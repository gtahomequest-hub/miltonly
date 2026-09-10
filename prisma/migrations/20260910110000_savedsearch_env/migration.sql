-- Lead.env alone was not enough. A preview submission creates a SavedSearch, the alert cron
-- runs on production, and SavedSearch had no environment dimension — so a watch created by a
-- preview test would have been sent, daily, from production, to whatever address the test
-- used. Tagging the lead row excluded the test from the COUNTS and left it in the SENDS.
--
-- The sender now matches watches to the environment it is itself running in, so production
-- sends production watches and a preview deployment sends preview ones.
ALTER TABLE "SavedSearch" ADD COLUMN     "env" TEXT NOT NULL DEFAULT 'production';
CREATE INDEX "SavedSearch_env_alertEnabled_idx" ON "SavedSearch"("env", "alertEnabled");

-- The six rows that exist are all from the Phase 1 preview proof. Retag them so the very
-- first production cron run does not send to a test address.
UPDATE "SavedSearch" SET "env" = 'preview' WHERE "email" LIKE 'gtahomequest+p1-%';
