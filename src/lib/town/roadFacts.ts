// src/lib/town/roadFacts.ts
// The one accessor for Town road facts. Everything that reads TOWN_ROAD_FACTS goes through here.
//
// ABSENCE IS NEVER EVIDENCE — the rule that governs this whole layer, enforced at its entry
// point. This returns null for a street the Town's centreline does not carry, and null means the
// caller renders exactly what it rendered before. It may not withhold a page, contradict a sale,
// or mark an entity unreal:
//
//   · the Roads layer was last published 2022-06-09, the Address Points layer 2023-11-15, and
//     the Town's own street-name registry 2026-05-21 — the names are NEWER than the geometry;
//   · 22 streets in that registry are absent from BOTH spatial layers, and Kennedy Circle West
//     is one of them WITH two recorded sales.
//
// A street with a sale and no geometry is a stale portal, not a fake street.
import { TOWN_ROAD_FACTS, type TownRoadFacts } from "@/data/townRoadFacts";
import { identityFromSlug } from "./identity";

export type { TownRoadFacts };
export { OGL_MILTON_ATTRIBUTION, TOWN_ROAD_FACTS_PULLED } from "@/data/townRoadFacts";

/** Town facts for one of our street slugs, or null when the Town has no centreline for it. */
export function roadFactsFor(slug: string | null | undefined): TownRoadFacts | null {
  if (!slug) return null;
  return TOWN_ROAD_FACTS[identityFromSlug(slug).key] ?? null;
}

/** The street's centreline centroid, or null. Additive: a caller with null keeps its own
 *  behaviour — it does not fall back to a town-centre constant on this path. */
export function streetCentroidFor(slug: string | null | undefined): { lat: number; lng: number } | null {
  const f = roadFactsFor(slug);
  return f ? { lat: f.lat, lng: f.lng } : null;
}
