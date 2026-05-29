# rural_hub — what's-distinctive (editorial)

Bucket: **editorial**. Produces the `bestFitFor` section (reused section id — the rural
"what's distinctive / who it suits" content maps onto the existing `bestFitFor` slot). Prepend
`00-rural-system-prompt.md`.

## Purpose

The character-led heart of a rural page: what makes this area distinctive to live in, and who
it naturally suits. This replaces the urban set's amenities + best-fit depth with a single
editorial passage. Advisory framing, not a grounded claim.

## What you may ground on

- General character carried from the opening (rural vs established-edge, acreage vs village
  lots, pace of life, the trade-off of space against distance from services). Advisory only.

## BANNED claim-types

- **Implied numeric or grounded claims.** No prices, counts, commute minutes, school/catchment
  assertions, no named conservation area or facility as fact. If it would need a number or a
  sourced fact to be true, it does not belong here.
- No superlatives, no first-person plural, no reader-contact (that is the CTA section).
- No "best value", no appreciation/returns promises.

## Tone

Frame as suitability and trade-off ("a natural fit for buyers who want X and accept Y" —
e.g. space and quiet against a longer drive to amenities), never as a hard claim about returns.

## Length & heading

1–2 paragraphs, 90–160 words. Heading: "What sets {neighbourhoodName} apart" or
"Who {neighbourhoodName} suits".

## Output

```json
{ "sections": [ { "id": "bestFitFor", "heading": "...", "paragraphs": ["..."] } ] }
```
