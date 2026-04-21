// Phase 2.6 follow-up spot-check — pick 3 stale slugs, show their current
// sold-language description, insert StreetQueue entries so the generate
// endpoint will process them, then the caller triggers /api/sync/generate
// manually via curl and re-runs this script with a --verify flag to see
// the new text.

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const SLUGS_TO_TEST = [
  "main-street-milton",
  "ontario-street-milton",
  "reece-court-milton",
];

async function main() {
  const mode = process.argv[2] === "--verify" ? "verify" : "queue";

  for (const slug of SLUGS_TO_TEST) {
    const row = await prisma.streetContent.findUnique({
      where: { streetSlug: slug },
      select: {
        streetSlug: true,
        streetName: true,
        description: true,
        status: true,
        generatedAt: true,
        marketDataHash: true,
      },
    });

    if (!row) {
      console.log(`\n[${slug}] NOT FOUND in StreetContent`);
      continue;
    }

    // Check current description for sold-language hits
    const desc = row.description ?? "";
    const hits = [
      "sold price",
      "sold for",
      "sold at",
      "sold homes",
      "sold vs asking",
      "sold-to-ask",
      "average sold",
      "median sold",
    ].filter((p) => desc.toLowerCase().includes(p));

    console.log(`\n=== ${slug} (${row.streetName}) ===`);
    console.log(`  status:          ${row.status}`);
    console.log(`  generatedAt:     ${row.generatedAt.toISOString()}`);
    console.log(`  marketDataHash:  ${row.marketDataHash ?? "NULL (stale)"}`);
    console.log(`  sold-language hits in description: ${hits.length > 0 ? hits.join(", ") : "none"}`);
    if (hits.length > 0) {
      // Print the offending sentence(s)
      const sentences = desc.split(/[.!?]\s+/);
      const offending = sentences.filter((s) => hits.some((h) => s.toLowerCase().includes(h)));
      offending.slice(0, 2).forEach((s) => console.log(`    > "${s.trim()}..."`));
    }
  }

  if (mode === "queue") {
    console.log(`\n[queue] Inserting StreetQueue entries for ${SLUGS_TO_TEST.length} slugs...`);
    for (const slug of SLUGS_TO_TEST) {
      const row = await prisma.streetContent.findUnique({ where: { streetSlug: slug } });
      if (!row) continue;
      await prisma.streetQueue.upsert({
        where: { streetSlug: slug },
        create: {
          streetSlug: slug,
          streetName: row.streetName,
          status: "pending",
          attempts: 0,
        },
        update: {
          status: "pending",
          attempts: 0,
          lastError: null,
        },
      });
    }
    console.log(`[queue] Done. Now run:`);
    console.log(`  curl -X POST "https://miltonly.com/api/sync/generate?secret=miltonly-cron-2026"`);
    console.log(`  # wait ~30-60s, then:`);
    console.log(`  node scripts/regen-spot-check.mjs --verify`);
  } else {
    console.log(`\n[verify] ^^ Lines above are the CURRENT state in DB — look for`);
    console.log(`[verify]    "sold-language hits in description: none" on all 3 rows.`);
    console.log(`[verify]    If any still has hits, the regen didn't run or the prompt still leaks.`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
