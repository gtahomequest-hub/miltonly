-- Phase 2.6 follow-up (2026-04-17) — null DB1 sold fields.
--
-- Rationale: Older IDX sync paths (now removed) populated Listing.soldPrice
-- and Listing.soldDate on DB1 rows whose MlsStatus flipped to "sold". VOW
-- compliance (see DO-NOT-REPEAT.md "VOW compliance enforced on display, never
-- on storage" + project-wide k-anonymity rule) requires sold data to live
-- exclusively in DB2 (sold.sold_records, Neon) where it is gated by VowGate,
-- fetcher-level session checks, and k=10 anonymity thresholds. Any
-- sold-price values sitting in DB1 are a legacy leak surface — they can be
-- read by numerous DB1-backed server components (schools, mosques, stats,
-- street-stats API, streetDecision, etc.) that lack the VOW gating applied
-- to DB2 paths.
--
-- This one-time UPDATE nulls the sold-derived columns on every affected
-- Listing row. The Listing.status column is left intact (it's used by
-- expiry logic and display-gate filtering). Running this does not affect
-- active listings, rental listings, or any sync pipeline.
--
-- Re-runnable: the WHERE clause is a no-op once all affected rows have
-- already been nulled, so repeated execution is safe.

UPDATE "Listing"
  SET "soldPrice" = NULL,
      "soldDate"  = NULL
  WHERE "soldPrice" IS NOT NULL
     OR "soldDate"  IS NOT NULL;
