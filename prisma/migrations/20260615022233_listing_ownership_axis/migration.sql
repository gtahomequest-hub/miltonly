-- AlterTable
-- Additive ownership-type axis: 3 nullable columns on Listing. Existing rows
-- stay NULL until the next full TREB/PropTx sync re-stamps them. No data change,
-- no backfill, no impact on propertyType or any existing column/index.
ALTER TABLE "public"."Listing" ADD COLUMN     "parcelOfTiedLand" TEXT,
ADD COLUMN     "propertySubType" TEXT,
ADD COLUMN     "propertyTypeRaw" TEXT;
