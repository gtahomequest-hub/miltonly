// Nightly stats compute (11:30 UTC). Reads DB2 sold records, writes DB3 analytics.
// Fully decoupled from /api/sync/sold (Point 5) — runs on its own cron, so a
// failed sync doesn't block stats refresh against whatever data did land.
//
// Auth: Authorization: Bearer <CRON_SECRET> (Point 7).

import { NextRequest, NextResponse } from "next/server";
import { soldDb, analyticsDb } from "@/lib/db";
import { computeAllStats } from "@/lib/sold-stats";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  const header = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!header || !process.env.CRON_SECRET || header !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!soldDb || !analyticsDb) {
    return NextResponse.json(
      { error: "SOLD_DATABASE_URL or ANALYTICS_DATABASE_URL is not configured" },
      { status: 503 }
    );
  }

  try {
    const summary = await computeAllStats();
    console.log(
      `[jobs/compute-sold-stats] ` +
      `streetsSale=${summary.streetsSale} streetsLease=${summary.streetsLease} ` +
      `nbhdsSale=${summary.neighbourhoodsSale} nbhdsLease=${summary.neighbourhoodsLease} ` +
      `duration=${summary.durationMs}ms`
    );
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    console.error("[jobs/compute-sold-stats] failed", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
