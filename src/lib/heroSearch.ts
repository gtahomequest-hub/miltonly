// src/lib/heroSearch.ts
// Hero/search resolver: turn typed text into a real destination, entity-first.
//
// TWO-TIER match so a bare neighbourhood name and a same-named street can both
// resolve correctly (Board V1 FIX 1 + collision flip):
//
//   Tier 1 — EXACT full key (keep street-type + directional tokens, expand
//            abbreviations, drop milton/province). Order: street -> condo ->
//            neighbourhood. So "Beaty Trail" and "Twiss Road" match their STREET
//            exactly; a bare "Beaty"/"Dempsey" doesn't match any street's full
//            key but DOES match the neighbourhood's -> neighbourhood.
//   Tier 2 — LOOSE core key (also strip trailing street-type + directional
//            tokens). Order flips to NEIGHBOURHOOD -> street -> condo, so on a
//            genuine collision the neighbourhood wins. "twiss" (no neighbourhood)
//            still falls to the street here.
//   Then intent keywords (worth/value -> /sell, rent/lease -> /rentals), then
//   /listings?q=.
//
// Result: "Beaty" -> /neighbourhoods/beaty, "Beaty Trail" -> the street,
//         "twiss" -> the street, "Holdsworth Cres" -> the street (not /sell).
//
// Keys are built from the clean canonical SLUG, never the messy `name` field
// ("Twiss Rd", "Farmstead. Dr"). A key mapping to >1 distinct slug is AMBIGUOUS
// and excluded, so we never guess — those fall through.

import { prisma } from "@/lib/prisma";
import { SURFACED_STREET_WHERE } from "@/lib/streetSurface";

const DROP = new Set(["milton", "on", "ont", "ontario", "canada", "ca"]);

// Abbreviation + directional expansion, applied per token for the FULL key so a
// typed abbreviation matches the slug's full words ("rd" -> "road", "s" -> "south").
const EXPAND: Record<string, string> = {
  rd: "road", av: "avenue", ave: "avenue", st: "street", dr: "drive",
  blvd: "boulevard", cres: "crescent", crt: "court", ct: "court", cir: "circle",
  pl: "place", ln: "lane", trl: "trail", ter: "terrace", terr: "terrace",
  pkwy: "parkway", sq: "square", gt: "gate", grv: "grove", hts: "heights",
  n: "north", s: "south", e: "east", w: "west",
  ne: "northeast", nw: "northwest", se: "southeast", sw: "southwest",
};

// Trailing street-type + directional tokens stripped for the LOOSE key.
const TAIL = new Set([
  "n", "s", "e", "w", "north", "south", "east", "west", "ne", "nw", "se", "sw",
  "rd", "road", "ave", "av", "avenue", "st", "street", "dr", "drive", "blvd", "boulevard",
  "cres", "crescent", "crt", "ct", "court", "way", "ln", "lane", "pl", "place", "cir", "circle",
  "terr", "ter", "terrace", "gate", "gt", "grove", "grv", "trail", "trl", "hts", "heights",
  "pkwy", "parkway", "sq", "square", "row", "close", "common", "commons", "gardens", "gdns",
  "green", "grn", "mews", "path", "ridge", "run", "walk", "bay", "line", "cross", "crossing",
  "hollow", "hill", "view", "vale", "glen", "manor", "park", "pass", "point", "pt",
]);

function tokens(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .filter((t) => !DROP.has(t));
}

/** Full key: keep every token, expand abbreviations/directionals. */
export function fullKey(input: string): string {
  return tokens(input).map((t) => EXPAND[t] ?? t).join("");
}

/** Loose key: strip trailing street-type + directional tokens. */
export function looseKey(input: string): string {
  const toks = tokens(input);
  while (toks.length > 1 && TAIL.has(toks[toks.length - 1])) toks.pop();
  return toks.join("");
}

type KeyMap = { full: Map<string, string>; loose: Map<string, string> };
type Index = { streets: KeyMap; condos: KeyMap; neighbourhoods: KeyMap };

let _cache: Index | null = null;
let _cacheAt = 0;
const TTL_MS = 60 * 60 * 1000;

/** Build full+loose key->slug maps, dropping keys that map to >1 distinct slug. */
function buildKeyMap(rows: { slug: string }[]): KeyMap {
  const full = new Map<string, string>();
  const loose = new Map<string, string>();
  const fAmb = new Set<string>();
  const lAmb = new Set<string>();
  for (const r of rows) {
    const fk = fullKey(r.slug);
    if (fk) {
      const ex = full.get(fk);
      if (ex === undefined) full.set(fk, r.slug);
      else if (ex !== r.slug) fAmb.add(fk);
    }
    const lk = looseKey(r.slug);
    if (lk) {
      const ex = loose.get(lk);
      if (ex === undefined) loose.set(lk, r.slug);
      else if (ex !== r.slug) lAmb.add(lk);
    }
  }
  fAmb.forEach((k) => full.delete(k));
  lAmb.forEach((k) => loose.delete(k));
  return { full, loose };
}

async function getIndex(): Promise<Index> {
  if (_cache && Date.now() - _cacheAt < TTL_MS) return _cache;
  const [streets, condos, neighbourhoods] = await Promise.all([
    // Surfaced entities only — dormant/pageless registry entities never resolve
    // (they would 404). See streetSurface.ts.
    prisma.residentialStreet.findMany({ where: SURFACED_STREET_WHERE, select: { slug: true }, orderBy: { soldCount12mo: "desc" } }),
    prisma.condoBuilding.findMany({ select: { slug: true } }),
    prisma.neighbourhood.findMany({ select: { slug: true } }),
  ]);
  _cache = {
    streets: buildKeyMap(streets),
    condos: buildKeyMap(condos),
    neighbourhoods: buildKeyMap(neighbourhoods),
  };
  _cacheAt = Date.now();
  return _cache;
}

/** Resolve typed text to a destination href. */
export async function resolveHeroSearch(raw: string): Promise<string> {
  const q = raw.trim();
  if (!q) return "/listings";

  const fk = fullKey(q);
  const lk = looseKey(q);
  if (fk || lk) {
    const idx = await getIndex();
    // Tier 1 — exact full key: street -> condo -> neighbourhood.
    if (fk) {
      const s = idx.streets.full.get(fk);
      if (s) return `/streets/${s}`;
      const c = idx.condos.full.get(fk);
      if (c) return `/condos/${c}`;
      const n = idx.neighbourhoods.full.get(fk);
      if (n) return `/neighbourhoods/${n}`;
    }
    // Tier 2 — loose key: neighbourhood -> street -> condo (collision flip).
    if (lk) {
      const n = idx.neighbourhoods.loose.get(lk);
      if (n) return `/neighbourhoods/${n}`;
      const s = idx.streets.loose.get(lk);
      if (s) return `/streets/${s}`;
      const c = idx.condos.loose.get(lk);
      if (c) return `/condos/${c}`;
    }
  }

  // Intent keywords run AFTER entity matching so real streets win.
  const s = q.toLowerCase();
  if (/\b(worth|value|valuation|sell|selling|apprais)/.test(s)) return "/sell";
  if (/\b(rent|rental|lease|leasing|tenant)/.test(s)) return "/rentals";

  return `/listings?q=${encodeURIComponent(q)}`;
}
