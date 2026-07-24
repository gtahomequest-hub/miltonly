# ADR 0001 — Three-Tier Site Architecture & Entity Taxonomy (WS3)

- Status: Accepted (staging migrated; prod promotion pending Brain Claude review)
- Date: 2026-05-28
- Deciders: Brain Claude (architecture), Builder Claude (implementation), Aamir (owner)
- Supersedes: the ad-hoc `StreetContent.isVipHub` "5+ active listings" flag

## Context

The site collapsed two different real-estate primitives into one. All sold trades
were aggregated by `street_slug` only, so a street page mixed condo towers with
detached houses (e.g. `gordon-krantz-avenue-milton` = 279 condo trades across four
towers + 9 houses; `main-street-milton` = 302 condo + 62 residential). Neighbourhoods
existed only as raw TREB strings; there was no neighbourhood entity, no polygon source,
and 0% coordinate coverage (0 of 7,483 sold records have lat/lng).

## Decision

Adopt a three-tier architecture — homepage / neighbourhood hubs / VIP entities /
standard tier — backed by three first-class entities. Six decisions are locked:

1. **Migration target.** All WS3 migration/backfill/verification runs on a Neon
   branch of DB1 (`ws3-staging`, endpoint `ep-old-unit-aeyqkwyt`). No prod write
   until this ADR + verification are reviewed and promotion is explicitly approved.

2. **Cover every neighbourhood — no 12-cap.** Two content profiles:
   - `urban_hub` — full hub spec **with** VIP tier (top-20%-or-tied per pool).
   - `rural_hub` — shorter, character-led, **no** VIP tier.
   - `standard_no_hub` — entity/streets exist, no hub page (Derry Green).
   `kind` (geographic) and `profile` (content depth) may diverge: the two thin urban
   neighbourhoods (Milton North, Bronte Meadows) are `kind=urban` but `profile=rural_hub`.

3. **String-based neighbourhood assignment; geocoding parked.** Point-in-polygon is
   impossible today (no coordinates). Each entity is assigned via its dominant raw
   TREB neighbourhood string. `centroidLat/Lng/polygon` columns are nullable so a
   future enrichment workstream can layer polygons in without a schema migration.

4. **Condo building key = `(street_number, street_slug)`.** `condo_corp_number` is
   dirty/non-unique (490 Gordon Krantz shows 7 corp numbers; Leger Way uses the
   placeholder `99999`) so it is stored as an attribute array, not a key.
   `displayName` is populated = `buildingAddress` at backfill (no clean marketed-name
   field exists in MLS — `association_name` is corp-stub garbage: "HSCC"/"TBD"/"Unknown").

5. **VIP = top-20%-or-tied, per neighbourhood, per pool, recency-weighted SALE count.**
   Weights: ≤12mo 1.0 / 12–24mo 0.6 / 24–36mo 0.3 / >36mo 0.1. Sticky once earned
   (`isVip` + `vipEarnedAt`); `currentRank` refreshes each cycle (WS5 prominence).
   **Promote-both** at the cutoff value — all entities at/above the cutoff weighted
   value are VIP (no arbitrary tiebreak). Lease-only condo buildings are entities
   (standard tier) but never VIP (sale-only scoring).

6. **WS5 URL policy.** Existing `/streets/[slug]` URLs are preserved (content narrows
   to residential-only); condo towers get net-new `/condos/[slug]` URLs; no redirects.
   Guaranteed by `ResidentialStreet.slug == street_slug` (parallel join layer; no rename
   of StreetContent/StreetGeneration).

## Entities (DB1 `public`)

- **Neighbourhood** — `slug` canonical key; `rawStrings[]` holds every TREB variant
  that maps here (the Nassagaweya merge: "1041 - NA Rural Nassagaweya" + "Nassagaweya").
- **ResidentialStreet** — `slug == street_slug`; sale aggregates + VIP fields.
- **CondoBuilding** — extended from the unused 0-row model; `(streetNumber, streetSlug)`
  identity, `buildingAddress`/`displayName`, `condoCorpNumbers[]`, sale/lease counts, VIP.
- **UnmappedNeighbourhoodString** — append-only review queue; `resolveNeighbourhood()`
  writes here on an unmatched string (fail-loud) and never auto-creates a neighbourhood.

## Verified outcome (staging)

- 24 neighbourhoods (14 urban_hub + 9 rural_hub [7 rural + 2 thin urban] + 1 standard).
- 915 ResidentialStreet (732 For-Sale-bearing) — all 361 published slugs resolve, 0 orphans.
  <!-- CORRECTION (street audit 2026-07): 361 was the WS3-snapshot figure. LIVE counts
       are now 926 ResidentialStreet, 422 published StreetContent, 385 StreetGeneration
       succeeded. See docs/street-audit / feat/street-ingest-hardening. -->

- 108 CondoBuilding (47 sale-active + 61 lease-only/no-sale).
- VIP: 139 residential + 15 condo = 154. Promote-both fired in Dempsey (9→10) and Scott (10→11).

## Corrections to earlier locked numbers (evidence-backed)

- **Condo building count 142 → 108.** The locked 142 grouped by `(street_number,
  street_name)`; the raw `street_name` carries dirty direction tokens (one building
  `8010 Derry Rd` recorded as "Derry Rd / Derry Rd E / Derry Rd N / Derry Rd W"; garbage
  like "Gordon Krantz Ave Ave S", "E Main St E"). Canonical `street_slug` grouping
  de-duplicates these into 108 real buildings. 108 is the correct physical-building count.
- **Condo sale-active 54 → 47, lease-only 88 → 61** follows from the same canonical dedup.

## Known items deferred to later workstreams (do not fix in WS3)

- **361 published StreetContent rows vs 305 succeeded StreetGeneration.** 56 published
  pages render via a fallback/older path. WS5 reconciliation.
  <!-- CORRECTION (street audit 2026-07): live counts are now 422 published / 385 succeeded. -->

- **4 published-only residential streets have no neighbourhood** (`country-lane-court`,
  `kelso-road`, `french-gardens`, `wise-crossing-n-a`; the last is a malformed slug).
  No DB2 trades and null StreetContent.neighbourhood. Manual assignment / cleanup later.
- **Raw street names are cosmetically dirty** ("Farmstead. Dr", "Main St East", backtick
  "`whitlock Ave"). Display normalization (expandStreetName) deferred to WS4 content layer.
- **Pre-existing `ads.leads` schema drift** (table created via raw SQL) was intentionally
  EXCLUDED from the WS3 migration — unrelated, out of scope.
- **Prisma Rust engine cannot reach the Neon `ws3-staging` branch endpoint** (P1001) while
  the `pg` driver connects reliably; migration/backfill/verification therefore used `pg`,
  and the migration is recorded in `_prisma_migrations` with Prisma's checksum so prod
  promotion via `migrate deploy` stays consistent.
- **Local `next build` homepage `/` export** fails on `connection_limit=1` + an Upstash
  cache miss during static export (many parallel `prisma.listing` queries time out). This
  is pre-existing and environmental, not a WS3 regression (WS3 touches no homepage code).
