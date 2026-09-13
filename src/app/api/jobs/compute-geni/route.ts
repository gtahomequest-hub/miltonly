// src/app/api/jobs/compute-geni/route.ts
// GENI Phase 0 — nightly refresh of analytics.neighbourhood_match_stats (DB2/geo -> DB3),
// mirroring compute-board. Auth via Authorization: Bearer <CRON_SECRET> OR ?secret=<CRON_SECRET>.
// PUBLIC-SAFE slow-moving per-neighbourhood match spine (no active listings, no authed price cols).
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { computeAndWriteNeighbourhoodMatchStats } from "@/lib/geni/neighbourhoodMatchStats";
import { DB_CACHE_TAG } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const secret = url.searchParams.get("secret");
  const expected = process.env.CRON_SECRET;
  if (!expected || (bearer !== expected && secret !== expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const rows = await computeAndWriteNeighbourhoodMatchStats();
    // MC-017: every DB3 read a page makes sits in the Data Cache under the db3 tag (src/lib/db.ts)
    // and the pages that made it are ISR; a run that wrote analytics rows drops the tag so the next
    // render reads what it just wrote. Pulled forward from MC-015.
    revalidateTag(DB_CACHE_TAG.ANALYTICS_DATABASE_URL);
    return NextResponse.json({ ok: true, dataCache: "revalidated", rows: rows.length, computedAt: rows[0]?.computed_at ?? null });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error).message ?? e) }, { status: 500 });
  }
}
