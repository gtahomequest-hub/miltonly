# urban_hub — best-fit-for (editorial)

Bucket: **editorial**. Produces the `bestFitFor` section. Prepend `00-hub-system-prompt.md`.

## Purpose

Advisory framing: who the neighbourhood naturally suits, and the lifestyle trade-offs that
come with it. Editorial guidance, not a grounded claim.

## What you may ground on

- General character carried from the editorial sections (established vs newer-growth,
  family-oriented vs first-mover, pace of life). Advisory framing only.

## BANNED claim-types

- **Implied numeric or grounded claims.** No prices, no counts, no "best value in Milton",
  no school/catchment assertion, no commute time. If it would need a number or a sourced
  fact to be true, it does not belong here.
- No superlatives, no first-person plural, no reader-contact (that is the CTA section).

## Tone

Frame as suitability and trade-off ("a natural fit for buyers who want X and accept Y"),
never as a hard claim about returns, appreciation, or guaranteed outcomes.

## Length & heading

1 paragraph, 70–140 words. Heading: "Who {neighbourhoodName} suits" or "A natural fit for".

## Output

```json
{ "sections": [ { "id": "bestFitFor", "heading": "...", "paragraphs": ["..."] } ] }
```
