# MC-004
D:\miltonly · main (work on `fix/queue-reeval` and `feat/geometry`, both unmerged)

## MC-004: MC-003 merged and green, the programme re-queued and blocked on credit, QUEUE item 5 built and proven on preview

### 1. Merge of `5ebe87a` by SHA, full gate: done

`git merge --no-ff 5ebe87a` on main, merge commit **`8ebb9377c071c55b14861bd4c957daec77ee9c10`** (21 files, +756/-23, no "Already up to date"). `pnpm build` exit 0. Pushed; `npx vercel ls --prod` shows `miltonly-132wnp10z` Ready; `https://miltonly.com/api/build` answers the full SHA. Production battery with `EXPECT_SHA=8ebb937…`: **`PASS · 12 checks · 449 pages · 109s`**, exit 0, `served == expected`. The MC-003 report and handoff were brought onto main as a docs-only commit (`90c457c`); the branch's log-string tweak to the fee guard was left out so the verified code SHA is the merge itself.

### 2. The queue: the diagnosis corrects my own MC-003 line

**MC-003 said the 09-11 15:00Z cron marked the 249 candidates `ineligible`. That was wrong**, and it came from reading timestamp-without-timezone columns through a local-time parser. The truth, measured:

- **One row** was marked `ineligible` on 09-11: `whitelock-avenue-milton`, created by the detect cron at 14:04Z for a new "rented" lease listing, an MLS misspelling of Whitlock Avenue, on neither the registry nor the allowlist. Refused at the entity floor. Correct.
- **The 249 candidates were never the cron's to build.** Of the 244 without a page: **167 were not in `StreetQueue` at all** (nothing enqueues a registry street whose only history is DB2; the detect cron enqueues on DB1 listing events), **68 were `ineligible`**, struck between May and August by the three-source DB1 gate that DEC-GATE-PARITY replaced on 09-10, and never re-read because the cron selects only `pending` and `failed < 3`, and **9 were `failed` at attempts=3** and so never retried (5 on the Anthropic credit-balance 400, 4 on a `NoCentroidError` the Town-centreline step has since fixed). The five pages that exist were built locally by `create-street-pages-local.ts`, which forces DeepSeek.

**The cause that is a queue-state bug, fixed on `fix/queue-reeval` (`4a65f30`, preview `miltonly-flgprxmsq`, build exit 0, not merged):** `ineligible` was a one-way door. DEC-QUEUE-REEVAL: the generate cron now re-examines an `ineligible` verdict older than 30 days in whatever capacity a run has left after every `pending` and retryable row, oldest verdict first, so a widened gate or a street's first DB2 record can reach it; a street still ineligible is stamped and waits another period; the response JSON reports `reevaluated`. The absent-from-queue half is not a bug to fix in the cron: it is what `requeue-creation-programme.ts` is for.

**Re-queued:** `scripts/requeue-creation-programme.ts --write` at 17:12Z. 249 candidates, 5 already have a page, 0 refused at the entity floor, **244 upserted to `pending`**, attempts 0, `createdAt` in programme order so the cron drains in the reviewed order. Prior state of the 244: 167 absent, 68 ineligible, 9 failed.

**The 18:00Z cron pass, confirmed:** it picked up **exactly 20** (`pending` 244 to 224; the other 5 of its 25 were retryable rows ahead in `createdAt`). **All 20 failed between 18:00:59Z and 18:01:09Z on `400 … Your credit balance is too low to access the Anthropic API`, `attemptCount` 0, no `StreetContent` row written.** Production runs `AI_PROVIDER_MARKET="haiku"` and `AI_PROVIDER_FALLBACK="opus"`, so the cron's first call is to Claude, and the account has had no credit since August (HANDOFF open item 1). The programme cannot move on the cron until credit is added or production's market half is pointed at DeepSeek as the local runner does; that is an environment change on production and I did not make it. **What happens meanwhile:** each hourly pass burns one attempt on 20 to 25 rows and a row is terminal `failed` after three, so the 244 would all be exhausted in roughly a day and a half. Once the provider is fixed, `requeue-creation-programme.ts --write` resets them (it sets attempts 0 and `lastError` null). The `differentPriorities` prompt/validator fault (22 % pass rate on this thin-data shape) is also still open and will meet these streets once they can generate.

### 3. QUEUE item 5, geometry backfill: built on `feat/geometry`, proven on preview, not merged

**Branch head `b0d424be1a551f35d9d60bf0a50fe258954633b2`**, preview **https://miltonly-ra87zyzmu-gtahomequest-hubs-projects.vercel.app**, `/api/build` answers the full SHA. `pnpm build` exit 0 (25 prebuild guards). Battery on the preview with the full SHA: **`PASS · 13 checks · 449 pages · 123s`**, exit 0.

**Data.** `scripts/town/gen-street-geometry.ts` writes `src/data/streetGeometry.ts` (972 Town identities, 837 joined to OSM, a JSON literal keyed by the Town identity key) from the Town Road Segments cache and the OSM export at `D:/dashcam/work/milton-roads.geojson`, with the Gate A rulings applied in the generator, once:

| field | source | rule applied | over 449 published (447 have a Town row) |
|---|---|---|---|
| length | Town geometry | nearest 10 m; m under 1 km, km to one decimal above | 447 |
| road class | Town `CATEGORY` | one value for the whole street, else null | 422 (346 local, 64 collector, 5 major arterial, 4 minor, 2 private, 1 highway) |
| lanes | Town `LANES` | one value, 0/null are "not stated" | 427 |
| posted limit | Town `SPEED_LIMIT` | one value | 419 |
| surface | OSM `surface` | one value after normalisation | 390 (388 asphalt) |
| sidewalk | OSM `sidewalk`, `:left/:right/:both` | collapsed to a side count (OSM left/right depends on way direction), one value | 243 (189 one side, 35 both, 16 none, 3 separate path) |
| terminus | Town geometry + `CATEGORY` + type | a dead-end node touched by no other street, at least 500 m inside the layer extent, never on an arterial or highway; "cul-de-sac" on court / close / place / gate / circle, "dead end" on another LOCAL type, else null | 29 (17 cul-de-sac, 12 dead end); `guelph-line` and `lower-base-line` correctly get none |
| orientation | Town geometry | length-weighted axial resultant ≥ 0.6, else null; one of four axes as a phrase | 269 (144 NE–SW, 114 NW–SE, 7 E–W, 4 N–S); 178 curved streets get none |

**Render.** `src/lib/town/geometry.ts` is a lookup and a formatter, no rulings. The seam (`streetV2Data.ts`) fills `sidebar.geometry`; both shells render a "Road facts" card in the sidebar (`.s-side-card.s-geo`, `data-identity`, one `.s-geo-fact[data-key]` row per fact) with the OGL attribution, plus the OSM line exactly when surface or sidewalk is shown. Never in a hero, glance or market tile. On preview: **447 cards, 2,646 facts** (447 + 422 + 427 + 419 + 390 + 243 + 29 + 269).

**Boundary.** `StreetGeneratorInput` carries no geometry field and nothing under `src/lib/ai` imports the data or the accessor; `scripts/test-geometry-boundary.ts` (prebuild, 57 assertions) holds both and proves the rule below on fixtures.

**Validator.** New hard rule `unit_figure` in `validateStreetGeneration.ts`, wired into both section validators and both FAQ arms with retry feedback: any distance, speed or lane count with a unit (m, metres, km, km/h, mph, lanes, digits or word numbers, grounded proper nouns masked first) is ungrounded by construction, because no input carries one. Minutes are excluded on purpose (commute minutes are an input). Measured on the 252 published pages with a generation row: **0 matches**, so the corpus loses nothing.

**Battery.** New check `geometry-facts`: parses `streetGeometry.ts` directly, reads every card off the served page, and asserts every rendered fact equals the layer value for the identity the card names (and that the identity is the street's own), nothing renders where the row is null, no layer fact goes unrendered, one card per page, attribution present and the OSM line exactly when due, and no unit figure in any of the 6,901 hero, glance or market tiles scanned. On preview: **2,646 facts compared, 0 differ, 0 extra, 0 missing, 0 leaks.** One fix on the way (`b0d424b`): the first run misread the attribution because the card capture consumes the note's closing tag; 447 false failures, none of them a page defect.

### Files
- main: merge `8ebb937`, docs `90c457c` and this commit
- `fix/queue-reeval` (`4a65f30`): `src/app/api/sync/generate/route.ts`, `scripts/requeue-creation-programme.ts`
- `feat/geometry` (`b0d424b`): `scripts/town/gen-street-geometry.ts`, `src/data/streetGeometry.ts`, `src/lib/town/geometry.ts`, `src/components/street/v2/{types,sections,StreetMinimalPage,mockData}`, `src/lib/streetV2Data.ts`, `src/lib/ai/validateStreetGeneration.ts`, `src/types/street-generator.ts`, `scripts/test-geometry-boundary.ts`, `scripts/verify/checks/geometry-facts.mjs`, `scripts/verify/{run.mjs,README.md}`, `package.json`
- record: `scratchpad/mc003/battery-prod-8ebb937.log`, `battery-geometry-preview.log`, `cron-1800.log`

### Next
Stopped, no merge. Your call on `fix/queue-reeval` `4a65f30` and `feat/geometry` `b0d424b`, each by SHA, and on the cron's provider: credit, or `AI_PROVIDER_MARKET=deepseek` on production, before the re-queued programme can build.
