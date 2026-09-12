// src/lib/hubNearby.ts
// Which hubs are actually NEAR a hub, decided by position.
//
// "Nearby neighbourhoods" used to be the first four published hubs of the same tier in
// database order, which put Beaty beside Bowes and Walker beside Willmott whatever the map
// says. The Town's neighbourhood polygons (src/data/townNeighbourhoods.ts) give every mapped
// hub a boundary; the centre of that boundary is a position, and the distance between two
// positions is a fact a reader can check on any map. So the four nearest hubs are the four
// nearest, and the distance is printed beside each one with its basis.
//
// THE FOUR RURAL HUBS WITHOUT A POLYGON (nassagaweya, campbellville, brookville-haltonville,
// moffat: the Town draws one polygon over all of rural Milton and it is deliberately unmapped,
// see townNeighbourhoodMap.ts) get no distance and no "nearby" claim. For those the section is
// the other rural hubs, headed as exactly that, with no number invented.
import { TOWN_NEIGHBOURHOODS } from "@/data/townNeighbourhoods";
import { TOWN_POLYGON_TO_NEIGHBOURHOOD } from "@/data/townNeighbourhoodMap";
import { metresBetween } from "@/lib/town/polygons";

/** Boundary centre per hub slug: the mean of every vertex of every polygon mapped to it.
 *  Computed once per instance; the data is a build-time constant. */
let _centres: Map<string, readonly number[]> | null = null;
function centres(): Map<string, readonly number[]> {
  if (_centres) return _centres;
  const sums = new Map<string, { x: number; y: number; n: number }>();
  for (const poly of TOWN_NEIGHBOURHOODS) {
    const slug = TOWN_POLYGON_TO_NEIGHBOURHOOD[poly.name];
    if (!slug) continue;
    const s = sums.get(slug) ?? { x: 0, y: 0, n: 0 };
    for (const ring of poly.rings) for (const [x, y] of ring) { s.x += x; s.y += y; s.n++; }
    sums.set(slug, s);
  }
  _centres = new Map(Array.from(sums, ([slug, s]) => [slug, [s.x / s.n, s.y / s.n] as const]));
  return _centres;
}

export interface NearbyHub {
  slug: string;
  /** boundary centre to boundary centre, in km to one decimal; null when either side has no polygon */
  distanceKm: number | null;
}

/**
 * The `n` nearest of `candidates` to `slug`, by boundary centre. When the hub itself has no
 * polygon the result is `byDistance: false` and the candidates come back in the order given,
 * each with a null distance: the caller must not call them "nearby".
 */
export function nearestHubs(slug: string, candidates: string[], n = 4): { hubs: NearbyHub[]; byDistance: boolean } {
  const c = centres();
  const here = c.get(slug);
  if (!here) return { hubs: candidates.slice(0, n).map((s) => ({ slug: s, distanceKm: null })), byDistance: false };
  const ranked = candidates
    .map((s) => {
      const there = c.get(s);
      return { slug: s, distanceKm: there ? Math.round(metresBetween(here, there) / 100) / 10 : null };
    })
    // Hubs with a position first, nearest first; the unplaced rural four trail in the order given.
    .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  return { hubs: ranked.slice(0, n), byDistance: true };
}
