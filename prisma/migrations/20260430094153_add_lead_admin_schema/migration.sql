-- DropIndex
DROP INDEX "Lead_createdAt_idx";

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "firstPage" TEXT,
ADD COLUMN     "internalReferrer" TEXT,
ADD COLUMN     "isQualified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leadStatus" TEXT DEFAULT 'New',
ADD COLUMN     "leadTemperatureAtSubmit" TEXT,
ADD COLUMN     "qualificationReason" TEXT;

-- CreateTable
CREATE TABLE "LeadActivity" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadActivity_leadId_createdAt_idx" ON "LeadActivity"("leadId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LeadActivity_type_createdAt_idx" ON "LeadActivity"("type", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LeadActivity_createdAt_idx" ON "LeadActivity"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Lead_leadStatus_createdAt_idx" ON "Lead"("leadStatus", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Lead_isQualified_createdAt_idx" ON "Lead"("isQualified", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Lead_source_createdAt_idx" ON "Lead"("source", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Lead_leadTemperatureAtSubmit_createdAt_idx" ON "Lead"("leadTemperatureAtSubmit", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Lead_leadStatus_isQualified_createdAt_idx" ON "Lead"("leadStatus", "isQualified", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Lead_source_leadStatus_createdAt_idx" ON "Lead"("source", "leadStatus", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
