# Handoff

_Last rewritten 2026-09-09, after QUEUE item 4 was built on `feat/condo-names`._

## READ THIS FIRST

**QUEUE item 4 is built and pushed and is NOT merged.** Branch `feat/condo-names`, preview
`miltonly-4jq67bbl4` at `078d92b`. Battery **`PASS · 9 checks · 444 pages · 58s`**, exit 0,
at the full SHA. The preview gate applies and Aamir reviews before merge. Record in
`scratchpad/reports/061-condo-names-gate-a.md` (the Gate A recon and the three rulings).

**`src/lib/condoName.ts` is the only source of a condo building's name on any surface.** The
condo counterpart of `resolveStreetName`, subject to the same rule: the registry is the
authority and the stored string is not. `streetSlug` is the primary; a re-parse of the raw
address is a **check**, and a row where the two disagree is reported, not silently resolved.
Two rows report today and both are understood: `21 Crt St N` ("Crt" is outside
`canonicalType`) and `6415 Regional Rd` (the stored string lost the "25").

**THE DIRECTION COMES FROM THE TOWN, PER CIVIC ADDRESS, OR NOT AT ALL.** This is the half
that matters and the easiest thing to undo by accident. The MLS strings carry a direction
that is not merely abbreviated but **wrong**: four streets carry contradictory directions
across their own buildings, and **`"1050 Main St W"` names an address the Town records as
MAIN STREET E**. `src/data/addressDirections.ts` is a new build-time projection of the
Town's own `ST_DIR_SUFFIX` — 1,355 civic addresses over the **12** Milton streets that
actually have a direction, from 1,976 directional address points, with **36 dropped for
contradicting themselves**. A building renders a direction only where the Town gives that
civic address one. `139 Main` is one of the 36 and renders none.

**There is no Main Street West condo.** All 17 Main Street buildings resolve East or to no
direction at all. The one stored as "Main St W" is `1050`, and the Town says East. If a
future task asks for a West example, the honest answer is that the corpus has none.

**The stored columns were backfilled and the render does not depend on them.**
`scripts/backfill-condo-names.ts` rewrote `buildingName`, `metaTitle` and `metaDescription`
on **57 of 59** published rows, 171 values, re-run changes **0**. Dry run is the default.
**The prose column is untouched** — 57 rows mention the abbreviation inside generated
sentences, and rewriting prose by substitution is how a backfill starts inventing claims.
Those 57 are a regeneration question and they stay open. The description **variant** is
preserved rather than recomputed, because recomputing sale-vs-rental today would restate a
fact about a different moment.

**`scripts/test-condo-name.ts` is the 19th prebuild test, 112 assertions.** It RENDERS both
condo shells and reads the H1 and breadcrumb back out of the markup rather than asserting
that a file imports the resolver — the item 3 pattern, and what open item 11 still wants
applied to the street name guard. **Verified red against main's behaviour: 54 of 112 failed,
including every rendered H1.** It asserts the Town's direction specifically, so a future
change that trusts the stored string again fails the build.

**The Anthropic account has no credit.** The Opus fallback returned `400
invalid_request_error: Your credit balance is too low to access the Anthropic API`. That is
the live blocker on `jasper-street-milton`, `wood-close-milton` and
`bell-school-line-milton`. **`AI_PROVIDER_FALLBACK="opus"` is still set in production**, so a
cron generation that escalates today fails closed rather than escalating.

**Published street pages: 445.** The battery reports 444; it counts a different population
and both numbers are right.

**Every cost figure in every handoff before 2026-09-05 is wrong by 3x on the Opus portion.**
`CLAUDE_MODELS` carried the 2026-05 rate long after it moved to $5/$25. Rows written before
the 2026-09-05 correction cannot be restated from what is stored.

**A generation stores the input it was written from.** `StreetGeneration.inputJson`. Do not
audit a generation by rebuilding its input when the row carries a snapshot.

## Where things stand

| | |
|---|---|
| `main` | **`3f5442d`**, item 3 merged and live |
| production | serving `3f5442d` |
| working branch | **`feat/condo-names`**, pushed, **not merged** |
| preview to review | **`miltonly-4jq67bbl4`**, at **`078d92b`** |
| battery on that preview | **`PASS · 9 checks · 444 pages · 58s`**, exit 0, at the full SHA |
| local build | exit 0, zero `P2024`, **19/19 prebuild**, 546 static pages |
| condo buildings | **65** (not the 108 the brief stated) |
| published `CondoContent` | 59; **57 backfilled**, re-run changes 0 |
| condo names carrying a Town direction | **17** of 65 |
| published street pages | **445** |
| pages carrying an address ladder | **442**; 27,130 civic addresses |
| QUEUE | 1, 2, 3 done; **4 built, awaiting preview review and merge**; 5, 6, 7 not started |

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
14. ~~Condo H1s render abbreviations~~ **CLOSED** by QUEUE item 4 on `feat/condo-names`.
    What remains is the **prose**: 57 of 59 published `CondoContent.description` bodies still
    say "1005 Nadalin Hts" inside generated sentences. The backfill deliberately did not touch
    them. A regeneration question, and it needs open item 1 resolved first.
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

Review preview **`miltonly-4jq67bbl4`** (at `078d92b`, battery PASS) and decide on merging
`feat/condo-names`. Then **QUEUE item 5, geometry backfill**.

Failing that: the Anthropic credit balance (open item 1), which blocks three pages and any
cron escalation; open item 8, the seven clips with `blur_verified: false`; open item 9, the
two orphaned clips. **Do not self-start any of them.**

Or, ahead of it if Aamir says so: the Anthropic credit balance (open item 1), which blocks
three pages and any cron escalation; open item 8, the seven clips with
`blur_verified: false`; open item 9, the two orphaned clips.

**Do not self-start any of them.**
