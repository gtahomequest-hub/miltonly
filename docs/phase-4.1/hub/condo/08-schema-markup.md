# condo-building — schema-markup (PROJECTED)

Bucket: **projected** (DEC-WS4-2). Produces the `schemaMarkup` section. Prepend
`00-condo-system-prompt.md`.

> **This section is NOT LLM-generated.** Schema fields project from the SAME
> `CondoBuildingGeneratorInput` as the gated body. The model writes nothing here. A schema
> entity that contradicts the gated prose is structurally impossible.

## What the renderer projects (you do NOT write this)

- `@type`: an `ApartmentComplex` / `Residence`-class entity, `name = "{displayName}"`,
  `containedInPlace` = `{neighbourhoodName}, Milton` (when present), `address` = `buildingAddress`.
- `numberOfAccommodationUnits` = `totalUnits` ONLY when non-null.
- `aggregatePrice` (sale) = `saleAggregates.typicalPrice` **only when it cleared k-anon**
  (non-null) **and the building is sale-active**. On a lease-only building, no sale price appears
  in the schema (there is none). Lease figures are not advertised as sale offers.

## Projected sections discipline (DEC-WS4-2)

Any building/street list this page projects (e.g. a parent-street or sibling-building link)
follows the same projection rule: emitted from the entity array, never free-typed, `/condos/[slug]`
for buildings and `/streets/[slug]` for the parent street (ADR 0001 DEC-6 URL policy).

## Hard constraint (enforced by construction)

- No field is free-typed. Every entity / number is a projection of a field already present (and
  already k-anon gated) in the input. No claim may contradict the gated body, and no sale figure
  is emitted for a lease-only building.

## Output (emitted by the renderer, not the model)

JSON-LD projected from `CondoBuildingGeneratorInput`.
