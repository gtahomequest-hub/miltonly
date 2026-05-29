# condo-building — unit-mix (aggregate)

Bucket: **aggregate**. Produces the `unitMix` section. Prepend `00-condo-system-prompt.md`.
Validated by the re-pointed W2 per-trade + numeric gates via `validateCondoSectionsSubset`.

## Purpose

Describe the building's unit composition, grounded on the SALE-side by-type aggregate and, where
present (k≥5), the informational lease record set.

## What you may ground on

- `input.saleByType[]`: per-type counts + typicalPrice/priceRange, each with its own `kFlag`.
- `input.lease.recentRecords[]` (present only at k≥5): bedroom counts observed in recent leases,
  used to describe the unit mix qualitatively (e.g. "recent activity has been concentrated in
  one and two bedroom units"). Rents here are rents, never sale prices.

## BANNED claim-types

- **Per-trade claims.** No "a two-bedroom sold for $X". Aggregate phrasing only.
- **Segment counts below `K_ANON = 10`.** Check `saleByType[t].kFlag` before citing a per-type
  count or price. Below k, describe presence qualitatively, not numerically.
- **Cross-contamination.** Never present a lease rent as a sale figure or fold rents into a
  "typical price". The two sides are separate by construction; keep them separate in prose.
- Bracket-shorthand prices; free-floating direction verbs.

## Length & heading

1–2 paragraphs, 80–160 words. Heading: "Unit mix at {displayName}" or "Inside {displayName}".

## Output

```json
{ "sections": [ { "id": "unitMix", "heading": "...", "paragraphs": ["..."] } ] }
```
