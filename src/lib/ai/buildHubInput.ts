// src/lib/ai/buildHubInput.ts
// WS4 (DEC-WS4, ADR 0002) — input builders for the urban_hub neighbourhood tier.
//
//   buildHubInput(neighbourhoodSlug)  — per-neighbourhood payload (deliverable 2)
//   buildMiltonWideContext()          — shared Milton-wide rollup (deliverable 3)
//
// Aggregation discipline is inherited verbatim from the WS3 / W2 street builder
// (src/lib/ai/buildGeneratorInput.ts): sale-side only, same k-anon thresholds
// (K_ANON_PRICE=5 typical, K_ANON_RANGE=10 range), quarterlyTrend ordered
// chronologically via sortKey = year*4 + quarter (W2 Step 5), single-trade
// quarters (count < 2) filtered out so the model can only narrate multi-trade
// signal. No aggregation logic is re-derived here — the SQL shapes mirror the
// live For-Sale aggregate query used by buildGeneratorInput.
//
// Dispatch: buildHubInput throws unless Neighbourhood.profile === 'urban_hub'
// (the 14 hubs). rural_hub / condo are WS4 patch 2 — not handled here.
//
// Server-scoped by construction (Prisma + Neon serverless HTTP). Never called at
// page-render time; consumed by WS5 generation orchestration + the WS4 fixtures.

import { prisma } from "@/lib/prisma";
import { getSoldDb } from "@/lib/db";
import { expandStreetName, shortNameFor } from "@/lib/street-data";
import type {
  HubGeneratorInput,
  HubAggregates,
  HubQuarter,
  HubTypeBucket,
  HubProjectedStreet,
  MiltonWideContext,
  KAnonLevel,
} from "@/types/hub-generator";

// K-anonymity thresholds — identical to buildGeneratorInput.ts / street-data.ts.
const K_ANON_PRICE = 5;
const K_ANON_RANGE = 10;

// Trend window. 30 months captures ~10 quarters of recent signal (matches the
// depth observed for hub-scale pools like Dempsey: 141 sales / 12mo).
const TREND_WINDOW_MONTHS = 30;

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

// ---------------------------------------------------------------------------
// Raw DB row shapes (local; not re-exported)
// ---------------------------------------------------------------------------

interface RawSaleAgg {
  n: number;
  lo: string | null;
  hi: string | null;
  avg_price: string | null;
  avg_dom: string | null;
}
interface RawTypeAgg {
  property_type: string;
  n: number;
  avg_price: string | null;
  min_price: string | null;
  max_price: string | null;
}
interface RawQuarterRow {
  yr: number;
  qtr: number;
  cnt: number;
  typical: string | null;
}
interface RawLeaseCount {
  n: number;
}

// ---------------------------------------------------------------------------
// Shared aggregate assembly — used by both buildHubInput and the Milton-wide
// rollup so the two sides of compared-to-milton are derived identically.
// ---------------------------------------------------------------------------

function assembleAggregates(
  sale: RawSaleAgg | null,
  leasesCount: number,
): HubAggregates {
  const salesCount = sale?.n ?? 0;
  const txCount = salesCount + leasesCount;

  const typicalRaw = num(sale?.avg_price ?? null);
  const typicalPrice = salesCount >= K_ANON_PRICE && typicalRaw !== null ? typicalRaw : null;

  const lo = num(sale?.lo ?? null);
  const hi = num(sale?.hi ?? null);
  const priceRange =
    salesCount >= K_ANON_RANGE && lo !== null && hi !== null
      ? { low: Math.round(lo), high: Math.round(hi) }
      : null;

  const domRaw = num(sale?.avg_dom ?? null);
  const daysOnMarket = domRaw !== null ? Math.round(domRaw) : null;

  const kAnonLevel: KAnonLevel =
    txCount === 0 ? "zero" : salesCount >= K_ANON_PRICE ? "full" : "thin";

  return {
    txCount,
    salesCount,
    leasesCount,
    typicalPrice: typicalPrice !== null ? Math.round(typicalPrice) : null,
    priceRange,
    daysOnMarket,
    kAnonLevel,
  };
}

function assembleQuarterly(rows: RawQuarterRow[]): HubQuarter[] {
  return rows
    .map((r) => {
      const typicalRaw = num(r.typical);
      return {
        quarter: `Q${r.qtr} ${r.yr}`,
        typical: typicalRaw !== null ? Math.round(typicalRaw) : null,
        count: r.cnt,
        sortKey: r.yr * 4 + r.qtr,
      };
    })
    // Single-trade quarters are anchoring landmines (DEC-PASS1-QUARTERTREND-FILTER,
    // carried to hub tier): drop count < 2 so the model narrates multi-trade signal.
    .filter((q) => q.count >= 2)
    .sort((a, b) => a.sortKey - b.sortKey);
}

function assembleByType(sales: RawTypeAgg[]): Record<string, HubTypeBucket> {
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

// ---------------------------------------------------------------------------
// SQL builders — sale-side aggregate / by-type / quarterly over a set of raw
// TREB neighbourhood strings. `null` rawStrings means Milton-wide (no filter).
// ---------------------------------------------------------------------------

function saleAggQuery(rawStrings: string[] | null) {
  return querySold<RawSaleAgg>((db) =>
    rawStrings
      ? db`SELECT COUNT(*)::int AS n, MIN(sold_price) AS lo, MAX(sold_price) AS hi,
                  AVG(sold_price) AS avg_price, AVG(days_on_market) AS avg_dom
           FROM sold.sold_records
           WHERE neighbourhood = ANY(${rawStrings}::text[])
             AND perm_advertise = TRUE AND transaction_type = 'For Sale'
             AND sold_date >= NOW() - INTERVAL '12 months'`
      : db`SELECT COUNT(*)::int AS n, MIN(sold_price) AS lo, MAX(sold_price) AS hi,
                  AVG(sold_price) AS avg_price, AVG(days_on_market) AS avg_dom
           FROM sold.sold_records
           WHERE perm_advertise = TRUE AND transaction_type = 'For Sale'
             AND sold_date >= NOW() - INTERVAL '12 months'`,
  );
}

function leaseCountQuery(rawStrings: string[] | null) {
  return querySold<RawLeaseCount>((db) =>
    rawStrings
      ? db`SELECT COUNT(*)::int AS n FROM sold.sold_records
           WHERE neighbourhood = ANY(${rawStrings}::text[])
             AND perm_advertise = TRUE AND transaction_type = 'For Lease'
             AND sold_date >= NOW() - INTERVAL '12 months'`
      : db`SELECT COUNT(*)::int AS n FROM sold.sold_records
           WHERE perm_advertise = TRUE AND transaction_type = 'For Lease'
             AND sold_date >= NOW() - INTERVAL '12 months'`,
  );
}

function quarterlyQuery(rawStrings: string[] | null) {
  return querySold<RawQuarterRow>((db) =>
    rawStrings
      ? db`SELECT EXTRACT(YEAR FROM sold_date)::int AS yr,
                  EXTRACT(QUARTER FROM sold_date)::int AS qtr,
                  COUNT(*)::int AS cnt, AVG(sold_price) AS typical
           FROM sold.sold_records
           WHERE neighbourhood = ANY(${rawStrings}::text[])
             AND perm_advertise = TRUE AND transaction_type = 'For Sale'
             AND sold_date >= NOW() - (INTERVAL '1 month' * ${TREND_WINDOW_MONTHS})
           GROUP BY yr, qtr ORDER BY yr, qtr`
      : db`SELECT EXTRACT(YEAR FROM sold_date)::int AS yr,
                  EXTRACT(QUARTER FROM sold_date)::int AS qtr,
                  COUNT(*)::int AS cnt, AVG(sold_price) AS typical
           FROM sold.sold_records
           WHERE perm_advertise = TRUE AND transaction_type = 'For Sale'
             AND sold_date >= NOW() - (INTERVAL '1 month' * ${TREND_WINDOW_MONTHS})
           GROUP BY yr, qtr ORDER BY yr, qtr`,
  );
}

function byTypeQuery(rawStrings: string[]) {
  return querySold<RawTypeAgg>((db) =>
    db`SELECT property_type, COUNT(*)::int AS n,
              AVG(sold_price) AS avg_price, MIN(sold_price) AS min_price, MAX(sold_price) AS max_price
       FROM sold.sold_records
       WHERE neighbourhood = ANY(${rawStrings}::text[])
         AND perm_advertise = TRUE AND transaction_type = 'For Sale'
         AND sold_date >= NOW() - INTERVAL '12 months'
       GROUP BY property_type`,
  );
}

// ---------------------------------------------------------------------------
// buildHubInput — deliverable 2.
// ---------------------------------------------------------------------------

export async function buildHubInput(neighbourhoodSlug: string): Promise<HubGeneratorInput> {
  const nbhd = await prisma.neighbourhood.findUnique({ where: { slug: neighbourhoodSlug } });
  if (!nbhd) throw new Error(`buildHubInput: no neighbourhood for slug "${neighbourhoodSlug}"`);
  // Dispatch keys on profile, never kind (DEC-WS4 scope correction). The two
  // thin-urban neighbourhoods are kind=urban but profile=rural_hub and must NOT
  // route here — they have no VIP pool + sub-k market depth.
  if (nbhd.profile !== "urban_hub") {
    throw new Error(
      `buildHubInput: "${neighbourhoodSlug}" has profile="${nbhd.profile}", expected "urban_hub". ` +
        `rural_hub / standard_no_hub are out of scope for this builder (WS4 patch 2).`,
    );
  }

  const rawStrings = nbhd.rawStrings;

  const [saleRows, leaseRows, quarterlyRows, byTypeRows, streets, activeListings] = await Promise.all([
    saleAggQuery(rawStrings),
    leaseCountQuery(rawStrings),
    quarterlyQuery(rawStrings),
    byTypeQuery(rawStrings),
    prisma.residentialStreet.findMany({
      where: { neighbourhoodId: nbhd.id },
      // currentRank order, VIP first (DEC-WS4-2). Nulls sort last.
      orderBy: [{ isVip: "desc" }, { currentRank: "asc" }],
      select: { slug: true, name: true, shortName: true, isVip: true, currentRank: true, soldCount12mo: true },
    }),
    prisma.listing.findMany({
      where: { neighbourhood: { in: rawStrings }, permAdvertise: true, status: "active" },
      select: { propertyType: true },
    }),
  ]);

  const aggregates = assembleAggregates(saleRows[0] ?? null, leaseRows[0]?.n ?? 0);
  const quarterlyTrend = assembleQuarterly(quarterlyRows);
  const byType = assembleByType(byTypeRows);

  const activeByType: Record<string, number> = {};
  for (const l of activeListings) {
    activeByType[l.propertyType] = (activeByType[l.propertyType] ?? 0) + 1;
  }

  const projectedStreets: HubProjectedStreet[] = streets.map((s) => ({
    slug: s.slug,
    // expandStreetName (WS3 carry-forward): clean display, never "Farmstead. Dr".
    displayName: expandStreetName(s.name),
    shortName: s.shortName ?? shortNameFor(expandStreetName(s.name)),
    isVip: s.isVip,
    currentRank: s.currentRank,
    soldCount12mo: s.soldCount12mo,
  }));

  return {
    neighbourhood: {
      slug: nbhd.slug,
      name: nbhd.name,
      profile: "urban_hub",
      kind: nbhd.kind,
      rawStrings,
    },
    aggregates,
    byType,
    quarterlyTrend,
    activeListingsCount: activeListings.length,
    activeByType,
    projectedStreets,
    vipStreetCount: projectedStreets.filter((s) => s.isVip).length,
    streetCount: projectedStreets.length,
    // schoolsCatchments DEPENDS-ON external Halton DSB + HCDSB data (gates WS5).
    schools: { sourced: false },
  };
}

// ---------------------------------------------------------------------------
// buildMiltonWideContext — deliverable 3. Computed ONCE per generation run and
// memoized (the 14 hubs share one rollup; recomputing per hub would run the
// same 1,859-row aggregate 14 times). Pass force=true to bypass the cache
// (fixtures / a fresh generation cycle).
// ---------------------------------------------------------------------------

let _miltonWideCache: Promise<MiltonWideContext> | null = null;

export function resetMiltonWideContextCache(): void {
  _miltonWideCache = null;
}

export function buildMiltonWideContext(force = false): Promise<MiltonWideContext> {
  if (!force && _miltonWideCache) return _miltonWideCache;
  const p = computeMiltonWideContext();
  if (!force) _miltonWideCache = p;
  return p;
}

async function computeMiltonWideContext(): Promise<MiltonWideContext> {
  const [saleRows, leaseRows, quarterlyRows, hubCount, activeCount] = await Promise.all([
    saleAggQuery(null),
    leaseCountQuery(null),
    quarterlyQuery(null),
    prisma.neighbourhood.count({ where: { profile: "urban_hub" } }),
    prisma.listing.count({ where: { permAdvertise: true, status: "active" } }),
  ]);

  return {
    scope: "milton-wide",
    aggregates: assembleAggregates(saleRows[0] ?? null, leaseRows[0]?.n ?? 0),
    quarterlyTrend: assembleQuarterly(quarterlyRows),
    activeListingsCount: activeCount,
    neighbourhoodCount: hubCount,
  };
}
