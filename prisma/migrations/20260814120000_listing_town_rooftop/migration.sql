-- Resolved municipal rooftop coordinate, from the Town of Milton Address Points layer.
-- Contains information licensed under the Open Government Licence – Milton.
--
-- NULLABLE ON PURPOSE. The existing latitude/longitude are non-nullable Float and carry 0/0 on
-- every row, because the sync wrote `item.Latitude || 0` and PropTx sends no coordinate. That is
-- the defect: `||` turned "unknown" into a valid position in the Gulf of Guinea. These columns
-- have no sentinel and no default — an address the Town has no point for stays NULL.
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "townLat" DOUBLE PRECISION;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "townLng" DOUBLE PRECISION;
