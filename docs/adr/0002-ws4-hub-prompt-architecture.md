# ADR 0002 — WS4 Hub-Tier Prompts & Validator Extension (DEC-WS4)

- Status: Proposed (Brain Claude architecture; pending Aamir review → Builder patch)
- Date: 2026-05-29
- Deciders: Brain Claude (architecture), Builder Claude (implementation), Aamir (owner)
- Builds on: ADR 0001 (WS3 three-tier model), DEC-GROUNDING-GATE (W2 grounding gate)

## Context

WS3 shipped the three-tier entity model (24 Neighbourhood, 915 ResidentialStreet,
108 CondoBuilding, 154 VIP). WS4 authors the hub-tier prompts and extends the W2
validator to enforce the grounding gate at neighbourhood and building granularity.
No code is written before this section→data-shape map is locked.

The core principle is inherited verbatim from DEC-GROUNDING-GATE: **validation gates
on CLAIM-TYPE vs DATA-EXISTENCE, not number proximity.** WS4 applies that principle
at a coarser tier (neighbourhood/building aggregates) and adds one net-new cross-
sectional rule (`comparison_mismatch`).

## Scope correction (read before authoring)

The session-start continuity note said 16 urban_hub + 7 rural_hub. ADR 0001 is
authoritative: **14 urban_hub + 9 rural_hub** (7 rural + 2 thin-urban). Bronte
Meadows and Milton North are `kind=urban` but `profile=rural_hub` — no VIP tier,
insufficient volume for full market depth.

**Prompt dispatch keys on `Neighbourhood.profile`, never `kind`.** Authoring "16
urban hubs" would generate VIP/full-market content for two neighbourhoods with no
VIP pool and sub-k market segments. WS4 ships 14 urban_hub prompt sets, 9 rural_hub
prompt sets, dispatched on `profile`.

## Decision

### DEC-WS4-1 — Section → data-shape map (urban_hub)

Every urban_hub section is classified into one of three buckets. The bucket
determines which validator rules apply and which claim-types the prompt bans.

| Section | Bucket | May ground on | Banned claim-types |
|---|---|---|---|
| Opening identity | editorial | character, position-in-Milton | named landmarks/facts not in input |
| Live market | aggregate | nbhd sold aggregates, quarterlyTrend | per-trade claims (input has no per-trade rows) |
| Inventory snapshot | aggregate | live active-listing counts (Listing) | per-listing claims; segment counts below k |
| Schools & catchments | grounded-external | Halton DSB + HCDSB boundary data | any school/catchment not in the sourced set |
| Amenities & infrastructure | editorial | general character | specific named/measured amenity claims |
| Compared-to-Milton | aggregate (2-sided) | nbhd aggregate **and** Milton-wide rollup | comparison verbs where either side ungrounded |
| Best-fit-for | editorial | advisory framing | implied numeric/grounded claims |
| Streets-in-this-neighbourhood | grounded-entity (projected) | ResidentialStreet[] by currentRank | any street/numeric not in the entity array |
| Buy/sell CTAs | editorial | conversion copy | — |
| FAQ | mixed (per-question) | classified per Q | per-Q per the bucket it falls in |
| Schema markup | grounded-entity (projected) | same input as gated body | any claim contradicting gated prose |

### DEC-WS4-2 — Entity-backed sections are projected, not generated

`streets-in-this-neighbourhood` and `schema markup` are pure projections of the
entity query. The LLM **does not write the street list or the schema fields** — the
renderer emits them from the `ResidentialStreet[]` array (ordered by `currentRank`,
VIP first) and the LLM writes only connective prose around a server-rendered list.

This makes street/entity fabrication in those sections structurally impossible —
the same discipline as the StreetPlaceholder fix. Zero added cost; removes a whole
fabrication surface from the validator's burden.

### DEC-WS4-3 — Compared-to-Milton: new shared input + new validator rule

The comparison section needs **both** sides grounded: the neighbourhood aggregate
(exists) and a Milton-wide rollup (does not exist as an input builder yet).

- **Input:** add `buildMiltonWideContext()` — computed once, shared across all 14
  hubs (not recomputed per hub). Lives beside the WS3 `buildResidentialStreetInput`
  / `buildCondoBuildingInput` split noted in the entity-taxonomy spec.
- **Validator:** add `comparison_mismatch` — the cross-sectional cousin of W2's
  `direction_mismatch`. For any comparison verb ("runs above / below / in line with
  the rest of Milton"), assert (a) both the nbhd side and the Milton side are present
  in the input, and (b) the asserted direction matches the actual aggregate delta.
  Fire only when no grounded reading supports the claim (mirror the widened
  `findTemporalPairings` window logic — collect candidates, accept if any supports).

This is the **only** genuinely net-new validator rule in WS4. Everything else is the
W2 gate re-pointed at hub-tier input.

### DEC-WS4-4 — k-anonymity binds at claim granularity, not tier

Neighbourhood-wide aggregates rarely trip k (Dempsey pool 44, Scott 48). But a
**segment** claim inside a hub (by type, by quarter) can fall under `K_ANON = 10`,
and **condo building tier trips it constantly** (47 sale-active buildings, many with
a handful of trades). The validator checks k at the granularity the claim asserts,
not at the section level.

### DEC-WS4-5 — Condo prompt fork (sale-active vs lease-only)

Per entity-taxonomy + DEC-GROUNDING-GATE, condo aggregates **must split by
`transaction_type`** (mixing sale + lease produced the `490 Gordon Krantz avg 2370`
garbage). The condo prompt forks:

- **Sale-active (47):** market section grounded on sale-side aggregates, k-checked
  per building.
- **Lease-only (61):** standard-tier page, **never VIP** (ADR 0001 DEC-5). Per-trade
  lease claims fire unless `leaseActivity.recentRecords` is populated at k ≥ 5
  (the W2 lease-side coverage rule, applied at building tier).

### DEC-WS4-6 — Schools as grounded-external; amenities as editorial

Schools/catchments has **no backing in DB1/DB2** and the W2 validator explicitly
cannot catch fabricated qualitative claims with no number attached. A wrong catchment
is a permanent, asymmetric trust failure (families search catchment with buy intent;
Google quality systems penalize it). Therefore:

- **Schools:** sourced externally from Halton District School Board + Halton Catholic
  DSB boundary data, grounded like any other entity. This is a **data-sourcing task
  that slots in front of WS5 generation** — but does NOT block WS4 prompt authoring;
  the other 9 section prompts are authored in parallel while catchment data is sourced.
- **Amenities:** editorial, prompt-constrained to general character (no named/measured
  claims). Low downside; no validator gate. Ships now.

### DEC-WS4-7 — rural_hub + condo derive from locked urban_hub

rural_hub = urban_hub minus VIP, minus market depth, character-led (identity, light
market with k-anon, what's distinctive, rural-roads list [projected], buy/sell CTAs,
light FAQ, schema). condo = the grounding contract at building-level thresholds per
DEC-WS4-4/5. Both are derivations authored after urban_hub is locked, not net-new design.

## Reuse (no reinvention)

Phase 4.1 architecture carries forward unchanged: retry-then-fail-closed orchestration,
the `StreetGeneration.status='failed'` + `StreetGenerationReview` two-table queue,
system-prompt caching, the $25/day budget cap + batch approval gates, DeepSeek/Opus
generation path. WS4 adds prompts + `comparison_mismatch` + `buildMiltonWideContext`;
it does not touch the orchestration or the failure mechanism.

## Completion gate (WS4)

Not git push. WS4 is done when:
1. 14 urban_hub + 9 rural_hub + condo (sale/lease fork) prompt sets exist in-repo.
2. The extended validator passes the 3 former Lane A streets clean (no regression).
3. `comparison_mismatch` fires on a deliberately-ungrounded synthetic comparison and
   passes a grounded one (fixture, mirroring `test-class-a-c-hardening.ts`).
4. A deliberately-thin synthetic neighbourhood / sub-k condo building fails-closed
   into `StreetGenerationReview` rather than publishing.
5. Raw evidence at each gate. No Builder self-certification.

## Carry-forward folded into the WS4 patch

- `.gitattributes *.sql text eol=lf` — 30-second commit, included in patch 1.
- Class A shorthand → AHA homes prompt (`02a-about-homes-amenities`): extend the
  W2 bracket-shorthand constraint when the homes section is validated under this work.
- `expandStreetName` display normalization (WS3 carry-forward) lands in the content
  layer here — projected street lists must render clean names, not "Farmstead. Dr".

## Out of scope (do not pull into WS4)

- Hub generation + homepage rebuild (WS5).
- The 361-vs-305 reconciliation, 4 null-neighbourhood streets, condo page generation
  (WS5 carry-forward items 1/2/4).
- Polygon enrichment (parked indefinitely; nullable columns already reserved).
