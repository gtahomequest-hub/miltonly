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
  gate: "gate", way: "way", gardens: "gardens",
  line: "line", common: "common", point: "point",
  hollow: "hollow", close: "close", walk: "walk",
  hill: "hill", grove: "grove", ridge: "ridge",
  view: "view", park: "park", square: "square",
};

const DIRECTION_TOKENS: ReadonlySet<string> = new Set<string>(["N", "S", "E", "W", "NE", "NW", "SE", "SW"]);

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
  const tailUpper = tokens[i].toUpperCase() as Direction;
  if (DIRECTION_TOKENS.has(tailUpper)) {
    direction = tailUpper;
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
