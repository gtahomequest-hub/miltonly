-- ============================================================================
-- 005_broker_remarks_purge.sql
-- COMPLIANCE REMEDIATION — VOW broker-only data retention purge.
--
-- REMEDIATION LOG (durable audit trail; this is the record, NOT the data):
--   Column     : sold.sold_records.broker_remarks   (AMPRE PrivateRemarks, text)
--                + the "PrivateRemarks" key retained inside sold.sold_records.raw_vow_data (jsonb)
--   Rows        : broker_remarks NON-NULL = 7,244 / 8,165 (89%) at verification time
--                 (of which ~1,009 rows' text mentions lockbox / showing / access-code language)
--                 raw_vow_data carrying a PrivateRemarks key = ~7,234 rows
--   Date        : 2026-07-26 (remediation authorized)
--   Reason      : VOW broker-only data retention remediation — broker_remarks (PrivateRemarks)
--                 held broker-only showing instructions and lockbox/access references, not licensed
--                 for retention under the PropTx/VOW data agreement, plus a security exposure
--                 (access-code language in free text). Source ingest was stopped first (vow-sync.ts:
--                 PrivateRemarks removed from the AMPRE $select; broker_remarks column hard-nulled;
--                 PrivateRemarks stripped from the raw_vow_data blob) so this purge cannot refill.
--   Note        : the incident description referenced a column "private_remarks" @ ~1,100 rows / 64%.
--                 VERIFIED: no private_remarks column exists — the broker-only column is
--                 broker_remarks @ 7,244 rows / 89%; ~1,009 rows carry lockbox/showing language
--                 (which is the likely source of the ~1,100 figure). Scope confirmed with the
--                 requester before execution.
--
-- !!! NOT YET EXECUTED — data-destructive; runs on PROD only after the requester's gate. !!!
-- Order: source-stop (vow-sync.ts, this branch) is deployed FIRST, then this migration runs.
-- ============================================================================

-- Purge the broker-only remark column across ALL rows (NULL, not selective — a regex over
-- free text from hundreds of agents cannot reliably catch every lockbox string, and a miss
-- leaves the retention violation while looking clean).
UPDATE sold.sold_records
   SET broker_remarks = NULL
 WHERE broker_remarks IS NOT NULL;

-- Also remove the retained PrivateRemarks key from the raw_vow_data catch-all blob, so the
-- broker-only data is not merely relocated (purge, not quarantine).
UPDATE sold.sold_records
   SET raw_vow_data = raw_vow_data - 'PrivateRemarks'
 WHERE raw_vow_data ? 'PrivateRemarks';

-- Optional stronger form (drop the column entirely instead of NULL). Safe: broker_remarks has
-- ZERO readers (only vow-sync writes it; it is not on the SoldRecord read type, not selected by
-- any input builder, dropped by sold-data.ts toListItem). Uncomment to DROP instead of NULL:
-- ALTER TABLE sold.sold_records DROP COLUMN IF EXISTS broker_remarks;
-- (If DROP is chosen, also remove "broker_remarks" from SOLD_RECORD_COLUMNS + the column map in
--  src/lib/vow-sync.ts, since the upsert would otherwise reference a non-existent column.)

-- CONFIRM CLEAN (run after the UPDATEs):
--   SELECT COUNT(*) FROM sold.sold_records WHERE broker_remarks IS NOT NULL;              -- expect 0
--   SELECT COUNT(*) FROM sold.sold_records WHERE raw_vow_data ? 'PrivateRemarks';         -- expect 0
