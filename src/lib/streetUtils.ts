import { createHash } from "crypto";

// Extracts ONLY the street name — no house numbers, no unit numbers
export function extractStreetName(fullAddress: string): string {
  let address = fullAddress.trim();

  // Step 1: Remove unit/suite/apt prefixes
  // Handles: "Unit 4 - 55", "#302-", "Suite 100 -", "Apt 2 -", "PH-"
  address = address.replace(
    /^(unit|suite|apt|apartment|ph|penthouse|#)\s*[\w\d]+\s*[-–]\s*/i,
    ""
  );

  // Step 2: Remove condo-style prefix like "1204-38"
  address = address.replace(/^\d{1,6}-/, "");

  // Step 3: Remove slash-format multi-house numbers like "225/269"
  // Also handles partial slash leftovers like "/269"
  address = address.replace(/^\d*\/\d+\s+/, "");

  // Step 4: Remove leading house number (digits at start)
  address = address.replace(/^\d+\s+/, "");

  // Step 4b: Remove leading "E " artifact from addresses like "1050 E Main Street"
  // (the house number was stripped but the leading direction stayed)
  address = address.replace(/^([NSEW])\s+(?=[A-Z])/i, "$1 ");

  // Step 5: Remove trailing city/province info (", Milton, ON ...")
  address = address.replace(/,\s*(Milton|ON|Ontario).*/i, "");

  // Step 6: Remove anything in parentheses — (Lower), (Upper), (UPPER LEVELS), etc.
  address = address.replace(/\s*\([^)]*\)\s*/g, " ");

  // Step 7: Normalize street type suffixes to abbreviations FIRST
  // (so subsequent steps can match abbreviated forms)
  const suffixes: Record<string, string> = {
    Avenue: "Ave",
    Road: "Rd",
    Street: "St",
    Boulevard: "Blvd",
    Court: "Crt",
    Drive: "Dr",
    Crescent: "Cres",
    Place: "Pl",
    Trail: "Trl",
    Circle: "Cir",
    Lane: "Ln",
    Terrace: "Terr",
    Grove: "Grv",
    Heights: "Hts",
    Hollow: "Hllw",
  };
  for (const [full, abbr] of Object.entries(suffixes)) {
    const regex = new RegExp(`\\b${full}\\b`, "i");
    address = address.replace(regex, abbr);
  }

  // Step 8: Remove trailing junk suffixes (run twice to catch chained junk like "Basement Apt.")
  const junkRegex =
    /\s+(Basement|BASEMENT|Bsmt|BSMT|Basemen|Bsmnt|Lower|LOWER|Upper|UPPER|Main|MAIN|Suite|Garden|N\/A|Apt\.?|bonus|SS\d*|Parking\s*\w*)[\s.]*\w*$/i;
  address = address.replace(junkRegex, "");
  address = address.replace(junkRegex, ""); // second pass for chained junk

  // Step 9: Remove trailing bare unit/floor numbers like "Derry Rd 1004" or "Main St E 107"
  // Matches: suffix + optional direction (N/S/E/W) + number
  address = address.replace(
    /\b(Ave|Rd|St|Blvd|Crt|Dr|Cres|Pl|Trl|Cir|Ln|Terr|Grv|Hts|Hllw|Way|Point|Gate|Landing|Line|Close|Crossing|Gardens)(\s+[NSEW])?\s+#?\d+[A-Z]?$/i,
    "$1$2"
  );

  // Step 10: Normalize case — proper title case
  address = address
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => {
      // Keep single-letter directional suffixes: E, W, N, S
      if (/^[NSEWnsew]$/.test(word)) return word.toUpperCase();
      // Title-case any word (handles ALL-CAPS and all-lowercase)
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");

  return address.trim();
}

/**
 * Ontario rural-address exception. For slugs whose bare numeric token IS
 * the street name (e.g. "3 Side Road" addressed as `3-side-rd-milton`),
 * returns the canonical display form. Regular urban streets with a leading
 * house number (like `106-rottenburg-crt-milton`) are NOT rural side-roads —
 * they fall through and are handled by the normal extractStreetName path.
 *
 * Patterns matched:
 *   <number>-side-rd-milton           → "<number> Side Road"
 *   <number>-side-road-milton         → "<number> Side Road"
 *   <number>-sideroad-milton          → "<number> Side Road"
 *   sideroad-<number>-milton          → "<number> Side Road"
 *
 * Returns null when the slug does not match the rural pattern — caller falls
 * back to its normal name-derivation path.
 */
export function ruralSideRoadName(slug: string): string | null {
  const m1 = slug.match(/^(\d+)-side-(?:rd|road|roa?d)-milton$/);
  if (m1) return `${m1[1]} Side Road`;
  const m2 = slug.match(/^(\d+)-sideroad-milton$/);
  if (m2) return `${m2[1]} Side Road`;
  const m3 = slug.match(/^sideroad-(\d+)-milton$/);
  if (m3) return `${m3[1]} Side Road`;
  // Step 13m-2a — named side roads (e.g. REID SIDE ROAD). Matches a single
  // alphabetic base token (no hyphens — multi-word bases are not known
  // side-road patterns in Milton). Registry has only "REID SIDE ROAD" today.
  const m4 = slug.match(/^([a-z]+)-side-(?:rd|road)-milton$/);
  if (m4) {
    const name = m4[1];
    return `${name.charAt(0).toUpperCase()}${name.slice(1).toLowerCase()} Side Road`;
  }
  return null;
}

// ─── Identity derivation (Step 13m-1) ───────────────────────────────────────
//
// The slug-as-key model conflates multiple slug variants of the same physical
// street. MLS ingestion routes data under abbreviated slug forms (e.g.
// `scott-blvd-milton` holds 54 transactions while `scott-boulevard-milton`
// holds 0). deriveIdentity() extracts a stable identity from a slug so the
// render + generator layers can query across all sibling variants.
//
//   identityKey = `${base}|${direction}|${suffixCanonical}`
//
// Suffix IS part of the identity key because some Milton bases carry two
// distinct streets with the same base + direction but different street types
// (e.g. Attenborough Terrace AND Attenborough Trail are both in Milton).
// Without suffix in the key, their data would merge incorrectly.

export type Direction = "" | "N" | "S" | "E" | "W" | "NE" | "NW" | "SE" | "SW";

export interface StreetIdentity {
  base: string;             // "asleton" | "main" | "3-side"
  suffixCanonical: string;  // full-word: "boulevard", "street", "road", "court"
  direction: Direction;     // "" | "N" | "S" | "E" | "W" | "NE" | "NW" | "SE" | "SW"
  identityKey: string;      // `${base}|${direction}`
  canonicalSlug: string;    // full-word form for display URL
}

const IDENTITY_SUFFIX_TOKENS: Set<string> = new Set([
  "blvd", "boulevard", "cres", "crescent", "crt", "court", "ct",
  "dr", "drive", "rd", "road", "st", "street", "ave", "avenue",
  "ln", "lane", "terr", "terrace", "ter", "trl", "trail",
  "gate", "way", "pl", "place", "cir", "circle", "hts", "heights",
  "pkwy", "parkway", "pky", "gardens", "line", "common", "point",
  "hollow", "close", "walk", "hill", "grove", "ridge", "view",
  "park", "square",
  // Step 13m-2a — Milton Street Directory 2022 reconciliation additions.
  // Landing/crossing/garden/path are frequent registry suffixes previously
  // unrecognized (22 / 12 / 9 / 4 entries respectively). pt→point, cr→crescent,
  // wy→way are MLS abbreviations that appeared in registry or universe slugs.
  // townline/head/centre are rare registry suffixes (3 / 1 / 1 entries).
  "landing", "ldg", "crossing", "garden", "path",
  "pt", "cr", "wy", "townline", "head", "centre",
]);

const IDENTITY_SUFFIX_CANON: Record<string, string> = {
  blvd: "boulevard", boulevard: "boulevard",
  cres: "crescent", crescent: "crescent",
  crt: "court", court: "court", ct: "court",
  dr: "drive", drive: "drive",
  rd: "road", road: "road",
  st: "street", street: "street",
  ave: "avenue", avenue: "avenue",
  ln: "lane", lane: "lane",
  terr: "terrace", terrace: "terrace", ter: "terrace",
  trl: "trail", trail: "trail",
  pl: "place", place: "place",
  cir: "circle", circle: "circle",
  hts: "heights", heights: "heights",
  pkwy: "parkway", parkway: "parkway", pky: "parkway",
  gate: "gate", way: "way", gardens: "garden",
  line: "line", common: "common", point: "point",
  hollow: "hollow", close: "close", walk: "walk",
  hill: "hill", grove: "grove", ridge: "ridge",
  view: "view", park: "park", square: "square",
  // Step 13m-2a — registry additions. `pt` and `cr` canonicalize to full
  // words; `gardens` plural collapses to `garden` singular (registry uses
  // singular form 9× vs plural 0×). `wy` is an MLS variant of `way`.
  landing: "landing", ldg: "landing",
  crossing: "crossing",
  garden: "garden",
  path: "path",
  pt: "point",
  cr: "crescent",
  wy: "way",
  townline: "townline",
  head: "head",
  centre: "centre",
};

// Step 13m-2a — accept spelled-out directional tokens (KENNEDY CIRCLE EAST
// in the Milton registry uses EAST/WEST spelled out rather than E/W). Alias
// to single-letter codes during derivation.
const DIRECTION_ALIAS: Record<string, Direction> = {
  N: "N", S: "S", E: "E", W: "W",
  NE: "NE", NW: "NW", SE: "SE", SW: "SW",
  NORTH: "N", SOUTH: "S", EAST: "E", WEST: "W",
};
const DIRECTION_TOKENS: ReadonlySet<string> = new Set<string>(Object.keys(DIRECTION_ALIAS));

// Step 13m-2a — authoritative registry of (base, suffix, direction) tuples
// that have real directional splits per Milton_Existing_Street_Directory_2022.pdf.
// Any MLS slug carrying a direction token whose (base, suffix) is NOT a key
// here has its direction stripped — the direction is MLS addressing noise,
// not a real street segment. Derived from 12 registry entries; 140 phantom
// MLS directional slugs collapse into their base identities as a result.
const REGISTERED_DIRECTIONS: Record<string, ReadonlySet<Direction>> = {
  "bronte|street":      new Set<Direction>(["N", "S"]),
  "burnhamthorpe|road": new Set<Direction>(["W"]),
  "campbell|avenue":    new Set<Direction>(["E", "W"]),
  "court|street":       new Set<Direction>(["N", "S"]),
  "james-snow|parkway": new Set<Direction>(["N", "S"]),
  "kennedy|circle":     new Set<Direction>(["E", "W"]),
  "lower-base|line":    new Set<Direction>(["E", "W"]),
  "main|street":        new Set<Direction>(["E", "N", "S", "W"]),
  "ontario|street":     new Set<Direction>(["N", "S"]),
  "parkway|drive":      new Set<Direction>(["E", "W"]),
  "steeles|avenue":     new Set<Direction>(["E", "W"]),
  "thompson|road":      new Set<Direction>(["N", "S"]),
};

/**
 * Derive a stable identity from a slug. Slug-only (no DB lookup). Returns null
 * for malformed or empty-city slugs. Called on every page render, so keep cheap.
 */
export function deriveIdentity(slug: string): StreetIdentity | null {
  const parts = slug.split("-");
  if (parts.length < 2 || parts[parts.length - 1] !== "milton") return null;
  const tokens = parts.slice(0, -1); // drop -milton
  if (tokens.length === 0) return null;

  // Walk from the tail: trailing direction, then suffix.
  let direction: Direction = "";
  let i = tokens.length - 1;
  const tailUpper = tokens[i].toUpperCase();
  if (DIRECTION_TOKENS.has(tailUpper)) {
    direction = DIRECTION_ALIAS[tailUpper] ?? "";
    i--;
  }
  let suffixCanonical = "";
  if (i >= 0) {
    const t = tokens[i].toLowerCase();
    if (IDENTITY_SUFFIX_TOKENS.has(t)) {
      suffixCanonical = IDENTITY_SUFFIX_CANON[t] ?? t;
      i--;
    }
  }
  const base = tokens.slice(0, i + 1).join("-").toLowerCase();
  if (!base) return null;

  // Step 13m-2a — registry-validated direction gate. If the slug carries a
  // directional token but the Milton Street Directory does not list this
  // (base, suffix) combo with that direction, strip the direction. Collapses
  // the ~140 phantom directional MLS variants into their base identities.
  if (direction) {
    const key = `${base}|${suffixCanonical}`;
    const registered = REGISTERED_DIRECTIONS[key];
    if (!registered || !registered.has(direction)) {
      direction = "";
    }
  }

  const canonicalParts = [base];
  if (suffixCanonical) canonicalParts.push(suffixCanonical);
  if (direction) canonicalParts.push(direction.toLowerCase());
  canonicalParts.push("milton");

  return {
    base,
    suffixCanonical,
    direction,
    identityKey: `${base}|${direction}|${suffixCanonical}`,
    canonicalSlug: canonicalParts.join("-"),
  };
}

/**
 * Given an identity and a candidate pool of slugs (typically the universe),
 * returns the subset whose derived identity matches. Used to resolve sibling
 * variants during page render + generator input construction.
 */
export function siblingSlugsForIdentity(
  identity: StreetIdentity,
  candidatePool: readonly string[],
): string[] {
  const out: string[] = [];
  for (const s of candidatePool) {
    const id = deriveIdentity(s);
    if (id && id.identityKey === identity.identityKey) out.push(s);
  }
  return out.sort();
}

// Converts street name to URL slug — always ends in -milton
export function streetNameToSlug(streetName: string): string {
  return (
    streetName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") + "-milton"
  );
}

// Calculates a market-data hash for staleness detection of the AI-generated
// street-content pipeline. Hash inputs post Phase 2.6 reflect the new
// active-only stats shape — no sold-price-derived fields, since DB1 no longer
// stores them. Changing this hash invalidates existing streetContent rows
// and forces regeneration, which is the intended behaviour after a semantic
// shift like this.
export function calcMarketDataHash(stats: {
  avgListPrice: number;
  totalSold12mo: number;
  avgDOM: number;
  dominantPropertyType: string;
}): string {
  const hashInput = [
    Math.round(stats.avgListPrice / 10000),
    stats.totalSold12mo,
    Math.round(stats.avgDOM),
    stats.dominantPropertyType,
  ].join("|");

  return createHash("sha256").update(hashInput).digest("hex").slice(0, 16);
}
