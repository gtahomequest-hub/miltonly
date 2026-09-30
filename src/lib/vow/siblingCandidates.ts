// The VOW half of resolveSiblingSlugs (MC-046). A street's slug variants ("…-st-…", "…-street-…")
// are matched across every source; the sold records and the analytics rows are two of those
// sources, and they are VOW data, so the street page no longer reads them (it matches its variants
// on DB1 listings alone). The cron-side callers (the generator input, the generation gate) still
// want every variant, and they run inside the door's scope, so they pass this in.

import "server-only";
import { soldDb, analyticsDb, scopedVowAccess } from "@/lib/vow/door";

/** Distinct street_slug values in DB2 and DB3 matching a LIKE pattern. Throws outside a scope. */
export async function vowSiblingCandidates(likePattern: string): Promise<string[]> {
  const access = scopedVowAccess();
  const sd = soldDb(access);
  const ad = analyticsDb(access);
  const [sold, stats] = await Promise.all([
    sd
      ? (sd`SELECT DISTINCT street_slug AS s FROM sold.sold_records WHERE street_slug LIKE ${likePattern}` as unknown as Promise<Array<{ s: string }>>).catch(() => [])
      : Promise.resolve([] as Array<{ s: string }>),
    ad
      ? (ad`SELECT DISTINCT street_slug AS s FROM analytics.street_sold_stats WHERE street_slug LIKE ${likePattern}` as unknown as Promise<Array<{ s: string }>>).catch(() => [])
      : Promise.resolve([] as Array<{ s: string }>),
  ]);
  return [...sold, ...stats].map((r) => r.s);
}
