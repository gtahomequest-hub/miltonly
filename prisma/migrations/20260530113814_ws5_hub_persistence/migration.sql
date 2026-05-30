-- CreateTable
CREATE TABLE "public"."HubGeneration" (
    "neighbourhoodSlug" TEXT NOT NULL,
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

    CONSTRAINT "HubGeneration_pkey" PRIMARY KEY ("neighbourhoodSlug")
);

-- CreateTable
CREATE TABLE "public"."HubContent" (
    "id" TEXT NOT NULL,
    "neighbourhoodSlug" TEXT NOT NULL,
    "neighbourhoodName" TEXT NOT NULL,
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

    CONSTRAINT "HubContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HubGeneration_status_idx" ON "public"."HubGeneration"("status");

-- CreateIndex
CREATE INDEX "HubGeneration_generatedAt_idx" ON "public"."HubGeneration"("generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HubContent_neighbourhoodSlug_key" ON "public"."HubContent"("neighbourhoodSlug");

