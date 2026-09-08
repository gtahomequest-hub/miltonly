# Handoff

_Last rewritten 2026-09-08, after QUEUE item 3 was built on `feat/address-anchors`._

## READ THIS FIRST

**QUEUE item 3 is built and pushed and is NOT merged.** Branch `feat/address-anchors`.
Two follow-up fixes landed 2026-09-08 after the first review pass: the per-address markup
diet and the directional-siblings recon. The preview gate
applies and Aamir reviews before merge. Full record in
`scratchpad/reports/059-address-anchors-build.md`.

**The Anthropic account has no credit.** The Opus fallback fired on
`bell-school-line-milton` and the API returned `400 invalid_request_error: Your credit
balance is too low to access the Anthropic API`. That is the live blocker on every page
DeepSeek cannot clear on its own, which today is `jasper-street-milton`,
`wood-close-milton` and `bell-school-line-milton`. Nothing in the code can route around
it. **`AI_PROVIDER_FALLBACK="opus"` is still set in production**, so a cron generation
that escalates today fails closed rather than escalating, silently and for a reason that
is not in the code.

**A street page renders without a `StreetContent` row.** `bell-school-line-milton` has
no row and returns HTTP 200 on production. Gate A's phrase "a registry street with no
page" meant no row; the route renders a profile-in-preparation page anyway. Anything
that reasons about "which streets have pages" from `StreetContent` alone is counting a
different thing from what is being served.

**Published street pages: 445.** Every handoff before this one said 444. The battery
still reports 444 pages; it counts a different population and both numbers are right.

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
| `main` | **`3c308e6`** |
| working branch | **`feat/address-anchors`**, pushed, **not merged** |
| preview to review | **`miltonly-b1rancuw3`**, at `312478d` |
| battery on that preview | **`PASS · 9 checks · 444 pages · 71s`**, exit 0, at the full SHA |
| production | serving `e815f28` |
| local build | exit 0, zero `P2024`, **18/18 prebuild**, 546 static pages |
| published street pages | **445** |
| pages carrying an address ladder | **442** of 445; 27,130 civic addresses |
| draft / unpublished | 41 / 4 |
| generations carrying an input snapshot | 154 of 480 |
| QUEUE | 1, 2 done; **3 built, awaiting preview review and merge**; 4, 5, 6, 7 not started |

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

**`scripts/test-address-anchors.ts` is the 18th prebuild test, 34 assertions.** It
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

**250 KB raw is not reachable and the arithmetic is in report 059.** The App Router
inlines the RSC flight payload, so everything is served twice. The addresses `ItemList`
alone costs 184 KB of the 421 KB, against a budget of 152 KB between the production
baseline and 250 KB — it is over budget before a single address element is drawn. With
bare `PostalAddress` items and 387 marks costing literally nothing, the floor is 244 KB.
Fitting 250 KB while keeping every address element means cutting the `ItemList` to about
40 of 387 addresses. The compressed transfer is 37 KB and moved only 12% while the raw
figure moved 43%, because what was removed was repetitive markup brotli was already
collapsing. **Recommendation: keep the full list.** The decision is open.

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
  any host that should be serving the ladder.
- `scripts/recon-address-anchors.ts` reports per-street ladder shape and corpus coverage.
- `scripts/create-street-page.ts` creates a page that does not exist; `regen-058-local.ts`
  regenerates one that does. Neither can run a Claude primary pass.
- `scripts/audit-corpus-grounding.ts` rebuilds inputs and reports false positives on
  comparator figures. Prefer `inputJson` on any row that has one.
- Whether the fallback fires at all is stochastic — the same page escalated on one run
  and passed on DeepSeek at attempt 2 on the next. A single-page A/B proves less than it
  looks.

## Next expected task

Review preview `miltonly-bz6ldhja2` and decide on merging `feat/address-anchors`. Failing
that: the Anthropic credit balance (open item 1), item 8, or item 9. Do not self-start
any of them.
