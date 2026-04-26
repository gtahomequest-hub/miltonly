-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "gclid" TEXT,
ADD COLUMN     "ip" TEXT,
ADD COLUMN     "referrer" TEXT,
ADD COLUMN     "userAgent" TEXT,
ADD COLUMN     "utmContent" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Lead_gclid_idx" ON "Lead"("gclid");
