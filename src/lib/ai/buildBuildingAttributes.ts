// src/lib/ai/buildBuildingAttributes.ts
// CONDO TIER — BUILD A: the aggregation mechanism (data/library only; NO render, NO
// condoData wiring, NO CONDO_ENABLED, NO generation trigger). Computes the 4 Gate-A rulings
// + gross yield + area-context over the building's DB2 sold-records CLUSTER (member-key union,
// the SAME key the stats use — resolveMemberKeys / groupCondoClusters).
//
// The four folds run over the building's SOLD RECORDS (the DB2 sold.sold_records cluster),
// NOT active Listings — the DB1 Listing model carries none of these building attributes
// (Gate A recon). All four attribute columns are AMPRE-mapped (vow-sync.ts).
//
// VOW/k-anon (ratified): typical k>=5, range k>=10 (K_ANON_RANGE), identity-only below k>=3.
// The attribute folds carry NO per-unit price (building facts). Price/yield medians are k-gated
// (median suppressed to null below k>=5) and computed in SQL via PERCENTILE_CONT so individual
// sold prices never enter JS. SALE and LEASE stay separate queries (the 490-Gordon-Krantz mix
// barrier). The returned payload holds no individual sold row and no sub-k price stat.
import { prisma } from "@/lib/prisma";
import { getSoldDb } from "@/lib/db";
import { groupCondoClusters, type CondoClusterRow } from "@/lib/condoIdentity";
import { getNeighbourhoodMatchStats } from "@/lib/geni/neighbourhoodMatchRead";

const K_TYPICAL = 5;
const K_RANGE = 10;
const K_IDENTITY = 3;

type SqlClient = NonNullable<ReturnType<typeof getSoldDb>>;
function querySold<T>(build: (db: SqlClient) => unknown): Promise<T[]> {
  const sd = getSoldDb();
  if (!sd) return Promise.resolve([] as T[]);
  return (build(sd) as Promise<T[]>).catch(() => [] as T[]);
}

// ── types ──────────────────────────────────────────────────────────────────
// The public shape lives in a server-free module so the 'use client' render page can import it.
import type { AmenityCount, BuildingAttributes } from "./buildingAttributes.types";
export type { AmenityCount, BuildingAttributes } from "./buildingAttributes.types";

interface RawAttrRow {
  building_amenities: string | null;
  association_amenities: string[] | null;
  association_fee_includes: string | null;
  property_management_company: string | null;
  association_name: string | null;
  transaction_type: string | null;
  sold_date: string | null;
}

const PLACEHOLDER = new Set(["", "0", "00", "000", "n/a", "na", "none", "null", "-", "unknown", "tba", "tbd", "tbc", "pending", "n / a"]);
const isPlaceholder = (s: string) => PLACEHOLDER.has(s.trim().toLowerCase());

/** array (text[]) or ", "-joined text → clean, deduped items for ONE record */
function splitMulti(v: string[] | string | null): string[] {
  if (v == null) return [];
  const parts = Array.isArray(v) ? v : String(v).split(/\s*[,;|/]\s*/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    const t = (raw ?? "").trim();
    if (!t || isPlaceholder(t)) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}
const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Count DISTINCT records that mention each item; keep a display casing (first seen).
function tallyByRecord(perRecord: string[][]): Map<string, { display: string; count: number }> {
  const m = new Map<string, { display: string; count: number }>();
  for (const rec of perRecord) {
    const keysThisRecord = Array.from(new Set(rec.map(normKey)));
    for (const k of keysThisRecord) {
      const disp = rec.find((x) => normKey(x) === k)!;
      const e = m.get(k);
      if (e) e.count += 1;
      else m.set(k, { display: disp, count: 1 });
    }
  }
  return m;
}

// ── RULING 1: AMENITIES — render if on >=2 of the building's sold records ────
function foldAmenities(rows: RawAttrRow[]): BuildingAttributes["amenities"] {
  const perRecord = rows.map((r) => {
    const u = new Set<string>();
    for (const a of splitMulti(r.building_amenities)) u.add(a);
    for (const a of splitMulti(r.association_amenities)) u.add(a);
    return Array.from(u);
  });
  const recordsWithAny = perRecord.filter((r) => r.length).length;
  const tally = tallyByRecord(perRecord);
  const detail = Array.from(tally.values())
    .map((e) => ({ amenity: e.display, count: e.count }))
    .sort((a, b) => b.count - a.count || a.amenity.localeCompare(b.amenity));
  const rendered = detail.filter((d) => d.count >= 2).map((d) => d.amenity);
  return {
    rendered,
    detail,
    recordsWithAny,
    note: rendered.length ? null : "no amenity appears on >=2 sold records",
    label: "amenities as recorded on MLS sales",
  };
}

// ── RULING 2: FEE-INCLUDES — association_fee_includes (SALE side), items in >=half ──
function foldFeeIncludes(rows: RawAttrRow[]): BuildingAttributes["feeIncludes"] {
  const perRecord = rows.map((r) => splitMulti(r.association_fee_includes)).filter((r) => r.length);
  const recordsCarrying = perRecord.length;
  const threshold = Math.ceil(recordsCarrying / 2); // >= half
  const tally = tallyByRecord(perRecord);
  const detail = Array.from(tally.values())
    .map((e) => ({ amenity: e.display, count: e.count }))
    .sort((a, b) => b.count - a.count || a.amenity.localeCompare(b.amenity));
  // DEC-CONDO-2 noise floor: fee-includes is a financial claim. Require >=3 records to CARRY
  // fee data before stating anything, and each item must appear in >=2 records AND >=half of
  // carriers. Below the building floor → "not stated" (a single agent's list is not a fact).
  if (recordsCarrying < 3) {
    return { items: [], detail, recordsCarrying, threshold, stated: false, note: "not stated — confirm with management (fewer than 3 sold records state the fee inclusions)" };
  }
  const items = detail.filter((d) => d.count >= 2 && d.count >= threshold).map((d) => d.amenity);
  return {
    items,
    detail,
    recordsCarrying,
    threshold,
    stated: items.length > 0,
    note: items.length ? null : "not stated — confirm with management",
  };
}

// ── RULING 3: MANAGEMENT — modal + outlier drop (phone/number-only, typos, lone outliers) ──
const PHONE_ONLY = /^[\s\d().+\-x/]*\d[\s\d().+\-x/]*$/i; // value that is only digits/phone punctuation
const MGMT_GENERIC = /\b(condominium|condo|corporation|corp|services?|service|property|management|mgmt|inc|ltd|llc|group|company|co|the|of|and)\b/gi;
function mgmtBrandKey(v: string): string {
  return v.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(MGMT_GENERIC, " ").replace(/\s+/g, " ").trim();
}
// modal-after-brand-merge over a set of values → {display, groups} (groups = distinct brand
// buckets, so groups-1 = outlier/typo variants dropped).
function modalBrand(values: string[]): { display: string | null; groups: number; modalCount: number } {
  if (!values.length) return { display: null, groups: 0, modalCount: 0 };
  const brand = new Map<string, { count: number; display: Map<string, number> }>();
  for (const v of values) {
    const k = mgmtBrandKey(v) || v.toLowerCase();
    const e = brand.get(k) ?? { count: 0, display: new Map<string, number>() };
    e.count += 1;
    e.display.set(v, (e.display.get(v) ?? 0) + 1);
    brand.set(k, e);
  }
  const modal = Array.from(brand.entries()).sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))[0];
  const display = Array.from(modal[1].display.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  return { display, groups: brand.size, modalCount: modal[1].count };
}

const MGMT_RECENT_N = 6; // modal over the most-recent N records = "current" manager

// DEC-CONDO-3: management is POINT-IN-TIME. After the outlier drop (phone/typo/junk/TBA/TBD),
// pick the modal over the MOST-RECENT N=6 records (recency-ordered) — a record-count window, NOT
// a calendar window: a dense/new building can have its whole history inside 24 months (830 megson,
// which switched Howland Green → CIE in early 2025), so a calendar window can't isolate the switch.
// The most-recent-N modal flips to the new manager only once it dominates the recent window (so a
// single stray record can't flip it), and leaves stable buildings untouched. Falls back to the
// all-time modal when fewer than 2 dated records exist.
function foldManagement(records: Array<{ value: string; soldDate: string | null }>): BuildingAttributes["management"] {
  const clean = records
    .map((r) => ({ value: r.value.trim(), soldDate: r.soldDate }))
    .filter((r) => r.value && !isPlaceholder(r.value) && !PHONE_ONLY.test(r.value));
  const rawCounts = new Map<string, number>();
  for (const r of clean) rawCounts.set(r.value, (rawCounts.get(r.value) ?? 0) + 1);
  const rawTop = Array.from(rawCounts.entries())
    .map(([value, count]) => ({ amenity: value, count }))
    .sort((a, b) => b.count - a.count || a.amenity.localeCompare(b.amenity));
  if (!clean.length) {
    return { company: null, allTimeCompany: null, window: "none", recentCount: 0, mostRecent: null, rawTop, note: "no valid management company on record" };
  }
  const allTime = modalBrand(clean.map((r) => r.value));
  const dated = clean.filter((r) => r.soldDate).sort((a, b) => Date.parse(b.soldDate!) - Date.parse(a.soldDate!));
  const mostRecent = dated[0]?.value ?? null;
  const recentSet = dated.slice(0, MGMT_RECENT_N);
  const useRecent = recentSet.length >= 2;
  const chosen = useRecent ? modalBrand(recentSet.map((r) => r.value)) : allTime;
  const changed = !!(allTime.display && chosen.display && mgmtBrandKey(allTime.display) !== mgmtBrandKey(chosen.display));
  const droppedOutliers = chosen.groups - 1;
  const parts: string[] = [];
  parts.push(useRecent ? `current = modal of most-recent ${recentSet.length} record(s)` : "all-time modal (fewer than 2 dated records)");
  if (changed) parts.push(`manager CHANGED — all-time modal was "${allTime.display}"`);
  if (droppedOutliers > 0) parts.push(`dropped ${droppedOutliers} outlier/typo variant(s) in-window`);
  else if (chosen.modalCount < 2) parts.push("single record — low confidence");
  return {
    company: chosen.display,
    allTimeCompany: allTime.display,
    window: useRecent ? "recent" : "all-time",
    recentCount: recentSet.length,
    mostRecent,
    rawTop,
    note: parts.join("; ") || null,
  };
}

// ── RULING 4: BUILDING NAME — modal association_name with corp-legal-name REJECTOR ──
const CORP_REJECT =
  /condominium\s+corp|condominium\s+corporation|\bcorporation\s+no|\bplan\s+no|\bno\.?\s*\d+\b|\b[a-z]{0,4}s?cc\s*(?:no|#|\d)|\b(?:hcc|mcc|mscc|hscc|pscc|tscc|ycc|pcc|dscc|wscc)\b|standard\s+condominium|common\s+element/i;
function foldName(values: string[], addressFallback: string): BuildingAttributes["buildingName"] {
  const clean = values.map((v) => v.trim()).filter((v) => v && !isPlaceholder(v));
  const counts = new Map<string, number>();
  for (const v of clean) counts.set(v, (counts.get(v) ?? 0) + 1);
  const rawTop = Array.from(counts.entries())
    .map(([value, count]) => ({ amenity: value, count }))
    .sort((a, b) => b.count - a.count || a.amenity.localeCompare(b.amenity));
  if (!clean.length) {
    return { name: addressFallback, source: "address", isRealName: false, rawTop, note: "no association_name on record" };
  }
  const modal = rawTop[0].amenity;
  if (CORP_REJECT.test(modal)) {
    return { name: addressFallback, source: "address", isRealName: false, rawTop, note: `corp-legal-name rejected ("${modal}") → address fallback` };
  }
  return { name: modal, source: "association_name", isRealName: true, rawTop, note: null };
}

// ── main ─────────────────────────────────────────────────────────────────────
async function resolveMemberKeys(buildingSlug: string): Promise<string[] | null> {
  const rows = await querySold<CondoClusterRow>((db) =>
    db`SELECT street_number, street_slug, COUNT(*)::int AS cnt
       FROM sold.sold_records
       WHERE property_type='condo' AND street_number IS NOT NULL AND street_slug IS NOT NULL
       GROUP BY street_number, street_slug`,
  );
  if (!rows.length) return null;
  const { clusters } = groupCondoClusters(rows);
  for (const c of Array.from(clusters.values())) {
    if (c.canonicalSlug === buildingSlug) {
      return Array.from(new Set(c.rows.map((r) => `${r.street_number}|${r.street_slug}`)));
    }
  }
  return null;
}

function medianQuery(keys: string[], tx: "For Sale" | "For Lease") {
  return querySold<{ n: number; med: string | null }>((db) =>
    db`SELECT COUNT(*)::int AS n,
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) AS med
       FROM sold.sold_records
       WHERE property_type='condo' AND (street_number || '|' || street_slug) = ANY(${keys})
         AND perm_advertise=TRUE AND transaction_type=${tx}
         AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()
         AND sold_price IS NOT NULL`,
  );
}
function medianByBedQuery(keys: string[], tx: "For Sale" | "For Lease") {
  return querySold<{ beds: number; n: number; med: string | null }>((db) =>
    db`SELECT beds, COUNT(*)::int AS n,
              PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) AS med
       FROM sold.sold_records
       WHERE property_type='condo' AND (street_number || '|' || street_slug) = ANY(${keys})
         AND perm_advertise=TRUE AND transaction_type=${tx}
         AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()
         AND sold_price IS NOT NULL AND beds IS NOT NULL
       GROUP BY beds ORDER BY beds`,
  );
}

const numOrNull = (v: string | null): number | null => (v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export async function buildBuildingAttributes(buildingSlug: string): Promise<BuildingAttributes> {
  const b = await prisma.condoBuilding.findUnique({
    where: { slug: buildingSlug },
    include: { neighbourhoodEntity: { select: { slug: true, name: true } } },
  });
  if (!b) throw new Error(`buildBuildingAttributes: no CondoBuilding for slug "${buildingSlug}"`);
  if (!b.streetNumber || !b.streetSlug) {
    throw new Error(`buildBuildingAttributes: "${buildingSlug}" missing (streetNumber, streetSlug) stats key`);
  }
  const addressFallback = b.displayName ?? b.buildingAddress ?? b.slug;
  const clusterKeys = (await resolveMemberKeys(buildingSlug)) ?? [`${b.streetNumber}|${b.streetSlug}`];

  // ONE attribute query (no price) — building facts only.
  const attrRows = await querySold<RawAttrRow>((db) =>
    db`SELECT building_amenities, association_amenities, association_fee_includes,
              property_management_company, association_name, transaction_type, sold_date
       FROM sold.sold_records
       WHERE property_type='condo' AND (street_number || '|' || street_slug) = ANY(${clusterKeys})
         AND perm_advertise=TRUE`,
  );

  // Price/yield medians — SQL PERCENTILE_CONT, prices never enter JS.
  const [saleMed, leaseMed, saleBed, leaseBed] = await Promise.all([
    medianQuery(clusterKeys, "For Sale"),
    medianQuery(clusterKeys, "For Lease"),
    medianByBedQuery(clusterKeys, "For Sale"),
    medianByBedQuery(clusterKeys, "For Lease"),
  ]);

  // record counts
  const cutoff = Date.now() - 365 * 24 * 3600 * 1000;
  const recent = (r: RawAttrRow) => (r.sold_date ? Date.parse(r.sold_date) >= cutoff : false);
  const saleAll = attrRows.filter((r) => r.transaction_type === "For Sale").length;
  const leaseAll = attrRows.filter((r) => r.transaction_type === "For Lease").length;
  const sale12mo = saleMed[0]?.n ?? attrRows.filter((r) => r.transaction_type === "For Sale" && recent(r)).length;
  const lease12mo = leaseMed[0]?.n ?? attrRows.filter((r) => r.transaction_type === "For Lease" && recent(r)).length;

  const kFloors = {
    saleTypical: sale12mo >= K_TYPICAL,
    saleRange: sale12mo >= K_RANGE,
    leaseTypical: lease12mo >= K_TYPICAL,
    identityOnly: sale12mo < K_IDENTITY && lease12mo < K_IDENTITY,
  };

  // folds
  const amenities = foldAmenities(attrRows);
  const feeIncludes = foldFeeIncludes(attrRows);
  const management = foldManagement(
    attrRows
      .map((r) => ({ value: r.property_management_company ?? "", soldDate: r.sold_date }))
      .filter((r) => r.value),
  );
  const buildingName = foldName(attrRows.map((r) => r.association_name ?? "").filter(Boolean), addressFallback);

  // ── YIELD (DEC-CONDO-4) — k-gated both sides; median x12 / median ──
  const saleMedianRaw = numOrNull(saleMed[0]?.med ?? null);
  const leaseMedianRaw = numOrNull(leaseMed[0]?.med ?? null);
  const saleMedian = kFloors.saleTypical ? saleMedianRaw : null; // suppress below k>=5
  const leaseMedian = kFloors.leaseTypical ? leaseMedianRaw : null;
  const headlinePct =
    saleMedian && leaseMedian ? Math.round(((leaseMedian * 12) / saleMedian) * 1000) / 10 : null;
  const bedMap = new Map<number, { saleMedian: number | null; leaseMedian: number | null; saleN: number; leaseN: number }>();
  for (const s of saleBed) bedMap.set(s.beds, { saleMedian: numOrNull(s.med), leaseMedian: null, saleN: s.n, leaseN: 0 });
  for (const l of leaseBed) {
    const e = bedMap.get(l.beds) ?? { saleMedian: null, leaseMedian: null, saleN: 0, leaseN: 0 };
    e.leaseMedian = numOrNull(l.med);
    e.leaseN = l.n;
    bedMap.set(l.beds, e);
  }
  const perBed = Array.from(bedMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([beds, e]) => {
      const okSale = e.saleN >= K_TYPICAL ? e.saleMedian : null;
      const okLease = e.leaseN >= K_TYPICAL ? e.leaseMedian : null;
      const yieldPct = okSale && okLease ? Math.round(((okLease * 12) / okSale) * 1000) / 10 : null;
      return { beds, yieldPct, saleMedian: okSale, leaseMedian: okLease, saleN: e.saleN, leaseN: e.leaseN };
    });
  const gyield = {
    headlinePct,
    saleMedian,
    leaseMedian,
    perBed,
    note:
      headlinePct != null
        ? null
        : !kFloors.saleTypical
          ? "sale sample below k>=5 — headline yield suppressed; see area context"
          : !kFloors.leaseTypical
            ? "lease sample below k>=5 — headline yield suppressed"
            : "insufficient paired comps",
  };

  // ── AREA-CONTEXT (DEC-CONDO-6) — reuse the k-safe neighbourhood typical_condo ──
  let typicalCondo: number | null = null;
  const nbhdSlug = b.neighbourhoodEntity?.slug ?? null;
  const nbhdName = b.neighbourhoodEntity?.name ?? b.neighbourhood ?? null;
  if (nbhdSlug) {
    const stats = await getNeighbourhoodMatchStats();
    const row = stats.find((s) => s.neighbourhood_slug === nbhdSlug) ?? stats.find((s) => s.neighbourhood_name === nbhdName);
    typicalCondo = row?.typical_condo ?? null;
  }
  const areaContext = {
    neighbourhoodSlug: nbhdSlug,
    neighbourhoodName: nbhdName,
    typicalCondo,
    label:
      typicalCondo != null
        ? `condos in ${nbhdName} typically sell around $${Math.round(typicalCondo).toLocaleString()}`
        : `neighbourhood condo typical not available for ${nbhdName ?? "this area"}`,
  };

  return {
    slug: b.slug,
    displayName: addressFallback,
    clusterKeys,
    records: { total: attrRows.length, saleAll, leaseAll, sale12mo, lease12mo },
    kFloors,
    amenities,
    feeIncludes,
    management,
    buildingName,
    gyield,
    areaContext,
    vow: { hasIndividualPrice: false, subKPriceSuppressed: !kFloors.saleTypical || !kFloors.leaseTypical },
    _debug: {
      amenitiesPerRecord: attrRows.map((r) => Array.from(new Set([...splitMulti(r.building_amenities), ...splitMulti(r.association_amenities)]))),
      feePerRecord: attrRows.map((r) => splitMulti(r.association_fee_includes)).filter((x) => x.length),
      mgmtValues: attrRows.map((r) => r.property_management_company ?? "").filter(Boolean),
      nameValues: attrRows.map((r) => r.association_name ?? "").filter(Boolean),
    },
  };
}
