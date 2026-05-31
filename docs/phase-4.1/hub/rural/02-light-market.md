# rural_hub — light-market (aggregate)

Bucket: **aggregate**. Produces the `liveMarket` section. Prepend `00-rural-system-prompt.md`.
This is `../urban/02-live-market.md` re-pointed at a thin rural pool — shallower, and frequently
mostly suppressed. Validated by the SAME re-pointed W2 gates via `validateHubSectionsSubset`
(per-trade + numeric + temporal). There is no compared-to-Milton follow-on.

## What you may ground on

- `input.aggregates`: `typicalPrice`, `priceRange`, `daysOnMarket`, `salesCount`,
  `leasesCount`, `kAnonLevel`.
- `input.quarterlyTrend[]`: `{ quarter, typical, count }`, chronological, multi-trade only
  (count ≥ 2 already filtered). **Disclosure of any quarterly figure is full-k only** — in a
  sub-k range pool (`priceRange === null`) the trend is context for you, never output (see
  "Sub-k RANGE pools — price silence" below).
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
  road pages. Do NOT state a typical price or range, NOR any quarterly median or spread (see
  "Sub-k RANGE pools — price silence" below). Do NOT cite a count under 10.
- `kAnonLevel === "full"` (rare for rural): up to 2 short paragraphs, typical + range + pace +
  trend, same discipline as urban. Still shallower than an urban hub — no segment deep-dive.
  **Caveat:** "full" only means salesCount ≥ 5. If `priceRange === null` (salesCount 5–9), the
  pool is still sub-k for range — price silence applies (see below); do not cite the range or
  the quarterly medians.
- `kAnonLevel === "zero"` (no trades): ONE sentence noting limited recorded resale activity in
  the trailing window, with no figures.

## Sub-k RANGE pools — price silence (moffat posture) — OVERRIDES the trend rules below

Applies whenever `input.aggregates.priceRange === null` (the sales pool is below
`K_ANON_RANGE = 10`, i.e. `salesCount < 10`), **independent of `kAnonLevel`**. State NO price
figure of any kind: no typical price, no price range, and **no quarterly-median figure or spread
— not even individually grounded quarterly typicals.** Do not write "quarterly medians ranged
from $X to $Y", a "$X–$Y" band, or a lone quarterly "$X". Decline in the moffat manner ("a
typical price cannot be stated with confidence; the pool trades too thinly") and point to the
individual road/street pages for any price detail. `quarterlyTrend` is context for YOU here, not
for disclosure. This is uniform across all thin rural hubs.

## Mandatory quarterly restatement (full-k pools only — when you cite the trend at all)

(Sub-k range pools disclose no trend at all — see "Sub-k RANGE pools — price silence" above.)

Internally restate each `quarterlyTrend` entry as `quarter → rounded typical → UP/DOWN/FLAT vs
prior` before writing. Every quarter named must be in the input; every paired price must match
within rounding tolerance; every direction verb must match the actual q-over-q delta.

## Heading

Use exactly one of: "The market in {neighbourhoodName}" or "How {neighbourhoodName} trades".

## Output

```json
{ "sections": [ { "id": "liveMarket", "heading": "...", "paragraphs": ["..."] } ] }
```
