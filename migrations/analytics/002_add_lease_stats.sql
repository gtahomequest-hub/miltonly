-- Phase 1 migration 002: lease aggregate columns on street_sold_stats and
-- neighbourhood_sold_stats. Rents vary ~3x by bed count (a 1-bed condo at
-- $2,200 vs a 4-bed detached at $6,500), so per-bed-count breakdown is the
-- honest unit for rental comparables. Sale analytics already break down by
-- property type (detached/semi/town/condo) so sale columns are unchanged.

ALTER TABLE analytics.street_sold_stats
  ADD COLUMN IF NOT EXISTS avg_leased_price       NUMERIC,
  ADD COLUMN IF NOT EXISTS avg_leased_price_1bed  NUMERIC,
  ADD COLUMN IF NOT EXISTS avg_leased_price_2bed  NUMERIC,
  ADD COLUMN IF NOT EXISTS avg_leased_price_3bed  NUMERIC,
  ADD COLUMN IF NOT EXISTS avg_leased_price_4bed  NUMERIC,
  ADD COLUMN IF NOT EXISTS leased_count_90days    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leased_count_12months  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_lease_dom          NUMERIC;

ALTER TABLE analytics.neighbourhood_sold_stats
  ADD COLUMN IF NOT EXISTS avg_leased_price       NUMERIC,
  ADD COLUMN IF NOT EXISTS avg_leased_price_1bed  NUMERIC,
  ADD COLUMN IF NOT EXISTS avg_leased_price_2bed  NUMERIC,
  ADD COLUMN IF NOT EXISTS avg_leased_price_3bed  NUMERIC,
  ADD COLUMN IF NOT EXISTS avg_leased_price_4bed  NUMERIC,
  ADD COLUMN IF NOT EXISTS leased_count_90days    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS leased_count_12months  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_lease_dom          NUMERIC;

COMMENT ON COLUMN analytics.street_sold_stats.avg_sold_price IS
  'Average SALE price (For Sale rows only, 90-day window). For rent data see avg_leased_price_* columns.';
COMMENT ON COLUMN analytics.street_sold_stats.avg_leased_price IS
  'Average monthly rent across all bed counts, 90-day window. Use avg_leased_price_<N>bed for accurate comps — rents vary ~3x by bed count.';

COMMENT ON COLUMN analytics.neighbourhood_sold_stats.avg_sold_detached IS
  'Average SALE price of detached homes (For Sale rows only, 90-day window).';
COMMENT ON COLUMN analytics.neighbourhood_sold_stats.avg_leased_price IS
  'Average monthly rent across all bed counts, 90-day window. Use avg_leased_price_<N>bed for accurate comps.';
