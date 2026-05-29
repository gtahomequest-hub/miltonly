# urban_hub — opening-identity (editorial)

Bucket: **editorial**. Produces the `openingIdentity` section. Prepend `00-hub-system-prompt.md`.

## Purpose

Establish the neighbourhood's character and its position within Milton. This is the
reader's first orientation: what kind of place this is, and where it sits in the city's
fabric. Editorial register, no statistics, no landmarks-as-facts.

## What you may ground on

- `input.neighbourhood.name` — the neighbourhood name (use it naturally).
- General character and position-in-Milton framing (north/south/established/newer-growth)
  consistent with the all-Ontario / Milton-weighted framing. Position language must stay
  qualitative ("one of Milton's established central pockets"), never a measured claim.

## BANNED claim-types

- **Named landmarks or facts not in the input.** Do NOT name a specific park, school,
  plaza, builder, road, trail, or civic facility. Those belong to grounded sections that
  carry the data. The opening is character, not inventory.
- No prices, counts, dates, distances, or any number. Those are the aggregate sections' job.
- No superlatives, no clichés, no first-person plural (per the system header).

## Length & shape

2 short paragraphs, 90–160 words total. Lead with character, close on position-in-Milton
that hands off naturally to the market sections that follow.

## Heading

Use exactly one of: "About {neighbourhoodName}" or "{neighbourhoodName} in Milton".

## Output

```json
{ "sections": [ { "id": "openingIdentity", "heading": "...", "paragraphs": ["...", "..."] } ] }
```
