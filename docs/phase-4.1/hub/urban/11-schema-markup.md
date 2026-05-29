# urban_hub — schema-markup (PROJECTED)

Bucket: **projected** (DEC-WS4-2). Produces the `schemaMarkup` section. Prepend
`00-hub-system-prompt.md`.

> **This section is NOT LLM-generated.** Schema fields project from the SAME
> `HubGeneratorInput` as the gated body, via `projectHubSchema()` in
> `src/lib/ai/hub/projectHubEntities.ts`. The model writes nothing here. This makes a
> schema entity that contradicts the gated prose structurally impossible.

## What the renderer projects (you do NOT write this)

- `@type: Place`, `name = "{neighbourhoodName}, Milton"`, `containedInPlace` = the city.
- `mainEntity` = an `ItemList` of the projected residential streets (display names + URLs),
  drawn from `projectedStreets[]` — the same array as the streets-in-this-neighbourhood
  section. No street appears in the schema that is not in that array.
- `aggregatePrice` = the neighbourhood `typicalPrice` **only when it cleared k-anon**
  (non-null). When the body had to suppress the typical price (sub-k), the schema omits the
  price too. The schema can never advertise a figure the gated prose suppressed.

## Hard constraint (enforced by construction)

- No field is free-typed. Every entity / number in the schema is a projection of a field
  already present (and already k-anon gated) in the input. No claim may contradict the
  gated body.

## Output (emitted by the renderer, not the model)

JSON-LD per `HubSchemaProjection` (see `src/types/hub-generator.ts`).
