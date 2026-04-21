-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('pending', 'generating', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "StreetGeneration" (
    "streetSlug" TEXT NOT NULL,
    "sectionsJson" JSONB NOT NULL,
    "faqJson" JSONB NOT NULL,
    "inputHash" TEXT NOT NULL,
    "status" "GenerationStatus" NOT NULL DEFAULT 'succeeded',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptCount" INTEGER NOT NULL,
    "wordCounts" JSONB NOT NULL,
    "totalWords" INTEGER NOT NULL,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "costUsd" DECIMAL(10,4),

    CONSTRAINT "StreetGeneration_pkey" PRIMARY KEY ("streetSlug")
);

-- CreateTable
CREATE TABLE "StreetGenerationReview" (
    "streetSlug" TEXT NOT NULL,
    "violations" JSONB NOT NULL,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastInputHash" TEXT NOT NULL,

    CONSTRAINT "StreetGenerationReview_pkey" PRIMARY KEY ("streetSlug")
);

-- CreateIndex
CREATE INDEX "StreetGeneration_status_idx" ON "StreetGeneration"("status");

-- CreateIndex
CREATE INDEX "StreetGeneration_generatedAt_idx" ON "StreetGeneration"("generatedAt");

-- CreateIndex
CREATE INDEX "StreetGenerationReview_lastAttemptAt_idx" ON "StreetGenerationReview"("lastAttemptAt");

