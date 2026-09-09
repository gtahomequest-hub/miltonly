# Handoff

_Last rewritten 2026-09-09, after `feat/address-anchors` merged and production verified._

## READ THIS FIRST

**QUEUE item 3 is MERGED and live.** `feat/address-anchors` merged to main as `e14bfa2`,
with `a6229a7` on top of it. Production `miltonly-c25astehn` serves `a6229a7`, confirmed on
the apex through `/api/build`. Battery **`PASS · 9 checks · 444 pages · 61s`**, exit 0, at
the full SHA. The anchor verifier passes on `https://miltonly.com`. All four anchor URLs
return 200 with their `id` present in the served markup. Approved by Aamir. Records in
`scratchpad/reports/059-address-anchors-build.md` and
`scratchpad/reports/060-address-ladder-verification.md`.

**`scratchpad/**` is now excluded from the app tsconfig** (`a6229a7`). It included
`**/*.ts` and excluded only `node_modules`, `scripts/**` and `tmp-*`, so a throwaway script
written to `scratchpad/` compiled under the **app's** tsconfig rather than the test one.
That is how `19883b7` passed a local gate and failed its Vercel build in 45s. Proven both
ways with a probe carrying the exact failing shape: `tsc --noEmit` clean with the exclusion,
the same `TS2802` without it. **Runnable `.ts` still belongs in `scripts/`** — the exclusion
closes the deploy hazard, it does not make `scratchpad/` a second home for code.

**A local build started before a file is written does not cover that file.** The other half
of the same lesson, and the reason the gate was green on a commit that could not deploy.
Write first, then build.

**380px tappability is measured corpus-wide.** `scripts/measure-address-380.ts` renders all
442 ladders and reads placement back out of the markup: 27,130 marks, **13,816 labels
suppressed**, minimum same-side gap **exactly 14px** (the height a suppressed mark is
given), **0** below it, minimum top **34px** (`END_PAD`), **0** clipped ends. The tightest
pair in Milton is `25-side-road-milton`. Half the corpus is drawn as a bare dot and every
one of those is still a real target.

**There is no VIP signup route in this codebase.** "Watch <Street>" points at
`#street-alert`, the live street alert already on the page, which posts
`property_address: <street name>`. `/exclusive` is a listings page with no form and `#vip`
is a homepage strip of links. **This is a deliberate deviation from the brief, which asked
for a VIP signup by name.** A distinct VIP list is a new surface and a new decision. The
owner CTA prefills for real: `/sell?street=<name>#valuation`, read by `HomeValuationCard`.

**The Anthropic account has no credit.** The Opus fallback fired on
`bell-school-line-milton` and the API returned `400 invalid_request_error: Your credit
balance is too low to access the Anthropic API`. That is the live blocker on every page
DeepSeek cannot clear on its own, which today is `jasper-street-milton`,
`wood-close-milton` and `bell-school-line-milton`. Nothing in the code can route around
it. **`AI_PROVIDER_FALLBACK="opus"` is still set in production**, so a cron generation
that escalates today fails closed rather than escalating, silently and for a reason that
is not in the code.

**A street page renders without a `StreetContent` row.** `bell-school-line-milton` has
no row and returns HTTP 200 on production — and now serves a 48-address ladder, because
the section reads the Town projection and does not depend on a generated row. Anything
that reasons about "which streets have pages" from `StreetContent` alone is counting a
different thing from what is being served.

**Published street pages: 445.** The battery still reports 444; it counts a different
population and both numbers are right.

**Every cost figure in every handoff before 2026-09-05 is wrong by 3x on the Opus
portion.** `CLAUDE_MODELS` in `src/lib/ai/compliance.ts` carried the 2026-05 Opus rate
of $15/$75 per MTok long after it moved to $5/$25. Corrected 2026-09-05; rows written
before that still hold the inflated number and cannot be restated from what is stored.
Nothing enforces that table. Check it against the current rate sheet before trusting a
cost claim.

**A generation stores the input it was written from.** `StreetGeneration.inputJson`. Use
it. Do not audit a generation by rebuilding its input when the row carries a snapshot.

## Where things stand

| | |
|---|---|
| `main` | **`a6229a7`**, item 3 merged |
| production | **`miltonly-c25astehn`**, serving **`a6229a7`**, confirmed on the apex |
| battery on production | **`PASS · 9 checks · 444 pages · 61s`**, exit 0, at the full SHA |
| anchor verifier on production | **PASS**, four streets |
| four anchor URLs on production | **200, `id` present in the served markup, all four** |
| local build | exit 0, zero `P2024`, **18/18 prebuild**, 546 static pages |
| working branch | `feat/address-anchors`, **merged**, safe to delete |
| published street pages | **445** |
| pages carrying an address ladder | **442** of 445; 27,130 civic addresses |
| draft / unpublished | 41 / 4 |
| generations carrying an input snapshot | 154 of 480 |
| QUEUE | 1, 2, **3 done**; 4, 5, 6, 7 not started |

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
14. Condo H1s still render abbreviations such as `Nadalin Hts`. QUEUE item 4.
15. Stored `HubContent.metaDescription` drifts from live on 21 of 22 hubs.
16. Rent pill disagrees with the market card on `melville-bonus-crescent-milton` and
    `mcdougall-crossing-milton`.
17. `video.miltonly.com` still unattached. `r2.dev` is rate-limited and not intended for
    production traffic at volume.
18. Two draft rows carry a clip: `diefenbaker-street-milton`, `murlock-heights-milton`.
19. **11 slugs have R2 clips uploaded and no `StreetContent` row.** Generation candidates,
    blocked by open item 1 wherever DeepSeek cannot clear them.

## Notes for the next run

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
- `scripts/recon-address-anchors.ts` reports per-street ladder shape and corpus coverage.
- `scripts/create-street-page.ts` creates a page that does not exist; `regen-058-local.ts`
  regenerates one that does. Neither can run a Claude primary pass.
- `scripts/audit-corpus-grounding.ts` rebuilds inputs and reports false positives on
  comparator figures. Prefer `inputJson` on any row that has one.
- Whether the fallback fires at all is stochastic — the same page escalated on one run
  and passed on DeepSeek at attempt 2 on the next. A single-page A/B proves less than it
  looks.

## Next expected task

**QUEUE item 4, condo building names** — route the street component of every
`CondoBuilding` address through `resolveStreetName`, keeping the house number, across the
H1, the title, the meta description, the JSON-LD and the breadcrumb. 108 buildings. It is
open item 14 as well: condo H1s still render abbreviations such as `Nadalin Hts`.

Or, ahead of it if Aamir says so: the Anthropic credit balance (open item 1), which blocks
three pages and any cron escalation; open item 8, the seven clips with
`blur_verified: false`; open item 9, the two orphaned clips.

**Do not self-start any of them.**
