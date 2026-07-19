// scripts/backfill-hub-meta.ts
// One-shot surgical backfill: recompute hubContent.metaTitle/metaDescription
// for every PUBLISHED hub row using the shared buildHubMeta formula (the
// same helper the generators now use), with live aggregates from the same
// input builders the generators call. Title/meta fields ONLY - no content
// regeneration, no LLM calls, so the grounding gate is not in play.
//
// Run: npx tsx --tsconfig tsconfig.test.json scripts/backfill-hub-meta.ts [--dry]
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
import { buildHubInput, buildRuralHubInput } from "@/lib/ai/buildHubInput";
import { buildHubMeta } from "@/lib/ai/hub/hubMeta";

const DRY = process.argv.includes("--dry");

async function main() {
  const rows = await prisma.hubContent.findMany({
    where: { status: "published" },
    select: { neighbourhoodSlug: true, neighbourhoodName: true, metaTitle: true, metaDescription: true },
  });
  console.log(`published hub rows: ${rows.length}${DRY ? "  (DRY RUN - no writes)" : ""}`);
  let updated = 0;
  let failed = 0;

  for (const row of rows) {
    const slug = row.neighbourhoodSlug;
    try {
      const nbhd = await prisma.neighbourhood.findUnique({ where: { slug }, select: { profile: true, name: true } });
      if (!nbhd) {
        console.log(`  SKIP ${slug}: no Neighbourhood row`);
        failed++;
        continue;
      }
      const profile = nbhd.profile === "urban_hub" ? ("urban" as const) : ("rural" as const);
      const input = profile === "urban" ? await buildHubInput(slug) : await buildRuralHubInput(slug);
      const { metaTitle, metaDescription } = buildHubMeta(
        row.neighbourhoodName,
        { typicalPrice: input.aggregates.typicalPrice, salesCount: input.aggregates.salesCount },
        profile,
      );
      const sane = !/\$0\b|NaN|undefined|null/.test(metaTitle + " " + metaDescription);
      if (!sane) {
        console.log(`  FAIL-CLOSED ${slug}: computed meta failed sanity check, row untouched`);
        console.log(`    title: ${metaTitle}`);
        console.log(`    desc : ${metaDescription}`);
        failed++;
        continue;
      }
      console.log(`  ${slug} [${profile}]`);
      console.log(`    OLD title: ${row.metaTitle}`);
      console.log(`    NEW title: ${metaTitle}`);
      console.log(`    OLD desc : ${(row.metaDescription ?? "").slice(0, 110)}`);
      console.log(`    NEW desc : ${metaDescription}`);
      if (!DRY) {
        await prisma.hubContent.update({
          where: { neighbourhoodSlug: slug },
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
