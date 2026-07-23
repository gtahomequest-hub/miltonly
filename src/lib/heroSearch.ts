// src/lib/heroSearch.ts
// Hero search resolver: turn typed text into a real destination, entity-FIRST.
// Order (per Board V1 FIX 1): ResidentialStreet -> CondoBuilding -> Neighbourhood
// -> intent keywords (worth/value -> /sell, rent/lease -> /rentals) -> /listings?q=.
//
// Matching is deterministic NORMALIZED-EXACT, not fuzzy — NO new dependency.
// Both the query and each entity's canonical SLUG are reduced to a "core key"
// by lowercasing, dropping "milton"/province tokens, and stripping trailing
// street-type + directional tokens. So "twiss", "Twiss Rd", and
// "Twiss Road Milton" all reduce to "twiss" and hit /streets/twiss-road-milton.
//
// Entity-before-intent is the whole point: "Holdsworth Cres" (a real street whose
// name contains "worth") resolves to the STREET, not /sell; bare "worth" has no
// street key and falls through to the /sell intent.
//
// Keys are built from the clean canonical SLUG, never the messy `name` field
// ("Twiss Rd", "Farmstead. Dr"). Collisions (two distinct streets reducing to the
// same core, e.g. Main St E / Main St W -> "main") are marked AMBIGUOUS and
// excluded, so we never guess — those fall through to /listings?q= search.

import { prisma } from "@/lib/prisma";

const DROP = new Set(["milton", "on", "ont", "ontario", "canada", "ca"]);

// Street-type + directional tokens stripped from the TAIL of a name/slug.
const TAIL = new Set([
  // directionals
  "n", "s", "e", "w", "north", "south", "east", "west", "ne", "nw", "se", "sw",
  // street types (Ontario common)
  "rd", "road", "ave", "av", "avenue", "st", "street", "dr", "drive", "blvd", "boulevard",
  "cres", "crescent", "crt", "ct", "court", "way", "ln", "lane", "pl", "place", "cir", "circle",
  "terr", "ter", "terrace", "gate", "gt", "grove", "grv", "trail", "trl", "hts", "heights",
  "pkwy", "parkway", "sq", "square", "row", "close", "common", "commons", "gardens", "gdns",
  "green", "grn", "mews", "path", "ridge", "run", "walk", "bay", "line", "cross", "crossing",
  "hollow", "hill", "view", "vale", "glen", "manor", "park", "pass", "point", "pt", "gardens",
]);

/** Reduce a name or slug to its comparable "core" (letters/digits only). */
export function coreKey(input: string): string {
  const toks = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .filter((t) => !DROP.has(t));
  while (toks.length > 1 && TAIL.has(toks[toks.length - 1])) toks.pop();
  return toks.join("");
}

type Index = {
  streets: Map<string, string>;
  condos: Map<string, string>;
  neighbourhoods: Map<string, string>;
};

let _cache: Index | null = null;
let _cacheAt = 0;
const TTL_MS = 60 * 60 * 1000; // entities change rarely; refresh hourly

/** Build a key->slug map, dropping any key that maps to >1 distinct slug. */
function buildMap(rows: { slug: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const r of rows) {
    const k = coreKey(r.slug);
    if (!k) continue;
    const existing = map.get(k);
    if (existing === undefined) map.set(k, r.slug);
    else if (existing !== r.slug) ambiguous.add(k);
  }
  for (const k of ambiguous) map.delete(k);
  return map;
}

async function getIndex(): Promise<Index> {
  if (_cache && Date.now() - _cacheAt < TTL_MS) return _cache;
  const [streets, condos, neighbourhoods] = await Promise.all([
    // most-sold first so a first-wins collision (before ambiguity check) favours it
    prisma.residentialStreet.findMany({
      select: { slug: true },
      orderBy: { soldCount12mo: "desc" },
    }),
    prisma.condoBuilding.findMany({ select: { slug: true } }),
    prisma.neighbourhood.findMany({ select: { slug: true } }),
  ]);
  _cache = {
    streets: buildMap(streets),
    condos: buildMap(condos),
    neighbourhoods: buildMap(neighbourhoods),
  };
  _cacheAt = Date.now();
  return _cache;
}

/** Resolve typed hero-search text to a destination href. */
export async function resolveHeroSearch(raw: string): Promise<string> {
  const q = raw.trim();
  if (!q) return "/listings";

  const key = coreKey(q);
  if (key) {
    const idx = await getIndex();
    const street = idx.streets.get(key);
    if (street) return `/streets/${street}`;
    const condo = idx.condos.get(key);
    if (condo) return `/condos/${condo}`;
    const nb = idx.neighbourhoods.get(key);
    if (nb) return `/neighbourhoods/${nb}`;
  }

  // Intent keywords run AFTER entity matching (so real streets win).
  const s = q.toLowerCase();
  if (/\b(worth|value|valuation|sell|selling|apprais)/.test(s)) return "/sell";
  if (/\b(rent|rental|lease|leasing|tenant)/.test(s)) return "/rentals";

  return `/listings?q=${encodeURIComponent(q)}`;
}
