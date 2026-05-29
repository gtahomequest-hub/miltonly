# urban_hub section-prompt template (WS4 patch 1, DEC-WS4 / ADR 0002)

ONE prompt set, authored once, consumed by all **14 `profile=urban_hub`** neighbourhoods at
WS5. Dispatch keys on `Neighbourhood.profile === "urban_hub"`, never on `kind`.

| # | file | section id | bucket | validator |
|---|---|---|---|---|
| 00 | `00-hub-system-prompt.md` | (shared header) | — | — |
| 01 | `01-opening-identity.md` | `openingIdentity` | editorial | none |
| 02 | `02-live-market.md` | `liveMarket` | aggregate | per-trade + numeric + temporal (re-pointed W2) |
| 03 | `03-inventory-snapshot.md` | `inventorySnapshot` | aggregate | per-trade + numeric; sub-`K_ANON`(10) segment ban |
| 04 | `04-schools-catchments.md` | `schoolsCatchments` | grounded-external | DEPENDS-ON HDSB+HCDSB; not generated until data lands |
| 05 | `05-amenities.md` | `amenities` | editorial | none |
| 06 | `06-compared-to-milton.md` | `comparedToMilton` | aggregate, 2-sided | **`comparison_mismatch`** (net-new) + per-trade |
| 07 | `07-best-fit-for.md` | `bestFitFor` | editorial | none |
| 08 | `08-streets-in-this-neighbourhood.md` | `streetsInNeighbourhood` | projected | server-rendered list; `assertNoFabricatedStreets` |
| 09 | `09-buy-sell-ctas.md` | `buySellCtas` | editorial | none (sales register allowed here only) |
| 10 | `10-faq.md` | `faq` | mixed (per-Q) | per-question bucket rules |
| 11 | `11-schema-markup.md` | `schemaMarkup` | projected | projected from input; never free-typed |

## Wiring

- Input: `buildHubInput(slug)` → `HubGeneratorInput`; `buildMiltonWideContext()` →
  `MiltonWideContext` (computed once per run). See `src/lib/ai/buildHubInput.ts`.
- Projected sections: `src/lib/ai/hub/projectHubEntities.ts`
  (`projectStreetsSection`, `projectHubSchema`, `assertNoFabricatedStreets`).
- Validator: `src/lib/ai/validateHubGeneration.ts`
  (`validateHubSectionsSubset`, `findComparisonMismatch`).
- Fail-closed: `src/lib/ai/hub/hubFailClosed.ts` (`routeHubGeneration`).

## Out of scope (this patch)

rural_hub / condo prompts (WS4 patch 2). Hub CONTENT generation + homepage rebuild (WS5).
The retry-then-fail-closed orchestration, the two-table failure queue, the budget cap.
