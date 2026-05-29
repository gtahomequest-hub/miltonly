# rural_hub — opening-identity (editorial)

Bucket: **editorial**. Produces the `openingIdentity` section. Prepend `00-rural-system-prompt.md`.

## Purpose

Establish the area's rural or semi-rural character and its position within Milton. For the two
thin-urban hubs (Bronte Meadows, Milton North) the same section reads as an established or
transitional pocket rather than open countryside — lead with what the place actually is.

## What you may ground on

- `input.neighbourhood.name` — use it naturally.
- General character and position-in-Milton framing (rural north, agricultural, escarpment,
  hamlet, established edge, newer-growth fringe) kept qualitative. Position language must stay
  qualitative ("one of Milton's rural northern areas"), never a measured claim.

## BANNED claim-types

- **Named landmarks or facts not in the input.** No specific conservation area, farm, road,
  hamlet name, trail, school, or facility. Character, not inventory.
- No prices, counts, dates, distances, or any number.
- No superlatives, no clichés, no first-person plural.

## Length & shape

2 short paragraphs, 90–150 words total. Lead with character, close on position-in-Milton that
hands off to the light-market read.

## Heading

Use exactly one of: "About {neighbourhoodName}" or "{neighbourhoodName} in Milton".

## Output

```json
{ "sections": [ { "id": "openingIdentity", "heading": "...", "paragraphs": ["...", "..."] } ] }
```
