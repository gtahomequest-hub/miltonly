# rural_hub — light-market (aggregate)

Bucket: **aggregate**. Produces the `liveMarket` section. Prepend `00-rural-system-prompt.md`.
This is `../urban/02-live-market.md` re-pointed at a thin rural pool — shallower, and frequently
mostly suppressed. Validated by the SAME re-pointed W2 gates via `validateHubSectionsSubset`
(per-trade + numeric + temporal). There is no compared-to-Milton follow-on.

## What you may ground on

- `input.aggregates`: `typicalPrice`, `priceRange`, `daysOnMarket`, `salesCount`,
  `leasesCount`, `kAnonLevel`.
- `input.quarterlyTrend[]`: `{ quarter, typical, count }`, chronological, multi-trade only
  (count ≥ 2 already filtered).
- `input.byType[]`: per-type counts + typicalPrice/priceRange, each with its own `kFlag`.

## BANNED claim-types (inherited verbatim from urban live-market)

- **Per-trade claims.** No per-trade sale rows exist in the input. "A detached home changed
  hands around $X" is fabrication regardless of proximity. Aggregate phrasing only.
- **Segment claims below `K_ANON = 10`.** Check `byType[t].kFlag` / `quarterlyTrend[q].count`.
- **Bracket-shorthand prices** — forbidden; always full rounded numbers.
- **Free-floating direction verbs** — every direction verb needs an explicit
  "from {prior} to {target}" transition (Class C / `temporal_pairing`).

## k-anon framing (rural pools are thin — this is the common case)

- `kAnonLevel === "thin"` (typical suppressed, salesCount < 5): **the common rural case.** ONE
  short paragraph: acknowledge the area trades thinly and that street-level detail lives on the
  road pages. Do NOT state a typical price or range. Do NOT cite a count under 10.
- `kAnonLevel === "full"` (rare for rural): up to 2 short paragraphs, typical + range + pace +
  trend, same discipline as urban. Still shallower than an urban hub — no segment deep-dive.
- `kAnonLevel === "zero"` (no trades): ONE sentence noting limited recorded resale activity in
  the trailing window, with no figures.

## Mandatory quarterly restatement (when you cite the trend at all)

Internally restate each `quarterlyTrend` entry as `quarter → rounded typical → UP/DOWN/FLAT vs
prior` before writing. Every quarter named must be in the input; every paired price must match
within rounding tolerance; every direction verb must match the actual q-over-q delta.

## Heading

Use exactly one of: "The market in {neighbourhoodName}" or "How {neighbourhoodName} trades".

## Output

```json
{ "sections": [ { "id": "liveMarket", "heading": "...", "paragraphs": ["..."] } ] }
```
