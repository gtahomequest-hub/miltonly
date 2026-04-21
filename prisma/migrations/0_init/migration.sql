-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "mlsNumber" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "streetSlug" TEXT NOT NULL,
    "neighbourhood" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'Milton',
    "price" INTEGER NOT NULL,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" DOUBLE PRECISION NOT NULL,
    "parking" INTEGER NOT NULL,
    "basement" BOOLEAN NOT NULL,
    "sqft" INTEGER,
    "propertyType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "soldPrice" INTEGER,
    "soldDate" TIMESTAMP(3),
    "daysOnMarket" INTEGER,
    "photos" TEXT[],
    "description" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "schoolZone" TEXT,
    "goWalkMinutes" INTEGER,
    "condoBuilding" TEXT,
    "maintenanceFee" INTEGER,
    "lotSize" TEXT,
    "lotDepth" DOUBLE PRECISION,
    "lotWidth" DOUBLE PRECISION,
    "garageType" TEXT,
    "heatSource" TEXT,
    "roof" TEXT,
    "foundation" TEXT,
    "construction" TEXT,
    "exteriorFeatures" TEXT[],
    "interiorFeatures" TEXT[],
    "fireplace" BOOLEAN NOT NULL DEFAULT false,
    "architecturalStyle" TEXT,
    "approximateAge" TEXT,
    "taxAmount" DOUBLE PRECISION,
    "taxYear" INTEGER,
    "maintenanceFeeAmt" DOUBLE PRECISION,
    "directionFaces" TEXT,
    "crossStreet" TEXT,
    "sewer" TEXT,
    "waterSource" TEXT,
    "virtualTourUrl" TEXT,
    "listOfficeName" TEXT,
    "totalRooms" INTEGER,
    "kitchens" INTEGER,
    "transactionType" TEXT,
    "petsAllowed" TEXT,
    "rentIncludes" TEXT[],
    "laundryFeatures" TEXT,
    "cooling" TEXT,
    "heatType" TEXT,
    "furnished" TEXT,
    "possessionDetails" TEXT,
    "minLeaseTerm" INTEGER,
    "locker" TEXT,
    "permAdvertise" BOOLEAN NOT NULL DEFAULT true,
    "displayAddress" BOOLEAN NOT NULL DEFAULT true,
    "listedAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "streetName" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "intent" TEXT NOT NULL,
    "score" TEXT NOT NULL,
    "scorePoints" INTEGER NOT NULL DEFAULT 0,
    "hasAgent" BOOLEAN,
    "isAgent" BOOLEAN,
    "street" TEXT,
    "bedrooms" INTEGER,
    "bathrooms" DOUBLE PRECISION,
    "parking" INTEGER,
    "basement" BOOLEAN,
    "timeline" TEXT,
    "priceRangeMin" INTEGER,
    "priceRangeMax" INTEGER,
    "neighbourhoods" TEXT[],
    "propertyType" TEXT,
    "condoBuilding" TEXT,
    "savedListings" TEXT[],
    "comparisonsMade" TEXT[],
    "source" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmKeyword" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastContactAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "cookieId" TEXT,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorProfile" (
    "id" TEXT NOT NULL,
    "cookieId" TEXT NOT NULL,
    "viewedListings" TEXT[],
    "savedListings" TEXT[],
    "pillsClicked" TEXT[],
    "comparisonsMade" TEXT[],
    "streetsPreviewed" TEXT[],
    "buildingsPreviewed" TEXT[],
    "priceRangeMin" INTEGER,
    "priceRangeMax" INTEGER,
    "preferredNeighbourhoods" TEXT[],
    "propertyType" TEXT,
    "bedrooms" INTEGER,
    "intent" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "searchCount" INTEGER NOT NULL DEFAULT 0,
    "timeOnSiteSeconds" INTEGER NOT NULL DEFAULT 0,
    "lastVisit" TIMESTAMP(3) NOT NULL,
    "firstVisit" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leadId" TEXT,

    CONSTRAINT "VisitorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CondoBuilding" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "neighbourhood" TEXT NOT NULL,
    "yearBuilt" INTEGER,
    "totalUnits" INTEGER,
    "managementCo" TEXT,
    "amenities" TEXT[],
    "petFriendly" BOOLEAN,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "goWalkMinutes" INTEGER,
    "avgSalePrice1bd" INTEGER,
    "avgSalePrice2bd" INTEGER,
    "avgSalePrice3bd" INTEGER,
    "avgRent1bd" INTEGER,
    "avgRent2bd" INTEGER,
    "avgRent3bd" INTEGER,
    "avgMaintenanceFee" INTEGER,
    "ownerRatioPct" DOUBLE PRECISION,
    "avgCapRate" DOUBLE PRECISION,
    "priceGrowth1yr" DOUBLE PRECISION,
    "activeForSale" INTEGER NOT NULL DEFAULT 0,
    "activeForRent" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CondoBuilding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreetContent" (
    "id" TEXT NOT NULL,
    "streetSlug" TEXT NOT NULL,
    "streetName" TEXT NOT NULL,
    "neighbourhood" TEXT,
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
    "isVipHub" BOOLEAN NOT NULL DEFAULT false,
    "vipHubAt" TIMESTAMP(3),
    "vipDescription" TEXT,
    "vipFaqJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreetContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StreetQueue" (
    "id" TEXT NOT NULL,
    "streetSlug" TEXT NOT NULL,
    "streetName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreetQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "website" TEXT,
    "bio" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExclusiveListing" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "priceType" TEXT NOT NULL DEFAULT 'sale',
    "bedsMin" INTEGER NOT NULL,
    "bedsMax" INTEGER NOT NULL DEFAULT 0,
    "baths" INTEGER NOT NULL,
    "parking" INTEGER NOT NULL DEFAULT 0,
    "propertyType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "badge" TEXT NOT NULL DEFAULT 'Exclusive',
    "description" TEXT NOT NULL,
    "photos" TEXT[],
    "slug" TEXT NOT NULL,
    "sqft" INTEGER,
    "yearBuilt" INTEGER,
    "lotSize" TEXT,
    "maintenance" INTEGER,
    "taxes" INTEGER,
    "taxYear" INTEGER,
    "heating" TEXT,
    "cooling" TEXT,
    "basement" TEXT,
    "garage" TEXT,
    "exterior" TEXT,
    "locker" TEXT,
    "exposure" TEXT,
    "petFriendly" BOOLEAN,
    "interiorFeatures" TEXT[],
    "exteriorFeatures" TEXT[],
    "rooms" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExclusiveListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceLog" (
    "id" TEXT NOT NULL,
    "checkDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiCompliance" BOOLEAN NOT NULL,
    "dataRetrieval" BOOLEAN NOT NULL,
    "listingExpiry" BOOLEAN NOT NULL,
    "displayPerms" BOOLEAN NOT NULL,
    "consentCheck" BOOLEAN NOT NULL,
    "allPassed" BOOLEAN NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "phone" TEXT,
    "verifyCode" TEXT,
    "verifyExpiry" TIMESTAMP(3),
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "savedListings" TEXT[],
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),
    "vowAcknowledgedAt" TIMESTAMP(3),
    "vowAcknowledgementText" TEXT,
    "vowAcknowledgementIp" TEXT,
    "vowAcknowledgementUserAgent" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "propertyType" TEXT,
    "neighbourhood" TEXT,
    "streetSlug" TEXT,
    "priceMin" INTEGER,
    "priceMax" INTEGER,
    "bedsMin" INTEGER,
    "bathsMin" INTEGER,
    "transactionType" TEXT,
    "alertEnabled" BOOLEAN NOT NULL DEFAULT true,
    "alertFrequency" TEXT NOT NULL DEFAULT 'daily',
    "lastAlertAt" TIMESTAMP(3),
    "lastMatchCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Listing_mlsNumber_key" ON "Listing"("mlsNumber");

-- CreateIndex
CREATE INDEX "Listing_streetSlug_idx" ON "Listing"("streetSlug");

-- CreateIndex
CREATE INDEX "Listing_syncedAt_idx" ON "Listing"("syncedAt");

-- CreateIndex
CREATE INDEX "Listing_neighbourhood_idx" ON "Listing"("neighbourhood");

-- CreateIndex
CREATE INDEX "Listing_status_idx" ON "Listing"("status");

-- CreateIndex
CREATE INDEX "Listing_propertyType_idx" ON "Listing"("propertyType");

-- CreateIndex
CREATE INDEX "Listing_price_idx" ON "Listing"("price");

-- CreateIndex
CREATE INDEX "Listing_transactionType_idx" ON "Listing"("transactionType");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_intent_idx" ON "Lead"("intent");

-- CreateIndex
CREATE INDEX "Lead_score_idx" ON "Lead"("score");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "VisitorProfile_cookieId_key" ON "VisitorProfile"("cookieId");

-- CreateIndex
CREATE UNIQUE INDEX "CondoBuilding_slug_key" ON "CondoBuilding"("slug");

-- CreateIndex
CREATE INDEX "CondoBuilding_neighbourhood_idx" ON "CondoBuilding"("neighbourhood");

-- CreateIndex
CREATE UNIQUE INDEX "StreetContent_streetSlug_key" ON "StreetContent"("streetSlug");

-- CreateIndex
CREATE UNIQUE INDEX "StreetQueue_streetSlug_key" ON "StreetQueue"("streetSlug");

-- CreateIndex
CREATE UNIQUE INDEX "ExclusiveListing_slug_key" ON "ExclusiveListing"("slug");

-- CreateIndex
CREATE INDEX "ComplianceLog_checkDate_idx" ON "ComplianceLog"("checkDate");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "SavedSearch_userId_idx" ON "SavedSearch"("userId");

-- CreateIndex
CREATE INDEX "SavedSearch_alertEnabled_idx" ON "SavedSearch"("alertEnabled");

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

