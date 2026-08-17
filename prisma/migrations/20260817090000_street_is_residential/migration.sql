-- A street can be structurally non-residential, independently of whether anything has traded on it.
--
-- The 22 entities inside the Town of Milton's "401 Industrial Area" polygon are industrial road
-- stubs — industrial-drive, wheelabrator-way, market-drive, mcgeachie-drive, chisholm-drive — with
-- zero sold records, zero listings and no page. The surfacing rule promotes an entity the moment
-- it acquires activity, so a single industrial unit trading would have pulled all of them into
-- hero search, autocomplete and a hub street ladder as though they were residential streets.
--
-- isResidential is a property of the street, so the surfacing predicate tests it OUTSIDE the
-- activity OR rather than inside it. Additive and defaulted true: no existing row changes meaning.
--
-- The rows themselves are set by scripts/town/mark-non-residential.ts, which derives the list from
-- the polygon rather than hard-coding slugs.

ALTER TABLE "ResidentialStreet" ADD COLUMN "isResidential" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "ResidentialStreet_isResidential_idx" ON "ResidentialStreet"("isResidential");
