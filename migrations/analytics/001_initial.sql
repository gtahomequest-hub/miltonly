-- Phase 1 migration: analytics schema (DB3).
-- Applied via POST /api/admin/migrate?schema=analytics with Authorization: Bearer <CRON_SECRET>.

CREATE SCHEMA IF NOT EXISTS analytics;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS analytics._migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- analytics.street_sold_stats
-- market_temperature: enum-like check constraint enforced at the database level.
-- peak_month: 1-12 calendar month with the highest sold count over the last 12 months.
CREATE TABLE IF NOT EXISTS analytics.street_sold_stats (
  street_slug         TEXT PRIMARY KEY,
  avg_sold_price      NUMERIC,
  median_sold_price   NUMERIC,
  avg_list_price      NUMERIC,
  avg_dom             NUMERIC,
  avg_sold_to_ask     NUMERIC,
  sold_count_90days   INTEGER NOT NULL DEFAULT 0,
  sold_count_12months INTEGER NOT NULL DEFAULT 0,
  price_change_yoy    NUMERIC,
  peak_month          INTEGER CHECK (peak_month BETWEEN 1 AND 12),
  market_temperature  TEXT    CHECK (market_temperature IN ('hot', 'warm', 'balanced', 'cool', 'cold')),
  last_updated        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- analytics.neighbourhood_sold_stats
-- market_score: 0-100 scale, enforced at the database level.
CREATE TABLE IF NOT EXISTS analytics.neighbourhood_sold_stats (
  neighbourhood       TEXT PRIMARY KEY,
  avg_sold_detached   NUMERIC,
  avg_sold_semi       NUMERIC,
  avg_sold_town       NUMERIC,
  avg_sold_condo      NUMERIC,
  avg_dom             NUMERIC,
  avg_sold_to_ask     NUMERIC,
  sold_count_90days   INTEGER NOT NULL DEFAULT 0,
  sold_count_12months INTEGER NOT NULL DEFAULT 0,
  price_change_yoy    NUMERIC,
  market_score        NUMERIC CHECK (market_score >= 0 AND market_score <= 100),
  last_updated        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- analytics.listing_scores
-- Per-active-listing scores. Computed by a later phase (scoring pipeline not in Phase 1).
-- Phase 1 creates the table so downstream code can reference it.
CREATE TABLE IF NOT EXISTS analytics.listing_scores (
  mls_number                 TEXT PRIMARY KEY,
  value_score                NUMERIC,
  commute_score              NUMERIC,
  school_score               NUMERIC,
  mosque_score               NUMERIC,
  investor_score             NUMERIC,
  price_vs_street_pct        NUMERIC,
  price_vs_neighbourhood_pct NUMERIC,
  estimated_rent             NUMERIC,
  gross_yield                NUMERIC,
  monthly_mortgage           NUMERIC,
  monthly_net_cashflow       NUMERIC,
  last_updated               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- analytics.street_monthly_stats
CREATE TABLE IF NOT EXISTS analytics.street_monthly_stats (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  street_slug     TEXT NOT NULL,
  year            INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  avg_sold_price  NUMERIC,
  sold_count      INTEGER NOT NULL DEFAULT 0,
  avg_dom         NUMERIC,
  avg_sold_to_ask NUMERIC,
  UNIQUE (street_slug, year, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_street ON analytics.street_monthly_stats(street_slug);
CREATE INDEX IF NOT EXISTS idx_monthly_date   ON analytics.street_monthly_stats(year, month);

-- analytics.neighbourhood_monthly_stats
CREATE TABLE IF NOT EXISTS analytics.neighbourhood_monthly_stats (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  neighbourhood  TEXT NOT NULL,
  year           INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month          INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  avg_sold_price NUMERIC,
  sold_count     INTEGER NOT NULL DEFAULT 0,
  avg_dom        NUMERIC,
  UNIQUE (neighbourhood, year, month)
);
