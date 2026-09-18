// src/lib/listings/vow.ts
// THE VOW LINE (MC-029, 2026-09-18). TRREB's VOW rules keep a set of per-listing facts behind a
// signed-in, acknowledged consumer relationship: how long a listing has been on the market, the
// date it was listed (the same number, before subtraction), what its price was before it changed
// and when, whether a listing sold or expired, and what it sold for. The IDX side, which every
// anonymous visitor is, may show an active listing's current asking price and its facts, and
// aggregates computed across many listings.
//
// This file is the one place that says which columns are which. Every public loader strips
// VOW_ONLY_FIELDS before a row is serialised, every public query narrows to PUBLIC_*_WHERE, and
// a signed-in, acknowledged session reads the withheld facts from
// /api/listings/[mlsNumber]/vow, a force-dynamic route that checks the session server-side.
// Nothing hides a field in the browser: a field the anonymous page must not show is absent from
// the payload the page is built from.
//
// The list is a runtime constant on purpose: scripts/verify/checks/vow-fields.mjs and the
// prebuild test read it, so the battery and the code cannot disagree about what is withheld.

import type { Prisma } from "@prisma/client";
import { config } from "@/lib/config";

/** Columns of `Listing` that only an acknowledged VOW consumer may see, per listing. */
export const VOW_ONLY_FIELDS = [
  "daysOnMarket",
  "listedAt",
  "priorPrice",
  "priceChangedAt",
  "lastPriceChangeAt",
  "soldPrice",
  "soldDate",
] as const;

export type VowOnlyField = (typeof VOW_ONLY_FIELDS)[number];

/** A listing with the VOW-only columns removed. */
export type PublicListing<T> = Omit<T, VowOnlyField>;

/** Returns a copy of the row without the VOW-only columns. Never mutates. */
export function stripVowFields<T extends object>(row: T): PublicListing<T> {
  const out = { ...row } as Record<string, unknown>;
  for (const f of VOW_ONLY_FIELDS) delete out[f];
  return out as PublicListing<T>;
}

export function stripVowFieldsAll<T extends object>(rows: T[]): PublicListing<T>[] {
  return rows.map(stripVowFields);
}

// ── the public set ───────────────────────────────────────────────────────────────────────
// A listing is public while it is advertised (permAdvertise, InternetEntireListingDisplayYN)
// AND currently on the market. The sale side carries that in `status = 'active'`; the lease
// side is `status = 'rented'` for its whole life and carries the lifecycle in `leaseStatus`
// (see rentalsAvailable.ts). A sold, expired or leased row is VOW data in its entirety: its
// page, its card and its presence on a list all say what happened to it.

/** Active sale listings the public may see. */
export const PUBLIC_SALE_WHERE = {
  permAdvertise: true,
  city: config.PRISMA_CITY_VALUE,
  status: "active",
  transactionType: { not: "For Lease" },
} as const;

/** Available lease listings the public may see. */
export const PUBLIC_LEASE_WHERE = {
  permAdvertise: true,
  city: config.PRISMA_CITY_VALUE,
  transactionType: "For Lease",
  leaseStatus: "active",
} as const;

/** Either side. Use where a surface mixes sale and lease rows. */
export const PUBLIC_LISTING_WHERE: Prisma.ListingWhereInput = {
  permAdvertise: true,
  city: config.PRISMA_CITY_VALUE,
  OR: [
    { status: "active", transactionType: { not: "For Lease" } },
    { transactionType: "For Lease", leaseStatus: "active" },
  ],
};

/** The same predicate on a row already in hand. */
export function isPublicListing(l: {
  permAdvertise: boolean;
  status: string;
  transactionType: string | null;
  leaseStatus: string | null;
}): boolean {
  if (!l.permAdvertise) return false;
  if (l.transactionType === "For Lease") return l.leaseStatus === "active";
  return l.status === "active";
}
