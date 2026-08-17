-- Drop ResidentialStreet.hasPublishedPage.
--
-- It was a denormalised copy of StreetContent.status with no maintenance mechanism:
-- generateStreet.ts — the only path that publishes a street page — wrote StreetContent.status and
-- publishedAt and never touched the flag, while three hand-run scripts set it. It had drifted on 6
-- rows, every one a street with a live published page the flag called unpublished, and that drift
-- is what let a geometric neighbourhood assignment reach a live page during the join work.
--
-- src/lib/streetSurface.ts derives publication from StreetContent on every call, and the derived
-- predicate was proved to reproduce the reconciled flag exactly (738 = 738, 0 gained, 0 lost)
-- before this ran. That equality is what licensed the drop.
--
-- ORDERING, WHICH IS THE WHOLE RISK HERE: one Neon instance serves production and every preview,
-- so this must run AFTER a build that no longer selects the column is live. It was: production
-- deployment miltonly-pywn5nx2m (main d640075) was serving before this migration was applied, and
-- its server bundle contains zero references to hasPublishedPage while referencing
-- recencyWeightedSold and isResidential — the two columns the replacement predicate does use.
--
-- Irreversible by design. There is nothing to restore: the fact lives in StreetContent.

DROP INDEX IF EXISTS "ResidentialStreet_hasPublishedPage_idx";

ALTER TABLE "ResidentialStreet" DROP COLUMN "hasPublishedPage";
