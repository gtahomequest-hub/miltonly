-- MC-015: the offset columns added earlier today are withdrawn before any row carried one.
-- *CapturedAt holds the capture instant; the wall clock is rendered in America/Toronto, where
-- every clip is filmed, so no per-row offset is stored (owner decision, task MC-015 prompt).
ALTER TABLE "public"."StreetContent" DROP COLUMN "videoCapturedOffsetMin";
ALTER TABLE "public"."StreetContent" DROP COLUMN "nightCapturedOffsetMin";
