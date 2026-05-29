# rural_hub — schema-markup (PROJECTED)

Bucket: **projected** (DEC-WS4-2). Produces the `schemaMarkup` section. Prepend
`00-rural-system-prompt.md`.

> **This section is NOT LLM-generated.** Schema fields project from the SAME
> `HubGeneratorInput` as the gated body, via `projectHubSchema()` in
> `src/lib/ai/hub/projectHubEntities.ts` — the same projector the urban set uses. The model
> writes nothing here.

## What the renderer projects (you do NOT write this)

- `@type: Place`, `name = "{neighbourhoodName}, Milton"`, `containedInPlace` = the city.
- `mainEntity` = an `ItemList` of the projected roads (display names + URLs), drawn from
  `projectedStreets[]` — the same array as the rural-roads section. No road appears in the
  schema that is not in that array.
- `aggregatePrice` = the area `typicalPrice` **only when it cleared k-anon** (non-null). For
  rural areas the typical is usually suppressed, so the schema usually omits the price — and
  must never advertise a figure the gated prose suppressed.

## Hard constraint (enforced by construction)

- No field is free-typed. Every entity / number is a projection of a field already present
  (and already k-anon gated) in the input. No claim may contradict the gated body.

## Output (emitted by the renderer, not the model)

JSON-LD per `HubSchemaProjection` (see `src/types/hub-generator.ts`).
