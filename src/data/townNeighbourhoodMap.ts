// src/data/townNeighbourhoodMap.ts
// HAND-WRITTEN AND REVIEWABLE. The Town of Milton's 26 neighbourhood polygons mapped onto OUR
// neighbourhood slugs — the only place a Town name is ever allowed to become one of ours.
//
// THE TOWN IS A POSITION ORACLE, NOT A NAMING AUTHORITY. Its boundaries are finer than TREB's,
// and TREB's are the ones buyers search in. We never adopt Fallingbrook, Mountain View, Valley
// View or Forest Grove as neighbourhoods; they are places the Town recognises INSIDE what TREB
// calls Old Milton, and that is how they are mapped.
//
// EVERY ENTRY IS EVIDENCED, not guessed. The evidence is the TREB neighbourhood of the streets
// already known to sit inside each polygon — regenerate it with:
//   npx tsx --tsconfig tsconfig.test.json scripts/town/evidence-polygon-map.ts
//   npx tsx --tsconfig tsconfig.test.json scripts/town/evidence-thin-polygons.ts
// The `n=` and `%` in each comment are that reading, taken 2026-08-16.
//
// null MEANS "DO NOT ASSIGN". It is a decision, not a gap: a street inside a null-mapped polygon
// keeps neighbourhoodId = NULL and loses nothing, per the standing rule that absence is never
// evidence. Two of these are the important ones — see NASSAGAWEYA and the industrial pair below.

export const TOWN_POLYGON_TO_NEIGHBOURHOOD: Record<string, string | null> = {
  // ── Direct correspondences. Same name, same ground, overwhelming agreement. ────────────────
  Beaty: "beaty",                     // n=88, 99% beaty
  Bowes: "bowes",                     // n=23, 100%
  Clarke: "clarke",                   // n=70, 100%
  Coates: "coates",                   // n=56, 100%
  Cobban: "cobban",                   // n=40, 100%
  Dempsey: "dempsey",                 // n=45, 98%
  "Dorset Park": "dorset-park",       // n=30, 100%
  Ford: "ford",                       // n=59, 100%
  Harrison: "harrison",               // n=60, 98%
  "Old Milton": "old-milton",         // n=27, 96%
  Scott: "scott",                     // n=54, 96%
  Timberlea: "timberlea",             // n=31, 97%
  Walker: "walker",                   // n=28, 89% (the 3 exceptions are Ford-side boundary streets)
  Willmott: "willmott",               // n=54, 98%
  "Bronte Meadows": "bronte-meadows", // n=8, 75% — thinner, but the 2 exceptions are arterials

  // ── The Town names a place INSIDE what TREB calls Old Milton. We map, we do not adopt. ─────
  Fallingbrook: "old-milton",   // n=12, 92% old-milton (meadowbrook, maplewood, anne, robinwood,
                                //   williams, dawson, heslop — every one TREB=old-milton)
  "Mountain View": "old-milton",// n=8,  88% old-milton (mountainview-drive, caves-court,
                                //   martin-street, highside-drive)
  "Valley View": "old-milton",  // n=1,  100% — valleyview-crescent, TREB=old-milton. Thin, but it
                                //   assigns nothing: the polygon contains zero orphans.
  "Forest Grove": "old-milton", // n=1,  100% — halton-avenue, TREB=old-milton.

  // ── Rural. The Town's names differ from TREB's entirely; both known streets agree. ─────────
  Nelson: "rural-milton-west",  // n=5, 100% (mcniven, bell-school-line, 1-side-road, 14-side-road,
                                //   appleby-line — all TREB=rural-milton-west)
  Trafalgar: "rural-trafalgar", // n=9, 67% — and the 3 exceptions are ALL long concession lines
                                //   (sixth-line, first-line, fourth-line) that cross the polygon
                                //   edge. Among streets contained by it, agreement is unanimous.
  Esquesing: "milton-north",    // n=2, 100% (esquesing-line, wood-close). Thin — 2 orphans ride on it.
  "Milton Heights": "milton-north", // n=2, 100% (peru-road, milton-heights-crescent). Thin — 5
                                //   orphans ride on it, all in the Milton Heights pocket itself.

  // ── DO NOT ASSIGN ─────────────────────────────────────────────────────────────────────────

  // THE IMPORTANT ONE. The Town draws ONE polygon over all of rural Milton and calls it
  // Nassagaweya. TREB splits the same ground five ways, and the split is near-even:
  //   nassagaweya 14 · rural-milton-west 13 · campbellville 10 · brookville-haltonville 7 · moffat 4
  // Top share 29%. Mapping this to `nassagaweya` would misassign roughly seven streets in ten
  // while looking like a clean name match — the single most dangerous entry in this file. The 14
  // orphans inside it stay unassigned until something declares them.
  Nassagaweya: null,

  // Industrial. 22 orphans sit inside 401 Industrial Area and their names say what they are —
  // industrial-drive, wheelabrator-way, market-drive, chisholm-drive, mcgeachie-drive. These are
  // not residential pages waiting to happen, and giving them a residential neighbourhood would
  // put them in a hub's orbit on the strength of a polygon alone. The single known street inside
  // is steeles-avenue (an arterial). No mapping.
  "401 Industrial Area": null,
  // Same call, weaker evidence: the one known street inside is fifth-line (an arterial) and TREB
  // calls it nassagaweya, which contradicts the polygon's own name. We do have a `derry-green`
  // neighbourhood, but it is standard_no_hub by design, so an assignment there would buy its 3
  // orphans no hub context at all. Not enough to act on either way.
  "Derry Green Industrial": null,
};

/** Polygons deliberately left unmapped — reported by the assignment run, never silently dropped. */
export const UNMAPPED_POLYGONS = Object.entries(TOWN_POLYGON_TO_NEIGHBOURHOOD)
  .filter(([, v]) => v === null)
  .map(([k]) => k);
