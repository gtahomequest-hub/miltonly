# Handoff — content worktree

CONTENT · D:\miltonly-content · feat/content-2

_Last rewritten 2026-09-11, after MCT-001 built the two source-grounded guides on
`feat/content-2` and proved them on a Vercel preview. Not merged._

## READ THIS FIRST

**This worktree owns the guides and everyday-life tier, and the Market Watch
weekly edition.** Its own tables, its own routes, generation through
`src/lib/ai/compliance.ts` under the cheap-first rule. **It never writes
`StreetContent`, `HubContent` or `CondoContent` rows, never touches the header,
footer or homepage.** Read the root `HANDOFF.md` for those tiers; it is the
authority on everything outside this scope.

## WHERE THIS BRANCH STANDS RIGHT NOW

**`feat/content-2` is BUILT AND PROVEN ON PREVIEW, awaiting Core's merge.** It
branches from `fc897e8`, which is `feat/content` merged up to `origin/main` at
`e71a7f6`, so it carries nothing of `feat/content` that main does not already
have. Preview `https://miltonly-jqoy3smu4-gtahomequest-hubs-projects.vercel.app` serves the code commit `5e7a3e3`; the head is the docs commit on top of it, and the battery ran with `5e7a3e3`'s full SHA: 12 of 13 checks pass over 481 pages, the `tiles` failure (chretien-street-milton, sub-k) reproduces on production at `2a89120` and is the street tier's. Record:
`scratchpad/reports/MCT-001-parking-and-go-guides.md`.

Two guides were added. Both are in `GUIDE_DEFS`, so the index, the sitemap and
the CollectionPage schema list them without a second edit:

```
/guides/parking-in-milton               parking
/guides/milton-go-train-to-toronto      milton go train
```

**`feat/content` itself is merged and live** (`31a9ab0`, then `5773f60`), the
2026-08-31 edition is corrected on production and the correction is spent.
Nothing below about the edition changed in this task.

## THE TWO SOURCE-GROUNDED GUIDES, AND THE RULE THEY RUN ON

The six original guides ground every number in a live figure the site already
renders. These two ground in a **stored source** instead, and the source is in
the repo:

- **Parking.** `src/data/sources/milton-parking/*.txt` is the text of seven
  milton.ca pages as read on **2026-09-11**, each file headed with its URL, the
  fetch date and the SHA-256 of the HTML it was extracted from.
  `src/data/sources/miltonParking.ts` is the typed index: the seven sources, the
  portal URLs, `PARKING_FACTS` (every number the guide may state, with the page
  it is on), the 15 pilot parks by ward, and the 13 survey rows. The guide is
  `src/lib/guides/parking.ts`.
- **GO.** `scripts/gtfs/milton-go.mjs` reads a Metrolinx GTFS extract
  (`GTFS_DIR`, default `D:/dashcam/work/gtfs/go`) and writes
  `src/data/sources/goGtfsMilton.ts`: feed version `20260910145058`, valid
  `20260910` to `20261127`, 79 dated services, every Milton to Union leg by
  weekday and weekend pattern, the 21 bus both ways, the 22 and 27, the fare,
  and the one exception date. The guide is `src/lib/guides/goTransit.ts`.
  **Re-run the script when the feed changes; do not hand-edit the output.**

**EVERY RULE SENTENCE CITES, ON THE PAGE.** `GuideSection.cited` is a list of
`{ text, source: { label, url, fetchedOn } }` rendered as a ledger with the URL
and read date beside each sentence. `GuideSection.table` and `GuideFaq.source`
carry the same `GuideSource`. All three are optional and additive; the six
original guides and the preview fixtures render exactly as before. Takeaways
are plain strings in the seam, so the parking takeaways carry the milton.ca
path and the read date inside the sentence. The Article JSON-LD gains a
`citation` array of the unique source URLs when a guide has any.

**NO INFERENCE BEYOND THE TEXT (parking).** Framing paragraphs state no rule.
Where the Town's pages are silent, the guide says so: no visitor permit, no list
of streets with posted exceptions, no fine amounts. A tip that started to
paraphrase a rule was moved into `cited` during the build; keep it that way.

**THE VALIDATOR RUNS OVER BOTH GUIDES AT BUILD TIME.**
`scripts/test-content-guides.ts` is prebuild test 21 (after
`test-content-validator`). It builds both guides without a database (the
builders take `deps.hubs`), walks every visible string (title, dek, takeaways,
paragraphs, tips, cited sentences, table captions, heads and cells, FAQs) and
runs `validateContentProse` against the guide's own bundle: 429 surfaces,
1,313 assertions. It also asserts the provenance contract and proves the gate
can fail (a weakened bundle, a planted place, a superlative, a fabricated
count). **The figures bundle is the fact list, not the prose.** Licensing a
number by putting the sentence itself into a text figure would make the test
pass on anything; the parking numbers come from `PARKING_FACTS`, the GO numbers
from the feed summary, and the departure times from text figures that are the
timetable, not the sentence.

**Sentence openers are entities.** The validator reads "The Town" or "Leaves
Milton GO" as one capitalised run and `SENTENCE_SAFE` only covers single words,
so "The", "From", "Leaves", "Arrives" and the like are in each guide's entity
list, with a comment saying why. Not a validator change; the validator is not
edited.

**Dates render as written.** `PARKING_FETCHED_ON` is "11 September 2026" and
`longDate()` in goTransit.ts builds the same shape from `YYYYMMDD`. No
`toLocaleDateString` anywhere in either guide (report 064).

**GTFS times past 24:00 are the next day and say so.** `clock("24:25")` renders
"12:25 a.m. (after midnight)". The 21's last departures are after midnight in
both directions; wrapping them silently would put a 12:25 a.m. bus before the
3:45 a.m. one.

## Link-down

`src/lib/guides/hubLookup.ts`: `hubSlugAt(lng, lat)` and `hubSlugsNear(lng,
lat, metres)` go through `TOWN_POLYGON_TO_NEIGHBOURHOOD`, the only place a Town
polygon may become one of our slugs, and `publishedHubs()` filters to
`HubContent.status = "published"`, so neither guide can link a hub that 404s.

- Parking links each pilot park's hub from the park's Town-published centroid
  (`TOWN_PARKS`), 12 hubs on preview. The pairing of the Town's park names to the
  parks layer ("Clark" to "Clarke", "Lions Park" to "Lions Sports Park") is in
  `PILOT_PARKS`, once, with a comment.
- GO links the hubs whose polygon edge is within 1.6 km of Milton GO, nearest
  first: Timberlea (the station sits in it), Dorset Park, Clarke, Dempsey, Old
  Milton, Beaty, Coates. The prose names the station's hub.

**Up-links from streets and hubs to these two guides are NOT added.** MC-003 set
the uplink rules and the battery's `guide-links` check encodes them; adding
guides to `guidesForStreet` / `guidesForHub` is Core's call. Flagged in the
report.

## What was refactored, and what was not

- `src/lib/guides/shared.ts` now holds `GuideDef`, `BuiltGuide`, `GUIDES_UPDATED`,
  the two CTAs and `readMinutes` (which now counts cited sentences and table
  cells). `guides.ts` re-exports the first three, so `index.ts`, the page and the
  sitemap did not change their imports. This exists so a builder file and the
  registry do not import each other in a cycle.
- `sections.tsx` renders `cited`, then `table`, then `tip`, then `links`. The
  tip moved from before the ledger to after it; on the six original guides
  (no ledger) the order is unchanged.
- Not edited: `validateContentProse.ts`, `validateStreetGeneration.ts`,
  `uplinks.ts`, anything under `src/lib/marketWatch`, any Core file.

## What a next session must not undo

Everything in this section from the 2026-09-10 handoff still stands and is
repeated here so this file remains the authority:

- **A SUPPRESSED FIGURE REMOVES PROSE, IT DOES NOT DAMAGE IT.** `sentence()`
  returns null when its figure is null and `para()` discards nulls.
- **A WEEK HAS TWO BASES.** `sold_date` is a calendar date at UTC midnight;
  `listedAt` is a real timestamp. `WeekWindow` carries both; use the one that
  matches the column. **Every DB2 window carries `sold_date <= NOW()`.**
- **GUIDES ARE DYNAMIC ON PURPOSE.** No `generateStaticParams` on
  `/guides/[slug]`. The two new guides read static sources but ride the same
  route, so they are dynamic too; that is fine and costs nothing.
- **THE PARAGRAPH NEVER BLOCKS A PAGE.** Two attempts, DeepSeek only, no Claude
  escalation.
- **AN EDITION IS IMMUTABLE ONCE PUBLISHED, WITH ONE NAMED EXCEPTION.** The
  correction note rides inside `sectionsJson`; `generateEdition` throws on a
  published row without one. **The 2026-08-31 correction is spent.**
- **A CORRECTION DOES NOT REPUBLISH.** `dateModified` reads `updatedAt`.
- **`neighbourhoodName.ts` is the only source of a neighbourhood name in this
  tier.** Unmapped returns null and the clause drops.
- **`policyRate.ts` is the only rate.** Render the date every time.
- **`validateStreetGeneration.ts` is Core's.** The Content validator
  reimplements five rules and `test-content-validator.ts` proves both
  directions.
- **PURGE BEFORE YOU GENERATE, NOT AFTER.** `scripts/purge-sold-caches.ts`, then
  generate, then revalidate.
- **The cron is Monday 08:00 America/Toronto** (`0 12 * * 1` and `0 13 * * 1`,
  hour guard 8), after the 11:00 UTC sold sync in both offsets.

## Deviations, stated and still standing

- **The schools guide ships board, level and grades, not address or distance.**
- **"Open this weekend" is not in v1.**
- **The GO guide does not compute the 22-to-Lakeshore-West connection.** The 22
  ends at Oakville GO; a connection time depends on a transfer the feed does not
  guarantee, so the guide names the option and stops.
- **The GO feed shows Thanksgiving Monday, 12 October 2026, with the weekday
  train timetable and the weekend bus timetable.** The guide states that as what
  the feed carries and tells the reader to check GO's site before a holiday. It
  is the only date in 79 that matches neither pattern.
- **The parking guide holds no fine amounts.** None of the seven fetched pages
  states one.

## Open items

1. **Only one edition exists, and the cron has not fired yet.** Watch the first
   Monday firing.
2. **Up-links from hubs and streets to the current edition, and to the two new
   guides, are Core's.**
3. **The two static sources age.** The GO feed's `feed_end_date` is 2026-11-27;
   after that the guide is wrong until the script is re-run on a new extract.
   The Town's parking pages carry a pilot that "will be presented to Council in
   2027". A quarterly re-fetch of both is the obvious cadence; nothing schedules
   it.
4. **`Listing.maintenanceFee` (Int) is dead**, `maintenanceFeeAmt` (Float) is
   live. Unchanged.
5. **`SUPERLATIVE_PHRASES` is module-private** in Core's validator; this tier
   keeps a copy. Unchanged.
6. **The invented-entity rule's one-word sentence-opener blind spot** is
   asserted, not closed. Unchanged.
7. **The guides index builds all eight articles for read times.** Two of them
   are static and cost nothing, but the pattern is the same one flagged at six.
8. **The parking ledger is long.** 59 cited sentences on one page. It is what
   "every rule sentence cites" produces from seven Town pages; if it reads as
   heavy, the fix is a collapsed ledger per section, not fewer citations.

## Notes for the next run

- `scripts/generate-market-edition.ts` is the edition runner; see the 2026-09-10
  notes in git history for its flags. Run it as
  `npx tsx --tsconfig tsconfig.test.json`.
- **The Prisma CLI reads `.env`, not `.env.local`.** This worktree has a
  gitignored `.env` with `DATABASE_URL` and `DIRECT_DATABASE_URL`;
  `DIRECT_DATABASE_URL` is `DATABASE_URL` with `-pooler` removed and the pool
  params dropped. `NEON_DATABASE_URL_UNPOOLED` is DB2, never a substitute.
- **Do not route around the migration ledger with `db execute`.** The ledger is
  clean: 26 rows, 0 drift.
- To re-fetch the parking sources: `curl -sL -A "Mozilla/5.0"` each URL in
  `PARKING_SOURCES`, extract `div#mainContent` up to the share/contact block as
  the `.txt` headers describe, diff against the stored text, then update
  `PARKING_FETCHED_ON` and `PARKING_FETCHED_ON_ISO` together and re-check
  `PARKING_FACTS` against the new text. `test-content-guides` will fail on any
  number the prose uses that the fact list no longer carries.
- To refresh the GO guide: drop a new GTFS extract in a folder, run
  `GTFS_DIR=<folder> node scripts/gtfs/milton-go.mjs`, commit the regenerated
  `goGtfsMilton.ts`. The guide, the test and the page follow.
- A dev server on a spare port (`pnpm next dev -p 3111`) renders both guides in
  about a minute cold; kill it before `pnpm build`, which shares `.next`.

## Next expected task

**None. Do not self-start.** Core merges `feat/content-2` or does not. The
remaining candidates, unchanged and nobody's current assignment, are the live
open-house block on the Market Watch index and a re-fetch cadence for the two
static sources.
