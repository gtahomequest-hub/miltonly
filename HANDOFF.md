CORE · D:\miltonly · main

# Handoff

_Last rewritten 2026-09-12 (MC-014): hubs v2 and core batch 3 on main, production 16/16, nothing waiting on a merge._

## READ THIS FIRST

**MAIN IS `f01a96a` AND PRODUCTION SERVES IT, `PASS · 16 checks · 489 pages · 596s`.** Two
merges by SHA on 2026-09-12: `05bc914` (hubs v2 `26af26b`, approved; marked done in QUEUE.md)
and `f01a96a` (core batch 3 `bf4f8b3`). Three conflicts between them, all resolved by keeping
both intents: the runner carries both new checks (`hub-page`, `sources-fresh`); the rebuilt
hub's renting square is scoped to `/rentals?neighbourhood=<slug>`; the ladder's third rung goes
to `/streets` for every hub because the per-hub overflow page now 301s to the ladder. Record:
`scratchpad/reports/MC-014-hubs-and-batch-3-on-main.md`.

**NOTHING WAITS ON A MERGE.** Every branch opened this week is on main.

**WHAT LANDED WITH CORE BATCH 3.** The board never the family; the judge cannot refuse on a
finding it labels not a violation; hub titles and descriptions have no em-dash and the LIVE
title serves (the stored one carried the old dash); `/rentals?neighbourhood=<hub>`; the overflow
page 301s and left the sitemap; parking and GO up-links from the guides' own hub rules, held by
the battery against the guides' down-links; `sources-fresh`, which will fire on 2026-11-28
(GTFS) and 2026-12-11 (parking pages) by design: refetch, then rebuild.

**WHAT LANDED WITH HUBS V2 (MH-004).** Glance claims derived or dropped; the ladder is every
published street at the street page's own k-gated typical (Timberlea: 22 rows = 22 published);
schools inside the Town polygon; the `hub-page` check.

**THE BATTERY LIES FOR AN HOUR AT A WINDOW EDGE, AND IT LIED ON PRODUCTION TONIGHT.** At 00:00Z
the 12-month window's trailing edge passed nine rows and `chretien-street` fell from five
sales to four while its page held the k5 figures; the homepage's neighbourhood typicals were
served from an entry a pre-tag build had computed from an untagged Data Cache reply. Production
and the rulings preview failed the same assertions at the same minute on code that had passed
an hour earlier, and the tagged Data Cache serves one stale reply past its expiry
(stale-while-revalidate), so "wait an hour" is not enough either. Read a FAIL after a window
edge or a sold-sync write against production first; if production fails the same lines, it is
the caches. `scratchpad/mc003/purge-street.ts <slug> <base…>` clears one street on both
caches and the path; after that the rulings preview passed 14/14.

**THE SOLD SYNC NOW PURGES BOTH CACHES ON MAIN.** Upstash (exact keys, per-street and
per-neighbourhood prefixes for what it wrote, a settle pass) and the `db2` Data Cache tag,
dropped by the sold route after a writing run. `/api/revalidate` takes `{ tag: "db2" | "db3" }`.
**Nothing drops `db3`** (analytics) yet.

**THE JUDGE, NOW READABLE ON EVERY ROW (`StreetGeneration.judgeVerdict`).** Two things its
verdicts show for a ruling: "For Catholic families …" is how the model names the Catholic
board's schools and the judge reads it as `religion` (three round-1 refusals tonight, all
passed on round 2); and on `barclay-circle` it refused with a finding it labelled "amenity
fact, not a violation". `barclay-circle` and `gordon-krantz-avenue` are the two crossed
streets still on the suppressed sample.

**THE SEVEN CLIPS ARE LIVE, THE MANIFEST IS 173 ROWS / 49 PUBLISHED**, `bronte-street-south`
retired. Re-keyed clips live under `streets/<slug>/<YYYYMMDD>/`.

**THE CREATION PROGRAMME IS RUNNING.** 19 pages created 2026-09-11, the cap held; the 00:00Z
pass opened a new budget (481 pages on the sitemap by 00:20Z). 215 pending.

**THE FIGURES MOVE DAILY, SO DO NOT PIN THEM.** The battery asserts each against its own source.

**Every cost figure in every handoff before 2026-09-05 is wrong by 3x on the Opus portion.**

## Where things stand

| | |
|---|---|
| `main` | code SHA **`f01a96a`**, docs on top |
| battery on production | **`PASS · 16 checks · 489 pages · 596s`** at `f01a96a`, 2026-09-12 |
| `prisma migrate status` | **clean**, 27 migrations |
| waiting on merge | nothing |
| creation programme | **running**, cap 20 per UTC day, DeepSeek first |
| `AI_PROVIDER_MARKET` | **deepseek** (Production, Preview); fallback opus, no credit |

## What happened 2026-09-10 (final) — three merges

Record in `scratchpad/reports/068-three-merges.md`.

**1. `5448b96`, the approved rent tile and hub anchors.** Cherry-picked as `1cf5342`, because a
merge reported "Already up to date". Battery `PASS · 11 checks · 449 pages · 109s`. `/rentals`
1,116 and the homepage agrees; `on-market` 457.

**2. `0a2499b`, feat/content.** Merged as `31a9ab0` after a `vercel.json` conflict resolved to
keep all three crons. Battery `PASS · 11 checks · 449 pages · 99s`. Content ran the held
2026-08-31 regeneration and reported back: every headline figure moved with the backfill, and new
listings held at 56 because they come from DB1's `listedAt`, which the backfill never touched.
That is the clean confirmation of the `CloseDate` diagnosis.

**3. `fix/core-batch`, head `dce1b70`.** `origin/main` merged in, four conflicts resolved, the TTL
added as its own commit rather than buried in the merge, two lead guards repointed. Preview
`miltonly-j6va7trjl` green, then merged as `8db80da`. Battery
`PASS · 11 checks · 449 pages · 97s`.

**Then the ledger.** Two wrong rows in `_prisma_migrations`, both fixed, status clean.

| `5448b96` | **cherry-picked** as `1cf5342` (a merge was a no-op) |
| `feat/content` `0a2499b` | **merged** as `31a9ab0`; Content notified, correction is live |
| `fix/core-batch` `dce1b70` | **merged** as `8db80da`; preview `miltonly-j6va7trjl` was green |
| `feat/homepage` | **unmerged**, intact, awaiting Home's hub work |
| crons | **17**, both market-watch entries kept |
| prebuild | **23 tests** |
| future-dated DB2 rows | **0** of 8,578 |
| creation programme | **paused**, 5 built, 249 rows `ineligible`, cap live at 20/day |
| published street pages | **450** |
| QUEUE | 1, 2, 3, 4 done; **7 DONE and merged**; 5, 6 not started |


## What happened 2026-09-10 (latest) — the revert, the sweep, and feat/leads

Record in `scratchpad/reports/067-revert-and-leads.md`.

**The sweep.** Redis purged first, then 487 figure-publishing paths revalidated in batches, all
200. Battery afterwards: every figure check green, drift zero. That answered the question the
sweep was for — the remaining red was never about figures.

**The revert.** `git log main --oneline -15` showed `c98f40e wip(hub)` sitting between the
approved `5448b96` and the merge commit. Reverted the merge whole. Battery went from
`FAIL · 11 checks` to `PASS · 10 checks` on that one commit.

**feat/leads.** Merged by SHA at `26381f9`. Build exit 0, zero `P2024`, 549 static pages.
Production Ready, `543ef99 served == expected`, battery `PASS · 10 checks · 449 pages · 70s`.

**The export.** `SUPERLATIVE_PHRASES` made public, one line, `114420a`.

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
24. **`feat/homepage` still needs Home to finish the hub work.** `5448b96` is back on main by
    cherry-pick and its check passes against the `h-` markup. When the `hh-` rebuild returns, the
    two checks must land WITH it: `hub-intents.mjs`'s selector, `hub-meta.mjs`'s `heroStats()`,
    and `hub-meta`'s sub-k `silent` model rewritten around the degrade-to-a-count tile (moffat
    prints `3` / "sales in 12 months" where a k-clearing hub prints `$955K` / "typical sale
    price"). That last one is a k-anonymity change and needs its own review.
29. **CLOSED by revert (historical).** The two hub checks failed against markup from an unapproved WIP
    commit (`c98f40e`), not against a stale contract. `git revert -m 1 cec6906` restored green.
    When Home re-merges `feat/homepage`, `hub-intents.mjs` and `hub-meta`'s `heroStats()` must
    land WITH the `hh-` markup, and `hub-meta`'s sub-k `silent` model has to be rewritten around
    the degrade-to-a-count tile (moffat prints `3` / "sales in 12 months" where a k-clearing hub
    prints `$955K` / "typical sale price"). That rewrite is a k-anonymity change and needs its
    own review.
25. **CLOSED.** `buildMiltonWideContext` now carries a 5-minute TTL (`259a365`). Previously: and nothing in the serving path resets it.
    Three homepage figures go stale daily and are corrected only by a deploy.
26. **The creation programme is paused at 22%.** `differentPriorities` is offered by the prompt
    on inputs the validator refuses it on. 226 of 249 candidates unattempted.
27. **CLOSED. `fix/core-batch` is merged** as `8db80da`. Previously: Main has moved twice under it (a
    revert and a merge). Nothing is wrong with the branch; its baseline is simply stale.
28. **17 streets cleared k5 and 9 cleared k10** in the backfill and still publish the suppressed
    figure, because the numbers are in stored prose. A regeneration is the only way through.
28. **The DB1 branch of `makeStreetDecision` has no entity floor**, and `/api/sync/generate` has
    none at all. Only `scripts/create-street-page.ts` enforces publish floor = entity floor.

## Notes for the next run

- **A reverted merge's commits are still ancestors, so re-merging them is a silent no-op.**
  `git merge --no-ff 5448b96` printed "Already up to date" and did nothing. Cherry-pick reapplies
  them. Read the merge output before believing a merge happened.
- **The Prisma CLI reads `.env`, NOT `.env.local`.** This worktree has a gitignored `.env`
  carrying `DATABASE_URL` and `DIRECT_DATABASE_URL`, which is the only reason `migrate status`
  runs here. A worktree without one fails **P1012** before it opens a connection, because
  `schema.prisma` declares `directUrl = env("DIRECT_DATABASE_URL")`. Content's worktree hit
  exactly that and was pushed toward improvising a value.
- **`DIRECT_DATABASE_URL` is `DATABASE_URL` with `-pooler` removed from the host.** Same Neon
  endpoint, unpooled. It does not need to be fetched from Vercel and no credential needs to be
  passed around to reconstruct it. **Do not substitute `NEON_DATABASE_URL_UNPOOLED`** — that is
  DB2, it has no `_prisma_migrations` table at all, and Prisma will confidently report every
  migration unapplied about the wrong database. That is the same DB1/DB2 substitution that once
  created two empty tables in the sold database.

  **The danger is the shape of the wrongness, not the wrongness.** That misreading does not
  produce an error or an obviously silly answer. It produces a specific, plausible, actionable
  finding — "the ledger is out of sync, do not run migrate deploy" — which reads as diligence and
  survives review intact. The only question that catches it is *which host answered*. On
  2026-09-10 it did not get asked, so the finding was written into `HANDOFF-content.md` as an
  instruction, and that instruction then licensed a whole tier to route around the ledger with
  `prisma db execute` for weeks. **A wrong reading that is merely wrong gets corrected; one that
  is useful-looking gets institutionalised.** Ask which database answered before writing down
  anything a `_prisma_migrations` query told you. (Content's framing, taken verbatim in
  substance; theirs is the sequence, not just the misreading.)
- **Never route around the ledger with `prisma db execute`.** It runs the SQL and writes no row,
  so the migration is invisible to `migrate status` and the next `migrate deploy` tries to replay
  it against tables that already exist. `HANDOFF-content.md` recommended exactly this, on a false
  premise; withdrawn by Content at `6608b59`. Audited afterwards with
  `scripts/diag-migration-ledger-audit.ts`: 26 rows, 26 directories, 0 in progress, 0 drift,
  0 never-applied, and only **2** rows with zero applied steps — `0_init`, which is the expected
  baseline, and `20260910120000_market_edition`. **`savedsearch_env` and `phase1_lead_layer` were
  genuinely run.** Content's worry that other migrations went the same way does not materialise.
- **`prisma migrate status` is worth running after any merge that carries migrations.** Two rows
  were wrong on 2026-09-10 and neither broke a build, because Vercel runs `prisma generate`, not
  `migrate deploy`. `scripts/fix-migration-ledger.ts` clears a zero-step rolled-back row safely.
- **`git merge --no-ff <branch>` resolves the branch at the moment you type it.** If you were
  given a SHA, merge the SHA. `cec6906` shipped an unapproved 1,532-line hub rebuild because the
  tip had moved past the commit that was approved, and nothing in the merge output says so.
  `git log --oneline <approved-sha>..<branch>` before merging tells you in one line.
- `scripts/revalidate-figure-pages.ts` sweeps all 487 figure-publishing paths in batches.
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

Whatever Aamir names. Open: a `db3` tag drop for the analytics sync; `barclay-circle` and
`gordon-krantz-avenue` on a later pass; QUEUE item 6.
