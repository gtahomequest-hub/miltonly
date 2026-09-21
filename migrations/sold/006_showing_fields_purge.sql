-- ============================================================================
-- 006_showing_fields_purge.sql
-- COMPLIANCE REMEDIATION (MC-036) — agent-only showing instructions retained in DB2.
--
-- REMEDIATION LOG (durable audit trail; this is the record, NOT the data):
--   Columns    : sold.sold_records.showing_requirements (text[], AMPRE ShowingRequirements,
--                e.g. {"Lockbox","Showing System"}) and showing_appointments (text, AMPRE
--                ShowingAppointments), plus the ShowingRequirements and ShowingAppointments keys
--                inside sold.sold_records.raw_vow_data (jsonb).
--   Rows       : showing_requirements NON-NULL = 8,649; showing_appointments NON-NULL = 1,852;
--                raw_vow_data carrying a ShowingRequirements key = 8,650 (read 2026-09-21).
--   Reason     : PropTx MLS Rules 8.23(b): instructions or remarks intended for co-operating
--                brokers only, such as those regarding showings and access to the property, may
--                not be made available to Consumers, and the July 2026 remediation (005) settled
--                that retention of such fields is itself the exposure. No reader under src/ ever
--                rendered these columns (verified 2026-09-21: zero references outside vow-sync).
--   Source     : stopped first (src/lib/vow-sync.ts, MC-036): both fields removed from the AMPRE
--                $select, both columns hard-nulled in the column map, both keys stripped from
--                the raw_vow_data blob, so this purge cannot refill.
--
-- !!! NOT YET EXECUTED — data-destructive; runs on PROD only after the requester's gate. !!!
-- Order: the source-stop (vow-sync.ts) is deployed FIRST, then this migration runs once.
-- ============================================================================

UPDATE sold.sold_records
   SET showing_requirements = NULL,
       showing_appointments = NULL,
       raw_vow_data = raw_vow_data - 'ShowingRequirements' - 'ShowingAppointments'
 WHERE showing_requirements IS NOT NULL
    OR showing_appointments IS NOT NULL
    OR raw_vow_data ? 'ShowingRequirements'
    OR raw_vow_data ? 'ShowingAppointments';

-- Confirm clean (expected 0, 0, 0):
-- SELECT COUNT(*) FILTER (WHERE showing_requirements IS NOT NULL),
--        COUNT(*) FILTER (WHERE showing_appointments IS NOT NULL),
--        COUNT(*) FILTER (WHERE raw_vow_data ? 'ShowingRequirements' OR raw_vow_data ? 'ShowingAppointments')
--   FROM sold.sold_records;
