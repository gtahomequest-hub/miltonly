CORE · D:\miltonly · main

# Handoff

_Last rewritten 2026-09-10, after the rulings were executed and the merge sequence halted._

## READ THIS FIRST

**THE MERGE SEQUENCE IS HALTED. `fix/core-batch` IS NOT MERGED.** `feat/homepage` merged to main
as **`cec6906`** and production serves it, but **the battery on production is RED** and the cause
came in with that merge, not with this batch. Stop-on-failure says continue only if a failure is
isolated AND pre-existing. These are isolated but new. `fix/core-batch` sits at **`2e8dfc0`**,
built and green on its own preview, waiting. Full record: `scratchpad/reports/066-rulings-and-merges.md`.

    FAIL · 11 checks · 449 pages
      [hub-meta]    hero stat tiles parsed on every hub: 0, expected 22
      [homepage]    Milton-wide figures outside their source + tolerance: 1, expected 0
      [hub-intents] hubs rendering no intent squares: 22, expected 0

**TWO OF THE THREE ARE STALE PARSERS, NOT BROKEN PAGES.** `feat/homepage` rewrote the hub hero
markup from an `h-` prefix to `hh-` and did not update the two checks that read it.
`hub-intents.mjs` matches `class="h-intent"` and the page renders `class="hh-intent"`;
`hub-meta.mjs`'s `heroStats()` splits on `<div class="h-hs">` and reads `h-n`/`h-l` while the page
renders `hh-fact` / `hh-fact-v` / `hh-fact-l` with `data-fig` and `data-value` attributes. **The
squares and tiles are on the page.** Confirmed by hand against bronte-meadows and moffat.

**AND THE SUB-K CONTRACT CHANGED WITH IT.** On a k-clearing hub `hub-fact-typical` prints `$955K`
labelled "typical sale price"; on moffat, which is sub-k, the same tile degrades to `3` labelled
"sales in 12 months". That is a better suppression than the old silent tile, but `hub-meta`'s
`silent` model no longer maps to it and its assertions need rewriting around the new contract.
**Not done here on purpose: rewriting another branch's k-anonymity verification inside a merge
window is how a real suppression bug gets waved through.**

**THE HOMEPAGE PUBLISHES A FIGURE FROM A CACHE NOTHING CAN INVALIDATE.** `proof-sales-12mo` reads
**1,531** against a live source of **1,728**. `buildMiltonWideContext()` in
`src/lib/ai/buildHubInput.ts` memoizes into a module-level `_miltonWideCache` with **no TTL**, and
`resetMiltonWideContextCache()` is called by one script and **nothing in the serving path**. The
memo was written for "once per generation run" across 14 hubs; the homepage calls it on every
render. It fills on the first render after a deploy and never refreshes for that lambda's life.
`on-market` and `dom` come from the same memo. **`/api/sync/sold` runs daily at 11:00, so this
goes stale every day and is silently corrected by the next deploy** — which is why it was never
caught. The backfill did not cause it, it only made it visible.

**A DB2 WRITE HAS THREE CONSUMERS TO INVALIDATE AND DEC-REGEN-REVALIDATE COVERS ONE.** The
sold-date backfill moved figures corpus-wide and purged nothing, because it writes no
`StreetContent` row. Purging the pages did not fix it either: the figures come from `cached()` in
`src/lib/cache.ts`, an Upstash layer with a 1h TTL that a Next.js path revalidation does not
touch. The homepage was a cache MISS and still printed the old numbers. **The order is Redis
first, pages second, prose third:** `scripts/purge-sold-caches.ts` (17 keys, 10 prefixes), then
`scripts/purge-after-sold-backfill.ts` (26 paths), then a regeneration, which is separate. That
fixed `sold-mtd` and all 18 hub-figure mismatches.

**THE BACKFILL IS DONE AND IT WAS 255, NOT 245.** The feed added 10 overnight. All 255 repairable,
0 undatable, 255 written, 0 failed, **re-run reports 0**. Repaired through `resolveSoldDate`, the
same function the sync calls, so a backfilled row is what the next sync would have written.
`close_date` untouched throughout. **150 streets changed their 12-month sample; 17 crossed k5 and
9 crossed k10, exactly as predicted.** They publish nothing new until they are regenerated,
because those figures live in stored prose.

**THE CREATION PROGRAMME IS BLOCKED AT A 22% PASS RATE.** The 50-page run **halted at 23** on the
five-consecutive-failure guard: 5 passed and published, 18 failed, $0.2624 of a $3 cap. The
dominant signature is `invalid_json_shape: sections length = 3, expected 2` — the model keeps
emitting **`differentPriorities`** and its FAQ on inputs where `dropsDifferentPriorities(input)`
is true, through all 5 attempts with the retry feedback in front of it. **All 249 candidates are
this same thin-data population**, so this is not a per-page problem. Fix the prompt before running
more. Failures are fail-closed and wrote no row, so there is nothing to unpublish.

**THE RUNNER IN THE RULING COULD NOT HAVE DONE IT.** `regen-058-local.ts` reads the
`StreetContent` row first and logs `SKIP - no StreetContent row`, which is every street in this
programme. It would have reported a clean run having created nothing.
**`scripts/create-street-pages-local.ts`** is its creation counterpart, with the same controls.

**A COLUMN WAS NEARLY ADDED FOR NOTHING.** `StreetContent.createdAt` already exists, in the
database and in `schema.prisma` both, defaulting on insert, carrying real history to 2026-04-21.
An `ALTER TABLE` to add it failed with **42701**. Nothing was added, the failed migration is
marked rolled back, and **`prisma migrate status` is clean**. Read the schema before adding to it.

**THE CRON DRAIN RUNS HOURLY**, so a per-invocation limit is not a daily one — 24 invocations
would have allowed 480 pages a day. `NEW_PAGES_PER_DAY = 20`, counted over
`StreetContent.createdAt`; only `build` spends budget, `regenerate` never did; a street over
budget is left **pending**, not ineligible, and the cap is reported in the route's JSON.

**`/rentals` is 1,116 and the homepage agrees. `on-market` is 457, not 462** — it is live and it
moves, and the battery passes it against its own source.

**Published street pages: 450**, up from 445: the five new ones. Total `StreetContent` 495.

**Every cost figure in every handoff before 2026-09-05 is wrong by 3x on the Opus portion.**

## Where things stand

| | |
|---|---|
| `main` | **`cec6906`** plus this docs commit; production serves it |
| battery on production | **`FAIL · 11 checks · 449 pages`**, 3 assertions, all diagnosed above |
| `fix/core-batch` | **`2e8dfc0`**, pushed, **NOT merged**, green on its own preview |
| `prisma migrate status` | **clean** |
| future-dated DB2 rows | **0** (255 repaired, re-run 0) |
| streets crossing k5 / k10 | **17 / 9**, unpublished until regenerated |
| creation candidates | **249**; 5 built, 18 failed, **226 not attempted** |
| creation pass rate | **22%**, systemic, programme paused |
| published street pages | **450** |
| QUEUE | 1, 2, 3, 4 done; **7 built and ruled, merge blocked**; 5, 6 not started |


## What happened 2026-09-10 (later) — the rulings

Four rulings executed. Record in `scratchpad/reports/066-rulings-and-merges.md`.

**1. The backfill.** `scripts/backfill-sold-date-not-future.ts`, dry-run by default, repairs
through `resolveSoldDate`. 255 rows, 0 undatable, re-run 0. It never invents a date and never
deletes a row it cannot date. Two new purge scripts followed it, in the order that matters.

**2. The 50-page run.** Halted at 23 by its own guard. 5 published. The blocker is a
prompt/validator disagreement over `differentPriorities` on thin-data inputs, not the runner.

**3. The cap.** Built, hourly-drain-aware, reported in the response.

**4. The merges.** `feat/homepage` in at `cec6906`. `fix/core-batch` held back on a red battery.

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
10. **`makeStreetDecision`'s minimum-data gate** — QUEUE item 7. Measured: 831 slugs
    carry DB2 records, 419 are skipped as low-data, 103 of those already have a page and
    316 have none. The brief's figure of 46 does not reproduce.
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
20. **CLOSED.** The 255 future-dated DB2 rows are repaired; a re-run reports 0.
24. **The hub battery cannot pass.** Two checks parse markup that no longer exists, and
    `hub-meta`'s sub-k `silent` model does not map to the new degrade-to-a-count tile. Blocks
    every merge until rewritten. See READ THIS FIRST.
25. **`buildMiltonWideContext` memoizes with no TTL** and nothing in the serving path resets it.
    Three homepage figures go stale daily and are corrected only by a deploy.
26. **The creation programme is paused at 22%.** `differentPriorities` is offered by the prompt
    on inputs the validator refuses it on. 226 of 249 candidates unattempted.
27. **17 streets cleared k5 and 9 cleared k10** in the backfill and still publish the suppressed
    figure, because the numbers are in stored prose. A regeneration is the only way through.
28. **The DB1 branch of `makeStreetDecision` has no entity floor**, and `/api/sync/generate` has
    none at all. Only `scripts/create-street-page.ts` enforces publish floor = entity floor.

## Notes for the next run

- **Purge order after any DB2 write: Redis, then pages, then prose.**
  `scripts/purge-sold-caches.ts` then `scripts/purge-after-sold-backfill.ts`. Purging pages first
  just re-renders the stale numbers, which is exactly what happened on 2026-09-10.
- **`&&` short-circuits, and an `echo` after it does not.** A chain whose `python` step failed
  still printed "migration written" and the migration directory was never created. Verify the
  artifact, not the message.
- **Read the schema before adding to it.** `StreetContent.createdAt` was already there, twice
  over, and the ALTER failed with 42701.
- `scripts/create-street-pages-local.ts` CREATES pages; `regen-058-local.ts` REgenerates and
  silently skips any slug with no row. Pick by whether the row exists.
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

**Make the battery honest again, then merge `fix/core-batch`.** Two stale hub checks and the
sub-k tile contract, open items 24 and 25. Nothing merges until the battery can pass, and it is
failing on parsers rather than on pages, so the pages are not the work.

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
