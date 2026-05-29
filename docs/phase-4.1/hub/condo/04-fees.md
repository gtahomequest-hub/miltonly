# condo-building — fees (editorial, attribute-grounded)

Bucket: **editorial** (grounded on a single building attribute). Produces the `fees` section.
Prepend `00-condo-system-prompt.md`.

## Purpose

Frame the building's maintenance-fee picture for a prospective buyer. This is a thin, factual
section — one grounded number at most.

## What you may ground on

- `input.building.avgMaintenanceFee` — the ONLY fee figure you may state, and ONLY when present
  (non-null). State it as a monthly maintenance fee, rounded sensibly (nearest $25). If null,
  write that fee detail varies by unit and is confirmed per listing — do NOT invent a figure.

## BANNED claim-types

- **Any fee figure not equal to `avgMaintenanceFee`.** No invented per-square-foot rate, no
  "fees include X utilities" unless that is a present attribute, no reserve-fund claim.
- No comparison of the fee to other buildings (no data side for that). No superlatives.
- Do NOT present a maintenance fee as a price or a rent.

## Length & heading

1 short paragraph, 40–90 words. Heading: "Maintenance fees at {displayName}" or "Monthly costs".

## Output

```json
{ "sections": [ { "id": "fees", "heading": "...", "paragraphs": ["..."] } ] }
```
