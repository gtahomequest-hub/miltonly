-- Street adjacency (physical intersection graph). Lateral links between street pages that
-- share an OSM road node — a real intersection, never inferred from proximity. Built and
-- refilled by scripts/build-street-adjacency.ts from milton-roads.geojson; a pure function
-- of the geometry + the published-slug set, so the table is truncated and rebuilt each run.
--
-- Directed edges (both a->b and b->a stored) so a page reads its neighbours with one indexed
-- lookup on streetSlug. connectedName is denormalised (the link label) to avoid a render-time
-- join.

-- CreateTable
CREATE TABLE "StreetAdjacency" (
    "id" TEXT NOT NULL,
    "streetSlug" TEXT NOT NULL,
    "connectedSlug" TEXT NOT NULL,
    "connectedName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreetAdjacency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StreetAdjacency_streetSlug_idx" ON "StreetAdjacency"("streetSlug");

-- CreateIndex
CREATE UNIQUE INDEX "StreetAdjacency_streetSlug_connectedSlug_key" ON "StreetAdjacency"("streetSlug", "connectedSlug");
