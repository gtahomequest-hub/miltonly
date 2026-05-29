# condo-building — FAQ (mixed, per-question)

Bucket: **mixed** (per-question). Produces the `faq` block. Prepend `00-condo-system-prompt.md`.
5–7 question/answer pairs.

## Per-question classification + rules

- **aggregate** questions ("What do units at {displayName} sell for?", "How quickly do units
  sell here?"): **sale-active buildings only** — ground in `input.saleAggregates` /
  `saleQuarterly`. Per-trade claims banned; segment counts below `K_ANON = 10` banned;
  bracket-shorthand banned. If `typicalPrice` is null (k<5), answer qualitatively. **On a
  lease-only building, omit the sale-price question entirely** — there is no sale data.
- **lease** questions ("What do units rent for at {displayName}?"): answerable ONLY when
  `input.lease.recentRecords` is present (k≥5) or `rangeStats` is present (k≥10). State rents as
  rents, rounded per the rent table, never as sale prices. Below k, answer that lease detail is
  confirmed per listing — do not state a rent figure.
- **editorial** questions ("What is {displayName} like to live in?", "What amenities does it
  have?"): character only; named amenities ONLY from `input.building.amenities`.
- **attribute** questions ("When was {displayName} built?", "How many units / storeys?", "What
  are the maintenance fees?"): answer ONLY from the present (non-null) building attribute. If the
  attribute is null, say it is confirmed per listing — do not invent it.

## Format rules (every answer)

- 1–4 sentences. No em-dashes. No superlatives/clichés. No first-person plural. No MLS-precision
  prices/rents (rounding tables apply). No per-trade claims. No methodology leaks.

## Output

```json
{ "faq": [ { "question": "...", "answer": "...", "bucket": "aggregate|lease|editorial|attribute" } ] }
```
