// src/app/api/jobs/compute-board/route.ts
// Nightly Board refresh (DB2 -> DB3), mirroring compute-sold-stats. Auth via
// Authorization: Bearer <CRON_SECRET> only, through the VOW door (MC-046 R16). Recomputes
// analytics.board_stats for all tabs.
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { computeAndWriteBoard } from "@/lib/board/computeBoard";
import { DB_CACHE_TAG, vowSystemAccess } from "@/lib/vow/door";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const access = vowSystemAccess(req);
  if (!access) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const tabs = await computeAndWriteBoard(access);
    // MC-017: every DB3 read a page makes sits in the Data Cache under the db3 tag (src/lib/vow/door.ts)
    // and the pages that made it are ISR; a run that wrote analytics rows drops the tag so the next
    // render reads what it just wrote. Pulled forward from MC-015.
    revalidateTag(DB_CACHE_TAG.ANALYTICS_DATABASE_URL);
    return NextResponse.json({ ok: true, dataCache: "revalidated", tabs: tabs.length, dataThrough: tabs[0]?.dataThrough ?? null });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error).message ?? e) }, { status: 500 });
  }
}
