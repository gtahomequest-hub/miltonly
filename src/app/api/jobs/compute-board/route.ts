// src/app/api/jobs/compute-board/route.ts
// Nightly Board refresh (DB2 -> DB3), mirroring compute-sold-stats. Auth via
// Authorization: Bearer <CRON_SECRET> OR ?secret=<CRON_SECRET>. Recomputes
// analytics.board_stats for all tabs.
import { NextResponse } from "next/server";
import { computeAndWriteBoard } from "@/lib/board/computeBoard";

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
    const tabs = await computeAndWriteBoard();
    return NextResponse.json({ ok: true, tabs: tabs.length, dataThrough: tabs[0]?.dataThrough ?? null });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String((e as Error).message ?? e) }, { status: 500 });
  }
}
