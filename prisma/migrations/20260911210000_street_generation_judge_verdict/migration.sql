-- StreetGeneration.judgeVerdict: the fair-housing judge verdict for the run, { result, round, rounds[] }.
-- Nullable; rows written before this column have no verdict and are left null.
ALTER TABLE "public"."StreetGeneration" ADD COLUMN "judgeVerdict" JSONB;
