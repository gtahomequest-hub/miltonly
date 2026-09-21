-- MP-006, the PropTx VOW Best Practices: the consent history, the access trail, the registrant
-- answer, the review flag and the terms version. No data change.
-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "isRegistrant" BOOLEAN,
ADD COLUMN     "registrantAt" TIMESTAMP(3),
ADD COLUMN     "reviewFlag" TEXT,
ADD COLUMN     "reviewFlaggedAt" TIMESTAMP(3),
ADD COLUMN     "vowAcknowledgementVersion" INTEGER;

-- CreateTable
CREATE TABLE "public"."VowConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "VowConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VowAccessLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "scope" TEXT,
    "path" TEXT,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "VowAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VowConsent_userId_at_idx" ON "public"."VowConsent"("userId", "at" DESC);

-- CreateIndex
CREATE INDEX "VowAccessLog_userId_at_idx" ON "public"."VowAccessLog"("userId", "at" DESC);

-- CreateIndex
CREATE INDEX "VowAccessLog_at_idx" ON "public"."VowAccessLog"("at" DESC);

-- CreateIndex
CREATE INDEX "VowAccessLog_kind_at_idx" ON "public"."VowAccessLog"("kind", "at" DESC);

-- CreateIndex
CREATE INDEX "User_reviewFlag_idx" ON "public"."User"("reviewFlag");

-- AddForeignKey
ALTER TABLE "public"."VowConsent" ADD CONSTRAINT "VowConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."VowAccessLog" ADD CONSTRAINT "VowAccessLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
