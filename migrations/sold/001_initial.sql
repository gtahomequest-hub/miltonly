-- Phase 1 migration: sold schema (DB2).
-- Applied via POST /api/admin/migrate?schema=sold with Authorization: Bearer <CRON_SECRET>.

CREATE SCHEMA IF NOT EXISTS sold;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tracking table for applied migrations on this schema.
CREATE TABLE IF NOT EXISTS sold._migrations (
  filename   TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- sold.sold_records
--
-- DO NOT DELETE FROM THIS TABLE. Historical sold records are the training set
-- for the DB4 prediction engine (Month 3). VOW compliance is enforced on
-- DISPLAY, not on storage — the read path filters sold_date >= NOW() - '90 days'
-- and perm_advertise = true. Records retained here forever.
--
-- Ingest ALL records from the VOW feed regardless of PermAdvertise/DisplayAddress.
-- The flags are stored on the row and re-checked on every read. This way a
-- flip from PermAdvertise=true → false (seller withdraws display consent) is
-- captured on the next ModificationTimestamp sync and honored automatically.
CREATE TABLE IF NOT EXISTS sold.sold_records (
  id                     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  mls_number             TEXT UNIQUE NOT NULL,
  address                TEXT NOT NULL,
  street_name            TEXT NOT NULL,
  street_slug            TEXT NOT NULL,
  neighbourhood          TEXT NOT NULL,
  city                   TEXT NOT NULL DEFAULT 'Milton',
  list_price             NUMERIC NOT NULL,
  sold_price             NUMERIC NOT NULL,
  sold_date              TIMESTAMPTZ NOT NULL,
  list_date              TIMESTAMPTZ NOT NULL,
  days_on_market         INTEGER NOT NULL,
  sold_to_ask_ratio      NUMERIC NOT NULL,
  beds                   INTEGER,
  baths                  NUMERIC,
  property_type          TEXT NOT NULL, -- detached|semi|townhouse|condo|other
  sqft_range             TEXT,
  lat                    NUMERIC,
  lng                    NUMERIC,
  display_address        BOOLEAN NOT NULL DEFAULT TRUE,  -- false → read path substitutes "Address withheld"
  perm_advertise         BOOLEAN NOT NULL DEFAULT TRUE,  -- false → read path excludes
  mls_status             TEXT NOT NULL DEFAULT 'Sold',   -- captures flips (e.g., deal collapse → Active)
  modification_timestamp TIMESTAMPTZ,                     -- cursor for incremental sync
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sold_street_slug     ON sold.sold_records(street_slug);
CREATE INDEX IF NOT EXISTS idx_sold_neighbourhood   ON sold.sold_records(neighbourhood);
CREATE INDEX IF NOT EXISTS idx_sold_date            ON sold.sold_records(sold_date DESC);
CREATE INDEX IF NOT EXISTS idx_sold_type            ON sold.sold_records(property_type);
CREATE INDEX IF NOT EXISTS idx_sold_city            ON sold.sold_records(city);
CREATE INDEX IF NOT EXISTS idx_sold_perm_advertise  ON sold.sold_records(perm_advertise);
CREATE INDEX IF NOT EXISTS idx_sold_status          ON sold.sold_records(mls_status);
CREATE INDEX IF NOT EXISTS idx_sold_modification    ON sold.sold_records(modification_timestamp DESC NULLS LAST);

-- sold.price_history
CREATE TABLE IF NOT EXISTS sold.price_history (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  mls_number         TEXT NOT NULL,
  event              TEXT NOT NULL, -- listed|price_change|sold|withdrawn
  price              NUMERIC NOT NULL,
  event_date         TIMESTAMPTZ NOT NULL,
  days_from_listing  INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_mls ON sold.price_history(mls_number);
