-- Street video (PoC, 2026-08-30). Four nullable columns on StreetContent backing a
-- single-street visual/UX test on /streets/lemieux-court-milton.
--
-- Additive and nullable: every existing row keeps meaning, and a null column renders
-- nothing on the page (no placeholder). All four land together on purpose — night
-- footage is a confirmed second field (overnight parking, lighting, after-hours
-- character) and there is no point migrating twice. No backfill: the clip URLs are
-- written by hand once the files are uploaded to Vercel Blob.
--
-- Poster frame and duration are extracted from the clip offline (poster resolved by
-- blob-name convention at render time), so no columns are stored for them here.

-- AlterTable
ALTER TABLE "StreetContent" ADD COLUMN     "videoUrl" TEXT,
ADD COLUMN     "videoCapturedAt" TIMESTAMP(3),
ADD COLUMN     "nightVideoUrl" TEXT,
ADD COLUMN     "nightCapturedAt" TIMESTAMP(3);
