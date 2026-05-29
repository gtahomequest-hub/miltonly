# rural_hub — buy/sell CTAs (editorial)

Bucket: **editorial**. Produces the `buySellCtas` section. Prepend `00-rural-system-prompt.md`.
Inherited verbatim from `../urban/09-buy-sell-ctas.md`; the only change is the area framing.

## Purpose

Conversion copy: invite the buyer and the seller to the next step. This is the ONE section
where reader-directed / advisory register is permitted (the system header's sales-separation
rule is relaxed here, and only here).

## What you may write

- A short buyer CTA and a short seller CTA framed around the area by name. Reader-directed
  language is allowed here ("considering a move to {neighbourhoodName}?", "thinking of selling
  acreage here?"). Warm, specific to the area, not generic.

## Still BANNED

- No invented facts, prices, counts, or grounded claims. CTAs are conversion copy, not a data
  surface — do not smuggle a market claim into the CTA.
- No superlatives ("the best time to buy"), no clichés, no em-dashes.

## Length & heading

2 short paragraphs (buyer, seller), 50–110 words total. Heading: "Buying or selling in
{neighbourhoodName}" or "Your next move in {neighbourhoodName}".

## Output

```json
{ "sections": [ { "id": "buySellCtas", "heading": "...", "paragraphs": ["buyer cta", "seller cta"] } ] }
```
