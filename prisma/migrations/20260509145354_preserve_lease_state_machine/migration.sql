-- AlterTable
ALTER TABLE "Listing" ADD COLUMN     "lastPriceChangeAt" TIMESTAMP(3),
ADD COLUMN     "leaseStatus" TEXT;

-- CreateIndex
CREATE INDEX "Listing_leaseStatus_idx" ON "Listing"("leaseStatus");
