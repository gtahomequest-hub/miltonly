// scripts/backfill-street-meta.ts
// One-shot surgical backfill (batch-001 triage, 2026-07-19): recompute
// streetContent.metaTitle/metaDescription for every PUBLISHED street row using
// the shared streetMeta formula (the same helper generateStreet.ts now uses),
// sourcing figures from the SAME live For-Sale aggregate query the phase41
// input builder uses. Meta fields ONLY - no content regeneration, no LLM
// calls, so the grounding gate is not in play.
//
// Fixes sitewide: "Milton's most detailed street guide" superlative (415 rows),
// "0 days on market" null-as-zero (415 rows), "Average list price $0" (161 rows),
// and frontmatter sold-counts contradicting the body (DB1 status-flip count
// replaced with the live DB2 sale count the body is written from).
//
// Run: npx tsx --tsconfig tsconfig.test.json scripts/backfill-street-meta.ts [--dry]
import { readFileSync } from "node:fs";

function loadEnv(file: string): void {
  try {
    const raw = readFileSync(file, "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        let v = m[2].replace(/\r$/, "");
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  } catch {}
}
loadEnv(".env.local");
loadEnv(".env");

import { prisma } from "@/lib/prisma";
import { getSoldDb } from "@/lib/db";
import { resolveSiblingSlugs } from "@/lib/street-data";
import { buildStreetMetaTitle, buildStreetMetaDescription } from "@/lib/streetMeta";

const DRY = process.argv.includes("--dry");
const K_ANON_PRICE = 5; // parallel to buildGeneratorInput.ts
const VERBOSE_FIRST = 10;

async function main() {
  const sd = getSoldDb();
  if (!sd) {
    console.error("No sold DB configured (SOLD_DATABASE_URL) - aborting, nothing written.");
    process.exit(1);
  }

  const rows = await prisma.streetContent.findMany({
    where: { status: "published" },
    select: { streetSlug: true, streetName: true, metaDescription: true },
    orderBy: { streetSlug: "asc" },
  });
  console.log(`published street rows: ${rows.length}${DRY ? "  (DRY RUN - no writes)" : ""}`);

  let updated = 0;
  let failed = 0;
  let i = 0;

  for (const row of rows) {
    const slug = row.streetSlug;
    i++;
    try {
      const siblings = await resolveSiblingSlugs(slug);
      const agg = (await sd`
        SELECT COUNT(*)::int AS n,
               AVG(sold_price) AS avg_price,
               AVG(days_on_market) AS avg_dom
          FROM sold.sold_records
          WHERE street_slug = ANY(${siblings}::text[])
            AND perm_advertise = TRUE
            AND transaction_type = 'For Sale'
            AND sold_date >= NOW() - INTERVAL '12 months'
      `) as unknown as Array<{ n: number; avg_price: string | null; avg_dom: string | null }>;

      const n = agg[0]?.n ?? 0;
      const avgPrice = agg[0]?.avg_price != null ? Number(agg[0].avg_price) : null;
      const avgDom = agg[0]?.avg_dom != null ? Math.round(Number(agg[0].avg_dom)) : null;

      const metaTitle = buildStreetMetaTitle(row.streetName);
      const metaDescription = buildStreetMetaDescription(row.streetName, {
        salesCount: n,
        typicalPrice: n >= K_ANON_PRICE && avgPrice !== null && Number.isFinite(avgPrice) ? avgPrice : null,
        // D3 ruling (2026-07-20): DOM below n=5 suppressed, mirroring buildGeneratorInput.
        daysOnMarket: n >= K_ANON_PRICE && avgDom !== null && Number.isFinite(avgDom) ? avgDom : null,
      });

      const sane = !/\$0\b|NaN|undefined|null/.test(metaTitle + " " + metaDescription);
      if (!sane) {
        console.log(`  FAIL-CLOSED ${slug}: computed meta failed sanity check, row untouched`);
        console.log(`    desc: ${metaDescription}`);
        failed++;
        continue;
      }

      if (i <= VERBOSE_FIRST) {
        console.log(`  ${slug}`);
        console.log(`    OLD: ${(row.metaDescription ?? "").slice(0, 120)}`);
        console.log(`    NEW: ${metaDescription}`);
      } else if (i % 50 === 0) {
        console.log(`  ... ${i}/${rows.length}`);
      }

      if (!DRY) {
        await prisma.streetContent.update({
          where: { streetSlug: slug },
          data: { metaTitle, metaDescription },
        });
      }
      updated++;
    } catch (e) {
      console.log(`  ERROR ${slug}: ${(e as Error).message.slice(0, 160)} - row untouched`);
      failed++;
    }
  }

  console.log(`\ndone: ${updated} ${DRY ? "would update" : "updated"}, ${failed} skipped/failed`);
  await prisma.$disconnect();
}

main();
