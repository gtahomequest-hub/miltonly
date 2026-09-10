-- DEC-PRICE-HISTORY (2026-09-10). Additive only: two nullable columns, no default,
-- no backfill, no index. Every existing row stays NULL, which is the honest state —
-- the prior price of a listing whose change was never observed is not knowable.
ALTER TABLE "Listing" ADD COLUMN "priorPrice" INTEGER;
ALTER TABLE "Listing" ADD COLUMN "priceChangedAt" TIMESTAMP(3);
