# condo-building — building-market (aggregate, SALE-ACTIVE ONLY)

Bucket: **aggregate**. Produces the `condoMarket` section. Prepend `00-condo-system-prompt.md`.
Validated by the re-pointed W2 per-trade + numeric + temporal gates via
`validateCondoSectionsSubset`.

> **Emit this section ONLY when `input.saleActive === true`.** On a lease-only building
> (`input.leaseOnly === true`, `saleCount12mo === 0`) there is NO sale-side data to ground a
> market section — DO NOT emit it. The validator fires the hard `condo_lease_only_market` rule
> if a `condoMarket` section appears on a lease-only building. A lease-only building's "market"
> story is its lease availability, told in the unit-mix / fees framing, never here.

## What you may ground on (sale-active only)

- `input.saleAggregates`: `typicalPrice`, `priceRange`, `daysOnMarket`, `salesCount`,
  `kAnonLevel` — all derived from For Sale trades ONLY.
- `input.saleQuarterly[]`: `{ quarter, typical, count }`, chronological, multi-trade only.
- `input.saleByType[]`: per-type sale figures with `kFlag`.

## BANNED claim-types

- **Per-trade claims** — no "a unit sold for $X". Aggregate phrasing only.
- **Lease cross-contamination** — never fold a rent into the typical sale price; never label a
  rent as a sale value. This section is sale-side only.
- **Segment counts below `K_ANON = 10`**; **bracket-shorthand prices**; **free-floating
  direction verbs** (need explicit from-X-to-Y transition).
- When `saleAggregates.typicalPrice` is null (k<5 — the common building case), do NOT state a
  typical price. Describe sale activity qualitatively ("the building has seen limited recorded
  resale activity in the trailing year") with no figure.

## k-anon framing

- `kAnonLevel === "full"`: 1–2 paragraphs, typical + range + pace + trend.
- `kAnonLevel === "thin"`: 1 paragraph; acknowledge limited sale signal, no typical price.
- `kAnonLevel === "zero"`: should not occur for a sale-active building; if it does, treat as thin.

## Mandatory quarterly restatement (when citing the trend)

Internally restate each `saleQuarterly` entry as `quarter → rounded typical → UP/DOWN/FLAT vs
prior` before writing. Every quarter named must be in the input; every paired price must match
within rounding tolerance; every direction verb must match the actual delta.

## Length & heading

1–2 paragraphs, 100–200 words. Heading: "The market at {displayName}" or "How {displayName}
trades".

## Output

```json
{ "sections": [ { "id": "condoMarket", "heading": "...", "paragraphs": ["..."] } ] }
```
