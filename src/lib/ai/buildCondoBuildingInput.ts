// src/lib/ai/buildCondoBuildingInput.ts
// WS4 patch 2 (DEC-WS4-5, ADR 0002) — input builder for the CONDO BUILDING tier.
//
//   buildCondoBuildingInput(buildingSlug) → CondoBuildingGeneratorInput
//
// This is the real work of the patch. The defining discipline is the
// transaction_type SPLIT (entity-taxonomy spec, DEC-WS4-5): sale-side and
// lease-side aggregates are computed by SEPARATE building-keyed queries and
// NEVER merged. Mixing them is the `490 Gordon Krantz avg 2370` regression —
// monthly rents (~$2,400) averaged with sale prices (~$700K) produce a nonsense
// midpoint. The sale side feeds the market section + VIP; the lease side is
// purely informational and can never reach `recencyWeightedSold` or the market
// section.
//
// The SQL is building-keyed — `(street_number, street_slug)` per ADR 0001 DEC-4
// — NOT a parameterization of the neighbourhood query. It REUSES
// `assembleAggregates` / `assembleQuarterly` from buildHubInput verbatim (so the
// k-anon discipline is identical: K_ANON_PRICE=5 typical, K_ANON_RANGE=10 range).
// Building-tier k-anon bites far more often than neighbourhood tier — many
// buildings have a handful of sale trades — and that is correct (DEC-WS4-4).
//
// Server-scoped by construction (Prisma DB1 + Neon serverless HTTP for DB2).
// Consumed by WS5 generation orchestration + the WS4 fixtures.

import { prisma } from "@/lib/prisma";
import { getSoldDb } from "@/lib/db";
import {
  assembleAggregates,
  assembleQuarterly,
  type RawSaleAgg,
  type RawQuarterRow,
} from "@/lib/ai/buildHubInput";
import { groupCondoClusters, type CondoClusterRow } from "@/lib/condoIdentity";
import type {
  CondoBuildingGeneratorInput,
  CondoLeaseInfo,
  HubTypeBucket,
  KAnonLevel,
} from "@/types/hub-generator";

const K_ANON_PRICE = 5;
const K_ANON_RANGE = 10;
const TREND_WINDOW_MONTHS = 30;
const LEASE_RECORD_CAP = 10;

type SqlClient = NonNullable<ReturnType<typeof getSoldDb>>;

function querySold<T>(build: (db: SqlClient) => unknown): Promise<T[]> {
  const sd = getSoldDb();
  if (!sd) return Promise.resolve([] as T[]);
  return (build(sd) as Promise<T[]>).catch(() => [] as T[]);
}

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : null;
}

interface RawTypeAgg {
  property_type: string;
  n: number;
  avg_price: string | null;
  min_price: string | null;
  max_price: string | null;
}
interface RawLeaseRecord {
  street_number: string | null;
  street_name: string | null;
  rent: string | null;
  beds: number | null;
  days_on_market: number | null;
  sold_month: string | null;
}

// ---------------------------------------------------------------------------
// Cluster-union-keyed SQL. Every query filters property_type='condo' AND
// (street_number || '|' || street_slug) = ANY(keys) — the UNION of the
// canonical cluster's member (street_number, street_slug) pairs, NOT the single
// synthetic canonical pair. The canonicalizer (deriveCondoIdentity /
// groupCondoClusters) is wired into the backfill grouping AND here, so trades
// living under variant/misspelled member slugs (e.g. 6415's lease records under
// regional-road / reginal-road / regional-rd-25-road) roll up into the building
// they belong to instead of vanishing. SALE vs LEASE stay physically distinct
// queries (the transaction_type split); the union is only over street pairs.
// ---------------------------------------------------------------------------

function saleAggQuery(keys: string[]) {
  return querySold<RawSaleAgg>((db) =>
    db`SELECT COUNT(*)::int AS n, MIN(sold_price) AS lo, MAX(sold_price) AS hi,
              AVG(sold_price) AS avg_price, AVG(days_on_market) AS avg_dom
       FROM sold.sold_records
       WHERE property_type = 'condo'
         AND (street_number || '|' || street_slug) = ANY(${keys})
         AND perm_advertise = TRUE AND transaction_type = 'For Sale'
         AND sold_date >= NOW() - INTERVAL '12 months'
         AND sold_date <= NOW()`,
  );
}

// SEPARATE lease aggregate — count only. Lease values are NEVER passed into the
// sale aggregate; they exist solely to flag the lease side and gate per-trade
// lease claims. This is the structural barrier against the 490 Gordon Krantz mix.
function leaseAggQuery(keys: string[]) {
  return querySold<{ n: number; lo: string | null; hi: string | null }>((db) =>
    db`SELECT COUNT(*)::int AS n, MIN(sold_price) AS lo, MAX(sold_price) AS hi
       FROM sold.sold_records
       WHERE property_type = 'condo'
         AND (street_number || '|' || street_slug) = ANY(${keys})
         AND perm_advertise = TRUE AND transaction_type = 'For Lease'
         AND sold_date >= NOW() - INTERVAL '12 months'
         AND sold_date <= NOW()`,
  );
}

function saleByTypeQuery(keys: string[]) {
  return querySold<RawTypeAgg>((db) =>
    db`SELECT property_type, COUNT(*)::int AS n,
              AVG(sold_price) AS avg_price, MIN(sold_price) AS min_price, MAX(sold_price) AS max_price
       FROM sold.sold_records
       WHERE property_type = 'condo'
         AND (street_number || '|' || street_slug) = ANY(${keys})
         AND perm_advertise = TRUE AND transaction_type = 'For Sale'
         AND sold_date >= NOW() - INTERVAL '12 months'
         AND sold_date <= NOW()
       GROUP BY property_type`,
  );
}

function saleQuarterlyQuery(keys: string[]) {
  return querySold<RawQuarterRow>((db) =>
    db`SELECT EXTRACT(YEAR FROM sold_date)::int AS yr,
              EXTRACT(QUARTER FROM sold_date)::int AS qtr,
              COUNT(*)::int AS cnt, AVG(sold_price) AS typical
       FROM sold.sold_records
       WHERE property_type = 'condo'
         AND (street_number || '|' || street_slug) = ANY(${keys})
         AND perm_advertise = TRUE AND transaction_type = 'For Sale'
         AND sold_date >= NOW() - (INTERVAL '1 month' * ${TREND_WINDOW_MONTHS})
         AND sold_date <= NOW()
       GROUP BY yr, qtr ORDER BY yr, qtr`,
  );
}

// Recent lease records — PII-redacted to street# + streetName (no unit, no full
// address). Cap 10, most recent first. Fetched ONLY when the building's lease
// count clears k (≥5); below that the per-trade lease gate fires (W2 lease-side
// rule at building tier, DEC-WS4-5).
function leaseRecordQuery(keys: string[]) {
  return querySold<RawLeaseRecord>((db) =>
    db`SELECT street_number, street_name, sold_price AS rent, beds, days_on_market,
              to_char(sold_date, 'YYYY-MM') AS sold_month
       FROM sold.sold_records
       WHERE property_type = 'condo'
         AND (street_number || '|' || street_slug) = ANY(${keys})
         AND perm_advertise = TRUE AND transaction_type = 'For Lease'
         AND sold_date >= NOW() - INTERVAL '12 months'
       ORDER BY sold_date DESC
       LIMIT ${LEASE_RECORD_CAP}`,
  );
}

function assembleSaleByType(sales: RawTypeAgg[]): Record<string, HubTypeBucket> {
  const out: Record<string, HubTypeBucket> = {};
  for (const t of sales) {
    const count = t.n;
    const typicalRaw = num(t.avg_price);
    const lo = num(t.min_price);
    const hi = num(t.max_price);
    const kFlag: KAnonLevel = count === 0 ? "zero" : count >= K_ANON_PRICE ? "full" : "thin";
    out[t.property_type] = {
      count,
      typicalPrice: count >= K_ANON_PRICE && typicalRaw !== null ? Math.round(typicalRaw) : null,
      priceRange:
        count >= K_ANON_RANGE && lo !== null && hi !== null
          ? { low: Math.round(lo), high: Math.round(hi) }
          : null,
      kFlag,
    };
  }
  return out;
}

// Resolve the canonical cluster's MEMBER (street_number, street_slug) pairs as
// "number|slug" keys, by re-running the SAME canonicalizer the backfill uses
// over the live DB2 condo universe and selecting the cluster whose
// canonicalSlug === buildingSlug. Returns null if no cluster matches (caller
// falls back to the building's own key). Generation-only path — buildInput has
// no render-path caller, so the one grouped DB2 scan per build is acceptable.
async function resolveMemberKeys(buildingSlug: string): Promise<string[] | null> {
  const rows = await querySold<CondoClusterRow>((db) =>
    db`SELECT street_number, street_slug, COUNT(*)::int AS cnt
       FROM sold.sold_records
       WHERE property_type = 'condo'
         AND street_number IS NOT NULL AND street_slug IS NOT NULL
       GROUP BY street_number, street_slug`,
  );
  if (!rows.length) return null;
  const { clusters } = groupCondoClusters(rows);
  for (const c of Array.from(clusters.values())) {
    if (c.canonicalSlug === buildingSlug) {
      return Array.from(new Set(c.rows.map((r: CondoClusterRow) => `${r.street_number}|${r.street_slug}`)));
    }
  }
  return null;
}

// Placeholder-attribute scrub. DB2 writes literal "000" / "0" / "N/A" into the
// management-company and condo-corp-number fields when the source MLS record
// carries no real value. These must never reach the prompt — the generator
// otherwise bakes "managed by 000" / "corporation number is 0" into the
// published prose, and the renderer (CondoData) has no management/corp field to
// strip it at display time. Cleaning at the input is the only durable fix.
const PLACEHOLDER_ATTR = new Set(["", "0", "00", "000", "0000", "n/a", "na", "none", "null", "-"]);
function scrubAttr(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === "" || PLACEHOLDER_ATTR.has(t.toLowerCase()) ? null : t;
}
function scrubCorpNumbers(arr: string[] | null | undefined): string[] {
  return (arr ?? [])
    .map((s) => (s ?? "").trim())
    .filter((s) => s !== "" && !PLACEHOLDER_ATTR.has(s.toLowerCase()));
}

// ---------------------------------------------------------------------------
// buildCondoBuildingInput — deliverable B1.
// ---------------------------------------------------------------------------

export async function buildCondoBuildingInput(
  buildingSlug: string,
): Promise<CondoBuildingGeneratorInput> {
  const b = await prisma.condoBuilding.findUnique({
    where: { slug: buildingSlug },
    include: { neighbourhoodEntity: { select: { name: true } } },
  });
  if (!b) throw new Error(`buildCondoBuildingInput: no CondoBuilding for slug "${buildingSlug}"`);
  if (!b.streetNumber || !b.streetSlug) {
    throw new Error(
      `buildCondoBuildingInput: "${buildingSlug}" is missing the (streetNumber, streetSlug) key ` +
        `(streetNumber=${b.streetNumber}, streetSlug=${b.streetSlug}); cannot key the building SQL.`,
    );
  }

  // Union of the cluster's member street-keys (variant/misspelled slugs roll up
  // onto this canonical building); fall back to the building's own key if the
  // cluster can't be resolved (e.g. a lone building absent from the DB2 universe).
  const memberKeys = (await resolveMemberKeys(buildingSlug)) ?? [`${b.streetNumber}|${b.streetSlug}`];

  const [saleRows, leaseRows, saleByTypeRows, saleQuarterRows] = await Promise.all([
    saleAggQuery(memberKeys),
    leaseAggQuery(memberKeys),
    saleByTypeQuery(memberKeys),
    saleQuarterlyQuery(memberKeys),
  ]);

  const leaseCount = leaseRows[0]?.n ?? 0;

  // SALE aggregate — assembled from the SALE query ONLY. leaseCount is passed so
  // txCount/kAnonLevel are meaningful, but typicalPrice/priceRange/DOM derive
  // exclusively from sale.avg_price etc. (assembleAggregates never reads a lease
  // field). This is the line the 490 Gordon Krantz regression crossed.
  const saleAggregates = assembleAggregates(saleRows[0] ?? null, leaseCount);
  const saleByType = assembleSaleByType(saleByTypeRows);
  const saleQuarterly = assembleQuarterly(saleQuarterRows);

  // LEASE side — informational. recentRecords only at k≥5 (gates the per-trade
  // lease rule); rangeStats only at k≥10 (anti-fingerprinting).
  const leaseKAnon: KAnonLevel =
    leaseCount === 0 ? "zero" : leaseCount >= K_ANON_PRICE ? "full" : "thin";
  const lease: CondoLeaseInfo = { leaseCount12mo: leaseCount, kAnonLevel: leaseKAnon };
  if (leaseCount >= K_ANON_PRICE) {
    const recs = await leaseRecordQuery(memberKeys);
    lease.recentRecords = recs.map((r) => ({
      address: `${r.street_number ?? ""} ${r.street_name ?? ""}`.trim(),
      rent: Math.round(num(r.rent) ?? 0),
      beds: r.beds ?? 0,
      daysOnMarket: r.days_on_market ?? 0,
      soldMonth: r.sold_month ?? "",
    }));
    if (leaseCount >= K_ANON_RANGE) {
      const lo = num(leaseRows[0]?.lo ?? null);
      const hi = num(leaseRows[0]?.hi ?? null);
      if (lo !== null && hi !== null) lease.rangeStats = { min: Math.round(lo), max: Math.round(hi) };
    }
  }

  // Fork (DEC-WS4-5). saleActive / leaseOnly are COMPLEMENTARY, keyed on the
  // 12-month sale count alone — the only signal that grounds a current sale
  // market section (saleAggQuery's window is 12 months; with saleCount12mo===0
  // typicalPrice is null and there is nothing to ground regardless of history).
  //
  // Deviation from the DEC-WS4-5 prose "sale-active (saleCount12mo > 0 /
  // recencyWeightedSold > 0)": a building with ONLY historical sales (>12mo;
  // recencyWeightedSold>0 but saleCount12mo===0 — e.g. 490 Gordon Krantz, now
  // lease-only) would otherwise be BOTH saleActive and leaseOnly, making
  // vipEligible true on a lease-only building. That contradicts "lease-only is
  // NEVER VIP" (ADR 0001 DEC-5). Keying on saleCount12mo makes the fork
  // mutually exclusive; a grandfathered-VIP building still surfaces its sticky
  // status via `isVip` (the DB field), but is not freshly VIP-ELIGIBLE while it
  // has no current sale data. Documented in ADR 0002 patch-2 addendum.
  const saleActive = b.saleCount12mo > 0;
  const leaseOnly = b.saleCount12mo === 0;

  return {
    building: {
      slug: b.slug,
      displayName: b.displayName ?? b.buildingAddress ?? b.slug,
      buildingAddress: b.buildingAddress,
      streetNumber: b.streetNumber,
      streetName: b.streetName,
      streetSlug: b.streetSlug,
      neighbourhoodName: b.neighbourhoodEntity?.name ?? b.neighbourhood ?? null,
      totalUnits: b.totalUnits,
      legalStories: b.legalStories,
      managementCo: scrubAttr(b.managementCo),
      avgMaintenanceFee: b.avgMaintenanceFee,
      yearBuilt: b.yearBuilt,
      condoCorpNumbers: scrubCorpNumbers(b.condoCorpNumbers),
    },
    saleAggregates,
    saleByType,
    saleQuarterly,
    lease,
    saleActive,
    leaseOnly,
    // Lease-only buildings are NEVER VIP (ADR 0001 DEC-5; schema keeps isVip
    // false). vipEligible mirrors saleActive — only sale-active buildings can be
    // scored by the existing recency-weighted classifier.
    vipEligible: saleActive,
    isVip: b.isVip,
    currentRank: b.currentRank,
    recencyWeightedSold: b.recencyWeightedSold,
  };
}
