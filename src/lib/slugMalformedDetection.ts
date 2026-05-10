// Slug malformation detection. Extracted from scripts/backfill-descriptions.ts
// in 2026-05-09 cleanup so consumers (e.g. scripts/generate-canonical-map.ts)
// can import without triggering backfill-descriptions's top-level main()
// side-effect, which previously caused unintended SG writes + ~$5-10 in
// API spend per accidental trigger.
//
// Pure-function module with constants + the detection function. No
// side-effects on import. Safe to load from any caller that needs to
// validate slug shape.

const MALFORMED_TOKENS = new Set(["na", "unt", "bsmt", "basement"]);
const EXACT_BLACKLIST = new Set([
  "hwy-7-n-a-milton",
  "con-5-pt-lot-17-milton",
  "no-1-side-rd-milton",
  "sideroad-10-milton",
]);
// Abbreviation ↔ full-form pairs for street-type suffixes. Exported so the
// canonicalization regression check (scripts/test-canonicalization-regression.ts)
// can identify abbreviated-form streetSlugs in StreetGeneration.
export const SUFFIX_PAIRS: Array<[string, string]> = [
  ["blvd", "boulevard"], ["cres", "crescent"], ["trl", "trail"],
  ["dr", "drive"], ["ave", "avenue"], ["rd", "road"],
  ["st", "street"], ["terr", "terrace"], ["ter", "terrace"],
  ["crt", "court"], ["ct", "court"], ["pl", "place"],
  ["cir", "circle"], ["ln", "lane"], ["hts", "heights"],
];

const STREET_TYPE_TOKENS = new Set([
  "blvd", "boulevard",
  "cres", "crescent",
  "way",
  "dr", "drive",
  "ave", "avenue",
  "rd", "road",
  "st", "street",
  "terr", "ter", "terrace",
  "trl", "trail",
  "gate",
  "crt", "court",
  "pl", "place",
  "cir", "circle",
  "hts", "heights",
  "gardens",
  "ln", "lane",
  "line",
  "common",
]);

/**
 * Reject slugs that encode MLS parse artifacts (N/A suffix, unit descriptors,
 * basement/upper qualifiers, mid-slug unit-number tokens) rather than real
 * street names. Conservative: only strips tokens with no plausible meaning
 * as part of a Milton street name.
 */
export function isMalformedSlug(slug: string): boolean {
  if (EXACT_BLACKLIST.has(slug)) return true;

  const parts = slug.split("-");
  if (parts.length < 3) return false;
  if (parts[parts.length - 1] !== "milton") return false;

  // Token-based malformation: "na", "unt", "bsmt", "basement" anywhere mid-slug.
  for (let i = 1; i < parts.length - 1; i++) {
    if (MALFORMED_TOKENS.has(parts[i].toLowerCase())) return true;
  }

  // "upper" as a unit descriptor — reject when it appears AFTER a street-type
  // token (featherstone-rd-upper, savoline-blvd-upper, etc.). Legitimate
  // "Upper X" street names have "upper" at the start, not after a suffix.
  let sawStreetType = false;
  for (let i = 1; i < parts.length - 1; i++) {
    const t = parts[i].toLowerCase();
    if (STREET_TYPE_TOKENS.has(t)) sawStreetType = true;
    else if (sawStreetType && (t === "upper" || t === "only")) return true;
  }

  // Numeric-only mid-slug token AFTER a street-type token = unit number
  // artifact. "3-side-rd-milton" is legitimate (leading numeric, side-road),
  // "farmstead-dr-ne-88-milton" is garbage (numeric after street-type "dr").
  sawStreetType = false;
  for (let i = 1; i < parts.length - 1; i++) {
    const t = parts[i].toLowerCase();
    if (STREET_TYPE_TOKENS.has(t)) sawStreetType = true;
    else if (sawStreetType && /^\d+$/.test(t)) return true;
  }

  // Step 13h — doubled street-type + numeric pattern.
  // asleton-blvd-boulevard-140-milton: adjacent abbreviation+full-form pair
  // with a numeric unit number somewhere later. MLS-ingestion artifact where
  // both StreetSuffix and suffix-in-StreetName landed in the slug plus the
  // unit number.
  for (let i = 1; i < parts.length - 2; i++) {
    const a = parts[i].toLowerCase();
    const b = parts[i + 1].toLowerCase();
    const isPair = SUFFIX_PAIRS.some(([abbr, full]) =>
      (a === abbr && b === full) || (a === full && b === abbr),
    );
    if (!isPair) continue;
    // Look for any numeric-only token after the pair (before -milton).
    for (let j = i + 2; j < parts.length - 1; j++) {
      if (/^\d+$/.test(parts[j])) return true;
    }
  }

  return false;
}
