# condo-building — buy/sell CTAs (editorial)

Bucket: **editorial**. Produces the `buySellCtas` section. Prepend `00-condo-system-prompt.md`.
Inherited from `../urban/09-buy-sell-ctas.md`; framing is the building.

## Purpose

Conversion copy: invite the buyer and the seller (or, for a lease-only building, the buyer and
the tenant) to the next step. The ONE section where reader-directed register is permitted.

## What you may write

- A short buyer CTA and a short seller CTA framed around the building by `displayName`.
- For a **lease-only** building, frame the second CTA around leasing / tenancy rather than
  selling ("looking to lease at {displayName}?"), since there is no sale market.
- Reader-directed language is allowed here ("considering a unit at {displayName}?"). Warm,
  specific, not generic.

## Still BANNED

- No invented facts, prices, counts, or grounded claims. CTAs are conversion copy, not a data
  surface — do not smuggle a market or fee claim into the CTA.
- No superlatives, no clichés, no em-dashes.

## Length & heading

2 short paragraphs, 50–110 words total. Heading: "Buying or selling at {displayName}" or
"Your next move at {displayName}".

## Output

```json
{ "sections": [ { "id": "buySellCtas", "heading": "...", "paragraphs": ["buyer cta", "seller/tenant cta"] } ] }
```
