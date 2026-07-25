// src/lib/geni/neighbourhoodMatchRead.ts
// GENI — the READ side of analytics.neighbourhood_match_stats (Phase-0 spine). Split out of
// neighbourhoodMatchStats.ts (which imports buildHubInput -> street-data -> server-only) so the
// matcher (Phase 2) and later phases can import the reader without dragging the server-only
// compute chain. Imports ONLY @/lib/db.
import { getAnalyticsDb } from "@/lib/db";

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
  computed_at: string;
}

/** Thin reader — plain SELECT *; numeric NUMERIC columns arrive as strings from neon. */
export async function getNeighbourhoodMatchStats(): Promise<NeighbourhoodMatchRow[]> {
  const a = getAnalyticsDb();
  if (!a) return [];
  try {
    return (await a`SELECT * FROM analytics.neighbourhood_match_stats ORDER BY neighbourhood_slug`) as NeighbourhoodMatchRow[];
  } catch {
    return [];
  }
}
