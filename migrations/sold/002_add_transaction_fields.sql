-- Phase 1 migration 002: transaction_type + standard_status on sold.sold_records.
--
-- Confirmed via /api/sync/sold/test probe D (2026-04-16):
--   TransactionType values returned by AMPRE: 'For Sale', 'For Lease'
--   MlsStatus values: 'Sold' (for sale rows), 'Leased' (for lease rows)
--   StandardStatus: 'Closed' (RESO-normalized, same for both)
-- CHECK constraint uses the exact TREB-returned strings.

ALTER TABLE sold.sold_records
  ADD COLUMN IF NOT EXISTS transaction_type TEXT
    CHECK (transaction_type IN ('For Sale', 'For Lease'));

ALTER TABLE sold.sold_records
  ADD COLUMN IF NOT EXISTS standard_status TEXT;

CREATE INDEX IF NOT EXISTS idx_sold_transaction_type
  ON sold.sold_records(transaction_type);

CREATE INDEX IF NOT EXISTS idx_sold_standard_status
  ON sold.sold_records(standard_status);

-- Document dual-purpose of the table so no future code assumes sales-only.
-- Sales and leases have different price scales ($1M vs $3K) — averaging them
-- together produces nonsense. Always filter by transaction_type first.
COMMENT ON TABLE sold.sold_records IS
  'Closed TREB VOW transactions — both sales and leases. ALWAYS filter on transaction_type before aggregating price data. Sales (For Sale) and leases (For Lease) have different price scales and must not be averaged together.';

COMMENT ON COLUMN sold.sold_records.transaction_type IS
  'TREB TransactionType. Exactly ''For Sale'' or ''For Lease''. CHECK constrained.';

COMMENT ON COLUMN sold.sold_records.standard_status IS
  'RESO StandardStatus. Typically ''Closed'' for every row in this table (both sales and leases).';

COMMENT ON COLUMN sold.sold_records.mls_status IS
  'TREB MlsStatus. ''Sold'' for sale rows, ''Leased'' for lease rows.';

COMMENT ON COLUMN sold.sold_records.sold_price IS
  'For Sale: final sale price in CAD. For Lease: monthly rent in CAD. Always filter by transaction_type before aggregating.';

COMMENT ON COLUMN sold.sold_records.list_price IS
  'For Sale: original list price in CAD. For Lease: asking monthly rent in CAD.';

COMMENT ON COLUMN sold.sold_records.sold_date IS
  'For Sale: close/sale date. For Lease: lease commencement / close date. Maps from AMPRE CloseDate.';
