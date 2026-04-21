# Phase 4.1 parking lot

Items surfaced during Phase 4.1 that are deliberately out of scope for this
phase. Each one is a follow-up; none blocks the 4.1 backfill.

## Empty DB1 Listing table

DB1 `Listing` and `StreetContent` tables are empty (0 rows). Every street
page renders today purely off DB3 `analytics.street_sold_stats`. Whatever
sync is meant to populate DB1 isn't running, or hasn't been wired up yet.
Phase 4.2 lead capture will function but won't have listing-context to
attach leads to until DB1 is populated. Re-open as a Phase 4.0 follow-up.

_Flagged: 2026-04-21 during Step 4.1.7 gate-widening diagnostic._

## cleanNeighbourhoodName regex gap

Known: some AMPRE neighbourhood strings slip past the cleaner and surface
raw codes in page copy. Non-blocking cosmetic issue.

## "Last 12 mo" methodology leak on AtAGlance tiles

Tile labels on the At-a-Glance grid still reference the methodology window
("last 12 mo") in a handful of places. Violates the no-methodology-leak
rule in the AI voice spec; needs the same scrub applied to static tile
copy.

## Schema price floating-point precision

`schema:price` values round-trip as floats and occasionally surface as
`566241.8367346938` in the JSON-LD. Needs `Math.round()` or equivalent
before serialization.

## Murlock Heights ghost slug

`murlock-heights-milton` has zero rows in DB1 / DB2 / DB3. The slug must
have entered the URL space from an external link or a hand-curated list;
nothing in our data populates it. Replaced as the "thin-data new-build"
spot-check fixture by `calla-point-milton` on 2026-04-21. The Murlock
name remains in `03-examples.ts` as an illustrative generator-input
spec (stage name, not a live slug).
