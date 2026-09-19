-- MP-002, the door. Five nullable-or-defaulted columns on User; no data change.
-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "consentText" TEXT,
ADD COLUMN     "consentTimestamp" TIMESTAMP(3),
ADD COLUMN     "homeStreetSlug" TEXT,
ADD COLUMN     "verifyAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "verifyTokenHash" TEXT;

-- CreateIndex
CREATE INDEX "User_verifyTokenHash_idx" ON "public"."User"("verifyTokenHash");
