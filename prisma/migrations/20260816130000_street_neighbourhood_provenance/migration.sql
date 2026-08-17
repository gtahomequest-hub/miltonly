-- Provenance for ResidentialStreet.neighbourhoodId, and the span a straddling street records
-- instead of an assignment.
--
-- A neighbourhood read off an MLS record is a DECLARED fact; one derived from the Town of Milton
-- Neighbourhoods polygon layer is an INFERENCE about position. They can disagree —
-- kelso-road-milton is declared "Rural Milton West" by DB2 and computed "Nassagaweya" by geometry,
-- and the declared one is right — so the source is recorded at assignment time rather than
-- letting the two become indistinguishable in one column.
--
-- Additive only. Both columns are nullable/defaulted, no existing row changes meaning, and
-- nothing reads them for display in this pass.

ALTER TABLE "ResidentialStreet" ADD COLUMN "neighbourhoodSource" TEXT;
ALTER TABLE "ResidentialStreet" ADD COLUMN "neighbourhoodSpan" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "ResidentialStreet_neighbourhoodSource_idx" ON "ResidentialStreet"("neighbourhoodSource");

-- Backfill every EXISTING assignment as 'treb'. This is a statement of fact, not a default:
-- every write path that has ever set neighbourhoodId (registry-entity-backfill,
-- registry-cleanup-repair, ws5-fix-abbrev-slug-class, the vow-sync resolver) derives it from
-- Neighbourhood.rawStrings — i.e. from a TREB neighbourhood string on a real record. There is no
-- pre-existing geometric or manual assignment for this to mislabel.
UPDATE "ResidentialStreet" SET "neighbourhoodSource" = 'treb' WHERE "neighbourhoodId" IS NOT NULL;
