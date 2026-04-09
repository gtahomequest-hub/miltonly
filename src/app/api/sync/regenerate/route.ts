import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calcMarketDataHash } from "@/lib/streetUtils";
import { getStreetStats } from "@/lib/streetDecision";

export const maxDuration = 120;

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
    fetch(`${baseUrl}/api/sync/generate?secret=${process.env.CRON_SECRET}`, {
      method: "GET",
    }).catch(() => {});
  }

  return NextResponse.json({
    checked: candidates.length,
    staleQueued: stale,
  });
}
