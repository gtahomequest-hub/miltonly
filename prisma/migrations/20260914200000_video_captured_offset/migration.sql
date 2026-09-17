-- StreetContent.videoCapturedOffsetMin / nightCapturedOffsetMin: the clip's local UTC offset in
-- minutes, so *CapturedAt can be a capture instant whose local wall clock is recoverable.
-- Nullable; rows written before this column are backfilled by scripts/backfill-video-captured.ts.
ALTER TABLE "public"."StreetContent" ADD COLUMN "videoCapturedOffsetMin" INTEGER;
ALTER TABLE "public"."StreetContent" ADD COLUMN "nightCapturedOffsetMin" INTEGER;
