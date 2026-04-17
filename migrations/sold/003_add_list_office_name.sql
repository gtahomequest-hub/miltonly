-- Phase 2.5 migration: listing brokerage per sold record.
-- VOW agreement section 6.3(c) requires the listing Brokerage to be clearly
-- displayed for every Listing including thumbnails, in the same font/size as
-- the other Listing details and not visually separated. AMPRE exposes this
-- as `ListOfficeName` on the Property resource. Field already used by
-- detect/route.ts on the active-listings side.

ALTER TABLE sold.sold_records
  ADD COLUMN IF NOT EXISTS list_office_name TEXT;

CREATE INDEX IF NOT EXISTS idx_sold_list_office
  ON sold.sold_records(list_office_name);

COMMENT ON COLUMN sold.sold_records.list_office_name IS
  'TREB ListOfficeName — the Brokerage that held the original listing. VOW 6.3(c) requires this be displayed per record, not just per page.';
