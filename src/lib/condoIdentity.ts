// Condo-building identity canonicalization (A1 ingestion-canonicalization gap,
// condo path). WS3's backfill grouped condo entities by RAW DB2
// (street_number, street_slug) — every dirty slug variant (units baked into
// the street field, doubled suffixes, misspellings, direction noise) became
// its own CondoBuilding entity, and the WS5 content batch generated pages for
// them 1:1 (the 2026-06 dedup: 112 raw groups → 68 true buildings).
//
// deriveCondoIdentity is a thin WRAPPER over deriveIdentity (streetUtils) —
// the street-tier core is delegated to, never duplicated, so the two paths
// cannot diverge. The wrapper handles ONLY what a building address adds on
// top of a street slug:
//
//   1. misspelling map        whitelock→whitlock, reginal→regional, …
//   2. junk-token drop        "na" (a literal N/A that reached StreetName)
//   3. direction-token drop   leading/interior E/W/SW/… (deriveIdentity only
//                             strips ONE trailing direction; building slugs
//                             carry them anywhere: e-main, main-e-street)
//   4. numbered-road allowlist  regional-road-25 — the "25" is street NAME,
//                             not a unit; both the unit-strip and
//                             deriveIdentity would otherwise mangle it
//   5. unit-descriptor strip  d204 / b412 / a-114 / sw-206 / 1803-b after the
//                             street-type suffix
//   6. first-suffix-wins      derry-rd-drive → road (differing-suffix runs;
//                             deriveIdentity's doubled-suffix collapse only
//                             merges SAME-canon pairs like rd-road)
//   7. street_number prefix   "309-770" / "418-490" — unit-streetnumber
//                             concatenation in street_number itself
//
// Suffix CONFLICTS across variants of one building (480-gordon-krantz-
// boulevard vs -avenue, 610-farmstead-road vs -drive, suffix-less
// 490-gordon-krantz) are NOT resolvable from a single slug. clusterKey
// deliberately excludes the suffix so the backfill can group by
// (number, base) and pick the majority suffix by trade count.

import {
  deriveIdentity,
  IDENTITY_SUFFIX_TOKENS,
  IDENTITY_SUFFIX_CANON,
} from "@/lib/streetUtils";
import { config } from "@/lib/config";

export interface CondoIdentity {
  streetNumber: string;     // unit-prefix split applied ("309-770" → "770")
  base: string;             // "whitlock" | "gordon-krantz" | "regional-road-25"
  suffixCanonical: string;  // "" when the slug carried no/only-special suffix
  canonicalSlug: string;    // `${streetNumber}-${base}[-${suffix}]-${SLUG_SUFFIX}`
  clusterKey: string;       // `${streetNumber}|${base}` — suffix EXCLUDED (majority vote at grouping)
}

// Misspellings observed in DB2 sold_records street fields (Milton condo set).
// Per-token, applied before any structural analysis.
const MISSPELLING_MAP: Record<string, string> = {
  whitelock: "whitlock",
  reginal: "regional",
  ledger: "leger",
  kranz: "krantz",
};

// Literal junk tokens that reached the street field ("N/A" → "na").
const JUNK_TOKENS: ReadonlySet<string> = new Set(["na"]);

// Direction tokens dropped at ANY position (street-tier policy: direction
// always collapses at identity time; deriveIdentity itself only handles the
// trailing position).
const DIRECTION_TOKENS_LC: ReadonlySet<string> = new Set([
  "n", "s", "e", "w", "ne", "nw", "se", "sw",
  "north", "south", "east", "west",
]);

// Unit-descriptor shapes seen after the street-type suffix: 206, 1803, d204,
// b412, a715, bare letters (the "b" of "1803-b", the "a" of "a-114").
const UNIT_DESCRIPTOR_RE = /^(?:[a-z]?\d{1,4}[a-z]?|[a-z])$/;

// Numbered-road allowlist. Milton has exactly one numbered road carrying
// condos: Regional Road 25. The trailing number is part of the street NAME —
// without this entry the unit-strip eats the "25" (and deriveIdentity has no
// suffix-at-end to anchor on). Keyed by the post-cleanup token prefix.
const NUMBERED_ROAD_PREFIX_RE = /^regional-(?:rd|road)(?:-|$)/;
const NUMBERED_ROAD_BASE = "regional-road-25";

/**
 * Canonicalize a condo-building identity from DB2's raw
 * (street_number, street_slug). street_slug is expected in the same
 * "-<SLUG_SUFFIX>"-terminated shape deriveIdentity consumes
 * ("whitlock-ave-d204-milton"). Returns null for malformed input.
 */
export function deriveCondoIdentity(
  streetNumber: string,
  streetSlug: string,
): CondoIdentity | null {
  // (7) street_number unit-prefix split: "309-770" → "770" (TREB writes
  // unit-streetnumber; the LAST segment is the civic number).
  const num = streetNumber.trim().split("-").filter(Boolean).pop() ?? "";
  if (!/^\d+$/.test(num)) return null;

  let tokens = streetSlug.toLowerCase().split("-").filter(Boolean);
  if (tokens.length === 0) return null;

  // Preserve the city terminal token for re-assembly; tolerate its absence.
  if (tokens[tokens.length - 1] === config.SLUG_SUFFIX) tokens = tokens.slice(0, -1);
  if (tokens.length === 0) return null;

  // (1) misspellings, (2) junk tokens.
  tokens = tokens.map((t) => MISSPELLING_MAP[t] ?? t).filter((t) => !JUNK_TOKENS.has(t));

  // (3) direction tokens at any position — but never empty the name part
  // (a hypothetical "west-avenue" keeps "west" as its base).
  const directionless = tokens.filter((t) => !DIRECTION_TOKENS_LC.has(t));
  if (directionless.length > 0) tokens = directionless;
  if (tokens.length === 0) return null;

  // (4) numbered-road allowlist — short-circuits all suffix/unit analysis.
  if (NUMBERED_ROAD_PREFIX_RE.test(tokens.join("-"))) {
    return {
      streetNumber: num,
      base: NUMBERED_ROAD_BASE,
      suffixCanonical: "",
      canonicalSlug: `${num}-${NUMBERED_ROAD_BASE}-${config.SLUG_SUFFIX}`,
      clusterKey: `${num}|${NUMBERED_ROAD_BASE}`,
    };
  }

  // (5)+(6) locate the FIRST street-type suffix whose entire tail is junk
  // (other suffix tokens or unit descriptors) and truncate there. This both
  // strips unit descriptors and resolves differing-suffix runs
  // (derry-rd-drive → derry-rd) in one pass; SAME-suffix doubling (rd-road)
  // is equally truncated, mirroring deriveIdentity's own collapse.
  let suffixIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (!IDENTITY_SUFFIX_TOKENS.has(tokens[i])) continue;
    const tailIsJunk = tokens
      .slice(i + 1)
      .every((t) => IDENTITY_SUFFIX_TOKENS.has(t) || UNIT_DESCRIPTOR_RE.test(t));
    if (tailIsJunk) { suffixIdx = i; break; }
  }
  if (suffixIdx === 0 && tokens.length > 1 && IDENTITY_SUFFIX_TOKENS.has(tokens[1])) {
    // Suffix-abbreviation-as-base ("21-crt-street" → Court Street): token 0
    // is the NAME; canonicalize it as a word and keep the real suffix.
    tokens = [IDENTITY_SUFFIX_CANON[tokens[0]] ?? tokens[0], tokens[1]];
  } else if (suffixIdx >= 0) {
    tokens = tokens.slice(0, suffixIdx + 1);
  }
  // suffixIdx === -1: suffix-less slug (490-gordon-krantz) — pass through;
  // the cluster-majority vote at grouping assigns the suffix.

  // Delegate to the street-tier core for suffix canonicalization, doubled
  // suffix collapse, trailing direction, interior city token.
  const identity = deriveIdentity(`${tokens.join("-")}-${config.SLUG_SUFFIX}`);
  if (!identity || !identity.base) return null;

  return {
    streetNumber: num,
    base: identity.base,
    suffixCanonical: identity.suffixCanonical,
    canonicalSlug: `${num}-${identity.canonicalSlug}`,
    clusterKey: `${num}|${identity.base}`,
  };
}

/**
 * Compose the canonical slug for a cluster after the majority-suffix vote.
 * (Suffix may differ from any single member's own suffix — e.g. the
 * 480-gordon-krantz cluster votes "avenue" over the lone "boulevard" row.)
 */
export function condoCanonicalSlug(
  streetNumber: string,
  base: string,
  suffixCanonical: string,
): string {
  const parts = [streetNumber, base];
  if (suffixCanonical) parts.push(suffixCanonical);
  parts.push(config.SLUG_SUFFIX);
  return parts.join("-");
}

// ── Cluster grouping (shared by ws3-backfill and the dedup dry-run) ─────────
//
// Pure function: rows in, clusters out. Both the live backfill and the
// read-only dry-run call THIS function, so what the dry-run prints is by
// construction what the backfill would write.

export interface CondoClusterRow {
  street_number: string;
  street_slug: string;
  /** total trade count for this raw (number, slug[, …]) group — the suffix-vote weight */
  cnt: number;
}

export interface CondoCluster<T extends CondoClusterRow> {
  clusterKey: string;       // `${streetNumber}|${base}`
  streetNumber: string;
  base: string;
  suffixCanonical: string;  // majority vote, weighted by cnt
  canonicalSlug: string;
  canonicalStreetSlug: string; // parent-street slug for the link graph
  rows: T[];                // every raw row in the cluster (for aggregation)
  memberSlugs: Map<string, number>; // raw entity slug -> summed cnt
}

export function groupCondoClusters<T extends CondoClusterRow>(
  rows: readonly T[],
): { clusters: Map<string, CondoCluster<T>>; rejected: T[] } {
  const clusters = new Map<string, CondoCluster<T>>();
  const rejected: T[] = [];
  // pass 1 — assign rows to clusters, tally suffix votes
  const votes = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const ci = deriveCondoIdentity(r.street_number, r.street_slug);
    if (!ci) { rejected.push(r); continue; }
    let c = clusters.get(ci.clusterKey);
    if (!c) {
      c = {
        clusterKey: ci.clusterKey, streetNumber: ci.streetNumber, base: ci.base,
        suffixCanonical: "", canonicalSlug: "", canonicalStreetSlug: "",
        rows: [], memberSlugs: new Map(),
      };
      clusters.set(ci.clusterKey, c);
      votes.set(ci.clusterKey, new Map());
    }
    c.rows.push(r);
    const rawSlug = `${r.street_number}-${r.street_slug}`;
    c.memberSlugs.set(rawSlug, (c.memberSlugs.get(rawSlug) ?? 0) + r.cnt);
    const v = votes.get(ci.clusterKey)!;
    v.set(ci.suffixCanonical, (v.get(ci.suffixCanonical) ?? 0) + r.cnt);
  }
  // pass 2 — majority suffix (cnt-weighted; ties broken by non-empty then alpha
  // for determinism) + canonical slugs
  for (const c of Array.from(clusters.values())) {
    const v = votes.get(c.clusterKey)!;
    const ranked = Array.from(v.entries()).sort(
      (a, b) => b[1] - a[1] || (b[0] ? 1 : 0) - (a[0] ? 1 : 0) || a[0].localeCompare(b[0]),
    );
    // a suffix-less variant must never outvote a suffixed sibling unless the
    // cluster has ONLY suffix-less members (490-gordon-krantz: 1 trade,
    // suffix-less, beside 78 avenue trades — avenue must win regardless)
    const best = ranked.find(([s]) => s !== "") ?? ranked[0];
    c.suffixCanonical = best ? best[0] : "";
    c.canonicalSlug = condoCanonicalSlug(c.streetNumber, c.base, c.suffixCanonical);
    const streetParts = [c.base];
    if (c.suffixCanonical) streetParts.push(c.suffixCanonical);
    streetParts.push(config.SLUG_SUFFIX);
    c.canonicalStreetSlug = streetParts.join("-");
  }
  return { clusters, rejected };
}
