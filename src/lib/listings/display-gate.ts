/**
 * Display Gate — IDX/DDF Compliance
 *
 * PropTx requires that every listing displayed publicly must have:
 *   - permAdvertise = true  (InternetEntireListingDisplayYN)
 *   - displayAddress = true (InternetAddressDisplayYN) — or address must be hidden
 *
 * This module provides the Prisma `where` clause additions and
 * a post-query filter for listings that should be shown publicly.
 */

/** Prisma where clause that enforces display permissions */
export const DISPLAY_PERMITTED_WHERE = {
  permAdvertise: true,
} as const;

/** Redacts the address from a listing when displayAddress is false */
export function redactAddress<T extends { displayAddress: boolean; address: string }>(
  listing: T
): T {
  if (!listing.displayAddress) {
    return { ...listing, address: "Address withheld by seller" };
  }
  return listing;
}

/** Filters an array of listings to only those permitted for display, redacting addresses where needed */
export function applyDisplayGate<T extends { permAdvertise: boolean; displayAddress: boolean; address: string }>(
  listings: T[]
): T[] {
  return listings
    .filter((l) => l.permAdvertise)
    .map((l) => redactAddress(l));
}
