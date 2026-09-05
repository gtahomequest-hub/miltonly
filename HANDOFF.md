# Handoff

_Last rewritten 2026-09-05 (third pass, after `fix/zero-price-priorities`)._

## READ THIS FIRST

**The corpus grounding sweep is done. Its residue is two pages, and both are understood.**
479 generations audited, 154 regenerated, 152 published clean. `jasper-street-milton` and
`wood-close-milton` stay draft. Detail in `scratchpad/reports/058-corpus-audit.md`.

**`fix/zero-price-priorities` is pushed and NOT merged.** It suppresses the
`differentPriorities` section on a no-price input and rejects one that appears anyway. It
works — `invented_cross_street` is gone from `jasper-street` entirely — and it does not make
the page pass. What it did was expose the next layer, and that layer is named in open item 1.

**Every cost figure in every earlier handoff is wrong by 3x on the Opus portion.**
`CLAUDE_MODELS` in `src/lib/ai/compliance.ts` carried the 2026-05 Opus rate of $15/$75 per
MTok long after it moved to $5/$25, and `costUsd` is computed from that table and written to
`StreetGeneration`. Corrected 2026-09-05. **Rows written before that commit still hold the
inflated number and were not rewritten** — the per-model token split needed to restate them
is not stored. Nothing enforces that table; check it against the current rate sheet before
trusting a cost claim.

**A generation stores the input it was written from.** `StreetGeneration.inputJson`. Use it.
Do not audit a generation by rebuilding its input when the row carries a snapshot — a rebuild
draws a different `crossStreets` set and reports figures as ungrounded that the page was
given.

Two decisions waiting:

1. **Seven clips are live with `blur_verified: false`**, all from the 2026-09-03 run.
2. **Two clips remain orphaned** under slugs that are not real streets.

## Where things stand

| | |
|---|---|
| `main` | `402fcd2` (+ `d6b0889`) |
| open branch | **`fix/zero-price-priorities`**, pushed, **not merged** |
| production | serving `e39c26a`, confirmed via `/api/build` |
| battery | **`PASS · 9 checks · 443 pages · 63s`**, exit 0, at the full SHA. Ran before `geddes-landing` published, so it counted 443 against today's 444 |
| local build | exit 0, zero `P2024`, **14/14 prebuild** |
| published street pages | **444** |
| draft / unpublished | 41 / 4 |
| generations carrying an input snapshot | 154 of 480 |
| QUEUE | 1, 2 done; 3 Gate A awaiting approval; 4, 5, 6, 7 not started |

## The fallback model — settled

`AI_PROVIDER_FALLBACK="opus"` in production. **Decided 2026-09-05: it stays.** When a
generation half exhausts its retry budget, that half re-runs on Claude Opus; unset, it fails
closed.

The code's Sonnet entry was corrected to `claude-sonnet-5` in the same pass (the old
`claude-sonnet-4-6` was a previous generation, and Sonnet 5 is both newer and cheaper), so
anything that selects `sonnet` now gets the current model. Nothing selects it.

The measurement behind the decision, on `geddes-landing`, the one page that escalates
reliably: **Opus fired on two halves and passed** ($0.4085); **Sonnet 5 fired on all three and
failed**. One trial each. The fallback exists to clear what the primary cannot, and on the
only head-to-head escalating page Sonnet did not.

## What happened 2026-09-05

**`StreetGeneration.inputJson` shipped** (`feat/gen-input-snapshot`, merged `c953b9e`). Both
write paths fill it at all ten sites where `inputHash` is written.
`scripts/test-input-snapshot.ts` asserts the pairing at every site and found a genuinely
unpaired site on its first run.

**154 pages regenerated.** 138 on the first pass (DeepSeek only, `$0.9443`), then the 13
published residue with the Opus fallback (13 of 13, `$1.2566` recorded at the stale rate,
about **$0.42** at the corrected one). Gate flags across the regenerated set went from 138 of
138 to zero.

**A zero-price street's prompt now says so.** `isZeroPrice` + `buildZeroPricePreamble`,
prepended to all three prompts — the thin-data preamble is market-scoped and every residue
failure was in the eval half. `scripts/test-zero-price-prompt.ts` is the 14th prebuild test,
15 assertions. **It did not clear the three zero-tier pages on DeepSeek alone**: `geddes` and
`jasper` still wrote a price into the FAQ. `geddes-landing` is live because the Opus fallback
cleared it. The prompt is right and worth keeping; DeepSeek is not strong enough to hold it.

**`jasper-street` was then attempted with the Opus fallback and still failed, $0.5330.** That
run is the useful one: it proves the preamble works and that what is left is a different
problem. See open item 1.

**`fix/zero-price-priorities` (pushed, not merged).** `differentPriorities` is not requested
when the input carries no price at any grain, its FAQ arm leaves the bank, and a new hard rule
`zero_price_priorities` rejects the section if it appears regardless. The presence check is
deliberately separate from the section count: a no-price T2 page that wrongly includes the
section lands on 7, which is a valid count, so the length check alone would report a position
mismatch rather than the real fault. The total word floor drops by that section's own minimum,
because holding a page to a count including a section it may not write is a retry it cannot
win. `scripts/test-zero-price-priorities.ts` is the 15th prebuild test, 19 assertions over
both suppression and rejection — a generator that stops asking is not a guarantee, since a
model can still volunteer the section. Build exit 0, zero `P2024`, 15/15 prebuild, battery
**`PASS · 9 checks · 443 pages · 73s`** on preview `miltonly-ivgrwnsvs`.

**Corrections to yesterday's report.** The "474 of 474 drifted" figure was a 12-vs-64-char
hash comparison bug; the real split is **13 identical, 461 changed**, and all 13 identical rows
carry zero gate flags. And `$0.009` per page is the DeepSeek rate, not a whole-corpus rate.

## Open items

1. **Two pages cannot be generated. `jasper-street`'s remaining blocker is the FAQ bank, not
   the sections.**

   **`jasper-street-milton`** — regenerated on DeepSeek under `fix/zero-price-priorities`,
   **$0.0169, failed, still draft**. The branch did its job: `aha` passed clean on attempt 1,
   and **`invented_cross_street` is gone from the run entirely** because the section it lived
   in is no longer requested. What remains, after both halves ran to attempt 5:

   - `invalid_json_shape: sections length = 3, expected 2` — DeepSeek keeps writing
     `differentPriorities` anyway. The validator rejects it correctly every time. This is the
     model failing to comply, not the rule failing to fire.
   - `faq_question_out_of_bank` on exactly *"If Jasper Street isn't the right fit, what
     similar streets should I look at?"* — the withdrawn arm, asked anyway, caught.
   - `zero_tier_price` and `numeric_ungrounded` in the FAQ: `$800,000`, `$700,000`,
     `low-$700s`.

   **That last group is the real next problem, and it is the same shape as this one.** The FAQ
   bank contains questions that *demand* a price — "What is the typical price on {Street}?",
   "What price range should I expect on {Street}?" — and a no-price street cannot answer
   either. The model is being asked a question whose only honest answer is "no price is
   published", and it reaches for a figure instead. **The fix is the same move applied one
   level down: withdraw the price-demanding questions from the bank on a no-price input, the
   way `fix/zero-price-priorities` withdraws the comparison question.** That is the next
   branch, and it is small.

   **`wood-close-milton`** — `getStreetStats()` returns `No stats available` and it fails in
   **one second**, before a prompt is ever built. No prompt, section or FAQ change can reach
   it; the stats gate is the thing to look at.

2. **Pre-2026-09-05 `costUsd` rows overstate Opus-assisted generations by 3x.** Not
   rewritable from what is stored. Treat historical cost claims as upper bounds.
3. **The DOM rule cannot read the neighbourhood's DOM.** `findUngroundedNumerics` compares a
   `days` token only against `input.aggregates.daysOnMarket`, never
   `neighbourhoodComparable.daysOnMarket`. 86 regenerated pages cite the neighbourhood figure
   correctly and would fire if the rule were widened past the market section. Fix the field
   before widening the scope.
4. **Grounding is still enforced on zero and thin only, dollars only.** Counts, percentages,
   days and quarter labels remain market-scoped on every tier.
5. **The two generation paths digest `inputHash` at different widths** (64 vs 12 chars), so
   `backfill-descriptions.ts`'s idempotency check can never match a row the cron wrote. The
   bulk path has been silently regenerating cron-written rows.
6. **`claude-haiku-4-5-20251001` carries a date suffix**; the current id is
   `claude-haiku-4-5`. It still resolves, so this is hygiene, not a fault. Production's
   `AI_PROVIDER_MARKET="haiku"` means the market half runs on it.
7. **Seven live clips carry `blur_verified: false`** (`chretien-street`, `clifford-point`,
   `frost-court`, `heaven-crescent`, `mulroney-heights`, `shade-lane`, `tasker-court`).
   Decision: verify or pull.
8. **Two orphaned clips** under slugs that are not real streets. GPS has been taken as far as
   it goes; someone has to watch the footage.
9. **`makeStreetDecision`'s minimum-data gate** — QUEUE item 7. Measured: 831 slugs carry DB2
   records, 419 are skipped as low-data, 103 of those already have a page and 316 have none.
   The brief's figure of 46 does not reproduce; the count is unfiltered for the registry.
10. **The name guard's blind spot**: it asserts a file *imports* the resolver, not that every
    consumer uses the resolved value. `test-input-snapshot.ts` is the pattern for fixing it.
11. `burnhamthorpe-road-milton` and `louis-st-laurent-avenue-milton` are entity-real with no
    data behind them.
12. `heroSearch.ts` resolves 5 slugs to physically different streets; needs an ambiguity guard.
13. Condo H1s still render abbreviations such as `Nadalin Hts`. QUEUE item 4.
14. Stored `HubContent.metaDescription` drifts from live on 21 of 22 hubs.
15. Rent pill disagrees with the market card on `melville-bonus-crescent-milton` and
    `mcdougall-crossing-milton`.
16. `video.miltonly.com` still unattached. `r2.dev` is rate-limited and not intended for
    production traffic at volume.
17. Two draft rows carry a clip: `diefenbaker-street-milton`, `murlock-heights-milton`.

## Notes for the next run

- **The battery takes the full 40-character SHA.** A short SHA fails the gate on a string
  compare and aborts before any content check.
- `scripts/regen-058-local.ts` runs the generator in-process with the primaries forced to
  DeepSeek. `REGEN_FALLBACK` opts into the Claude escalation, `REGEN_CAP_USD` caps the spend,
  `REGEN_ORDER` and `REGEN_LOG` point it at a set. It refuses to start if a primary is aimed
  at Claude.
- `scripts/audit-corpus-grounding.ts` rebuilds inputs and reports false positives on
  comparator figures. Prefer `inputJson` on any row that has one.
- Whether the fallback fires at all is stochastic — the same page escalated on one run and
  passed on DeepSeek at attempt 2 on the next. A single-page A/B proves less than it looks.

## Next expected task

A decision on merging `fix/zero-price-priorities`, item 1's FAQ-bank follow-on, item 7, or
item 8. Do not self-start any of them.
