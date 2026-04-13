import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSMS } from "@/lib/smsAlert";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  return POST(request);
}

/**
 * Listing Expiry Job
 *
 * Marks listings as expired if they haven't been seen in the last sync.
 * PropTx requires listings removed within 24-48 hours of becoming inactive.
 *
 * Logic: If a listing's syncedAt is older than 48 hours and its status is
 * still "active", it was not returned by the TREB API in the last two syncs
 * — meaning it's been removed from the feed and must be expired.
 */
export async function POST(request: NextRequest) {
  const secret =
    request.headers.get("authorization")?.replace("Bearer ", "") ||
    request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago

  // Find active listings not seen in last 48 hours
  const staleListings = await prisma.listing.findMany({
    where: {
      status: "active",
      syncedAt: { lt: cutoff },
    },
    select: { id: true, mlsNumber: true, address: true, syncedAt: true },
  });

  if (staleListings.length === 0) {
    return NextResponse.json({ expired: 0, message: "No stale listings found" });
  }

  // Mark them as expired
  const result = await prisma.listing.updateMany({
    where: {
      status: "active",
      syncedAt: { lt: cutoff },
    },
    data: { status: "expired" },
  });

  console.log(`[Expiry] Marked ${result.count} listings as expired (not seen since ${cutoff.toISOString()})`);

  // Alert if significant number expired
  if (result.count > 10) {
    await sendSMS(
      `⚠ Miltonly expiry: ${result.count} listings marked expired (not in TREB feed for 48h+). Check if sync is running.`
    );
  }

  return NextResponse.json({
    expired: result.count,
    cutoff: cutoff.toISOString(),
    sample: staleListings.slice(0, 5).map((l) => ({
      mls: l.mlsNumber,
      address: l.address,
      lastSeen: l.syncedAt,
    })),
  });
}
