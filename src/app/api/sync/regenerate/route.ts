import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcMarketDataHash } from "@/lib/marketDataHash";
import { getStreetStats } from "@/lib/streetDecision";
import { streetRegenEnabled, STREET_REGEN_PAUSED_REASON } from "@/lib/streetRegen";
import { vowSystemAccess, withVowAccess } from "@/lib/vow/door";

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  // MC-046 R16: a VOW-reading cron route opens the door by the Authorization header only
  // (`Bearer <CRON_SECRET>`, constant time); a `?secret=` query parameter is refused.
  const access = vowSystemAccess(request);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return withVowAccess(access, () => runPOST());
}

async function runPOST() {
  // PAUSED UNLESS STREET_REGEN_ENABLED IS "true" (MC-049, src/lib/streetRegen.ts): the schedule and
  // the secret stay; the run reads nothing, queues nothing, fires nothing.
  if (!streetRegenEnabled()) {
    console.log(`[regenerate] paused: ${STREET_REGEN_PAUSED_REASON}; nothing queued, nothing written`);
    return NextResponse.json({ paused: true, reason: STREET_REGEN_PAUSED_REASON });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Find published pages older than 30 days with stale data
  const candidates = await prisma.streetContent.findMany({
    where: {
      status: "published",
      generatedAt: { lt: thirtyDaysAgo },
    },
    select: {
      streetSlug: true,
      streetName: true,
      marketDataHash: true,
    },
  });

  const stale: string[] = [];

  for (const page of candidates) {
    const stats = await getStreetStats(page.streetSlug);
    if (!stats) continue;

    const currentHash = calcMarketDataHash(stats);
    if (currentHash !== page.marketDataHash) {
      // Queue for regeneration
      await prisma.streetQueue.upsert({
        where: { streetSlug: page.streetSlug },
        create: {
          streetSlug: page.streetSlug,
          streetName: page.streetName,
          status: "pending",
        },
        update: {
          status: "pending",
          attempts: 0,
          lastError: null,
        },
      });
      stale.push(page.streetName);
    }
  }

  // Fire generate route if any stale pages found
  if (stale.length > 0) {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    // MC-046 R16: /api/sync/generate takes the secret in the Authorization header only.
    fetch(`${baseUrl}/api/sync/generate`, {
      method: "GET",
      headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    }).catch(() => {});
  }

  return NextResponse.json({
    checked: candidates.length,
    staleQueued: stale,
  });
}
