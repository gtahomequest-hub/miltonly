-- Content tier: Market Watch weekly edition.
-- Additive only. No existing table is touched.

CREATE TABLE "public"."MarketEdition" (
    "id" TEXT NOT NULL,
    "weekOf" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "sectionsJson" JSONB NOT NULL,
    "summarySentence" TEXT NOT NULL,
    "interpretation" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketEdition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketEdition_weekOf_key" ON "public"."MarketEdition"("weekOf");
CREATE INDEX "MarketEdition_status_idx" ON "public"."MarketEdition"("status");
CREATE INDEX "MarketEdition_weekOf_idx" ON "public"."MarketEdition"("weekOf");

CREATE TABLE "public"."MarketEditionGeneration" (
    "id" TEXT NOT NULL,
    "weekOf" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'succeeded',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "inputJson" JSONB NOT NULL,
    "rawOutput" TEXT,
    "violationsJson" JSONB NOT NULL DEFAULT '[]',
    "provider" TEXT,
    "model" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "costUsd" DECIMAL(10,4),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketEditionGeneration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketEditionGeneration_weekOf_idx" ON "public"."MarketEditionGeneration"("weekOf");
CREATE INDEX "MarketEditionGeneration_status_idx" ON "public"."MarketEditionGeneration"("status");
