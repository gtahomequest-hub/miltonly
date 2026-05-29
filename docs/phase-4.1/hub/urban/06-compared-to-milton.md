# urban_hub — compared-to-milton (aggregate, 2-sided)

Bucket: **aggregate, 2-sided**. Produces the `comparedToMilton` section. Prepend
`00-hub-system-prompt.md`. **This is the only section gated by the net-new
`comparison_mismatch` validator rule (DEC-WS4-3).**

## Purpose

Place the neighbourhood against the wider Milton market: does it trade above, below, or in
line with the rest of Milton, and does it move faster or slower. Grounded on BOTH sides.

## What you may ground on

- Neighbourhood side: `input.aggregates.typicalPrice`, `priceRange`, `daysOnMarket`.
- Milton-wide side: `milton.aggregates.typicalPrice`, `priceRange`, `daysOnMarket`
  (from `MiltonWideContext`, computed once per run).

## The two-sided rule (hard)

**Every comparison verb requires BOTH sides present in the input.** A comparison verb is any
of: above / below / in line with / on par with / higher than / lower than / richer than /
cheaper than / outpaces / trails / sells faster / sells slower, when paired with a Milton
anchor ("the rest of Milton", "the wider Milton market", "the Milton average", "across
Milton", "city-wide").

- If the neighbourhood side OR the Milton side for the metric you are comparing is `null`
  (k-anon suppressed), you may NOT make that comparison. The validator fires
  `comparison_mismatch` (`side_ungrounded`).
- The asserted direction MUST match the actual aggregate delta. "Above the rest of Milton"
  requires `nbhd.typicalPrice > milton.typicalPrice` (beyond max($25K, 5%)). "Sells faster"
  requires `nbhd.daysOnMarket < milton.daysOnMarket`. A contradicting direction fires
  `comparison_mismatch` (`direction_mismatch`).
- "In line with" requires the delta to be within tolerance (flat) on price or pace.

## How to write it safely

1. Restate internally: nbhd typical {X} vs Milton typical {Y} → nbhd is ABOVE/BELOW/IN-LINE;
   nbhd DOM {A} vs Milton DOM {B} → FASTER/SLOWER/SAME.
2. Make ONLY the comparison the restatement supports. If a side is null, describe the
   neighbourhood's own figure without a Milton comparison verb.

## BANNED claim-types

- Per-trade claims (input is aggregate-only) — same as live-market.
- A comparison verb where either side is ungrounded, or whose direction contradicts the delta.
- Implied differentials you cannot ground ("a $200K premium to the city" unless both sides
  are present and the delta supports it after rounding).

## Length & heading

1 paragraph, 90–170 words. Heading: "{neighbourhoodName} against the rest of Milton" or
"How {neighbourhoodName} compares to Milton".

## Output

```json
{ "sections": [ { "id": "comparedToMilton", "heading": "...", "paragraphs": ["..."] } ] }
```
