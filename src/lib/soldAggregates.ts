// src/lib/soldAggregates.ts
// INDEXABLE Milton-wide SOLD aggregate layer for /sold (A1). Public by design —
// these are k-anonymised AGGREGATES only (counts, medians, banded ranges). ZERO
// individual sold records, addresses, or per-transaction prices ever leave here;
// the raw records stay behind the VOW gate in sold-data.ts, unchanged.
//
// Discipline (matches the street/condo tiers):
//   - median/typical + DOM + sold-to-ask at k >= K_ANON_PRICE (5); suppress with
//     null, NEVER 0, NEVER a placeholder.
//   - a min/max-style range only at k >= K_ANON_RANGE (10) — here the honest
//     interquartile (p25–p75) band, so a lone luxury/rural sale can't skew it.
//   - DEC-SOLD-UPPER-BOUND: EVERY window carries `sold_date <= NOW()` alongside
//     the 12-month lower bound, so future-dated closings never inflate a figure.
//   - AGGREGATE KIND matches the linked sibling (DEC-GENI-1 consistency): the Milton-wide
//     overall + by-type + trend use the MEDIAN (== the homepage/Board top-level convention),
//     while each NEIGHBOURHOOD row uses the MEAN via the hub's own saleAggQuery (== the
//     /neighbourhoods/[slug] page it links to). No surface shows two "typical" prices one
//     click apart.
//   - deterministic — every number traces to one of these queries. No LLM.
//
// Computed ON-DEMAND from DB2 (sold.sold_records), NOT from the DB3
// analytics.neighbourhood_match_stats precompute: that table is empty in prod
// (compute-geni truncate-then-timeout), so depending on it would blank the
// neighbourhood table. Direct DB2 keeps every figure live + self-contained.

import "server-only";
import { getSoldDb } from "./db";
import { cached, CACHE_TTL } from "./cache";
import { prisma } from "./prisma";
import { config } from "./config";
import { NEIGHBOURHOOD_SEED } from "./neighbourhood";
// Reuse the EXACT hub aggregate query + assembly so the neighbourhood table can't drift
// from the /neighbourhoods/[slug] LIVE stat it links to (DEC-GENI-1 consistency precedent).
// (The hubs' generated prose/meta can carry older numbers — a hub-internal staleness, out
// of scope here; this binds /sold to the hub's live computed typical.)
import { saleAggQuery, assembleAggregates } from "./ai/buildHubInput";

const K_ANON_PRICE = 5;
const K_ANON_RANGE = 10;
const CITY = config.PRISMA_CITY_VALUE;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const x = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(x) ? x : null;
};
// Round to nearest $5k — the sitewide convention (homepageData + hubData both use
// round5k), so /sold figures render byte-identical to the homepage + hub pages.
const round5k = (v: number | null): number | null => (v === null ? null : Math.round(v / 5000) * 5000);

// ── OVERALL — Milton-wide, trailing 12 months ────────────────────────────
export interface SoldOverall {
  count: number;
  medianPrice: number | null; // k>=5
  bandLow: number | null; // p25, k>=10
  bandHigh: number | null; // p75, k>=10
  avgDom: number | null; // k>=5
  soldToAskPct: number | null; // k>=5, one decimal
}

export async function getMiltonSoldOverall(): Promise<SoldOverall> {
  const empty: SoldOverall = { count: 0, medianPrice: null, bandLow: null, bandHigh: null, avgDom: null, soldToAskPct: null };
  const db = getSoldDb();
  if (!db) return empty;
  return cached("sold-agg:overall-12mo", CACHE_TTL.stats, async () => {
    const rows = (await db`
      SELECT
        COUNT(*)::int AS n,
        PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY sold_price) AS median,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY sold_price) AS p25,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY sold_price) AS p75,
        AVG(days_on_market)   AS avg_dom,
        AVG(sold_to_ask_ratio) AS avg_sta
      FROM sold.sold_records
      WHERE city = ${CITY} AND perm_advertise = TRUE AND transaction_type = 'For Sale'
        AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()
    `) as Array<Record<string, unknown>>;
    const r = rows[0] ?? {};
    const n = num(r.n) ?? 0;
    const kPrice = n >= K_ANON_PRICE;
    const kRange = n >= K_ANON_RANGE;
    const sta = num(r.avg_sta);
    return {
      count: n,
      medianPrice: kPrice ? round5k(num(r.median)) : null,
      bandLow: kRange ? round5k(num(r.p25)) : null,
      bandHigh: kRange ? round5k(num(r.p75)) : null,
      avgDom: kPrice && num(r.avg_dom) !== null ? Math.round(num(r.avg_dom) as number) : null,
      soldToAskPct: kPrice && sta !== null ? Math.round(sta * 1000) / 10 : null,
    };
  });
}

// ── BY PROPERTY TYPE ─────────────────────────────────────────────────────
export interface SoldTypeRow {
  slug: "detached" | "semi" | "townhouse" | "condo";
  label: string;
  count: number;
  medianPrice: number | null; // k>=5
}
const TYPE_DEFS: Array<{ slug: SoldTypeRow["slug"]; label: string }> = [
  { slug: "detached", label: "Detached" },
  { slug: "semi", label: "Semi-detached" },
  { slug: "townhouse", label: "Townhouse" },
  { slug: "condo", label: "Condo" },
];

export async function getMiltonSoldByType(): Promise<SoldTypeRow[]> {
  const db = getSoldDb();
  if (!db) return [];
  return cached("sold-agg:by-type-12mo", CACHE_TTL.stats, async () => {
    const rows = (await db`
      SELECT property_type,
        COUNT(*)::int AS n,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) AS median
      FROM sold.sold_records
      WHERE city = ${CITY} AND perm_advertise = TRUE AND transaction_type = 'For Sale'
        AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()
      GROUP BY property_type
    `) as Array<Record<string, unknown>>;
    const by = new Map(rows.map((r) => [String(r.property_type), r]));
    return TYPE_DEFS.map((t) => {
      const r = by.get(t.slug);
      const n = r ? num(r.n) ?? 0 : 0;
      return {
        slug: t.slug,
        label: t.label,
        count: n,
        medianPrice: n >= K_ANON_PRICE && r ? round5k(num(r.median)) : null,
      };
    });
  });
}

// ── BY NEIGHBOURHOOD — one row per PUBLISHED hub, linked to /neighbourhoods/[slug]
export interface SoldNbhdRow {
  slug: string;
  name: string;
  count: number;
  // MEAN typical (NOT median). This row links to /neighbourhoods/{slug}, which renders the
  // k-safe MEAN (hubData.ts round5k(SUM/COUNT)); using the mean here — via the hub's own
  // saleAggQuery — keeps the two prices byte-identical one click apart (DEC-GENI-1).
  typicalPrice: number | null; // k>=5 (suppressed rows still render + still link)
}

export async function getMiltonSoldByNeighbourhood(): Promise<SoldNbhdRow[]> {
  const db = getSoldDb();
  if (!db) return [];
  return cached("sold-agg:by-nbhd-12mo-mean", CACHE_TTL.stats, async () => {
    // Published hubs are the link universe — the exact set the sitemap emits.
    const published = await prisma.hubContent.findMany({
      where: { status: "published" },
      select: { neighbourhoodSlug: true },
    });
    const seedBySlug = new Map(NEIGHBOURHOOD_SEED.map((s) => [s.slug, s]));
    const hubs = published
      .map((p) => seedBySlug.get(p.neighbourhoodSlug))
      .filter((s): s is (typeof NEIGHBOURHOOD_SEED)[number] => Boolean(s));

    const rows = await Promise.all(
      hubs.map(async (h) => {
        // Reuse the hub page's EXACT sale query + assembly. assembleAggregates applies the
        // SAME k-anon gate (typicalPrice null when <5) and mean the hub's live stat uses, so
        // this row's value == /neighbourhoods/{slug}'s live typical. round5k for clean display
        // (the hub's own sibling chips also round5k — hubData.ts:92).
        const sale = (await saleAggQuery(h.rawStrings))[0] ?? null;
        const agg = assembleAggregates(sale, 0);
        return {
          slug: h.slug,
          name: h.name,
          count: agg.salesCount,
          typicalPrice: agg.typicalPrice != null ? round5k(agg.typicalPrice) : null,
        } as SoldNbhdRow;
      })
    );
    // Busiest first; suppressed (k<5) sink to the bottom but still render + link.
    return rows.sort((a, b) => b.count - a.count);
  });
}

// ── QUARTERLY TREND — last 5 quarters ────────────────────────────────────
export interface SoldQuarterRow {
  label: string; // e.g. "Q3 2026"
  count: number;
  medianPrice: number | null; // k>=5
}

export async function getMiltonSoldQuarterly(): Promise<SoldQuarterRow[]> {
  const db = getSoldDb();
  if (!db) return [];
  return cached("sold-agg:quarterly", CACHE_TTL.stats, async () => {
    const rows = (await db`
      SELECT
        EXTRACT(YEAR FROM sold_date)::int AS y,
        EXTRACT(QUARTER FROM sold_date)::int AS q,
        COUNT(*)::int AS n,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) AS median
      FROM sold.sold_records
      WHERE city = ${CITY} AND perm_advertise = TRUE AND transaction_type = 'For Sale'
        AND sold_date >= NOW() - INTERVAL '18 months' AND sold_date <= NOW()
      GROUP BY 1, 2
      ORDER BY 1 DESC, 2 DESC
      LIMIT 5
    `) as Array<Record<string, unknown>>;
    return rows
      .map((r) => {
        const n = num(r.n) ?? 0;
        return {
          label: `Q${num(r.q)} ${num(r.y)}`,
          count: n,
          medianPrice: n >= K_ANON_PRICE ? round5k(num(r.median)) : null,
        } as SoldQuarterRow;
      })
      .reverse(); // oldest → newest for a left-to-right trend
  });
}

export interface SoldAggregatesData {
  overall: SoldOverall;
  byType: SoldTypeRow[];
  byNeighbourhood: SoldNbhdRow[];
  quarterly: SoldQuarterRow[];
}

export async function getMiltonSoldAggregates(): Promise<SoldAggregatesData> {
  const [overall, byType, byNeighbourhood, quarterly] = await Promise.all([
    getMiltonSoldOverall().catch(() => ({ count: 0, medianPrice: null, bandLow: null, bandHigh: null, avgDom: null, soldToAskPct: null }) as SoldOverall),
    getMiltonSoldByType().catch(() => [] as SoldTypeRow[]),
    getMiltonSoldByNeighbourhood().catch(() => [] as SoldNbhdRow[]),
    getMiltonSoldQuarterly().catch(() => [] as SoldQuarterRow[]),
  ]);
  return { overall, byType, byNeighbourhood, quarterly };
}
