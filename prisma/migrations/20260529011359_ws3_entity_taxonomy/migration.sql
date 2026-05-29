-- WS3 three-tier entity taxonomy. Additive + non-destructive.
-- 3 CREATE TABLE (Neighbourhood, ResidentialStreet, UnmappedNeighbourhoodString)
-- + ALTER CondoBuilding (0-row table: add WS3 fields, relax legacy NOT NULLs).
-- NOTE: a pre-existing drift on ads.leads (created via raw SQL) was intentionally
-- EXCLUDED from this migration — it is unrelated to WS3 and out of scope.

-- AlterTable
ALTER TABLE "public"."CondoBuilding" ADD COLUMN     "buildingAddress" TEXT,
ADD COLUMN     "condoCorpNumbers" TEXT[],
ADD COLUMN     "currentRank" INTEGER,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "isVip" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastClassifiedAt" TIMESTAMP(3),
ADD COLUMN     "leaseCount12mo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "legalStories" INTEGER,
ADD COLUMN     "neighbourhoodAmbiguous" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "neighbourhoodId" TEXT,
ADD COLUMN     "recencyWeightedSold" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "saleCount12mo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "streetName" TEXT,
ADD COLUMN     "streetNumber" TEXT,
ADD COLUMN     "streetSlug" TEXT,
ADD COLUMN     "vipEarnedAt" TIMESTAMP(3),
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "address" DROP NOT NULL,
ALTER COLUMN "neighbourhood" DROP NOT NULL,
ALTER COLUMN "latitude" DROP NOT NULL,
ALTER COLUMN "longitude" DROP NOT NULL,
ALTER COLUMN "lastUpdated" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "public"."Neighbourhood" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rawStrings" TEXT[],
    "profile" TEXT NOT NULL DEFAULT 'urban_hub',
    "isHub" BOOLEAN NOT NULL DEFAULT true,
    "hasVipTier" BOOLEAN NOT NULL DEFAULT true,
    "kind" TEXT NOT NULL DEFAULT 'urban',
    "centroidLat" DOUBLE PRECISION,
    "centroidLng" DOUBLE PRECISION,
    "polygon" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Neighbourhood_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResidentialStreet" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "streetType" TEXT,
    "neighbourhoodId" TEXT,
    "neighbourhoodAmbiguous" BOOLEAN NOT NULL DEFAULT false,
    "soldCount12mo" INTEGER NOT NULL DEFAULT 0,
    "recencyWeightedSold" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isVip" BOOLEAN NOT NULL DEFAULT false,
    "vipEarnedAt" TIMESTAMP(3),
    "currentRank" INTEGER,
    "crossStreets" TEXT[],
    "lastClassifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResidentialStreet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UnmappedNeighbourhoodString" (
    "id" TEXT NOT NULL,
    "rawString" TEXT NOT NULL,
    "source" TEXT,
    "seenCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UnmappedNeighbourhoodString_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Neighbourhood_slug_key" ON "public"."Neighbourhood"("slug");

-- CreateIndex
CREATE INDEX "Neighbourhood_profile_idx" ON "public"."Neighbourhood"("profile");

-- CreateIndex
CREATE UNIQUE INDEX "ResidentialStreet_slug_key" ON "public"."ResidentialStreet"("slug");

-- CreateIndex
CREATE INDEX "ResidentialStreet_neighbourhoodId_idx" ON "public"."ResidentialStreet"("neighbourhoodId");

-- CreateIndex
CREATE INDEX "ResidentialStreet_isVip_idx" ON "public"."ResidentialStreet"("isVip");

-- CreateIndex
CREATE UNIQUE INDEX "UnmappedNeighbourhoodString_rawString_key" ON "public"."UnmappedNeighbourhoodString"("rawString");

-- CreateIndex
CREATE INDEX "UnmappedNeighbourhoodString_resolved_idx" ON "public"."UnmappedNeighbourhoodString"("resolved");

-- CreateIndex
CREATE INDEX "CondoBuilding_neighbourhoodId_idx" ON "public"."CondoBuilding"("neighbourhoodId");

-- CreateIndex
CREATE INDEX "CondoBuilding_streetSlug_idx" ON "public"."CondoBuilding"("streetSlug");

-- CreateIndex
CREATE INDEX "CondoBuilding_isVip_idx" ON "public"."CondoBuilding"("isVip");

-- AddForeignKey
ALTER TABLE "public"."ResidentialStreet" ADD CONSTRAINT "ResidentialStreet_neighbourhoodId_fkey" FOREIGN KEY ("neighbourhoodId") REFERENCES "public"."Neighbourhood"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CondoBuilding" ADD CONSTRAINT "CondoBuilding_neighbourhoodId_fkey" FOREIGN KEY ("neighbourhoodId") REFERENCES "public"."Neighbourhood"("id") ON DELETE SET NULL ON UPDATE CASCADE;
