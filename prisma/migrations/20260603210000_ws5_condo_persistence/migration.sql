-- CreateTable
CREATE TABLE "public"."CondoGeneration" (
    "buildingSlug" TEXT NOT NULL,
    "sectionsJson" JSONB NOT NULL,
    "faqJson" JSONB NOT NULL,
    "inputHash" TEXT NOT NULL,
    "status" "public"."GenerationStatus" NOT NULL DEFAULT 'succeeded',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptCount" INTEGER NOT NULL,
    "wordCounts" JSONB NOT NULL,
    "totalWords" INTEGER NOT NULL,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "costUsd" DECIMAL(10,4),

    CONSTRAINT "CondoGeneration_pkey" PRIMARY KEY ("buildingSlug")
);

-- CreateTable
CREATE TABLE "public"."CondoContent" (
    "id" TEXT NOT NULL,
    "buildingSlug" TEXT NOT NULL,
    "buildingName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rawAiOutput" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "needsReview" BOOLEAN NOT NULL DEFAULT true,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "marketDataHash" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "reviewNotes" TEXT,
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "faqJson" TEXT,
    "statsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CondoContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CondoGeneration_status_idx" ON "public"."CondoGeneration"("status");

-- CreateIndex
CREATE INDEX "CondoGeneration_generatedAt_idx" ON "public"."CondoGeneration"("generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CondoContent_buildingSlug_key" ON "public"."CondoContent"("buildingSlug");
