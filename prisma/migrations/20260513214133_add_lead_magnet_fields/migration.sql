-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "consentText" TEXT,
ADD COLUMN     "consentTimestamp" TIMESTAMP(3),
ADD COLUMN     "matchCriteria" JSONB,
ADD COLUMN     "yourHomeAddress" TEXT;
