# Spec — Entity Taxonomy (residential street vs condo building)

Status: implemented on `ws3-staging` (WS3). See ADR 0001.

## The distinction

The MLS feed (`sold.sold_records`, DB2) mixes two physical primitives under one
`street_slug`. WS3 splits them:

| | Residential street | Condo building |
|---|---|---|
| Primitive | a named street | one tower / civic address |
| Source trades | `property_type IN (detached, semi, townhouse)` | `property_type = 'condo'` |
| Identity key | `street_slug` | `(street_number, street_slug)` |
| Entity model | `ResidentialStreet` | `CondoBuilding` |
| URL (WS5) | `/streets/[slug]` (preserved) | `/condos/[slug]` (net-new) |

A single street_slug can spawn one residential street **and** many condo buildings
(`gordon-krantz-avenue-milton` → the residential street + 460/470/480/490 towers).

## Why building address, not condo_corp_number

`condo_corp_number` is present on 99.4% of condo rows but is dirty and non-unique per
building: `490 Gordon Krantz Ave` carries 7 distinct corp numbers; `1105 Leger Way`
uses the placeholder `99999`. It is stored as `condoCorpNumbers String[]` (an attribute),
never as the key. The civic address `(street_number, street_slug)` is the stable key.

`street_slug` (canonical) is used rather than raw `street_name` because the raw name
carries dirty direction/spelling tokens — one building `8010 Derry Rd` appears as
"Derry Rd / Derry Rd E / Derry Rd N / Derry Rd W". Grouping by the canonical slug
de-duplicates these (142 raw address strings → 108 real buildings).

## displayName

No marketed building-name field exists in the feed (`BuildingName` absent from all
1,614 condo rows; `association_name` is corp-stub garbage; `property_management_company`
names firms, not buildings). `displayName` is therefore populated = `buildingAddress`
at backfill. A future curation/NLP pass may override it; read paths use `displayName`.

## Schema (DB1 `public`)

`Neighbourhood`, `ResidentialStreet`, `CondoBuilding` (extended), `UnmappedNeighbourhoodString`.
Full Prisma models in `prisma/schema.prisma`; migration `20260529011359_ws3_entity_taxonomy`.
Legacy `CondoBuilding` columns (`name`, `address`, `neighbourhood`, `latitude`, `longitude`)
were relaxed to nullable because the entity backfill sources from sold records and has no
coordinates. The migration is additive and non-destructive (0-row CondoBuilding alter +
3 new tables).

## buildGeneratorInput split (WS3 wiring → WS4 consumes)

`buildGeneratorInput(slug)` is to be split into:
- `buildResidentialStreetInput(slug)` — shared metrics + crossStreets, streetType, directionalStats.
- `buildCondoBuildingInput(buildingSlug)` — shared metrics + unitCount, legalStories, managementCo,
  association fees, corp numbers. **Condo aggregates must split by `transaction_type`**
  (sale vs lease) — mixing them produced garbage averages (e.g. `490 Gordon Krantz avg 2370`
  = rents averaged with sale prices).

## Backfill / classification entry points

- Seed + helper: `src/lib/neighbourhood.ts` (`NEIGHBOURHOOD_SEED`, `resolveNeighbourhood`).
- Backfill: `scripts/ws3-backfill.ts` (reads DB2 sold, writes DB1-staging via `pg`).
- Verification: `scripts/ws3-verify.ts`, `scripts/ws3-tiebreak-check.ts`.
