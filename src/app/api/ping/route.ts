// Deploy-health probe. Returns the current Vercel build commit SHA so we can
// confirm deploys are landing without touching any Neon / AMPRE code paths.
// Gated by the same Bearer CRON_SECRET as /api/sync/sold for consistency.
//
// Auth: Authorization: Bearer <CRON_SECRET>

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const header = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!header || !process.env.CRON_SECRET || header !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    commit: process.env.VERCEL_GIT_COMMIT_SHA || "unknown",
    timestamp: new Date().toISOString(),
  });
}
