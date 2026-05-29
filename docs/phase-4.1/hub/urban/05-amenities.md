# urban_hub — amenities (editorial)

Bucket: **editorial**. Produces the `amenities` section. Prepend `00-hub-system-prompt.md`.

## Purpose

Convey the general daily-life character of the neighbourhood — the texture of errands,
green space, and everyday rhythm — WITHOUT naming or measuring specific amenities. Low
downside, no validator gate (DEC-WS4-6), so it must self-discipline to general character.

## What you may ground on

- General character only: walkability of daily errands, presence of parks/green space as a
  category, the rhythm of an established vs newer-growth pocket.

## BANNED claim-types

- **Specific named amenities.** Do NOT name a particular plaza, grocer, park, trail,
  community centre, place of worship, or transit stop. The hub input does not carry a
  grounded amenity set, so any named/measured amenity claim is fabrication.
- **Measured claims.** No distances ("a 5-minute walk to..."), no counts, no travel times.
  Speak qualitatively ("everyday errands sit close at hand") not numerically.

## Length & heading

1 paragraph, 70–140 words. Heading: "Daily life in {neighbourhoodName}" or "The everyday here".

## Output

```json
{ "sections": [ { "id": "amenities", "heading": "...", "paragraphs": ["..."] } ] }
```
