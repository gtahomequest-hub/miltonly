-- MP-007, the PropTx standard: the erasure marker and the hard-throttle audit table. The
-- reviewer path (R-8.21) uses existing reviewFlag values ("reviewer-hold", "reviewer") and
-- needs no column. No data change.

-- AlterTable: when a consumer's erasure request was recorded (PIPEDA vs the 180-day rule).
ALTER TABLE "public"."User" ADD COLUMN     "erasureRequestedAt" TIMESTAMP(3);

-- CreateTable: one row per consumer/limit/window when the hard ceiling (R-8.13) is hit.
CREATE TABLE "public"."VowThrottle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "limit" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "max" INTEGER NOT NULL,
    "ip" TEXT,

    CONSTRAINT "VowThrottle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VowThrottle_userId_limit_at_idx" ON "public"."VowThrottle"("userId", "limit", "at" DESC);

-- CreateIndex
CREATE INDEX "VowThrottle_at_idx" ON "public"."VowThrottle"("at" DESC);

-- AddForeignKey
ALTER TABLE "public"."VowThrottle" ADD CONSTRAINT "VowThrottle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
