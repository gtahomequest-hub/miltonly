-- Organic Growth Loop piece 1 (SENSE): SEO opportunity queue + audit log +
-- sense-run metadata + coverage resume state. No changes to existing tables.

CREATE TABLE "SeoOpportunity" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'none',
    "entitySlug" TEXT,
    "targetPage" TEXT,
    "impressions" INTEGER NOT NULL,
    "clicks" INTEGER NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "senseRunId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoActionLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "opportunityId" TEXT,
    "detail" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoActionLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SenseRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "keywordRows" INTEGER NOT NULL DEFAULT 0,
    "coverageInspected" INTEGER NOT NULL DEFAULT 0,
    "coverageMode" TEXT NOT NULL DEFAULT 'light',
    "indexedCount" INTEGER,
    "error" TEXT,

    CONSTRAINT "SenseRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeoCoverageState" (
    "id" TEXT NOT NULL,
    "stateJson" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoCoverageState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SeoOpportunity_query_class_key" ON "SeoOpportunity"("query", "class");
CREATE INDEX "SeoOpportunity_status_idx" ON "SeoOpportunity"("status");
CREATE INDEX "SeoOpportunity_class_idx" ON "SeoOpportunity"("class");
CREATE INDEX "SeoActionLog_createdAt_idx" ON "SeoActionLog"("createdAt");
CREATE INDEX "SenseRun_startedAt_idx" ON "SenseRun"("startedAt");
