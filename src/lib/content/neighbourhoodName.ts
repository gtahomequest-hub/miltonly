// src/lib/content/neighbourhoodName.ts
//
// The Content tier's only source of a neighbourhood's display name.
//
// WHY THIS EXISTS. `Listing.neighbourhood` and `sold_records.neighbourhood`
// hold the RAW TREB string, which looks like "1037 - TM Timberlea" and
// "1032 - FO Ford". The first preview of the condo guide printed those
// verbatim in prose: "1 bed, 1 parking, owned locker, in 1032 - FO Ford."
//
// That is the same defect class the street and condo tiers already have rules
// for. `resolveStreetName` exists because a stored string is not a name, and
// `condoName.ts` exists for the same reason. A raw feed identifier on a public
// surface is a feed leak whether it is a street abbreviation or a board's
// internal area code.
//
// NEIGHBOURHOOD_SEED is the authority, the same bridge
// getMiltonSoldByNeighbourhood and the Market Watch edition already cross.
//
// AN UNMAPPED STRING RETURNS NULL, NOT THE RAW STRING. A caller drops the
// clause rather than falling back to the feed. Falling back is what put the
// code on the page in the first place.

import { NEIGHBOURHOOD_SEED } from "@/lib/neighbourhood";

const byRaw = new Map<string, { name: string; slug: string }>();
for (const seed of NEIGHBOURHOOD_SEED) {
  for (const raw of seed.rawStrings) {
    byRaw.set(raw.trim().toLowerCase(), { name: seed.name, slug: seed.slug });
  }
}

export interface ResolvedNeighbourhood {
  name: string;
  slug: string;
}

/** The registry's name for a raw feed string, or null when nothing owns it. */
export function resolveNeighbourhood(raw: string | null | undefined): ResolvedNeighbourhood | null {
  if (!raw) return null;
  return byRaw.get(raw.trim().toLowerCase()) ?? null;
}

/** The display name alone, or null. Never the raw string. */
export function neighbourhoodDisplayName(raw: string | null | undefined): string | null {
  return resolveNeighbourhood(raw)?.name ?? null;
}
