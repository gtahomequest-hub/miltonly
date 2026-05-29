# condo-building — amenities (editorial)

Bucket: **editorial**. Produces the `amenities` section. Prepend `00-condo-system-prompt.md`.

## Purpose

General character of building living. Editorial register, no named/measured amenity claims
unless the input carries them.

## What you may ground on

- `input.building.amenities[]` — ONLY the amenities present in this array may be named. If the
  array is empty, write to general building-living character without naming specific facilities.
- `input.building.managementCo` — may be referenced ONLY if present (non-null).
- `input.building.legalStories` / `totalUnits` — for scale framing, ONLY if present.

## BANNED claim-types

- **Named or measured amenities not in `input.building.amenities`.** No invented gym, pool,
  concierge, party room, rooftop, parking ratio, or pet policy. This is the editorial low-downside
  rule from `../urban/05-amenities.md`, re-pointed to building scope.
- No prices, no counts beyond present attributes. No superlatives, no clichés, no first-person plural.

## Length & heading

1 paragraph, 60–130 words. Heading: "Living at {displayName}" or "Amenities and building life".

## Output

```json
{ "sections": [ { "id": "amenities", "heading": "...", "paragraphs": ["..."] } ] }
```
