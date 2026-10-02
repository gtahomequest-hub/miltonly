import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { vowSystemAccess } from "@/lib/vow/door";

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  // MC-046 R16: this route counts listing rows of every status to queue generation, so it opens
  // the VOW door by the Authorization header only; `?secret=` is refused.
  if (!vowSystemAccess(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find all unique streets in Listing that don't have StreetContent yet
  const streets: { streetName: string; streetSlug: string; cnt: bigint }[] =
    await prisma.$queryRaw`
      SELECT "streetName", "streetSlug", COUNT(*)::bigint as cnt
      FROM "Listing"
      WHERE "streetSlug" IS NOT NULL
      AND "streetName" IS NOT NULL
      AND "streetSlug" NOT IN (
        SELECT "streetSlug" FROM "StreetContent"
      )
      AND "streetSlug" NOT IN (
        SELECT "streetSlug" FROM "StreetQueue"
      )
      GROUP BY "streetName", "streetSlug"
      ORDER BY cnt DESC
    `;

  let queued = 0;
  for (const s of streets) {
    try {
      await prisma.streetQueue.create({
        data: {
          streetSlug: s.streetSlug,
          streetName: s.streetName,
          status: "pending",
        },
      });
      queued++;
    } catch {
      // skip duplicates
    }
  }

  return NextResponse.json({
    queued,
    totalStreets: streets.length,
    message: `Queued ${queued} streets for backfill generation. The generate cron will process them over the next ${Math.ceil(queued / 20)} days at ~20 streets per run.`,
  });
}
