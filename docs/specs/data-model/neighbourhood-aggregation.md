# Spec — Neighbourhood Aggregation & Assignment

Status: implemented on `ws3-staging` (WS3). See ADR 0001.

## Source & method

No polygon source and 0% coordinate coverage (0 of 7,483 sold records carry lat/lng),
so **point-in-polygon is not possible today**. WS3 uses **string-based assignment**: the
raw TREB neighbourhood string (`CityRegion`, stored as `sold_records.neighbourhood` /
`Listing.neighbourhood`) maps to a canonical `Neighbourhood` entity.

`centroidLat`, `centroidLng`, `polygon` are nullable columns reserved for a future
geocoding/polygon enrichment workstream — it can populate them without a migration.

## Canonical mapping: 25 raw strings → 24 entities

The raw string is **not 1:1** with a neighbourhood. Rural areas arrive as both a coded
and an uncoded variant; `Neighbourhood.rawStrings[]` holds every variant. The only merge:
**Nassagaweya** = `["1041 - NA Rural Nassagaweya", "Nassagaweya"]`.

Profiles (full table in `src/lib/neighbourhood.ts` `NEIGHBOURHOOD_SEED`):

- **urban_hub (14, hasVipTier=true):** Beaty, Bowes, Cobban, Clarke, Coates, Dempsey,
  Dorset Park, Ford, Harrison, Old Milton, Scott, Timberlea, Willmott, Walker.
- **rural_hub — kind=urban, thin (2, no VIP):** Bronte Meadows, Milton North.
- **rural_hub — kind=rural (7, no VIP):** Rural Milton, Nassagaweya, Rural Trafalgar,
  Brookville/Haltonville, Campbellville, Moffat, Rural Milton West.
- **standard_no_hub (1):** Derry Green — `kind=industrial`, `isHub=false`. Data check:
  3 records, all detached residential, 0 condo → streets exist (standard tier) but no hub.

`Rural Milton West` (102 records) and `1039 - MI Rural Milton` (16) are kept **separate**
per decision (volume disparity); merge revisited only if polygons later prove overlap.

## Per-entity assignment

Each entity is assigned to the **dominant** raw string among its trades (mode by record
count), resolved via `resolveNeighbourhood`. If an entity's trades span strings that map
to **different** neighbourhoods, `neighbourhoodAmbiguous=true` is set (55 residential,
9 condo entities flagged). 4 published-only residential streets have no neighbourhood
(no DB2 trades + null StreetContent.neighbourhood) — flagged for manual assignment.

## resolveNeighbourhood + the review queue (future-proofing)

`resolveNeighbourhood(rawString, source)` (`src/lib/neighbourhood.ts`):
1. Returns the `Neighbourhood` whose `rawStrings[]` contains the string.
2. On no match: logs (fail-loud) and upserts the string into `UnmappedNeighbourhoodString`
   (append-only, `seenCount` bump). **Never auto-creates** a neighbourhood.
3. Brain Claude reviews the queue and either extends an existing `rawStrings[]` or creates
   a new neighbourhood.

This is the durable layer for string-based assignment as MLS data quality drifts; a future
polygon resolver replaces step 1 but keeps the review-queue mechanism. Backfill confirmed
**0 unmapped strings** (all 25 known strings seeded).
