// src/lib/ai/hub/projectHubEntities.ts
// WS4 (DEC-WS4-2, ADR 0002) — PROJECTED hub sections.
//
// streets-in-this-neighbourhood and schema-markup are NOT LLM-generated. The
// renderer emits the street list from buildHubInput's ResidentialStreet[] array
// (server-rendered, currentRank order, VIP first); the LLM writes ONLY connective
// prose around a list it never authors. Schema fields project from the same input.
//
// This makes street/entity fabrication structurally impossible in those sections
// (the same discipline as the StreetPlaceholder fix). expandStreetName has already
// run in buildHubInput, so projected names render clean ("Main Street East"), not
// "Farmstead. Dr".
//
// `assertNoFabricatedStreets` is the defense-in-depth guard: if a future render
// path ever lets the LLM emit names INTO the list (it must not), this catches any
// street-name-shaped phrase in the connective prose that is not in the projected
// set, before it can ship.

import { config } from "@/lib/config";
import type { HubGeneratorInput, HubProjectedStreet, HubSchemaProjection } from "@/types/hub-generator";

function streetUrl(slug: string): string {
  // WS5 URL policy (ADR 0001 DEC-6): residential streets keep /streets/[slug].
  return `/streets/${slug}`;
}

// MC-046: projectStreetsSection (and its ProjectedStreetListItem, which carried each street's
// 12-month sold count) had no caller and was removed; the hub renders its ladder from
// hubStreetLadder.ts, ordered by active listings.

/**
 * Schema markup projected from what the hub page renders. No field may contradict the page
 * (DEC-WS4-2).
 *
 * MC-046 Stage 1 (PropTx VOW Best Practices item 40): Place.aggregatePrice is never emitted. It
 * carried the hub's typical SOLD price, a value derived from VOW records, and JSON-LD is served
 * to everyone. The projector takes only the neighbourhood name and the street list, so no sold
 * aggregate can reach it.
 */
export function projectHubSchema(
  input: { neighbourhood: { name: string }; projectedStreets: ReadonlyArray<{ slug: string; displayName: string }> },
  renderedStreets?: ReadonlyArray<{ name: string; slug: string }>,
): HubSchemaProjection {
  // The ItemList MUST mirror what the hub PAGE renders — its published-only, capped
  // ladder + VIP set — not the full surfaced projection and not the full published list.
  // Schema is the machine-readable twin of the visible list; marking up content not on the
  // page sits against Google's structured-data guidance, and it is redundant: the /streets
  // overflow page carries its own full uncapped published-only ItemList where those streets
  // actually render. When renderedStreets is supplied we use it verbatim (name + url, in
  // rendered order); absent → the surfaced projection (backward-compatible for any other caller).
  const items = renderedStreets
    ? renderedStreets.map((s) => ({ name: s.name, url: streetUrl(s.slug) }))
    : input.projectedStreets.map((s) => ({ name: s.displayName, url: streetUrl(s.slug) }));
  const schema: HubSchemaProjection = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: `${input.neighbourhood.name}, ${config.CITY_NAME}`,
    containedInPlace: { "@type": "City", name: config.CITY_NAME },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((it, i) => ({
        "@type": "ListItem" as const,
        position: i + 1,
        name: it.name,
        url: it.url,
      })),
    },
  };
  return schema;
}

// ---------------------------------------------------------------------------
// Defense-in-depth guard. The connective prose around the projected list must
// not introduce a street name of its own. Returns any capitalized street-name-
// shaped phrase ending in a street-type token that is NOT in the projected set
// (allowing the neighbourhood name + the host city). Empty ⇒ clean.
// ---------------------------------------------------------------------------

const STREET_TYPE_TOKENS =
  "Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Court|Crt|Crescent|Cres|Boulevard|Blvd|Lane|Ln|Way|Place|Pl|Trail|Trl|Terrace|Terr|Gate|Circle|Common|Ridge|Grove|Close|Walk|Hill|Heights";

export function assertNoFabricatedStreets(
  prose: string,
  input: HubGeneratorInput,
): string[] {
  const allowed = new Set<string>();
  for (const s of input.projectedStreets) {
    allowed.add(s.displayName.toLowerCase());
    if (s.shortName) allowed.add(s.shortName.toLowerCase());
    // TRANSITION (DEC-NAME-SOURCE Build 1). displayName now comes from the registry, so a hub whose
    // prose was generated against the OLD derivation would have every street in it re-classified as
    // fabricated — "Main St E" is not "Main Street". Accept the previously stored form too until
    // Build 2 regenerates the prose. Widening an anti-fabrication allowlist is safe in one
    // direction only: it can admit a real street under a stale name, never invent one.
    if (s.legacyDisplayName) allowed.add(s.legacyDisplayName.toLowerCase());
  }
  allowed.add(input.neighbourhood.name.toLowerCase());

  const re = new RegExp(
    `\\b([A-Z][a-zA-Z'\\-]+(?:\\s+[A-Z][a-zA-Z'\\-]+){0,3}\\s+(?:${STREET_TYPE_TOKENS})(?:\\s+(?:North|South|East|West|N|S|E|W))?)\\b`,
    "g",
  );
  const offenders: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(prose)) !== null) {
    const phrase = m[1].trim();
    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // Allowed if it matches (or is contained by) a projected display/short name.
    const ok = Array.from(allowed).some((a) => a.includes(key) || key.includes(a));
    if (!ok) offenders.push(phrase);
  }
  return offenders;
}

export type { HubProjectedStreet };
