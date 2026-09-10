// src/lib/rentalsAvailable.ts
// THE ONE RENTAL AVAILABILITY COUNT. /rentals and the homepage both read it, so the two
// surfaces cannot state different numbers of the same thing.
//
// WHY THE FILTER IS `leaseStatus`, NOT `status`. The lease side does not use `status='active'`
// at all: a lease row is `status='rented'` for its whole life and `leaseStatus` carries the
// lifecycle, exactly as the schema comment says. So a query filtered on transaction type alone
// counts every lease record ever advertised.
//
// Measured 2026-09-10: `/rentals` counted 1,340 rows that way and printed them as "1,340 active
// rentals · live TREB data", five times over. 224 of those were `leaseStatus='leased'` — already
// gone. **1,116** were actually available. The page was not slightly stale; it was counting
// closed inventory under the word "active".
//
// This was found while adding an "available to rent" figure to the homepage under an instruction
// to read the exact figure /rentals publishes. Publishing 1,340 on a second surface would have
// doubled a false claim and had the battery certify it, so the shared count filters correctly and
// /rentals now reports 1,116. That is a visible change to a page outside the homepage worktree,
// made deliberately and flagged in the report: reverting it means putting the old number back on
// BOTH surfaces, not just one.
//
// It is not k-gated, and does not need to be: a count of listings currently advertised on the
// public MLS is public by construction. It is sold-side aggregates that carry the VOW obligation.
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";

/** Milton rentals a person can actually enquire about today. */
export async function getRentalsAvailableCount(): Promise<number> {
  return prisma.listing.count({
    where: {
      transactionType: "For Lease",
      city: config.PRISMA_CITY_VALUE,
      permAdvertise: true,
      leaseStatus: "active",
    },
  });
}
