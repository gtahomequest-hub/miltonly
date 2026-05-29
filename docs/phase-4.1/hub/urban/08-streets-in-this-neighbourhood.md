# urban_hub — streets-in-this-neighbourhood (PROJECTED)

Bucket: **projected** (DEC-WS4-2). Produces the `streetsInNeighbourhood` section. Prepend
`00-hub-system-prompt.md`.

> **This section is NOT LLM-generated.** The renderer emits the street list directly from
> `buildHubInput`'s `projectedStreets[]` array (server-rendered, `currentRank` order, VIP
> first) via `projectStreetsSection()` in `src/lib/ai/hub/projectHubEntities.ts`. The model
> writes ONLY the connective prose that wraps a list it never authors. This makes
> street-name fabrication in this section structurally impossible.

## What the renderer projects (you do NOT write this)

- The ordered list of `ResidentialStreet` entities in the neighbourhood, `currentRank`
  order, VIP first. Each item: `displayName` (already `expandStreetName`-normalized — clean
  names like "Main Street East", never "Farmstead. Dr"), `url` (`/streets/[slug]`),
  `isVip`, `soldCount12mo`.

## What you DO write (connective prose only)

- A short intro paragraph BEFORE the list and an optional short outro AFTER it.
- The intro may reference the neighbourhood name, the count of streets, and the VIP count
  (all from the input), framed editorially: "These are the {totalCount} residential streets
  in {neighbourhoodName}, with the most active listed first."

## Hard constraint (enforced)

- You may NOT name any individual street in your connective prose. Street names come ONLY
  from the projected list. `assertNoFabricatedStreets()` rejects any street-name-shaped
  phrase in your prose that is not in the projected set.
- You may NOT state a per-street price or per-street count beyond what the projection
  carries. No new numbers.

## Length & heading

Intro + optional outro, 40–90 words of connective prose total. Heading: "Streets in
{neighbourhoodName}" or "Explore {neighbourhoodName} street by street".

## Output (connective prose only — the list is injected by the renderer)

```json
{ "sections": [ { "id": "streetsInNeighbourhood", "heading": "...", "paragraphs": ["intro", "outro?"] } ] }
```
