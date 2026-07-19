-- Organic Growth Loop piece 2 (DIGEST): week-over-week metric memory.
-- prev* columns on SeoOpportunity (shifted by sense on each new run) and
-- whole-property totals on SenseRun. Additive only.

ALTER TABLE "SeoOpportunity" ADD COLUMN "prevImpressions" INTEGER;
ALTER TABLE "SeoOpportunity" ADD COLUMN "prevClicks" INTEGER;
ALTER TABLE "SeoOpportunity" ADD COLUMN "prevPosition" DOUBLE PRECISION;

ALTER TABLE "SenseRun" ADD COLUMN "totalImpressions" INTEGER;
ALTER TABLE "SenseRun" ADD COLUMN "totalClicks" INTEGER;
