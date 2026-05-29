# rural_hub — rural-roads / streets-in-this-area (PROJECTED)

Bucket: **projected** (DEC-WS4-2). Produces the `streetsInNeighbourhood` section. Prepend
`00-rural-system-prompt.md`.

> **This section is NOT LLM-generated.** The renderer emits the road/street list directly from
> `buildRuralHubInput`'s `projectedStreets[]` array via `projectStreetsSection()` in
> `src/lib/ai/hub/projectHubEntities.ts`. The model writes ONLY the connective prose. Road-name
> fabrication is structurally impossible.

## What the renderer projects (you do NOT write this)

- The ordered list of `ResidentialStreet` entities in the area, **`currentRank` order** (NOT
  VIP-first — rural has no VIP tier; `vipCount` is always 0). Each item: `displayName`
  (already `expandStreetName`-normalized — clean names, never "Farmstead. Dr"), `url`
  (`/streets/[slug]`), `soldCount12mo`. `isVip` is false for every rural road.

## What you DO write (connective prose only)

- A short intro paragraph BEFORE the list and an optional short outro AFTER it.
- The intro may reference the area name and the count of roads (from the input), framed
  editorially: "These are the {totalCount} roads in {neighbourhoodName}." Do NOT reference a
  VIP count — rural pools have none.

## Hard constraint (enforced)

- You may NOT name any individual road in your connective prose. Names come ONLY from the
  projected list. `assertNoFabricatedStreets()` rejects any street-name-shaped phrase in your
  prose that is not in the projected set.
- No per-road price or count beyond what the projection carries. No new numbers.

## Length & heading

Intro + optional outro, 40–80 words. Heading: "Roads in {neighbourhoodName}" or
"Explore {neighbourhoodName}".

## Output (connective prose only — the list is injected by the renderer)

```json
{ "sections": [ { "id": "streetsInNeighbourhood", "heading": "...", "paragraphs": ["intro", "outro?"] } ] }
```
