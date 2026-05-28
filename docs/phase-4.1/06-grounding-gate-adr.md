# ADR: Workstream 2 — Grounding Gate (DEC-GROUNDING-GATE)

**Date:** 2026-05-28
**Status:** Locked
**Scope:** Phase 4.1 v2 market-section generation pipeline.
**Authors:** Brain Claude (architecture), Builder Claude (implementation).

## Context

The Lane A diagnostic on `centennial-forest-drive-milton` (2026-05-28; full evidence at `experiment-output/centennial-lane-a-diag-1779960429929/`) proved that the failures Aamir had been seeing in the Phase 4.1 market section were NOT model hallucination as previously believed. They split into three classes:

- **Class A (validator false-rejections, tier-shorthand).** Model emitted "high-$770s" / "mid-$920s" — natural real estate prose pointing at input quarterly typicals of `$776,667` / `$928,333`. The validator's literal-extractor claimed the bare `$770` / `$920` span before the tier-aware regex could grab the full token, then compared `770` against `776,667` and false-fired `numeric_ungrounded`.
- **Class B (real fabrication, missed by validator).** Model emitted "A three-bedroom condo unit changed hands around $775,000 in Q4 2024" — a singular per-trade claim. Input exposes zero per-trade sale records; only aggregates (typicalPrice, byType, quarterlyTrend) exist. The numeric proximity check passed because $775K is within tolerance of the Q4'24 quarterly typical of $776,667. The validator missed the structural problem: the CLAIM TYPE (single transaction, specific date, specific bed count) was not supported by the DATA SHAPE.
- **Class C (validator false-rejections, verb-binding).** Chained prose like "softened to $776K in Q4 2024, then firmed to $928K in Q2 2025" — "firmed" semantically describes the Q4'24 → Q2'25 transition (which is up). The validator's `findTemporalPairings` bound "firmed" to the nearest preceding quarter (Q4 2024) and compared the wrong transition (Q3 2024 → Q4 2024 = down), false-firing `direction_mismatch`.

The validator was running on 5-attempt retries against false rejections and eventually exhausting the budget — burning ~$0.018 per centennial-class street and never publishing.

## Decision

### 1. Gate behaviour — retry-then-fail-closed

On any validation failure: retry with the tightened prompt up to the existing 5-attempt budget. If retries exhaust, the street **does not publish**.

Fail-closed mechanism (no new tables):

- `StreetGeneration.status='failed'` — the queue signal (existing enum value).
- `StreetGenerationReview` — the queue payload (existing table, one row per `streetSlug`, JSON `violations` + `lastAttemptAt` + `lastInputHash`).
- `StreetContent` is **not touched** on fail. Any prior published row is preserved exactly; brand-new streets that fail have no `StreetContent` row, and the page renderer's `getOrGenerateStreetContent` fallback handles render-time.

Auto-publish is gated on this invariant: a published `StreetContent` row exists **only** for streets whose most recent generation passed all validators. There is no path that writes draft prose to `StreetContent.description` on a failed run.

### 2. Class B — structural grounding principle

**Validation gates on CLAIM-TYPE vs DATA-EXISTENCE, not number proximity.**

`findPerTradeFabrications` (src/lib/ai/validateStreetGeneration.ts) detects singular-per-trade language ("a/an/one" + property-or-transaction-noun + transaction-verb + nearby price) and checks the corresponding per-trade record set in `StreetGeneratorInput`. If the prose makes a per-trade claim and the input has no per-trade record set for that side, the rule fires regardless of how close the cited number is to an aggregate.

Coverage:
- **Sale-side claims:** input never exposes per-trade sales → always fire.
- **Lease-side claims:** fire when `input.leaseActivity.recentRecords` is empty or absent (Part 4 populates this when k ≥ 5).

Aggregate phrasing ("the typical condo sold around $X", "Q4 2024 trades clustered around $Y", "comparable condos in the period sold around $Z") is suppressed via a negative-lookahead inside the determiner-adjective span.

New `ValidatorRule` value: `"per_trade_fabrication"`. Wired into both `validateStreetGeneration` and `validateSectionsSubset` for sections `market` and `neighbourhoodComparable`.

### 3. Class A + C — defense-in-depth (prompt + validator)

**Prompt constraints** (docs/phase-4.1/02b-market-prompt.md):

- Bracket-shorthand price expressions banned. Required full-number forms: "around $776,000," not "the high-$770s." Tier-shorthand prose forms were removed from the rounding guidance.
- Direction verbs require an explicit "from {X} to {Y}" transition. Chained free-floating direction verbs are forbidden; if a transition cannot be named explicitly, use non-directional prose ("trend has been uneven across quarters").

**Validator hardening** (src/lib/ai/validateStreetGeneration.ts):

- `NUMERIC_PATTERNS` reordered so the tier-aware regex `(high|mid|low)-\$N(s)` wins its span before the bare `\$N` regex. `parseDollarTokenForGrounding` already scales tier-shorthand to thousands correctly; the bug was at extraction time, not parse time.
- `findTemporalPairings` direction-verb binding widened: collect ALL quarter mentions in the verb's ±50-char window; accept the verb if ANY candidate's q-over-q transition supports the stated direction (or is flat). Only fire `direction_mismatch` when no candidate supports the direction. The error message names the failing candidate.
- `collectInputPrices` gap: added `input.neighbourhoodComparable.typicalSoldPrice` and `priceRange` (low/high) to the input price list. Prior omission caused `$600K`-class false rejections when the model wrote rounded neighbourhood prices.
- `"compressed"` removed from `downPattern` — it is a range-narrowing verb ("the range compressed"), not a price-direction verb. Inclusion caused false-positives.

### 4. Input fixes (Step 5)

- `quarterlyTrend` is now sorted chronologically via a `sortKey = year * 4 + quarter` numeric key, replacing `localeCompare` on the display label. Previously the model received `Q1 '26, Q2 '25, Q3 '24, Q4 '24, Q4 '25` (string-sorted) and had to re-sort mentally.
- Sales-side aggregates (`salesCount`, `typicalPrice`, `priceRange`, `daysOnMarket`) now derive from the LIVE `sold.sold_records` For-Sale aggregate query. Previously `salesCount` and `typicalPrice` came from `analytics.street_sold_stats` (which can be stale relative to live), while `priceRange` came from the live query. Centennial's centennial-forest-drive observed analytics count = 10 but live count = 9 — the threshold mismatch caused `salesCount` to advertise `k ≥ 10` while `priceRange` was suppressed. Sourcing all sales-side aggregates from the same query guarantees mutual consistency.
- Note: this resolves the inconsistency but does NOT populate centennial's priceRange. The true live count is 9 < `K_ANON_RANGE = 10`, so the range correctly suppresses per the k-anon contract.

## Consequences

**Operationally:**

- Streets that fail will accumulate in `StreetGenerationReview`. Admin tooling can list "ready for human review" by querying `StreetGenerationReview` rows whose `streetSlug` has `StreetGeneration.status='failed'`.
- The retry-then-fail-closed flow is safe to run on auto-publish. Worst case: a street that the model and validator together cannot agree on will sit in `StreetGenerationReview` with violations recorded, and the prior published `StreetContent` (if any) continues to render at the page route.
- No new database tables, no new status enum values, no new admin UI is required. The existing two-table failure mechanism is the queue.

**Code structure:**

- `findPerTradeFabrications` is exported for unit testing; the in-tree fixtures at `scripts/test-class-b-grounding.ts` cover the fabrication-fires and aggregate-passes cases.
- `validateSectionsSubset` runs the per-trade rule on market AND neighbourhoodComparable sections so the per-half retry loop catches fabrications without falling through to combined-level fail.
- `PHASE41_FORCE_FAIL_CLOSED` is a test-scaffold env flag in `generateStreet.ts` that short-circuits the LLM call and synthesizes a `validatorPassed=false` result. Off by default. Used by `scripts/test-fail-closed.ts` for the fail-closed verification.

**Documentation invariants:**

- This ADR is the source of truth for the grounding-gate decision and the claim-type-vs-data-existence principle. Future patches that touch the grounding rule, the fail-closed orchestration, or the prompt's price/direction constraints should reference DEC-GROUNDING-GATE in their commit message and update this document.

## Verification (all artifacts persisted)

- **Step 1 fixtures:** `scripts/test-class-b-grounding.ts` — fabrication-fires + aggregate-passes both PASS.
- **Step 2 fail-closed:** `scripts/test-fail-closed.ts` — pre/post `StreetContent` rowHash match (`7ed80874217e5627`); `StreetGeneration.status='failed'`; `StreetGenerationReview` has the queue violation.
- **Step 3 prompt:** centennial regenerated under `docs/phase-4.1/02b-market-prompt.md` produces zero bracket-shorthand; output at `experiment-output/centennial-lane-a-diag-1779962744781/`.
- **Step 4 hardening:** `scripts/test-class-a-c-hardening.ts` — original raw output now yields 1 violation (Class B per-trade, real fabrication) instead of 4. Step-3 raw output yields 0 violations.
- **Step 5 input:** `scripts/test-step5-input-fixes.ts` — `quarterlyTrend` chronological; sales-side aggregates live-reconciled.

## What the model still has to do right

The validator catches structural problems and most numeric ungrounding. It cannot catch:

- Genuinely-fabricated qualitative claims that are not numeric and not pattern-detectable (e.g., a made-up neighbourhood landmark with no number attached).
- Coherence errors where multiple grounded numbers are recombined into a misleading narrative (e.g., correctly citing two real input numbers but pairing them with a false causal connector).

These remain prompt-engineering and editorial concerns. They are out of scope for this ADR.
