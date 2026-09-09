// src/lib/condoName.ts
// THE ONLY SOURCE OF A CONDO BUILDING'S NAME ON ANY SURFACE — the condo counterpart of
// resolveStreetName, and subject to the same rule: the Town registry is the authority and the
// stored string is not. QUEUE item 4. Recon and the three rulings behind it: report 061.
//
// WHAT WAS WRONG. CondoBuilding carries an MLS-derived string like "1005 Nadalin Hts", and every
// surface rendered it verbatim. 57 of 59 published rows carried an abbreviation. Worse, the
// direction in those strings is not merely abbreviated, it is WRONG: four streets carry
// contradictory directions across their own buildings (Gordon Krantz Avenue is stored as E, S and
// W at once), and "1050 Main St W" names an address the Town records as MAIN STREET **E**.
//
// SO THE DIRECTION COMES FROM THE TOWN, PER CIVIC ADDRESS, OR NOT AT ALL. src/data/
// addressDirections.ts is the Town's own ST_DIR_SUFFIX, 1,355 civic addresses over the 12 streets
// in Milton that actually have one. An address with no row there renders no direction — absence
// is never evidence, and it is also not licence to invent one from the MLS string.
//
// THE NUMBER IS NEVER RESOLVED, ONLY CARRIED. It is the civic number and nothing derives it.
//
// A REAL BUILDING NAME STILL WINS. "Bronte Meadows" is a better H1 than any address. This module
// governs the ADDRESS, which is what every one of those buildings falls back to, and it always
// computes the address form as well, because JSON-LD `address` must be an address even when the
// heading is a name.
import { resolveStreetName } from "@/lib/streetName";
import { identityFromSlug, parseAddress } from "@/lib/town/identity";
import { directionForKey, type Direction } from "@/data/addressDirections";

const DIRECTION_WORD: Record<Direction, string> = {
  N: "North",
  E: "East",
  S: "South",
  W: "West",
};

export interface CondoNameInput {
  /** the building's own slug, used only for reporting */
  slug: string;
  /** civic number, carried through untouched */
  streetNumber: string | null;
  /** PRIMARY. The parent street slug already stored on the row. */
  streetSlug: string | null;
  /** the raw MLS-derived string. A CHECK on streetSlug, never the name. */
  buildingAddress: string | null;
  /** a real building name where one is known, e.g. a vetted association_name */
  associationName?: string | null;
}

export interface ResolvedCondoName {
  /** what a heading, a title, a breadcrumb and a card render. */
  name: string;
  /** the address form, always — even when `name` is a real building name. */
  address: string;
  number: string | null;
  streetName: string | null;
  direction: Direction | null;
  source: "association" | "registry" | "off-registry" | "fallback" | "raw";
  /** false when the stored streetSlug and a re-parse of the address disagree. */
  agrees: boolean;
  /** every disagreement and every refusal, named. Nothing here is swallowed. */
  issues: string[];
}

/**
 * Resolve one building. Pure — no DB, no network — so the prebuild guard imports it directly.
 */
export function resolveCondoName(input: CondoNameInput): ResolvedCondoName {
  const issues: string[] = [];
  const raw = (input.buildingAddress ?? "").trim();
  const number = (input.streetNumber ?? "").trim() || null;

  // ── the street, from the stored slug ────────────────────────────────────────
  const slug = (input.streetSlug ?? "").trim() || null;
  let streetName: string | null = null;
  let source: ResolvedCondoName["source"] = "raw";
  let identityKey: string | null = null;

  if (slug) {
    identityKey = identityFromSlug(slug).key;
    const resolved = resolveStreetName(slug);
    streetName = resolved.name;
    source = resolved.source;
  } else {
    issues.push("no streetSlug stored");
  }

  // ── the check: a re-parse of the raw address must agree with the slug ───────
  // It is a CHECK, not a second source. On the corpus the two never contradict; if they ever do,
  // the row is reported rather than quietly resolved from whichever answered.
  const parsed = parseAddress(raw);
  let agrees = true;
  if (slug && parsed) {
    agrees = parsed.identity.key === identityKey;
    if (!agrees) {
      issues.push(`streetSlug "${slug}" (${identityKey}) disagrees with the address re-parse (${parsed.identity.key})`);
    }
  } else if (slug && !parsed) {
    // "21 Crt St N" — the abbreviation is outside canonicalType. The slug still answers, so this
    // is a note, not a failure.
    issues.push(`address ${JSON.stringify(raw)} does not re-parse; resolved from streetSlug alone`);
  }

  // ── the direction, from the Town or not at all ──────────────────────────────
  let direction: Direction | null = null;
  if (number && identityKey) {
    direction = directionForKey(number, identityKey);
  }

  // ── compose ────────────────────────────────────────────────────────────────
  // Every part has to be present. A half-name ("Main Street" with no number, or a number with no
  // street) is worse than the raw string, so the raw string is what a refusal falls back to.
  let address: string;
  if (number && streetName) {
    address = direction ? `${number} ${streetName} ${DIRECTION_WORD[direction]}` : `${number} ${streetName}`;
  } else {
    address = raw || input.slug;
    source = "raw";
    if (!number) issues.push("no streetNumber stored");
    if (!streetName) issues.push("street did not resolve to a name");
  }

  const association = (input.associationName ?? "").trim();
  return {
    name: association || address,
    address,
    number,
    streetName,
    direction,
    source: association ? "association" : source,
    agrees,
    issues,
  };
}

/** The shape every caller that only wants the string uses. */
export function condoDisplayName(input: CondoNameInput): string {
  return resolveCondoName(input).name;
}
