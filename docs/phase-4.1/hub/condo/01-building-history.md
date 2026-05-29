# condo-building — building-history (editorial)

Bucket: **editorial**. Produces the `buildingHistory` section. Prepend `00-condo-system-prompt.md`.

## Purpose

Orient the reader: what kind of building this is and where it sits. Lead with the building's
own attributes where the input carries them.

## What you may ground on (cite ONLY when non-null)

- `input.building.displayName` / `buildingAddress` — the building's address-name.
- `input.building.yearBuilt` — state the build year ONLY if present.
- `input.building.legalStories` — height in storeys ONLY if present.
- `input.building.totalUnits` — unit count ONLY if present.
- `input.building.neighbourhoodName` — the neighbourhood, used for position framing.

## BANNED claim-types

- **Any attribute that is null in the input.** No invented build year, storey count, unit count,
  developer, or architect. `displayName` is the building address, not a marketed name — do not
  invent a building name.
- No prices here (that is the market / fees sections). No superlatives, no clichés, no
  first-person plural.

## Length & heading

1–2 paragraphs, 80–150 words. Heading: "About {displayName}" or "{displayName} at a glance".

## Output

```json
{ "sections": [ { "id": "buildingHistory", "heading": "...", "paragraphs": ["..."] } ] }
```
