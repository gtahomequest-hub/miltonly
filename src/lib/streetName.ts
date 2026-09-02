// src/lib/streetName.ts
// THE NAMING AUTHORITY. DEC-NAME-SOURCE Build 1.
//
// One resolver, slug-keyed, registry-first. Every display surface calls this; nothing derives a
// street's display name any other way. Before this module the name was minted independently in
// ~15 places off whatever MLS happened to write, and the Town registry was read by NONE of them —
// src/lib/street-data.ts never even imported it.
//
// PURE ON PURPOSE. No `server-only`, no prisma, no DB. The helpers below used to live in
// street-data.ts behind its `import "server-only"`, which is why scripts/build-street-adjacency.ts
// grew a private copy of the same logic that then drifted. They are moved here unchanged and
// re-exported from street-data.ts, so every existing importer keeps working.
//
// SLUG-KEYED IS A CORRECTNESS REQUIREMENT, NOT A PREFERENCE. Resolving by NAME reproduces the exact
// defect this exists to fix: canonicalizeResidential("KENNEDY CIRCLE") returns KENNEDY CIRCLE WEST,
// because its tokeniser pops directionals before matching and all three Kennedy rows collide on the
// same key. Only an exact-slug lookup is safe. Kennedy Circle / East / West are three streets.
//
// DIRECTIONALS ARE NOT PART OF A NAME. The registry carries no directional field; a directional
// street is its own row (KENNEDY CIRCLE EAST). Where MLS supplies one for a street the Town lists
// undirected, it belongs in street_direction (see vow-sync.ts), never in the rendered name.

import { MILTON_STREET_REGISTRY, type RegistryStreet } from "@/data/miltonStreetRegistry";
import { OFF_REGISTRY_SET } from "@/data/offRegistryStreets";
import { config } from "@/lib/config";

/** Token-level expansion map for street-type abbreviations and compass
 *  directions. Applied only to the display form of the street name — the
 *  short form (used in prose) keeps abbreviations. */
const STREET_ABBREVIATIONS: Record<string, string> = {
  ave: "Avenue",
  st: "Street",
  rd: "Road",
  dr: "Drive",
  ct: "Court",
  // Step 11d: real-world DB1 streetName values use "Crt" for Court.
  // Slug forms include both -crt-milton and -court-milton. Both abbreviation
  // variants map to "Court" — the canonical full-word form.
  crt: "Court",
  cres: "Crescent",
  blvd: "Boulevard",
  ln: "Lane",
  pl: "Place",
  tr: "Trail",
  trl: "Trail",
  cir: "Circle",
  hts: "Heights",
  gt: "Gate",
  cmn: "Common",
  pk: "Park",
  // Step 11d: parkway variants (pkwy/pky) absent from universe audit but
  // mapped here for completeness across GTA datasets.
  pkwy: "Parkway",
  pky: "Parkway",
  rdg: "Ridge",
  gr: "Grove",
  gv: "Grove",
  cl: "Close",
  wk: "Walk",
  hl: "Hill",
  ter: "Terrace",
  terr: "Terrace",
  vw: "View",
  hwy: "Highway",
  // compass directions
  e: "East",
  w: "West",
  n: "North",
  s: "South",
  ne: "Northeast",
  nw: "Northwest",
  se: "Southeast",
  sw: "Southwest",
};

/** Strip trailing " Milton" if present — shared by both display and short-name
 *  derivations so stored DB names and slug-derived names are normalized
 *  identically. */
function stripTrailingCity(name: string): string {
  const tokens = name.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens[tokens.length - 1].toLowerCase() === config.CITY_NAME.toLowerCase()) {
    return tokens.slice(0, -1).join(" ");
  }
  return name;
}

/** Expand street-type abbreviations ("Cres" → "Crescent") and compass
 *  abbreviations ("E" → "East") for DISPLAY contexts: H1, page title,
 *  breadcrumbs, schema.org Place.name. Strips trailing " Milton" so the
 *  city suffix never double-renders.
 *
 *  Step 13h — after expansion, collapse adjacent duplicates so names like
 *  "Asleton Blvd Boulevard" (where raw MLS fields concatenated a suffix
 *  abbreviation AND its full-word form) render as "Asleton Boulevard".
 *
 *  Step 13h — Ontario rural-address exception. When the raw name begins
 *  with a bare numeric token followed by "Side", "Sideroad", or "Line",
 *  preserve the number as part of the street name ("3 Side Road", not
 *  just "Side Road"). For conventional street names where the leading
 *  number is a house number, the caller is responsible for stripping it
 *  BEFORE calling expandStreetName. This function preserves whatever
 *  numeric tokens it receives. */
export function expandStreetName(name: string): string {
  const cleaned = stripTrailingCity(name);
  const expanded = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const key = token.toLowerCase().replace(/\.$/, "");
      return STREET_ABBREVIATIONS[key] ?? token;
    });
  // Collapse adjacent duplicate tokens (case-insensitive). Catches the
  // doubled-suffix artifact from upstream data-ingestion paths that
  // concatenate StreetName + StreetSuffix without de-duplication.
  const deduped: string[] = [];
  for (const tok of expanded) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.toLowerCase() === tok.toLowerCase()) continue;
    deduped.push(tok);
  }
  return deduped.join(" ");
}

const STREET_SUFFIXES = new Set([
  "avenue", "street", "road", "drive", "court", "crescent", "boulevard",
  "lane", "way", "place", "trail", "line", "circle", "terrace",
  "heights", "gate", "common", "park", "ridge", "grove", "close", "walk", "hill",
  // abbreviations (with trailing period stripped before match)
  "ave", "st", "rd", "dr", "ct", "cres", "blvd", "ln", "pl", "tr", "cir",
  "hts", "gt", "cmn", "pk", "rdg", "gr", "cl", "wk", "hl", "ter", "terr",
]);

export function shortNameFor(name: string): string {
  let tokens = stripTrailingCity(name).split(/\s+/).filter(Boolean);
  // Strip a street-type suffix (e.g. "Crescent", "Ave", "Cres.").
  if (tokens.length > 1) {
    const tail = tokens[tokens.length - 1].toLowerCase().replace(/\.$/, "");
    if (STREET_SUFFIXES.has(tail)) tokens = tokens.slice(0, -1);
  }
  return tokens.join(" ") || name;
}
/**
 * The ONE repair for a street's display name. It lives here, beside expandStreetName, because
 * `streetName` feeds BOTH the H1 (via mapStreetV2Data -> sections.tsx) and generateMetadata's
 * <title>. Repairing it inside generateMetadata alone would have made the title disagree with the
 * page's own heading on every affected street — the same class of defect as a snippet disagreeing
 * with its glance tile.
 *
 * Every rule was measured against real computed names, not assumed:
 *   UNIT      "Kovachik Boulevard #bsmt"     a listing's unit designator leaked into the name
 *   HOUSENUM  "420 Hincks Drive"             a street number leaked in; the slug proves it is not
 *                                            part of the name (hincks-drive-milton). "25 Side Rd"
 *                                            KEEPS its 25, because its slug is 25-side-road-milton.
 *   DOUBLED   "15 Side Road Side Road"       adjacent repeated phrase
 *             "First Line Nassagaweya Line"  trailing type word already present earlier
 *   CASING    "Mcdougall Crossing"           15 streets; Mc/Mac/O' need the next letter capitalised
 *
 * Deliberately NOT handled: appending a type word the slug carries and the name lacks (e.g.
 * "Sycamore" <- sycamore-garden). No instance survived measurement, and inventing a suffix from a
 * slug risks renaming a street that is genuinely named without one.
 */
const NAME_TYPE_WORDS =
  "Road|Drive|Court|Line|Street|Avenue|Way|Gate|Terrace|Crescent|Boulevard|Place|Close|Circle|Trail|Gardens|Garden|Grove|Lane|Park|Path|Square|Hill|Heights|Landing|Centre|Common|Mews|Row|Bend|Point|View|Walk|Crossing";

export function displayStreetName(name: string, slug: string): string {
  let n = (name ?? "").trim();
  if (!n) return n;

  // UNIT — drop a "#unit" token and everything after it.
  n = n.replace(/\s*#.*$/, "").trim();

  // HOUSENUM — strip a leading number ONLY when the slug does not also begin with one.
  // The slug is the arbiter: 25-side-road-milton legitimately begins with its number.
  if (/^\d+\s+\S/.test(n) && !/^\d/.test(slug)) n = n.replace(/^\d+\s+/, "");

  // DOUBLED (adjacent) — "A B A B" -> "A B", for a repeated 1-3 word phrase.
  n = n.replace(/\b((?:\w+)(?:\s+\w+){0,2})\s+\1\b/gi, "$1");

  // DOUBLED (non-adjacent) — a TRAILING type word already present earlier is redundant:
  // "First Line Nassagaweya Line" -> "First Line Nassagaweya". Only ever drops the final token,
  // and only when the identical type word already appears before it.
  // Token comparison, not a built RegExp: the escaping in a string-built pattern is easy to get
  // wrong and fails SILENTLY (a lost backslash turns \s into a literal "s", and the rule quietly
  // never fires). Comparing words needs no escaping and cannot degrade that way.
  const parts = n.split(/\s+/);
  if (parts.length > 2) {
    const last = parts[parts.length - 1].toLowerCase();
    const isTypeWord = NAME_TYPE_WORDS.split("|").some((t) => t.toLowerCase() === last);
    const seenEarlier = parts.slice(0, -1).some((w) => w.toLowerCase() === last);
    if (isTypeWord && seenEarlier) n = parts.slice(0, -1).join(" ");
  }

  // CASING — "Mcdougall" -> "McDougall", "Macdonald" -> "MacDonald", "O'brien" -> "O'Brien".
  n = n
    .replace(/\bMc([a-z])/g, (_m, c: string) => "Mc" + c.toUpperCase())
    .replace(/\bMac([a-z])(?=[a-z]{2,})/g, (_m, c: string) => "Mac" + c.toUpperCase())
    .replace(/\bO'([a-z])/g, (_m, c: string) => "O'" + c.toUpperCase());

  return n.replace(/\s{2,}/g, " ").trim();
}

// ── the registry index ────────────────────────────────────────────────────────
const REGISTRY_BY_SLUG: Map<string, RegistryStreet> = new Map(
  MILTON_STREET_REGISTRY.map((r) => [r.slug, r]),
);

/** Registry `type` -> the display word. The registry stores it lowercase and separate from `name`. */
const TYPE_LABEL: Record<string, string> = {
  avenue: "Avenue", boulevard: "Boulevard", centre: "Centre", circle: "Circle",
  close: "Close", common: "Common", court: "Court", crescent: "Crescent",
  crossing: "Crossing", drive: "Drive", garden: "Garden", gate: "Gate",
  heights: "Heights", landing: "Landing", lane: "Lane", line: "Line",
  numbered: "", parkway: "Parkway", path: "Path", place: "Place",
  point: "Point", road: "Road", street: "Street", terrace: "Terrace",
  townline: "Townline", trail: "Trail", way: "Way",
};

/**
 * ALL-CAPS registry name -> display form, WITHOUT regressing intra-word casing.
 *
 * This ordering is load-bearing. The registry is generated from a Town PDF that stores names in
 * ALL CAPS, which destroys the capital inside "McDougall". Naive title-casing therefore yields
 * "Mcdougall Crossing" — and production currently renders "McDougall Crossing" CORRECTLY, because
 * displayStreetName repairs it downstream. Shipping the registry name without this composition
 * would regress 15 live pages from right to wrong.
 *
 * Mc/Mac/O' must run AFTER the title-case pass: the repair matches a LOWERCASE letter after the
 * prefix, so it cannot fire against "MCDOUGALL" and only works on "Mcdougall".
 */
export function titleCaseOfficial(allCaps: string): string {
  const titled = allCaps
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return applyMcMacO(titled);
}

/** The Mc/Mac/O' repair, extracted so titleCaseOfficial and displayStreetName share one rule. */
export function applyMcMacO(s: string): string {
  return s
    .replace(/\bMc([a-z])/g, (_m, c: string) => "Mc" + c.toUpperCase())
    .replace(/\bMac([a-z])(?=[a-z]{2,})/g, (_m, c: string) => "Mac" + c.toUpperCase())
    .replace(/\bO'([a-z])/g, (_m, c: string) => "O'" + c.toUpperCase());
}

export type NameSource = "registry" | "off-registry" | "fallback";

export interface ResolvedStreetName {
  name: string;
  shortName: string;
  streetType: string | null;
  source: NameSource;
}

/**
 * THE ONE ENTRY POINT. Give it a slug; it returns the name every surface must render.
 *
 * `source` is deliberately part of the return value, not an internal detail: /admin/review needs to
 * show a reviewer raw-vs-registry side by side, and a "fallback" result is the signal that the Town
 * registry (REGISTRY_VERSION, a periodic PDF republish) has not caught up with a new subdivision.
 *
 * NEVER RETURNS A BARE SLUG. sync/vip-hubs previously wrote `sample?.streetName || slug` into the
 * field that outranks everything at render, so a raw slug could surface as an H1.
 */
export function resolveStreetName(slug: string, fallbackRaw?: string | null): ResolvedStreetName {
  const reg = REGISTRY_BY_SLUG.get(slug);
  if (reg) {
    const name = titleCaseOfficial(reg.name);
    return {
      name,
      // RegistryStreet.base is the Town's own base form ("buckthorn" for BUCKTHORN GARDEN) and was
      // read by nothing before this. It is a better shortName source than stripping a suffix from
      // the display name, because shortNameFor's suffix set omits 9 of the 27 registry types.
      shortName: applyMcMacO(titleCaseOfficial(reg.base)) || name,
      streetType: TYPE_LABEL[reg.type] || null,
      source: "registry",
    };
  }

  // Off-registry rural/Region roads. canonicalizeResidential returns canonicalName: null for these,
  // which means PASS THROUGH, not "no name" — reading it as empty breaks 25 Side Road, Second Line
  // and Nipissing Road, all of which render correctly today off the legacy chain.
  const viaFallback = fallbackFor(slug, fallbackRaw);
  if (OFF_REGISTRY_SET.has(slug)) return { ...viaFallback, source: "off-registry" };
  return viaFallback;
}

/** The pre-existing derivation, unchanged — still the right answer when the registry has no row. */
function fallbackFor(slug: string, fallbackRaw?: string | null): ResolvedStreetName {
  const raw = (fallbackRaw ?? "").trim();
  const base = raw ? displayStreetName(expandStreetName(raw), slug) : deslugForDisplay(slug);
  const name = base || deslugForDisplay(slug);
  return { name, shortName: shortNameFor(name) || name, streetType: null, source: "fallback" };
}

/** Last resort so a bare slug can never reach a heading. Only used when no raw name exists at all. */
function deslugForDisplay(slug: string): string {
  const words = slug
    .replace(new RegExp(`-${config.CITY_NAME.toLowerCase()}$`), "")
    .split("-")
    .filter(Boolean);
  return applyMcMacO(words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "));
}
