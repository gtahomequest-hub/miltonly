// src/app/api/jobs/compute-geni/route.ts
// GENI Phase 0 — nightly refresh of analytics.neighbourhood_match_stats (DB2/geo -> DB3),
// mirroring compute-board. Auth via Authorization: Bearer <CRON_SECRET> OR ?secret=<CRON_SECRET>.
// PUBLIC-SAFE slow-moving per-neighbourhood match spine (no active listings, no authed price cols).
import { NextResponse } from "next/server";
import { computeAndWriteNeighbourhoodMatchStats } from "@/lib/geni/neighbourhoodMatchStats";

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
    return NextResponse.json({ ok: true, rows: rows.length, computedAt: rows[0]?.computed_at ?? null });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error).message ?? e) }, { status: 500 });
  }
}
