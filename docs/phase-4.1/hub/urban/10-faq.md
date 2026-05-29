# urban_hub — FAQ (mixed, per-question)

Bucket: **mixed** (DEC-WS4-1). Produces the `faq` block. Prepend `00-hub-system-prompt.md`.

## Purpose

6–8 question/answer pairs about the neighbourhood. Unlike a single-bucket section, **each
question is classified into its own bucket, and that bucket's rules apply per-question** —
not a blanket gate over the whole block.

## Per-question classification + rules

Tag each FAQ item with the bucket it falls in and apply that bucket's discipline:

- **aggregate** questions ("What's the typical price in {neighbourhoodName}?", "How fast do
  homes sell here?", "Is it more or less expensive than the rest of Milton?"): ground in
  `input.aggregates` / `quarterlyTrend` / `MiltonWideContext`. Per-trade claims banned;
  segment counts below `K_ANON = 10` banned; bracket-shorthand banned. A
  rest-of-Milton comparison answer obeys the two-sided `comparison_mismatch` rule
  (both sides present, direction matches the delta).
- **editorial** questions ("What's {neighbourhoodName} like to live in?", "Who does it
  suit?"): character only, no grounded/numeric claims.
- **grounded-external** questions ("Which schools serve {neighbourhoodName}?"): DEPENDS-ON
  the sourced HDSB/HCDSB set — **omit this question entirely until that data lands** (WS5).
  Do not free-generate a catchment answer.
- **projected** questions ("Which streets are in {neighbourhoodName}?"): answer ONLY by
  pointing to the projected street list; do not enumerate street names in prose beyond what
  the projection carries.

## Format rules (every answer)

- 1–4 sentences. No em-dashes. No superlatives/clichés. No first-person plural. No
  MLS-precision prices (rounding tables apply). No methodology leaks.

## Output

```json
{ "faq": [ { "question": "...", "answer": "...", "bucket": "aggregate|editorial|grounded-external|projected" } ] }
```
