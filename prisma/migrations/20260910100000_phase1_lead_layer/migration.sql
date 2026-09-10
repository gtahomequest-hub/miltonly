-- Phase 1, the lead layer. Every statement is additive and backward compatible:
-- production is running the previous code against this same database while this
-- migration is applied, so nothing may drop, rename, or tighten an existing column.

-- Lead.env — which deployment produced the row. Preview and production share one
-- database; without this a preview test is indistinguishable from a real lead.
-- The default is 'production' so the rows that existed before keep their meaning.
ALTER TABLE "Lead" ADD COLUMN     "env" TEXT NOT NULL DEFAULT 'production';

CREATE INDEX "Lead_env_createdAt_idx" ON "Lead"("env", "createdAt" DESC);
CREATE INDEX "Lead_landingPage_idx" ON "Lead"("landingPage");

-- SavedSearch — an alert signup captures an email and nothing else, so a saved search
-- must be able to exist without a User row. userId becomes nullable and `email` carries
-- the address in that case. Every pre-existing row keeps its userId.
ALTER TABLE "SavedSearch" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "SavedSearch" ADD COLUMN     "email" TEXT;
ALTER TABLE "SavedSearch" ADD COLUMN     "leadId" TEXT;
ALTER TABLE "SavedSearch" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'listing';

CREATE INDEX "SavedSearch_kind_idx" ON "SavedSearch"("kind");
CREATE INDEX "SavedSearch_email_idx" ON "SavedSearch"("email");
CREATE INDEX "SavedSearch_leadId_idx" ON "SavedSearch"("leadId");

-- The FK was created with ON DELETE RESTRICT, which is not valid for a nullable
-- column that is deliberately null on lead-created rows. SET NULL is the correct
-- behaviour: deleting a User must not delete the watch history.
ALTER TABLE "SavedSearch" DROP CONSTRAINT "SavedSearch_userId_fkey";
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Leads per page. A VIEW, not a table: there is nothing to write that Lead does not
-- already hold, and a table would be a second copy of the same fact that can drift.
-- `page` is the pathname only — host and query stripped — so the same page reached
-- through an ad, a preview host and the apex aggregates into one row.
-- Preview and development rows are excluded here, once, so no caller can forget to.
CREATE OR REPLACE VIEW public.lead_daily_by_page AS
SELECT
  CASE
    WHEN COALESCE(NULLIF("landingPage", ''), '') = '' THEN '(not recorded)'
    ELSE split_part(
           regexp_replace(COALESCE(NULLIF("landingPage", ''), ''), '^https?://[^/]+', ''),
           '?', 1)
  END                                   AS page,
  "source"                              AS source,
  ("createdAt" AT TIME ZONE 'UTC')::date AS day,
  COUNT(*)::int                         AS leads
FROM public."Lead"
WHERE "env" = 'production'
GROUP BY 1, 2, 3;

COMMENT ON VIEW public.lead_daily_by_page IS
  'Leads per page per day, production only. Written by no one; derived from public."Lead". Read by scripts/leads-report.ts.';
