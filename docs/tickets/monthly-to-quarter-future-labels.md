# Ticket: monthlyToQuarterly emits future-dated / incomplete quarters

## Problem
Batch-001 external audit (2026-07-19, finding B13 / standards 5.4+5.5):
pages generated 2026-07-18 narrated transactions and completed quarters
that cannot exist yet:
- "a three-bedroom townhouse rented around $3,156 per month in August
  2026" (asleton)
- "climbing to $984,500 in Q3 2026" (asleton — presented as a
  completed trend point 18 days into the quarter, and Q2 2026 was
  skipped entirely)
- "before firming to approximately $1.26M in Q3 2026" (etheridge)

Two contributing layers:
1. `monthlyToQuarterly` (src/lib/street-data.ts:815) buckets whatever
   monthly rows exist, including the CURRENT incomplete quarter, and
   labels it like a finished one. The generator input then presents
   Q3 2026 as a trend point and the model narrates it as history.
2. DB2 carries future-dated rows (an August 2026 lease record existing
   on July 18). The 2026-07-03 fix (fc42808) excluded future-dated
   closings from 12-month rolling COUNTS but not from the monthly-stats
   compute or the lease recentRecords path, so future soldMonth values
   still reach the prompt.

## Scope
- monthlyToQuarterly: drop (or explicitly label "quarter to date") any
  bucket whose quarter has not ENDED as of the compute date; decide
  label policy with the prompt's temporal rules in mind.
- Extend the future-dating exclusion to compute-sold-stats monthly
  rows and the per-row lease record query in buildGeneratorInput
  (`sold_date <= NOW()` guard).
- Validator already normalizes quarter labels; add a test that a
  current-quarter bucket never reaches quarterlyTrend input.

## Estimated effort
1-2 h including tests; touches street-data.ts, sold-stats compute,
buildGeneratorInput.

## Priority
Medium-high: it fabricates history on every street with current-quarter
trades and re-fires each new quarter. Should land before the full
~355-street roll so the regen wave doesn't bake current-quarter labels
into every page.

## RESOLVED 2026-07-20 (commit 224bb91)
- All 12-month sold_records windows in buildGeneratorInput bounded with
  `sold_date <= NOW()` (covers lease recentRecords/byBed + sale
  aggregates - the August 2026 lease class).
- quarterlyTrend filtered through `dropUnfinishedQuarters` (pure helper,
  exported, injectable `now`); render-side charts intentionally untouched.
- New hard validator rule `future_period_claim` (all sections + FAQ):
  un-ended quarter labels and un-begun month-years fail closed.
- compute-sold-stats monthly rows NOT changed (input-seam filter makes it
  moot for generation; charts may legitimately show quarter-to-date).
