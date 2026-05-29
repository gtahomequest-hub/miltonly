# urban_hub — schools-catchments (grounded-external) — DEPENDS-ON external data

Bucket: **grounded-external**. Produces the `schoolsCatchments` section. Prepend
`00-hub-system-prompt.md`.

> **DEPENDS-ON: Halton District School Board (HDSB) + Halton Catholic District School Board
> (HCDSB) boundary data.** This is a separate sourcing task that slots in FRONT of WS5
> generation and gates WS5 — it does NOT block WS4 prompt authoring. **Until that data
> lands, this section is NOT generated.** `input.schools.sourced === false` in WS4; the
> renderer skips the section while it is false. Do NOT free-generate school or catchment
> claims under any circumstances.

## Why this is gated, not editorial (DEC-WS4-6)

Schools/catchments has no backing in DB1/DB2, and the validator cannot catch a fabricated
qualitative claim with no number attached. A wrong catchment is a permanent, asymmetric
trust failure: families search catchment with buy intent, and Google quality systems
penalize an incorrect boundary. So this section grounds STRICTLY on the externally-sourced
HDSB + HCDSB set, like any other entity — never on model priors.

## Authoring contract (for when data lands at WS5)

When `input.schools.sourced === true` (WS5), the input will carry the sourced catchment set
per board. You may then name ONLY schools present in that set, attach ONLY the catchment /
board / level facts present in that set, and must not infer a boundary, a ranking, or a
"strong catchment" qualitative claim that the sourced data does not state.

- BANNED: any school name, catchment boundary, or board assignment not in the sourced set.
- BANNED: ranking/quality adjectives ("top-rated", "strong catchment") unless the sourced
  data carries that signal explicitly.

## Length & heading (WS5)

1–2 paragraphs, 80–180 words. Heading: "Schools and catchments" or "Education in
{neighbourhoodName}".

## Output (WS5 only — omitted entirely in WS4)

```json
{ "sections": [ { "id": "schoolsCatchments", "heading": "...", "paragraphs": ["..."] } ] }
```
