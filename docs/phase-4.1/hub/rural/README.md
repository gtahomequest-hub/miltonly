# rural_hub section-prompt template (WS4 patch 2, DEC-WS4-7 / ADR 0002)

ONE prompt set, authored once, consumed by all **9 `profile=rural_hub`** neighbourhoods at WS5
(7 rural + 2 thin-urban: Bronte Meadows, Milton North). Dispatch keys on
`Neighbourhood.profile === "rural_hub"`, never on `kind`.

**Derivation, not new design (DEC-WS4-7):** rural = urban minus VIP, minus market depth,
character-led. Voice + prohibitions + the W2 grounding gate are inherited verbatim from
`../urban/00-hub-system-prompt.md`. There is no compared-to-Milton section, no VIP section, no
inventory snapshot, no schools/amenities-as-fact.

| # | file | section id | bucket | validator |
|---|---|---|---|---|
| 00 | `00-rural-system-prompt.md` | (shared header) | — | — |
| 01 | `01-opening-identity.md` | `openingIdentity` | editorial | none |
| 02 | `02-light-market.md` | `liveMarket` | aggregate | per-trade + numeric + temporal (re-pointed W2); usually k-anon suppressed |
| 03 | `03-whats-distinctive.md` | `bestFitFor` | editorial | none |
| 04 | `04-rural-roads.md` | `streetsInNeighbourhood` | projected | server-rendered list (currentRank, NOT VIP-first); `assertNoFabricatedStreets` |
| 05 | `05-buy-sell-ctas.md` | `buySellCtas` | editorial | none (sales register allowed here only) |
| 06 | `06-faq.md` | `faq` | mixed (per-Q) | per-question bucket rules; 4–6 Q (no rest-of-Milton Q) |
| 07 | `07-schema-markup.md` | `schemaMarkup` | projected | projected from input; never free-typed |

## Wiring

- Input: `buildRuralHubInput(slug)` → `HubGeneratorInput` (profile `rural_hub`,
  `vipStreetCount` always 0). See `src/lib/ai/buildHubInput.ts`. **No `MiltonWideContext`** —
  rural has no compared-to-Milton section.
- Projected sections: `src/lib/ai/hub/projectHubEntities.ts` (shared with urban —
  `projectStreetsSection`, `projectHubSchema`, `assertNoFabricatedStreets`).
- Validator: `src/lib/ai/validateHubGeneration.ts` (`validateHubSectionsSubset`) — **reused as
  is** (DEC-WS4-7 A3). A rural page emits no `comparedToMilton` section, so `comparison_mismatch`
  is never reached for rural; the re-pointed W2 gates still apply to the light-market section.
- Fail-closed: `src/lib/ai/hub/hubFailClosed.ts` (`routeHubGeneration`) — shared with urban.

## Out of scope (this patch)

Condo prompts (`../condo`). Hub CONTENT generation + homepage rebuild (WS5).
