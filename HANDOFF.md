CORE · D:\miltonly · fix/core-batch

# Handoff

_Last rewritten 2026-09-10, after the CORE batch was built, previewed and verified. NOT merged._

## READ THIS FIRST

**`fix/core-batch` is built and awaiting review. Nothing is merged and production is unchanged.**
Head `abf9ef4`, preview `miltonly-5b9qn9rrs`, battery **`PASS · 10 checks · 444 pages · 67s`**,
exit 0, `served == expected` at the full SHA. Full record in
`scratchpad/reports/065-core-batch.md`. Read it before touching any of the four pieces.

**THE ONE THING THAT SHOULD NOT MERGE WITHOUT A RULING: 250 new pages.** Widening
`makeStreetDecision`'s gate (QUEUE item 7) admits **355** registry-filtered streets that the DB1
clause was refusing. **105 of them already have a page** and merely refresh on the cron, which is
what item 7 was written to fix. **The other 250 have no page at all, and the cron will start
building them.** Item 7's own text calls that "a different and much larger decision". It is not a
bug in the change; it is the change working, at a scale nobody has approved.

**`CloseDate` IS NOT THE DATE OF THE SALE.** It is the completion date the parties agreed to, and
PropTx sets `MlsStatus='Sold'` / `StandardStatus='Closed'` when a deal goes **firm**, not when it
closes. `sold_date` was `CloseDate` verbatim, so **245 rows carried a sold date in the future**,
the furthest **2027-01-29**. Not 192 — that was the `For Sale` half; there are 53 `For Lease` too.
All 245 had a `PurchaseContractDate` already in the past. `resolveSoldDate` in `vow-sync.ts` now
takes the contract date when the close has not happened and returns null when neither date is
defensible, and the ingest loop drops a row it cannot date rather than writing NULL into a
NOT NULL column. `close_date` still carries `CloseDate`. Guarded by prebuild test 20.

**Bounding those windows changes what 145 streets show today.** All 245 future rows sat inside the
90-day consumer list window, and those lists sort `DESC`, so **145 streets had their "recent
sales" list led by a sale that has not happened**. Four windows still had no upper bound and now
do: `sold-data.ts` ×3 and `buildCondoBuildingInput`'s `leaseRecordQuery`. **The 28-day window in
`computeBoard.ts` was already safe** and was left alone; check before assuming otherwise.

**Re-dating moves k, not the headline.** Once the sync re-upserts them, the Milton-wide 12-month
sample goes 1,531 to 1,723 and the Milton-wide typical stays **$930,000**. But **17 streets cross
k5 upward and 9 cross k10**, so 17 gain a typical point and 9 gain a range. No k rule was changed;
the floor is working on a bigger, truer sample. **The 245 existing rows were not repaired** — the
brief did not ask for a backfill, so they keep their `CloseDate` until a sync rewrites them.

**A PRIOR PRICE IS NOW STORED, AND IT IS EMPTY.** `Listing.priorPrice` and `priceChangedAt`,
additive migration, written by the DB1 sync on the update branch when both prices are > 0 and
differ. Deliberately **not** gated on `MlsStatus` — that gating is exactly why `lastPriceChangeAt`
could never support a drop. **Both columns are NULL corpus-wide right now** and nothing was
backfilled, because a prior price that was never observed is not knowable. **Do not wire a
"price reduced" badge or a drop count yet**: today they would read zero and publish "no
reductions" as a measurement. The three comments that said no prior price is stored are corrected
in place; the two removed features stay removed on purpose.

**THE DB1 LISTING UPSERT IS IN `src/app/api/sync/detect/route.ts`, NOT `vow-sync.ts`.**
`vow-sync.ts` writes DB2 `sold.sold_records`. Nothing in `src/` calls `prisma.listing.upsert`; the
detect route branches on a pre-fetched row and calls `update` or `create`.

**The DB2 branch of the gate is floored on the registry, and the DB1 branch still is not.**
14 of the slugs the DB2 clause would otherwise rescue are on neither the registry nor the
off-registry allowlist, and they are ingest debris: `derry-rd-road-milton` (236 rows),
`nipissing-rd-milton-road-milton`, `bessy-trail-trail-milton`, `nipising-road-milton`. Publish
floor = entity floor, so they are refused. **But the DB1 branch has never consulted the registry
either, and `/api/sync/generate` has no floor check at all** — only `scripts/create-street-page.ts`
enforces it. 0 of the 445 published streets are off the floor today, so nothing is leaking. Nothing
stops it either. Left open on purpose: it is a behavioural change to a path this batch did not touch.

**419 and 256 are both right.** They count different populations. 419 (422 today, drift of 3) is
over slugs carrying DB2 records; 256 is over `StreetQueue` rows, which is what the cron drain sees.
Registry-filtered, the answer item 7 asks for is **355**.

**The battery is 10 checks now, not 9.** `feat/homepage` added the homepage-figure check. A run
reporting 9 is stale.

**`feat/homepage` merged to main as `a9546a7`** while this batch was branched. Its record is
`HANDOFF-home.md`, a separate file for a separate worktree, and it was not folded into this one.

**`--conditions=react-server` BREAKS scripts that reach `street-data.ts`.** React's shared-subset
entry throws "not yet supported outside of experimental channels" before the script runs. Use
`npx tsx --require ./scripts/_server-only-shim.cjs` instead. The CLAUDE.md line about
`NODE_OPTIONS` holds for scripts that import server modules **without** pulling React in.

**Published street pages: 445.** The battery reports 444; different population, both right.

**Every cost figure in every handoff before 2026-09-05 is wrong by 3x on the Opus portion.**

**A generation stores the input it was written from.** `StreetGeneration.inputJson`.

## Where things stand

| | |
|---|---|
| `main` | **`e2d8476`** (code SHA `a9546a7`, the `feat/homepage` merge) |
| branch | **`fix/core-batch`** at **`abf9ef4`**, pushed, **not merged** |
| production | unchanged by this batch; serving main |
| preview | **`miltonly-5b9qn9rrs`**, Ready |
| battery on preview | **`PASS · 10 checks · 444 pages · 67s`**, exit 0, 0 FAIL, `abf9ef4 served == expected` |
| local build | exit 0, zero `P2024`, **20/20 prebuild**, 546 static pages |
| future-dated DB2 rows | **245** (192 For Sale, 53 For Lease), furthest **2027-01-29**, unrepaired |
| unbounded `sold_date` windows | **0** (was 4) |
| gate `skip_low_data`, `StreetQueue` | **256 to 78** |
| gate population, registry-filtered | **355** (105 have a page, **250 do not**) |
| `Listing.priorPrice` populated rows | **0**, by design, until the next sync |
| published street pages | **445** |
| QUEUE | 1, 2, 3, 4 done; **7 built, not merged**; 5, 6 not started |


## What happened 2026-09-10 — the CORE batch

Four pieces on one branch, prompted directly, ahead of QUEUE item 5. Report
`scratchpad/reports/065-core-batch.md` is the detail; this is the shape.

**1. List-price history.** `Listing.priorPrice` / `priceChangedAt`, migration
`20260910120000_listing_price_history`. Written in the detect route on the update branch only,
guarded on both prices being > 0 because `price: item.ListPrice || 0` turns an absent ListPrice
into a zero and a zero is not a reduction. Not gated on `MlsStatus`. Nothing backfilled.

**2. Future-dated sold rows.** `CloseDate` identified as the source, and why it is not the sale
date. `resolveSoldDate` added and guarded; the four remaining unbounded windows bounded under
`DEC-SOLD-UPPER-BOUND`. Impact measured both ways: 145 streets' record lists change now, 17 and 9
streets cross k5 and k10 after the sync re-dates. Existing rows untouched.

**3. QUEUE item 7.** `makeStreetDecision` now runs the same DB2 existence clause `getStreetStats`
has, and only when the DB1 clause has already failed, so a passing street costs the cron what it
cost before. The DB2 branch is floored on the registry.
`scripts/dryrun-street-decision-gate.ts` measures it without writing, because
`makeStreetDecision` marks rows `ineligible` as a side effect and cannot be called from a dry run.

**4. ExitIntent and CornerWidget** moved to `src/components/street/retired/`. `CornerWidgetProps`
stays live in `types/street.ts` because `buildCornerWidget` in `street-data.ts` still assembles
it; the `globals.css` rules stay and are annotated. Neither had an importer.

## What happened 2026-09-09 — QUEUE item 4, condo names

**The surfaces wired**, all from `condoName`: H1, title, meta description, breadcrumb,
JSON-LD `name` and `address`, OpenGraph and Twitter on **both** condo routes, the `/condos`
index, `/api/autocomplete`, `heroIndex` and the hub's condo list. Also
`buildCondoBuildingInput`, so the next generation writes the resolved name instead of
re-introducing what the backfill just removed — without that, this item undoes itself.

**A real `association_name` still wins the heading.** `condoName` governs the ADDRESS, which
is what those buildings fall back to, and it always computes the address form as well,
because JSON-LD `address` must be an address even when the heading is a name.

**`regional-road-25-milton` joined `OFF_REGISTRY_STREETS`** (ruling 1). It was the one
building in 65 that resolved to no name at all.

**Why the direction is not in `townAddressPoints.ts`.** That key is `${number}|${base}||${type}`
and has no direction slot. Widening a 1.4 MB ingest-only table with a row-count assertion five
things depend on, to carry a field 4% of its rows have, is the wrong trade. Re-run
`scripts/town/gen-address-directions.ts` if the Town layer is re-pulled; it fetches its own
filtered slice and refuses to write a partial table.

## What happened 2026-09-08 — QUEUE item 3, address anchors

`/streets/<slug>#<houseNumber>` on every published street the Town has address points
for. Read report 059 before touching any of it; the summary below is the shape, not the
detail.

**The sourcing is a build-time projection, not a render-time import.**
`src/data/townAddressPoints.ts` declares itself ingest-only and is 1.4 MB.
`scripts/town/gen-street-addresses.ts` consumes it and emits
`src/data/streetAddresses.ts` — 901 identities, 40,826 addresses, 3,048 placed cross
streets, 432 KB, and **no coordinate per house**. It parses the ingest module's packed
literal as text and asserts the row count against the constant that module exports, so a
re-pull that changes the table fails the generator instead of drifting. **Re-run the
generator whenever `townAddressPoints.ts` is re-pulled.**

**Position is walked per side, in house-number order.** A merged walk accumulates the
road width on every step, because consecutive numbers alternate across the roadway; on a
short street that inflates the total by more than the street is long. Walking by number
rather than projecting onto a straight axis is also what makes crescents, courts and
circles come out right.

**A cross-street tick is a nearest-pair estimate within 150 m**, not a surveyed
intersection. It links only where `StreetAdjacency` already holds the pair, because
every `connectedSlug` there is a published street; everything else is a label.

**What the section may carry stops at building form and live status.** Never, at any k:
a sold price, a sold date, an owner, a historical listing, or a per-address coordinate.
A single address is a population of one. The summary sentence is generated from the data
and never written by a model. The `ItemList` is `PostalAddress` and nothing else, with
no `offers` and no `price`.

**`scripts/test-address-anchors.ts` is the 18th prebuild test, 52 assertions.** It
renders the section and reads the ids back out of the markup rather than asserting that
a file imports something — the pattern open item 9 still wants applied to the name
guard, and it now counts mark tags against mark count so a wrapper cannot creep back in.
It runs under `tsconfig.jsx-test.json`, which exists only to set
`"jsx": "react-jsx"`; the app's tsconfig says `preserve` and under `tsx` that fails in a
component written for the automatic runtime.

**`scripts/verify/address-anchors.mjs`** is the deployed-host check. It strips React's
`<!-- -->` text separator before matching heading text, which is the one difference
between the served page and the local render the prebuild guard reads.

**`scripts/create-street-page.ts` is new.** `regen-058-local.ts` is a *re*generation
runner and skips any slug with no `StreetContent` row, which is exactly the case for a
street that has never been generated. The new script copies its provider discipline
verbatim and adds the entity floor as a refusal.

**Page weight, after the diet.** An address is ONE tag whose detail lives in a single
`data-d` attribute that CSS draws on interaction. `savoline-boulevard-milton`
(387 addresses) went 745 KB to **421 KB** raw and 42.1 KB to **37.2 KB** compressed.

**The 250 KB raw target is WITHDRAWN and the full `ItemList` stays. Decided 2026-09-09.**
The arithmetic is in report 059: the App Router inlines the RSC flight payload, so
everything is served twice, and the `ItemList` alone costs 184 KB against a 152 KB budget
— over budget before a single address element is drawn. Fitting 250 KB would have meant
cutting the list to about 40 of 387 addresses. After the 2026-09-09 changes savoline is
**437 KB raw and 38 KB compressed**, up 4% on the words and the CTA block. Compressed is
what a browser and a crawler actually pay.

**What landed 2026-09-09.** 34 px reserved at both ends of the spine so no end label is
clipped. Cross-street names moved to the right edge of their rule, in mono, truncated with
an ellipsis and carrying the full name in `title`, linked where the street has a published
page — and the summary sentence now links the same names on the same rule, which is what
`summaryNodes` is for. Position reads in words (`midway`, `near the Charles Street end`)
with the fraction kept on the end of `data-d` for the guard. The footer is the exact
sentence asked for, held verbatim by the guard and the deployed verifier. Two CTAs in the
page's own final-CTA card, no new colour: `/sell?street=<name>#valuation` and
`#street-alert`. **`DOT_GAP` went 7 to 14 px and is now the hit area of a quiet mark**, so
no two targets can overlap; measured on savoline, 387 marks, 331 labels suppressed,
minimum same-side gap exactly 14 px on both sides, zero below. Guard at 52 assertions.

**There is no VIP signup route in this codebase.** "Watch <Street>" points at
`#street-alert`, the live street alert already on the page. `/exclusive` is a listings page
with no form and `#vip` is a homepage strip of links. A distinct VIP list would be a new
surface and a new decision. Re-checked 2026-09-09 against the brief, which asked for a VIP
signup by name: **this is still the deviation, and it is deliberate.** The alert posts
`source: "street-alert"` with `property_address: <street name>`, so the street travels the
way a prefill would carry it. The owner CTA does prefill for real — `/sell?street=<name>`,
read by `HomeValuationCard` as the initial address value.

**Cross-street links verified against the published set, not just against the code.** On
pine-street the section draws 8 ticks; the 4 published ones link, the 4 that are not
(`maiden-lane`, `fulton-street`, `prince-street`, `bruce-street`) carry no link and are
absent from the sitemap, all 8 carry `title`, and the summary sentence links the same 4.

**`HomeValuationCard` now reads `?street=`** as the initial value of its address field. The
component is shared with `/sell`, the sold pages and `/value`, and the change is inert
without the parameter.

## Open items

1. **The Anthropic account has no credit, and it is the only path for three pages.**
   `bell-school-line-milton` was the new one this task tried. It passes
   `makeStreetDecision` and `getStreetStats`; the stale `NoCentroidError` on its queue
   row is cleared by the Town-centreline step in `resolveCentroid`. What fails is the
   eval half, on the jasper pattern exactly: `invalid_json_shape` plus
   `zero_price_faq_question` on all 5 attempts. Two active listings near $4M and zero
   sold in the window, so the zero-price rules fire correctly and DeepSeek will not hold
   them. $0.042 spent, nothing written, fail-closed. `jasper-street-milton` and
   `wood-close-milton` are the other two, and `wood-close` is a different fault: its
   `getStreetStats()` returns `No stats available` in one second, before a prompt exists.
2. **No two published pages share an address ladder. An earlier note here said they did
   and it was wrong.** That claim reasoned from the identity model rather than the data.
   Measured 2026-09-08 by `scripts/recon-directional-siblings.ts`: across 490
   `StreetContent` rows, exactly **one** identity key carries more than one row, and it is
   not directional — `jarrett-cross-milton` (unpublished, resolves through the fallback
   chain) and `jarrett-crossing-milton` (published, resolves through the registry) both sit
   on `jarrett||crossing`. **Groups where more than one row is published: 0.** The registry
   carries exactly two compass-word streets, `kennedy-circle-east-milton` and
   `kennedy-circle-west-milton`; neither has a page, they collide with each other on
   `kennedy-circle||` and NOT with the published `kennedy-circle-milton` (`kennedy||circle`),
   and `kennedy-circle||` has no Town address points at all. There is no Bronte North/South
   pair in the registry or in `StreetContent`. The exposure is future and it is a publish
   decision, not a render bug.
3. **Pre-2026-09-05 `costUsd` rows overstate Opus-assisted generations by 3x.** Not
   rewritable from what is stored. Treat historical cost claims as upper bounds.
4. **The DOM rule cannot read the neighbourhood's DOM.** `findUngroundedNumerics`
   compares a `days` token only against `input.aggregates.daysOnMarket`, never
   `neighbourhoodComparable.daysOnMarket`. 86 regenerated pages cite the neighbourhood
   figure correctly and would fire if the rule were widened. Fix the field before
   widening the scope.
5. **Grounding is still enforced on zero and thin only, dollars only.** Counts,
   percentages, days and quarter labels remain market-scoped on every tier.
6. **The two generation paths digest `inputHash` at different widths** (64 vs 12 chars),
   so `backfill-descriptions.ts`'s idempotency check can never match a row the cron
   wrote. The bulk path has been silently regenerating cron-written rows.
7. **`claude-haiku-4-5-20251001` carries a date suffix**; the current id is
   `claude-haiku-4-5`. Hygiene, not a fault. Production's `AI_PROVIDER_MARKET="haiku"`
   means the market half runs on it.
8. **Seven live clips carry `blur_verified: false`** (`chretien-street`,
   `clifford-point`, `frost-court`, `heaven-crescent`, `mulroney-heights`, `shade-lane`,
   `tasker-court`). Decision: verify or pull.
9. **Two orphaned clips** under slugs that are not real streets. GPS has been taken as
   far as it goes; someone has to watch the footage.
10. **BUILT, NOT MERGED.** QUEUE item 7's gate parity is on `fix/core-batch`. Re-measured
    2026-09-10: 832 slugs carry DB2 records, 422 are skipped by the old gate, **355 survive the
    registry filter**, of which 105 have a page and **250 do not**. Those 250 are new pages the
    cron will build on merge, and they need a ruling. `StreetQueue` view of the same change:
    `skip_low_data` 256 to 78.
11. **The name guard's blind spot**: it asserts a file *imports* the resolver, not that
    every consumer uses the resolved value. `test-input-snapshot.ts` and now
    `test-address-anchors.ts` are the pattern for fixing it.
12. `burnhamthorpe-road-milton` and `louis-st-laurent-avenue-milton` are entity-real with
    no data behind them.
13. `heroSearch.ts` resolves 5 slugs to physically different streets; needs an ambiguity
    guard.
14. **CLOSED.** Condo H1s, titles, meta and stored name columns all render the full name, and
    52 of 55 prose bodies were regenerated clean. The 3 that remain are a fail-closed validator
    failure (`830-megson-terrace`) and two zero-data refusals (`158-mill-street`,
    `174-bronte-street`), not naming faults. `830-megson-terrace` is queued in
    `StreetGenerationReview` under `condo:830-megson-terrace-milton` if anyone wants it.
15. Stored `HubContent.metaDescription` drifts from live on 21 of 22 hubs.
16. Rent pill disagrees with the market card on `melville-bonus-crescent-milton` and
    `mcdougall-crossing-milton`.
17. `video.miltonly.com` still unattached. `r2.dev` is rate-limited and not intended for
    production traffic at volume.
18. Two draft rows carry a clip: `diefenbaker-street-milton`, `murlock-heights-milton`.
19. **11 slugs have R2 clips uploaded and no `StreetContent` row.** Generation candidates,
    blocked by open item 1 wherever DeepSeek cannot clear them.
20. **245 DB2 rows still carry a future `sold_date`.** The sync will not write another, and every
    window now excludes them, but they are not repaired. They correct themselves only as the sync
    re-upserts them, and only if it re-fetches them. A one-off re-date is the alternative.
21. **The DB1 branch of `makeStreetDecision` has no entity floor**, and `/api/sync/generate` has
    none at all. Only `scripts/create-street-page.ts` enforces publish floor = entity floor. 0 of
    445 published streets are off the floor today, so nothing is leaking; nothing stops it either.
22. **`Listing.priorPrice` and `priceChangedAt` are empty and must stay unwired.** Both the
    `priceReduced` badge (`listingsV2Data.ts`) and a homepage drop count (`homeSignals.ts`) are
    deliberately still absent. Wiring either today publishes "no reductions" as a measurement.
23. **`StreetPageData.cornerWidget` is still assembled by `buildCornerWidget`** for a component
    that no longer exists outside `retired/`. Dead work on every street render. Removing it is a
    page-composition change and was not made.

## Notes for the next run

- **Run a script that reaches `street-data.ts` as `npx tsx --require ./scripts/_server-only-shim.cjs`.**
  `NODE_OPTIONS=--conditions=react-server` makes React's shared-subset entry throw before the
  script starts. Same trap the condo runner note records, different cause of arrival.
- `scripts/dryrun-street-decision-gate.ts` reports the gate population without writing. It never
  calls `makeStreetDecision`, which marks queue rows `ineligible` as a side effect.
- `scripts/test-sold-date-not-future.ts` is prebuild test 20. It pins "today" and asserts the
  property, not just the cases: no input produces a future `sold_date`.
- **A long heredoc through the Bash tool can fail to find its terminator.** Two `<<'PY'` blocks
  died with "unexpected EOF" on content that was valid. Write the script to a file and run it.
- **The battery takes the full 40-character SHA.** A short SHA fails the gate on a string
  compare and aborts before any content check. `EXPECT_SHA` overrides local HEAD, which
  is what you want when running it from a branch against a preview.
- `scripts/verify/address-anchors.mjs` takes `BASE` and checks four streets. Run it on
  any host that should be serving the ladder. The four anchor URLs it proves:
  `/streets/pine-street-milton#262`, `/streets/mae-court-milton#71`,
  `/streets/mcphail-way-milton#3165`, `/streets/bell-school-line-milton#7295`.
  The last has **no `StreetContent` row** and renders its ladder anyway — the address
  section reads the Town projection and does not depend on a generated row.
- `scripts/measure-address-380.ts` re-measures the 380px hit areas corpus-wide. Pure, no
  DB, no network at render time. Run it under `tsconfig.jsx-test.json` after any change to
  `DOT_GAP`, `END_PAD`, `LABEL_GAP` or `.s-m.s-q`. It reads
  `scratchpad/audit/060-slugs.txt`, which is the published set from the sitemap.
- **`tsconfig.json` type-checks `**/*.ts`**, excluding `node_modules`, `scripts/**`,
  `scratchpad/**` and `tmp-*`. `scratchpad/**` was added in `a6229a7` after a throwaway
  script there failed a Vercel build (`19883b7`, `TS2802`). **Runnable `.ts` still goes in
  `scripts/`** — the exclusion closes a deploy hazard, it does not make `scratchpad/` a
  second home for code. Anything outside those four exclusions compiles under the app's
  tsconfig, not the test one.
- **A local build started before a file is written does not cover that file.** The gate on
  `19883b7` was green and the deploy still failed, because the script was created while the
  build was running. Write first, then build.
- `scripts/regen-condo-local.ts` is the CONDO bulk runner. `REGEN_ORDER` is required, there is
  no default. It forces DeepSeek primaries, refuses to start if any primary knob names a Claude
  model, and sets `CONDO_ENABLED=true` for its own process only. Run it as
  `npx tsx --tsconfig tsconfig.test.json` — **not** with `NODE_OPTIONS=--conditions=react-server`,
  which makes React's shared-subset entry throw "not yet supported outside of experimental
  channels" before anything runs.
- `scripts/recon-condo-names.ts` reports condo naming state across all 65 buildings, including
  which resolve, which report a disagreement, and which carry a Town direction. Read only.
- `scripts/backfill-condo-names.ts` is **dry run by default**; `--write` to touch anything. It
  reports 10 before/after samples and proves its own idempotency after a write.
- `scripts/town/gen-address-directions.ts` regenerates `src/data/addressDirections.ts` from the
  Town layer. Re-run it whenever the Town address layer is re-pulled.
- `scripts/recon-address-anchors.ts` reports per-street ladder shape and corpus coverage.
- `scripts/create-street-page.ts` creates a page that does not exist; `regen-058-local.ts`
  regenerates one that does. Neither can run a Claude primary pass.
- `scripts/audit-corpus-grounding.ts` rebuilds inputs and reports false positives on
  comparator figures. Prefer `inputJson` on any row that has one.
- Whether the fallback fires at all is stochastic — the same page escalated on one run
  and passed on DeepSeek at attempt 2 on the next. A single-page A/B proves less than it
  looks.

## Next expected task

**Review `fix/core-batch` on `miltonly-5b9qn9rrs` and rule on the 250 creation candidates.**
Nothing merges until that is answered. The other three pieces of the batch are independent of it
and could be split out if the gate change needs to wait.

Then: **QUEUE item 5, geometry backfill** — solar exposure, surface, lanes, sidewalk, maxspeed,
length and terminus onto all published streets from the Town and OSM layers. No camera work and
nothing derived from imagery.

Failing that: the Anthropic credit balance (open item 1), which blocks three pages and any
cron escalation; open item 8, the seven clips with `blur_verified: false`; open item 9, the
two orphaned clips. **Do not self-start any of them.**

Or, ahead of it if Aamir says so: the Anthropic credit balance (open item 1), which blocks
three pages and any cron escalation; open item 8, the seven clips with
`blur_verified: false`; open item 9, the two orphaned clips.

**Do not self-start any of them.**
