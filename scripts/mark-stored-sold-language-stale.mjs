// Phase 2.6 follow-up — mark StreetContent rows with "sold price"-style
// narrative language as stale so the regenerate cron picks them up on
// its next pass.
//
// Staleness conditions required by makeStreetDecision in streetDecision.ts:
//   1. marketDataHash must differ from the recomputed hash   — we null it
//   2. generatedAt must be older than 30 days               — we push it
//                                                             back 35 days
//
// This script is idempotent. Running it twice is a no-op on already-marked rows.

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const PATTERNS = [
  "sold price",
  "sold for",
  "sold at",
  "sold homes",
  "sold vs asking",
  "sold-to-ask",
  "average sold",
  "median sold",
  "sold in the last",
];

const THIRTY_FIVE_DAYS_AGO = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);

async function main() {
  // Match on any of description/rawAiOutput/faqJson — catches every leak path
  // the regenerate cron could serve to a public user.
  const toMark = await prisma.streetContent.findMany({
    where: {
      OR: [
        ...PATTERNS.map((p) => ({ description:  { contains: p, mode: "insensitive" } })),
        ...PATTERNS.map((p) => ({ rawAiOutput:  { contains: p, mode: "insensitive" } })),
        ...PATTERNS.map((p) => ({ faqJson:      { contains: p, mode: "insensitive" } })),
      ],
    },
    select: { id: true, streetSlug: true },
  });

  console.log(`[stale-mark] Rows to mark stale: ${toMark.length}`);
  if (toMark.length === 0) {
    console.log("[stale-mark] Nothing to do.");
    return;
  }

  const ids = toMark.map((r) => r.id);
  const result = await prisma.streetContent.updateMany({
    where: { id: { in: ids } },
    data: {
      marketDataHash: null,
      generatedAt: THIRTY_FIVE_DAYS_AGO,
    },
  });

  console.log(`[stale-mark] Rows updated: ${result.count}`);
  console.log(`[stale-mark] First 5 marked slugs: ${toMark.slice(0, 5).map((r) => r.streetSlug).join(", ")}`);
  console.log(`[stale-mark] These rows will be regenerated on the next /api/sync/regenerate cron run`);
  console.log(`[stale-mark] (Sunday 12:00 UTC per vercel.json) or any manual /api/sync/generate trigger.`);
}

main().catch((e) => {
  console.error("[stale-mark] FAILED:", e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
