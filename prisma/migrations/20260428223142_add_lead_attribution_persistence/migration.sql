-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "firstVisitAt" TIMESTAMP(3),
ADD COLUMN     "gclidLast" TEXT,
ADD COLUMN     "landingPage" TEXT,
ADD COLUMN     "utmCampaignLast" TEXT,
ADD COLUMN     "utmContentLast" TEXT,
ADD COLUMN     "utmMediumLast" TEXT,
ADD COLUMN     "utmSourceLast" TEXT,
ADD COLUMN     "utmTermLast" TEXT;
