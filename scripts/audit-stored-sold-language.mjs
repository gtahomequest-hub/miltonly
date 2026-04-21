// Phase 2.6 follow-up audit — check AI-generated stored content in DB1 for
// "sold price"-style language that pre-dated the sold-language sweep.
// Source-level greps miss these because the text lives in database rows
// written by earlier runs of the generate cron.
//
// Scope: StreetContent table — description, rawAiOutput, faqJson, vipDescription,
//        metaTitle, metaDescription.
// Other AI-content tables in this schema: none. (Schools and mosques are
// hardcoded lists in lib/; neighbourhoods don't have a dedicated AI-content
// table; exclusive listings are manually entered.)
//
// This script is read-only — it reports counts and sample slugs but does
// not clear marketDataHash. The clearing is a separate explicit action.

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

async function main() {
  const total = await prisma.streetContent.count();
  console.log(`\nStreetContent total rows: ${total}`);

  // description column
  const descMatches = await prisma.streetContent.findMany({
    where: {
      OR: PATTERNS.map((p) => ({ description: { contains: p, mode: "insensitive" } })),
    },
    select: { streetSlug: true, status: true, marketDataHash: true },
  });
  console.log(`\n  description column`);
  console.log(`    matches:          ${descMatches.length}`);
  console.log(`    published:        ${descMatches.filter((s) => s.status === "published").length}`);
  console.log(`    draft:            ${descMatches.filter((s) => s.status === "draft").length}`);
  console.log(`    with hash:        ${descMatches.filter((s) => s.marketDataHash).length}`);
  if (descMatches.length > 0) {
    console.log(`    sample slugs:     ${descMatches.slice(0, 5).map((s) => s.streetSlug).join(", ")}`);
  }

  // rawAiOutput column
  const rawMatches = await prisma.streetContent.count({
    where: {
      OR: PATTERNS.map((p) => ({ rawAiOutput: { contains: p, mode: "insensitive" } })),
    },
  });
  console.log(`\n  rawAiOutput column matches: ${rawMatches}`);

  // faqJson column
  const faqMatches = await prisma.streetContent.count({
    where: {
      OR: PATTERNS.map((p) => ({ faqJson: { contains: p, mode: "insensitive" } })),
    },
  });
  console.log(`  faqJson column matches:     ${faqMatches}`);

  // vipDescription column
  const vipMatches = await prisma.streetContent.count({
    where: {
      OR: PATTERNS.map((p) => ({ vipDescription: { contains: p, mode: "insensitive" } })),
    },
  });
  console.log(`  vipDescription matches:     ${vipMatches}`);

  // metaDescription column (fed into <meta name="description">)
  const metaMatches = await prisma.streetContent.count({
    where: {
      OR: PATTERNS.map((p) => ({ metaDescription: { contains: p, mode: "insensitive" } })),
    },
  });
  console.log(`  metaDescription matches:    ${metaMatches}`);

  // vipFaqJson column
  const vipFaqMatches = await prisma.streetContent.count({
    where: {
      OR: PATTERNS.map((p) => ({ vipFaqJson: { contains: p, mode: "insensitive" } })),
    },
  });
  console.log(`  vipFaqJson matches:         ${vipFaqMatches}`);

  console.log(`\nTo clear marketDataHash on rows with sold language in description`);
  console.log(`(forces regeneration on next cron pass), run:`);
  console.log(`  node scripts/clear-stored-sold-language-stale.mjs`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(() => prisma.$disconnect());
