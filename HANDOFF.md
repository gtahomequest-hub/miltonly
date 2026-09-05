# Handoff

_Last rewritten 2026-09-05._

## READ THIS FIRST

**The corpus grounding sweep is done and its residue is down to two pages.** 479 generations
audited, 154 regenerated, 152 published clean. `jasper-street-milton` and `wood-close-milton`
remain draft. Detail in `scratchpad/reports/058-corpus-audit.md`.

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

Three decisions waiting:

1. **`AI_PROVIDER_FALLBACK` — I did not change it, and it needs your call.** See below.
2. **Seven clips are live with `blur_verified: false`**, all from the 2026-09-03 run.
3. **Two clips remain orphaned** under slugs that are not real streets.

## Where things stand

| | |
|---|---|
| `main` | `e39c26a` |
| production | serving `e39c26a`, confirmed via `/api/build` |
| battery | **`PASS · 9 checks · 443 pages · 63s`**, exit 0, at the full SHA |
| local build | exit 0, zero `P2024`, **14/14 prebuild** |
| published street pages | **443** |
| draft / unpublished | 42 / 4 |
| generations carrying an input snapshot | 154 of 480 |
| QUEUE | 1, 2 done; 3 Gate A awaiting approval; 4, 5, 6, 7 not started |

## The fallback decision

Production carries `AI_PROVIDER_FALLBACK="opus"`. When a generation half exhausts its retry
budget, that half re-runs on Claude; unset, it fails closed.

**You asked me to switch it to Sonnet. I changed the code's Sonnet entry to `claude-sonnet-5`
— the old `claude-sonnet-4-6` was a previous generation — but I left the production variable
on `opus`, because the measurement contradicts the premise:**

- **Opus fallback: 13 of 13** published residue pages cleared, plus `geddes-landing`.
- **Sonnet 5 fallback: fired on all three halves of `geddes-landing` and failed** the page
  Opus cleared on the same input.

One trial each, so it is a signal and not a verdict. But the fallback exists precisely to
clear pages the primary cannot, and on the only escalating page tested head-to-head, Sonnet
did not. Switching production would quietly disable the mechanism for the pages that need it.
Sonnet 5 is cheaper per token ($2/$10 against Opus's corrected $5/$25) — if the cost was the
reason, note that the corrected Opus rate is already a third of what the table claimed.

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

**Corrections to yesterday's report.** The "474 of 474 drifted" figure was a 12-vs-64-char
hash comparison bug; the real split is **13 identical, 461 changed**, and all 13 identical rows
carry zero gate flags. And `$0.009` per page is the DeepSeek rate, not a whole-corpus rate.

## Open items

1. **Two pages cannot be generated.** `jasper-street-milton` (thin, no price at any grain;
   the FAQ keeps reaching for a figure) and `wood-close-milton` (`getStreetStats()` returns
   `No stats available` — it fails in one second, before the prompt is ever built, so no
   prompt change can reach it). `jasper` would likely clear on the Opus fallback, as
   `geddes-landing` did. `wood-close` needs the stats gate looked at, not the generator.
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

The fallback decision above, item 1, item 7, or item 8. Do not self-start any of them.
