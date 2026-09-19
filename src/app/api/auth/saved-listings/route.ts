import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { isPublicListing } from "@/lib/listings/vow";
import { canSeeVowRecords } from "@/lib/vow-access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const mls = request.nextUrl.searchParams.get("mls");
  if (!mls) return NextResponse.json({ listings: [] });

  const mlsNumbers = mls.split(",").filter(Boolean);
  if (mlsNumbers.length === 0) return NextResponse.json({ listings: [] });

  const rows = await prisma.listing.findMany({
    where: { mlsNumber: { in: mlsNumbers } },
    select: {
      mlsNumber: true,
      address: true,
      price: true,
      propertyType: true,
      status: true,
      leaseStatus: true,
      transactionType: true,
      permAdvertise: true,
      streetSlug: true,
      bedrooms: true,
      bathrooms: true,
    },
  });

  // MC-029: whether a saved listing sold or expired is a VOW-only fact. A signed-in person who
  // has not acknowledged sees "active" or "unavailable", nothing finer; an acknowledged one
  // sees the feed's status. The address and the price stay: the person saved them.
  const canSeeStatus = canSeeVowRecords(user);
  const listings = rows.map(({ leaseStatus, transactionType, permAdvertise, ...l }) => ({
    ...l,
    status: canSeeStatus
      ? l.status
      : isPublicListing({ permAdvertise, status: l.status, transactionType, leaseStatus })
        ? "active"
        : "unavailable",
  }));

  return NextResponse.json({ listings }, { headers: { "Cache-Control": "private, no-store" } });
}
