// Nightly stats compute (11:30 UTC). Reads DB2 sold records, writes DB3 analytics.
// Fully decoupled from /api/sync/sold (Point 5) — runs on its own cron, so a
// failed sync doesn't block stats refresh against whatever data did land.
//
// Auth: Authorization: Bearer <CRON_SECRET> only, through the VOW door (MC-046 R16).

import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { soldDb, analyticsDb, vowSystemAccess, DB_CACHE_TAG } from "@/lib/vow/door";
import { computeAllStats } from "@/lib/sold-stats";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  const access = vowSystemAccess(req);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!soldDb(access) || !analyticsDb(access)) {
    return NextResponse.json(
      { error: "DB2 or DB3 is not configured" },
      { status: 503 }
    );
  }

  try {
    const summary = await computeAllStats(access);
    console.log(
      `[jobs/compute-sold-stats] ` +
      `streetsSale=${summary.streetsSale} streetsLease=${summary.streetsLease} ` +
      `nbhdsSale=${summary.neighbourhoodsSale} nbhdsLease=${summary.neighbourhoodsLease} ` +
      `duration=${summary.durationMs}ms`
    );
    // MC-017: every DB3 read a page makes sits in the Data Cache under the db3 tag (src/lib/vow/door.ts)
    // and the pages that made it are ISR; a run that wrote analytics rows drops the tag so the next
    // render reads what it just wrote. Pulled forward from MC-015.
    revalidateTag(DB_CACHE_TAG.ANALYTICS_DATABASE_URL);
    return NextResponse.json({ ok: true, dataCache: "revalidated", ...summary });
  } catch (err) {
    console.error("[jobs/compute-sold-stats] failed", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
