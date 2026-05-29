# urban_hub — inventory-snapshot (aggregate)

Bucket: **aggregate**. Produces the `inventorySnapshot` section. Prepend `00-hub-system-prompt.md`.

## Purpose

A read on live supply: how many homes are currently on the market in the neighbourhood and
what that says about pace. Grounded ONLY in live active-listing counts.

## What you may ground on

- `input.activeListingsCount` — total live active listings in the neighbourhood.
- `input.activeByType` — active count per property type.

## BANNED claim-types

- **Per-listing claims.** Do not describe an individual active listing ("a 4-bedroom is
  listed at $X"). Aggregate counts only.
- **Any segment count below `K_ANON = 10`.** If `activeByType[t] < 10`, do not state that
  per-type count. You may still give the neighbourhood total if it is ≥ 10, and speak of
  smaller segments qualitatively ("a smaller pool of condos") WITHOUT a number.
- No prices here unless they trace to `input.aggregates` (this is a supply read, not a price
  read); prefer to keep this section about count and pace, deferring price to live-market.

## Interpretation

Pair the active count with the neighbourhood `daysOnMarket` (from `input.aggregates`) for a
tight/loose read, e.g. "supply sits around {N} active homes, and with typical days on market
near {DOM} the pace reads as {tight/balanced/loose}." Keep it one paragraph.

## Length & heading

1 paragraph, 60–130 words. Heading: "What's on the market now" or "Current supply in
{neighbourhoodName}".

## Output

```json
{ "sections": [ { "id": "inventorySnapshot", "heading": "...", "paragraphs": ["..."] } ] }
```
