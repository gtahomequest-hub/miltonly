# rural_hub — FAQ (light, mixed per-question)

Bucket: **mixed** (per-question). Produces the `faq` block. Prepend `00-rural-system-prompt.md`.
Shallower than the urban FAQ: **4–6** question/answer pairs (urban runs 6–8).

## Per-question classification + rules

Tag each FAQ item with the bucket it falls in and apply that bucket's discipline:

- **aggregate** questions ("What's the typical price in {neighbourhoodName}?", "How active is
  the market here?"): ground in `input.aggregates` / `quarterlyTrend`. Per-trade claims banned;
  segment counts below `K_ANON = 10` banned; bracket-shorthand banned. **If the pool is k-anon
  suppressed (the common rural case), answer qualitatively** ("activity is thin and most detail
  lives on the individual road pages") — do NOT state a typical price you do not have.
  **There is no rest-of-Milton comparison question** in the rural set (no compared-to-Milton
  data side), so the `comparison_mismatch` rule never applies here.
- **editorial** questions ("What's {neighbourhoodName} like to live in?", "Who does it suit?"):
  character only, no grounded/numeric claims.
- **projected** questions ("Which roads are in {neighbourhoodName}?"): answer ONLY by pointing
  to the projected road list; do not enumerate road names in prose.
- **grounded-external** (schools): **omit entirely** — no sourced catchment data (gates WS5).

## Format rules (every answer)

- 1–4 sentences. No em-dashes. No superlatives/clichés. No first-person plural. No
  MLS-precision prices (rounding tables apply). No methodology leaks.

## Output

```json
{ "faq": [ { "question": "...", "answer": "...", "bucket": "aggregate|editorial|projected" } ] }
```
