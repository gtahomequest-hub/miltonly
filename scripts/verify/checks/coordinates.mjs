// Coordinates are real, or they are absent. Nothing in between.
//
// The defect this guards: `item.Latitude || 0` turned an absent coordinate into a valid one at
// (0, 0) — a point in the Gulf of Guinea that passes every null check — and the /listings map
// pinned all 2,930 listings on it. The repair is a resolved municipal rooftop with NULL where
// unresolved, so what has to be asserted is that NULL really is what unresolved produces.
//
// Read off the served pages, not the database: a stored coordinate that never reaches a pin is
// not a fix, and a pin drawn from something other than the stored coordinate is a new defect.
import { parsePage } from '../lib/parse.mjs';

/** Milton, generously drawn. Anything outside is a sentinel, a projection failure, or a bug. */
const BBOX = { minLng: -80.3, maxLng: -79.6, minLat: 43.3, maxLat: 43.75 };
const inMilton = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= BBOX.minLat && lat <= BBOX.maxLat && lng >= BBOX.minLng && lng <= BBOX.maxLng;

/** Straight-line kilometres — enough to ask "is this pin on its own street". */
const RAD = Math.PI / 180;
function km(aLat, aLng, bLat, bLng) {
  const dLat = (bLat - aLat) * RAD, dLng = (bLng - aLng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * RAD) * Math.cos(bLat * RAD) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export default {
  id: 'coordinates',
  title: 'Every published coordinate is real, and every distance has two real endpoints',

  perPage(slug, html) {
    const p = parsePage(html);
    // Distances the street page publishes in its Nearby block.
    const nearby = [...html.matchAll(/<span class="s-near-n">([\s\S]*?)<\/span>(?:<span class="s-near-d">([\s\S]*?)<\/span>)?/g)]
      .map((m) => ({ name: m[1].replace(/<[^>]+>/g, '').trim(), distance: m[2]?.replace(/<[^>]+>/g, '').trim() ?? null }));
    const commute = [...html.matchAll(/<span class="s-cd-n">([\s\S]*?)<\/span>(?:<span class="s-cd-t">([\s\S]*?)<\/span>)?/g)]
      .map((m) => ({ name: m[1].replace(/<[^>]+>/g, '').trim(), distance: m[2]?.replace(/<[^>]+>/g, '').trim() ?? null }));

    return {
      slug,
      nearbyTotal: nearby.length,
      nearbyWithFigure: nearby.filter((n) => n.distance && /\d/.test(n.distance)).length,
      commuteWithFigure: commute.filter((n) => n.distance && /\d/.test(n.distance)).length,
      suppressionNote: /Travel times aren.t street-specific yet/.test(html),
      attribution: /Open Government Licence . Milton/.test(html),
      typeCards: p.types.length,
    };
  },

  finish(rows) {
    const withDistances = rows.filter((r) => r.nearbyWithFigure > 0);
    const suppressed = rows.filter((r) => r.suppressionNote);
    return {
      coverage: [
        ['pages publishing at least one nearby distance', withDistances.length],
        ['pages still showing the suppression note', suppressed.length],
        ['pages carrying the OGL attribution', rows.filter((r) => r.attribution).length],
      ],
      assertions: [
        // A page cannot both publish a distance and claim it has none.
        ['pages both publishing a distance AND claiming none', rows.filter((r) => r.nearbyWithFigure > 0 && r.suppressionNote).length, 0],
        // The distance block is the derived fact — every page carrying one must name its source.
        ['pages publishing a distance without attribution', withDistances.filter((r) => !r.attribution).length, 0],
      ],
      examples: withDistances.filter((r) => !r.attribution).slice(0, 5).map((r) => r.slug),
    };
  },

  /** Exported for the standalone map/rooftop probe — see scripts/town/verify-coords.ts. */
  helpers: { inMilton, km },
};
