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

## Tenure-as-statistic methodology_leak pattern

A new `methodology_leak` phrasing class surfaced in Step 11 day-2 results,
distinct from the median/past-12-months patterns that the current
METHODOLOGY_LEAK_PHRASES list catches.

Abbott-st-milton failed all 3 retry attempts on the excerpt:

> "...rather than trading in and out, and the long average tenure on the
> block reflects that..."

The phrase "long average tenure" smuggles in statistical-style reasoning
through different wording than the typical "median" / "past 12 months" /
"n=X" leaks. The model reaches for this construction on streets with
limited trade volume where "residents stay" would read fine but "average
tenure" gives the sentence a statistical gloss.

Not blocking — the retry loop correctly caught it and routed the street
to the review queue. The concern is that our METHODOLOGY_LEAK_PHRASES
list may be missing this class of phrasing, meaning other streets could
leak the same pattern without being caught (or get caught late in the
retry sequence).

Consider extending METHODOLOGY_LEAK_PHRASES post-backfill with:
- "average tenure"
- "typical tenure"
- "long-held"
- "held for" + duration constructions

Not applied now — would require a full spot-check regression pass to
confirm no false positives on streets where tenure language is narrative
rather than statistical. Defer to post-backfill review phase.

## Schools-FAQ — omit-pool approach for post-backfill cleanup

Schools-FAQ hard-cap amendment was attempted and rejected in Step 12b.
The model ignored the explicit 3-sentence ceiling across 3/3 test streets
(aspen-terrace, ash-gate, balsam-crt — all produced 8-9 sentences on
"Which schools serve X?" answers even after the amendment landed in the
system prompt). Spec was unambiguous; model chose to enumerate anyway
on list-shaped inputs. More prompt pressure caused displacement in
Step 8c, exact pressure in 12b produced zero compliance.

Alternative approach deferred for post-backfill cleanup: omit the
schools question from the FAQ selection pool on streets with 3+ schools
in `nearby.schoolsPublic` / `nearby.schoolsCatholic`. Prevention rather
than cure — the problematic question simply doesn't get asked when the
input guarantees the model will over-enumerate. Other FAQ clusters
(price, commute, housing stock, rental) fill the slot.

Estimated recovery: ~200+ streets currently expected to land in
StreetGenerationReview over the full Milton backfill would instead
succeed with 6-8 clean FAQs that skip schools. Implementation is in
the generator input layer (buildGeneratorInput.ts), not the prompt —
remove schools from the question pool condition when school count
exceeds a threshold. ~10 LoC.

Evaluate after Phase 4.1 backfill completes. Not blocking day-3 resume.

## KNOWN_MILTON_ANCHORS — arterial road coverage

`validateStreetGeneration.ts` has a `KNOWN_MILTON_ANCHORS` list used to
tolerate references to well-known Milton places in the
`differentPriorities` section. It currently lists neighbourhoods but not
arterial road names. Step 8 rerun surfaced one instance where the model
referenced "Main Street" as a benign Milton landmark from calla-point,
which tripped `invented_cross_street` on attempt 1; retry cleanly
dropped the reference. Single occurrence, not worth fixing on its own.
Revisit if the Step 9 backfill surfaces this pattern repeatedly —
candidates to add: "Main Street", "Derry Road", "James Snow Parkway",
"Regional Road 25".

## Murlock Heights ghost slug

`murlock-heights-milton` has zero rows in DB1 / DB2 / DB3. The slug must
have entered the URL space from an external link or a hand-curated list;
nothing in our data populates it. Replaced as the "thin-data new-build"
spot-check fixture by `calla-point-milton` on 2026-04-21. The Murlock
name remains in `03-examples.ts` as an illustrative generator-input
spec (stage name, not a live slug).
