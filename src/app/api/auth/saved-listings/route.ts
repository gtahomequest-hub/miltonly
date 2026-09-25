import { getSession, touchSession } from "@/lib/auth";
import { logVowAccess, clientIpFromHeaders } from "@/lib/vow-audit";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { isPublicListing } from "@/lib/listings/vow";
import { redactAddress } from "@/lib/listings/display-gate";
import { canSeeVowRecords } from "@/lib/vow-access";

export const dynamic = "force-dynamic";

// MC-036, item 4: the most saved listings one response describes. The session's list is the
// only list this route reads, and it is cut here as well as at the save (save-listing/route.ts).
const SAVED_LISTINGS_CAP = 100;

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  // MC-036: THE LOOKUP IS THE SESSION'S OWN LIST. The route read whatever comma-separated MLS
  // numbers the client sent, with no cap, so an acknowledged user could ask for the feed status
  // of any row by number. ?mls= now only narrows the person's savedListings; a number that is
  // not in the list is not looked up.
  const saved = (user.savedListings || []).slice(0, SAVED_LISTINGS_CAP);
  const mls = request.nextUrl.searchParams.get("mls");
  const asked = mls ? new Set(mls.split(",").filter(Boolean)) : null;
  const mlsNumbers = asked ? saved.filter((m) => asked.has(m)) : saved;
  if (mlsNumbers.length === 0) return NextResponse.json({ listings: [] });

  const rows = await prisma.listing.findMany({
    where: { mlsNumber: { in: mlsNumbers } },
    select: {
      mlsNumber: true,
      address: true,
      displayAddress: true,
      price: true,
      propertyType: true,
      status: true,
      leaseStatus: true,
      transactionType: true,
      permAdvertise: true,
      listOfficeName: true,
      bedrooms: true,
      bathrooms: true,
    },
  });

  // MC-029: whether a saved listing sold or expired is a VOW-only fact. A signed-in person who
  // may not see VOW records (src/lib/vow-access.ts) sees "active" or "unavailable", nothing
  // finer; one who may sees the feed's status. The price stays: the person saved it. The
  // address stays unless the seller withheld it (MC-036): then redactAddress replaces it, the
  // dashboard prints "Address on request", and streetSlug is not selected, so the card ties the
  // listing to no street. listOfficeName is selected for the brokerage line beside the price.
  const canSeeStatus = canSeeVowRecords(user);
  const listings = rows.map(({ leaseStatus, transactionType, permAdvertise, ...l }) => ({
    ...redactAddress(l),
    status: canSeeStatus
      ? l.status
      : isPublicListing({ permAdvertise, status: l.status, transactionType, leaseStatus })
        ? "active"
        : "unavailable",
  }));

  // The audit trail (MP-006): a saved listing's sold or expired status is a VOW-only fact.
  if (canSeeStatus) {
    await logVowAccess({
      userId: user.id,
      kind: "saved-listings",
      scope: mlsNumbers.slice(0, 20).join(","),
      path: request.nextUrl.pathname,
      recordCount: listings.length,
      ip: clientIpFromHeaders(request.headers),
      userAgent: request.headers.get("user-agent"),
      reviewFlag: user.reviewFlag,
    });
  }
  await touchSession();

  return NextResponse.json({ listings }, { headers: { "Cache-Control": "private, no-store" } });
}
