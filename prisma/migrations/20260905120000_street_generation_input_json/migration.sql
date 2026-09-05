-- StreetGeneration.inputJson: the generator input a generation was written from.
-- Nullable; pre-existing rows have no snapshot and are left null.
ALTER TABLE "public"."StreetGeneration" ADD COLUMN "inputJson" JSONB;
