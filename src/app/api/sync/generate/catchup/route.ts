// Manual catch-up endpoint for clearing a large backlog.
// Processes up to 100 streets in one run with a 5-minute timeout.
// Protected by CRON_SECRET (same auth as the scheduled generate cron).
// Trigger manually: POST /api/sync/generate/catchup?secret=<CRON_SECRET>

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  const secret =
    request.headers.get("authorization")?.replace("Bearer ", "") ||
    request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Count pending / failed before kicking off
  const [pendingBefore, failedBefore] = await Promise.all([
    prisma.streetQueue.count({ where: { status: "pending" } }),
    prisma.streetQueue.count({ where: { status: "failed", attempts: { lt: 3 } } }),
  ]);

  const totalBefore = pendingBefore + failedBefore;
  if (totalBefore === 0) {
    return NextResponse.json({
      ok: true,
      message: "Queue is empty — nothing to catch up.",
      pendingBefore: 0,
      failedBefore: 0,
    });
  }

  // Fire the regular generate endpoint in sequence up to 4 times (4 × 25 = 100 max).
  // Each call consumes exactly what the regular cron consumes, so behaviour is identical
  // to letting the normal schedule run 4 times in a row — but without waiting 16 hours.
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
  const results: unknown[] = [];
  const start = Date.now();

  for (let i = 0; i < 4; i++) {
    // Stop early if nothing left
    const remaining = await prisma.streetQueue.count({
      where: {
        OR: [
          { status: "pending" },
          { status: "failed", attempts: { lt: 3 } },
        ],
      },
    });
    if (remaining === 0) break;

    try {
      const res = await fetch(
        `${baseUrl}/api/sync/generate?secret=${secret}`,
        { method: "POST", headers: { Authorization: `Bearer ${secret}` } },
      );
      const json = await res.json();
      results.push({ run: i + 1, ...json });
    } catch (e) {
      results.push({ run: i + 1, error: e instanceof Error ? e.message : String(e) });
      break;
    }

    // Don't exceed the function timeout
    if (Date.now() - start > 270_000) break;
  }

  const [pendingAfter, failedAfter] = await Promise.all([
    prisma.streetQueue.count({ where: { status: "pending" } }),
    prisma.streetQueue.count({ where: { status: "failed", attempts: { lt: 3 } } }),
  ]);

  return NextResponse.json({
    ok: true,
    pendingBefore,
    failedBefore,
    pendingAfter,
    failedAfter,
    processedApprox: totalBefore - (pendingAfter + failedAfter),
    runs: results,
    durationMs: Date.now() - start,
  });
}
