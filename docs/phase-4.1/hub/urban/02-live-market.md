# urban_hub — live-market (aggregate)

Bucket: **aggregate**. Produces the `liveMarket` section. Prepend `00-hub-system-prompt.md`.

## Purpose

Neighbourhood-level market read: how the neighbourhood trades, grounded ONLY in the
neighbourhood sale-side aggregates and the quarterly trend. This is the W2 `market` section
re-pointed from street tier to neighbourhood tier.

## What you may ground on

- `input.aggregates`: `typicalPrice`, `priceRange`, `daysOnMarket`, `salesCount`,
  `leasesCount`, `kAnonLevel`.
- `input.quarterlyTrend[]`: `{ quarter, typical, count }`, already chronological
  (sortKey = year*4 + quarter) and filtered to multi-trade quarters (count ≥ 2).
- `input.byType[]`: per-type counts + typicalPrice/priceRange, each with its own `kFlag`.

## BANNED claim-types

- **Per-trade claims.** The input exposes NO per-trade sale rows — only aggregates. Phrases
  like "a three-bedroom detached changed hands around $X", "one home sold for $Y in Q3",
  "a recent sale closed at $Z" are fabrications regardless of how close the number is to an
  aggregate (this is the W2 Class B rule re-pointed at hub tier). Use aggregate phrasing
  only: "the typical home traded around $X", "Q3 2025 trades clustered near $Y".
- **Segment claims below `K_ANON = 10`.** Do not cite a by-type or by-quarter figure whose
  count is under 10. Check `byType[t].kFlag` / `quarterlyTrend[q].count` before citing.
- **Bracket-shorthand prices** (inherited verbatim from `02b`): "high-$770s", "mid-$920s",
  "the $800s", "low-$1.1Ms" are FORBIDDEN. Always full numbers: "around $810,000".
- **Free-floating direction verbs** (inherited verbatim from `02b`, Class C): every
  direction verb (firmed, softened, rose, eased, climbed, dipped, held, steadied) MUST name
  an explicit "from {prior quarter or value} to {target quarter or value}" transition. If
  you cannot name the transition, use neutral language ("the trend has been uneven across
  quarters"). A free-standing verb triggers `temporal_pairing` on the wrong quarter.

## Mandatory quarterly restatement (before writing)

Internally restate each `quarterlyTrend` entry as `quarter → rounded typical → UP/DOWN/FLAT
vs prior`. Only after that may you write the trend prose. Every quarter you name must be in
the input; every price paired with a quarter must match that quarter's typical within
rounding tolerance; every direction verb must match the actual q-over-q delta.

## k-anon framing

- `kAnonLevel === "full"`: 2 paragraphs, 180–260 words. Typical price + range + pace + trend.
- `kAnonLevel === "thin"`: 1 paragraph; acknowledge the neighbourhood trades thinly and that
  street-level detail lives on the street pages.
- `kAnonLevel === "zero"`: 1 short paragraph; newer growth, limited resale history.

## Heading

Use exactly one of: "The market in {neighbourhoodName}" or "How {neighbourhoodName} trades".

## Output

```json
{ "sections": [ { "id": "liveMarket", "heading": "...", "paragraphs": ["..."] } ] }
```
