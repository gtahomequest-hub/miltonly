// src/lib/town/identity.ts
// ONE street-identity parser, shared by the generator, the backfill and the ingest write path.
//
// Three vocabularies have to agree before anything can be joined:
//   · our slugs          "fifth-line-nassagaweya-milton", "25-side-road-milton"
//   · MLS address text   "1551 Labine Point, Milton, ON L9E 1V5", "115 Nipissing Road 402 A"
//   · the Town's layers  GEOSTNAME "NO 5" + SUFSTTYPE "SIDE ROAD"
//
// A recon pass that split slugs on the last hyphen matched 1 of 18 off-registry roads and read as
// a data problem. It was a parser problem: SIDE ROAD is a TWO-token street type and every side
// road is named "NO 5". Hence one implementation, with the Town's actual vocabulary in it.
//
// The key is {base}||{type} with direction dropped, because a street page unions its directional
// siblings (Bronte Street N and S are one street).

/** Spelled and ordinal forms our slugs use where the Town writes a bare number. */
const WORD_NUMBER: Record<string, string> = {
  one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8',
  nine: '9', ten: '10', eleven: '11', twelve: '12', fourteen: '14', fifteen: '15',
  seventeen: '17', twenty: '20', thirty: '30',
  first: '1', second: '2', third: '3', fourth: '4', fifth: '5', sixth: '6', seventh: '7',
  eighth: '8', ninth: '9', tenth: '10', fourteenth: '14', fifteenth: '15', seventeenth: '17',
  twentieth: '20', thirtieth: '30',
};

const DIRECTIONS = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw',
  'north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest']);

/** Multi-token street types, longest first — these must be tested before single tokens. */
const MULTI_TOKEN_TYPES: Array<[RegExp, string]> = [
  [/side-?road$/, 'side-road'],
  [/side-rd$/, 'side-road'],
  [/town-?line$/, 'townline'],
  [/ring-road$/, 'road'],
];

/** Single-token types, with the abbreviations MLS uses mapped onto the Town's spelling. */
const TYPE_ALIAS: Record<string, string> = {
  st: 'street', str: 'street', rd: 'road', dr: 'drive', drv: 'drive', ave: 'avenue', av: 'avenue',
  crt: 'court', ct: 'court', cres: 'crescent', cr: 'crescent', crescent: 'crescent',
  blvd: 'boulevard', pl: 'place', ln: 'lane', ter: 'terrace', terr: 'terrace', trl: 'trail',
  hts: 'heights', ht: 'heights', pt: 'point', gt: 'gate', cir: 'circle', sq: 'square',
  pkwy: 'parkway', gdns: 'garden', gdn: 'garden', gardens: 'garden', grv: 'grove',
  cmn: 'common', xing: 'crossing', lndg: 'landing', hwy: 'highway', hy: 'highway',
  sr: 'side-road', cross: 'crossing',
};

const KNOWN_TYPES = new Set(['street', 'road', 'drive', 'avenue', 'court', 'crescent', 'boulevard',
  'terrace', 'trail', 'way', 'gate', 'circle', 'heights', 'place', 'lane', 'line', 'crossing',
  'landing', 'garden', 'point', 'parkway', 'path', 'close', 'common', 'highway', 'square',
  'grove', 'centre', 'townline', 'side-road']);

const canonicalType = (raw: string): string => {
  const t = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!t) return '';
  const mapped = TYPE_ALIAS[t] ?? t;
  return KNOWN_TYPES.has(mapped) ? mapped : '';
};

/** Numbered roads are written six ways by MLS and one way by the Town ("NO 5"). */
const canonicalBase = (raw: string): string => {
  let b = raw.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  b = b.replace(/^no-/, '');                          // "NO 5" -> "5"
  return b
    .split('-')
    .filter(Boolean)
    .filter((t) => !DIRECTIONS.has(t))
    .map((t) => WORD_NUMBER[t] ?? t.replace(/^(\d+)(st|nd|rd|th)$/, '$1'))
    .join('-');
};

export interface StreetIdentity {
  base: string;
  type: string;
  /** `${base}||${type}` — the join key */
  key: string;
}

const identity = (base: string, type: string): StreetIdentity => ({ base, type, key: `${base}||${type}` });

/** Identity of one of our slugs: "fifth-line-nassagaweya-milton" -> {5-line-nassagaweya, line}. */
export function identityFromSlug(slug: string): StreetIdentity {
  const s = String(slug ?? '').toLowerCase().replace(/-milton$/, '');
  for (const [re, type] of MULTI_TOKEN_TYPES) {
    if (re.test(s)) return identity(canonicalBase(s.replace(re, '')), type);
    // leading form: "sideroad-10"
    const lead = s.match(/^(side-?road|side-rd)-(.+)$/);
    if (lead) return identity(canonicalBase(lead[2]), 'side-road');
  }
  const parts = s.split('-');
  const tail = canonicalType(parts[parts.length - 1] ?? '');
  if (tail && parts.length > 1) return identity(canonicalBase(parts.slice(0, -1).join('-')), tail);
  return identity(canonicalBase(s), '');
}

/** Identity of a Town feature: GEOSTNAME + SUFSTTYPE (Roads) or STREET_TYPE (Address Points). */
export function identityFromTown(geostname: string | null, sufsttype: string | null): StreetIdentity {
  return identity(canonicalBase(String(geostname ?? '')), canonicalType(String(sufsttype ?? '')));
}

export interface ParsedAddress {
  /** street number as an integer — the join key's other half */
  number: number;
  identity: StreetIdentity;
}

/** Tokens MLS welds into the street field that are not part of any street name. */
const OCCUPANCY = new Set(['bsmt', 'bsmnt', 'basement', 'upstairs', 'upper', 'lower', 'main',
  'ph', 'th', 'unit', 'apt', 'lot', 'blk', 'block', 'na', 'n', 'a', 'only', 'floor', '2nd']);

/** MLS address text -> {number, identity}. Reads `address`, NOT `street_name`: the latter is
 *  abbreviated ("Hop Pl", "Caverhill Cres") and drops the street number entirely. */
export function parseAddress(address: string | null | undefined): ParsedAddress | null {
  if (!address) return null;
  const head = String(address).split(',')[0].trim();
  const m = head.match(/^(\d+)\s+(.+)$/);
  if (!m) return null;
  const number = Number(m[1]);
  if (!Number.isFinite(number) || number <= 0) return null;

  const tokens = m[2].toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/).filter(Boolean);

  // Trailing unit designators, in the three shapes the feed produces: a bare number (402), a
  // number with a letter (105b), and a LETTER-then-number suite code (a509, d810). Without the
  // third, every unit in one condo tower parses as a different street.
  while (tokens.length > 1) {
    const last = tokens[tokens.length - 1];
    if (/^\d+[a-z]?$/.test(last) || /^[a-z]\d{2,4}$/.test(last) || OCCUPANCY.has(last)) tokens.pop();
    else break;
  }

  // A two-token type has to be consumed before the single-token test sees only its last word.
  const joined = tokens.join('-');
  for (const [re, type] of MULTI_TOKEN_TYPES) {
    if (re.test(joined)) return { number, identity: identity(canonicalBase(joined.replace(re, '')), type) };
  }

  while (tokens.length > 1 && DIRECTIONS.has(tokens[tokens.length - 1])) tokens.pop();
  if (!tokens.length) return null;

  const tail = canonicalType(tokens[tokens.length - 1]);
  if (tail && tokens.length > 1) return { number, identity: identity(canonicalBase(tokens.slice(0, -1).join('-')), tail) };
  return { number, identity: identity(canonicalBase(tokens.join('-')), '') };
}

/** The rooftop lookup key: one address point per (street number, street identity). */
export const rooftopKey = (number: number, id: StreetIdentity): string => `${number}|${id.key}`;
