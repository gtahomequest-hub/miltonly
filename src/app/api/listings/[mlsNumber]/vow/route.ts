// src/app/api/listings/[mlsNumber]/vow/route.ts
// THE WITHHELD FACTS, FOR THE CONSUMER WHO MAY SEE THEM (MC-029). The listing page is ISR and
// never carries a VOW-only column (src/lib/listings/vow.ts). A signed-in, acknowledged session
// reads them here, per listing, and the island on the page renders what comes back. The gate is
// this route's own session check, the same one /api/streets/[slug]/sold-records runs; nothing
// is decided in the browser.
//
// Anonymous: { canSee: false, needsAcknowledgement: false }. Signed in with a step still owed
// (the acknowledgement, the password since MP-002b, or both; src/lib/vow-access.ts is the one
// judge): needsAcknowledgement true, so the island shows the card, which asks for what is
// owed. Either way no field.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canSeeVowRecords } from "@/lib/vow-access";

export const dynamic = "force-dynamic";

export interface ListingVowFacts {
  /** Days since the listing date, the feed's own figure when it carries one. */
  daysOnMarket: number;
  listedAt: string;
  /** The list price before the most recent observed change, and when. Null when never observed. */
  priorPrice: number | null;
  priceChangedAt: string | null;
  /** active | sold | expired | rented, and the lease lifecycle where it applies. */
  status: string;
  leaseStatus: string | null;
  soldPrice: number | null;
  soldDate: string | null;
}

export type ListingVowResponse =
  | { canSee: false; needsAcknowledgement: boolean }
  | { canSee: true; facts: ListingVowFacts | null };

export async function GET(_req: NextRequest, { params }: { params: { mlsNumber: string } }) {
  const user = await getSession();
  const canSee = canSeeVowRecords(user);
  if (!canSee) {
    const body: ListingVowResponse = { canSee: false, needsAcknowledgement: !!user };
    return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
  }

  const l = await prisma.listing.findUnique({
    where: { mlsNumber: params.mlsNumber },
    select: {
      permAdvertise: true,
      daysOnMarket: true,
      listedAt: true,
      priorPrice: true,
      priceChangedAt: true,
      status: true,
      leaseStatus: true,
      soldPrice: true,
      soldDate: true,
    },
  });
  // A listing the feed withholds from display is withheld from the consumer too: the VOW feed
  // adds sold and history to what may be shown, it does not override the display flag.
  if (!l || !l.permAdvertise) {
    const body: ListingVowResponse = { canSee: true, facts: null };
    return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
  }

  const facts: ListingVowFacts = {
    daysOnMarket: l.daysOnMarket ?? Math.max(0, Math.floor((Date.now() - l.listedAt.getTime()) / 86_400_000)),
    listedAt: l.listedAt.toISOString(),
    priorPrice: l.priorPrice,
    priceChangedAt: l.priceChangedAt ? l.priceChangedAt.toISOString() : null,
    status: l.status,
    leaseStatus: l.leaseStatus,
    soldPrice: l.soldPrice,
    soldDate: l.soldDate ? l.soldDate.toISOString() : null,
  };
  const body: ListingVowResponse = { canSee: true, facts };
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
}
