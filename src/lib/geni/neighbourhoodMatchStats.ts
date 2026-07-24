// src/lib/geni/neighbourhoodMatchStats.ts
// GENI Phase 0 — nightly-precomputed, PUBLIC-SAFE per-neighbourhood match spine.
// One row per neighbourhood (24) in analytics.neighbourhood_match_stats (DB3),
// raw-SQL managed (mirrors board_stats). SLOW-MOVING signals ONLY.
//
// DEC-GENI-1: per-type price = the PUBLIC hub MEAN aggregate (saleAggQuery/byTypeQuery
//   + assembleAggregates/assembleByType from buildHubInput) — the SAME figure the hub
//   page renders, k-anon MEAN, sub-k -> NULL. analytics.neighbourhood_sold_stats
//   (avg_sold_* / avg_dom / avg_sold_to_ask, authed-only-by-policy) is NEVER read here.
// DEC-GENI-2: NO active listing counts (they go stale in a day; live at match time, Phase 2).
// DEC-GENI-3: GO/school distance = geo.ts NEIGHBOURHOOD_CENTROIDS + haversine over the
//   schools.ts roster (lat/lng schools only). Centroid-less neighbourhoods -> NULL, has_centroid=false.
// NULL-never-0: sub-k / absent price & DOM -> NULL (never 0). Volume counts are public (0 is real).
import { requireAnalyticsDb, getAnalyticsDb, getSoldDb } from "@/lib/db";
import { NEIGHBOURHOOD_SEED } from "@/lib/neighbourhood";
import { saleAggQuery, byTypeQuery, assembleAggregates, assembleByType } from "@/lib/ai/buildHubInput";
import { NEIGHBOURHOOD_CENTROIDS, GO_STATION, haversineKm } from "@/lib/geo";
import { schools } from "@/lib/schools";

export interface NeighbourhoodMatchRow {
  neighbourhood_slug: string;
  neighbourhood_name: string;
  profile: string;
  kind: string;
  typical_detached: number | null;
  typical_semi: number | null;
  typical_town: number | null;
  typical_condo: number | null;
  sold_12mo: number | null;
  sold_90d: number | null;
  dom_avg: number | null;
  has_centroid: boolean;
  dist_go_km: number | null;
  dist_nearest_school_km: number | null;
  nearest_school_name: string | null;
  computed_at: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Public 90-day SOLD count. This is a sold-side volume count (NOT active inventory —
// DEC-GENI-2), computed from public perm_advertise sold_records; not a hub figure.
async function sold90dCount(rawStrings: string[]): Promise<number | null> {
  const sd = getSoldDb();
  if (!sd) return null;
  try {
    const rows = (await sd`SELECT COUNT(*)::int AS n FROM sold.sold_records
      WHERE neighbourhood = ANY(${rawStrings}::text[])
        AND perm_advertise = TRUE AND transaction_type = 'For Sale'
        AND sold_date >= NOW() - INTERVAL '90 days' AND sold_date <= NOW()`) as Array<{ n: number }>;
    return rows[0]?.n ?? 0;
  } catch {
    return null;
  }
}

function centroidFor(rawStrings: string[]): { lat: number; lng: number } | null {
  for (const rs of rawStrings) {
    const c = NEIGHBOURHOOD_CENTROIDS[rs];
    if (c) return c;
  }
  return null;
}

function nearestSchool(lat: number, lng: number): { km: number; name: string } | null {
  let best: { km: number; name: string } | null = null;
  for (const s of schools) {
    if (typeof s.lat !== "number" || typeof s.lng !== "number") continue;
    const km = haversineKm(lat, lng, s.lat, s.lng);
    if (!best || km < best.km) best = { km, name: s.name };
  }
  return best;
}

export async function computeNeighbourhoodMatchRows(): Promise<NeighbourhoodMatchRow[]> {
  const out: NeighbourhoodMatchRow[] = [];
  const now = new Date().toISOString();
  for (const nb of NEIGHBOURHOOD_SEED) {
    const raw = nb.rawStrings;
    const [saleRows, byTypeRows, s90] = await Promise.all([
      saleAggQuery(raw), // reused hub query — sold.sold_records, public, k-anon
      byTypeQuery(raw), // reused hub query — per-type MEAN, public
      sold90dCount(raw),
    ]);
    const agg = assembleAggregates(saleRows[0] ?? null, 0); // leasesCount unused; only salesCount + DOM read
    const byType = assembleByType(byTypeRows);
    const centroid = centroidFor(raw);
    const go = centroid ? round2(haversineKm(centroid.lat, centroid.lng, GO_STATION.lat, GO_STATION.lng)) : null;
    const sch = centroid ? nearestSchool(centroid.lat, centroid.lng) : null;
    out.push({
      neighbourhood_slug: nb.slug,
      neighbourhood_name: nb.name,
      profile: nb.profile,
      kind: nb.kind,
      typical_detached: byType["detached"]?.typicalPrice ?? null, // k-anon MEAN; NULL if sub-k (never 0)
      typical_semi: byType["semi"]?.typicalPrice ?? null,
      typical_town: byType["townhouse"]?.typicalPrice ?? null,
      typical_condo: byType["condo"]?.typicalPrice ?? null,
      sold_12mo: agg.salesCount, // public sale count (0 is a real value)
      sold_90d: s90,
      dom_avg: agg.daysOnMarket, // NULL when no sales (assembleAggregates), never 0
      has_centroid: !!centroid,
      dist_go_km: go,
      dist_nearest_school_km: sch ? round2(sch.km) : null,
      nearest_school_name: sch ? sch.name : null,
      computed_at: now,
    });
  }
  return out;
}

export async function writeNeighbourhoodMatchStats(rows: NeighbourhoodMatchRow[]): Promise<void> {
  const a = requireAnalyticsDb();
  await a`CREATE TABLE IF NOT EXISTS analytics.neighbourhood_match_stats (
    neighbourhood_slug text PRIMARY KEY,
    neighbourhood_name text NOT NULL,
    profile text NOT NULL,
    kind text NOT NULL,
    typical_detached int,
    typical_semi int,
    typical_town int,
    typical_condo int,
    sold_12mo int,
    sold_90d int,
    dom_avg int,
    has_centroid boolean NOT NULL,
    dist_go_km numeric,
    dist_nearest_school_km numeric,
    nearest_school_name text,
    computed_at timestamptz NOT NULL DEFAULT NOW()
  )`;
  await a`TRUNCATE analytics.neighbourhood_match_stats`;
  for (const r of rows) {
    await a`INSERT INTO analytics.neighbourhood_match_stats
      (neighbourhood_slug, neighbourhood_name, profile, kind,
       typical_detached, typical_semi, typical_town, typical_condo,
       sold_12mo, sold_90d, dom_avg, has_centroid,
       dist_go_km, dist_nearest_school_km, nearest_school_name, computed_at)
      VALUES (${r.neighbourhood_slug}, ${r.neighbourhood_name}, ${r.profile}, ${r.kind},
       ${r.typical_detached}, ${r.typical_semi}, ${r.typical_town}, ${r.typical_condo},
       ${r.sold_12mo}, ${r.sold_90d}, ${r.dom_avg}, ${r.has_centroid},
       ${r.dist_go_km}, ${r.dist_nearest_school_km}, ${r.nearest_school_name}, NOW())`;
  }
}

export async function computeAndWriteNeighbourhoodMatchStats(): Promise<NeighbourhoodMatchRow[]> {
  const rows = await computeNeighbourhoodMatchRows();
  await writeNeighbourhoodMatchStats(rows);
  return rows;
}

// ── Reader (thin — plain SELECT *; later phases read through this) ──
export async function getNeighbourhoodMatchStats(): Promise<NeighbourhoodMatchRow[]> {
  const a = getAnalyticsDb();
  if (!a) return [];
  try {
    return (await a`SELECT * FROM analytics.neighbourhood_match_stats ORDER BY neighbourhood_slug`) as NeighbourhoodMatchRow[];
  } catch {
    return [];
  }
}
