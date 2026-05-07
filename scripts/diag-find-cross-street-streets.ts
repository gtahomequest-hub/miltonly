// scripts/diag-find-cross-street-streets.ts
// Walk the operational DB and find streets where input.crossStreets[] is
// non-empty, so we have a candidate for the Phase 4.1 cooperative-input
// validation before the prod flip. Reports top 10 by crossStreets count
// then salesCount, plus aggregate stats and ideal-target flag.

import { readFileSync } from "node:fs";

function loadEnvLocal(): void {
  try {
    const raw = readFileSync(".env.local", "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        let value = m[2].replace(/\\n$/, "");
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env[m[1]] = value;
      }
    }
  } catch {}
}
loadEnvLocal();

import { prisma } from "@/lib/prisma";
import { buildGeneratorInput } from "@/lib/ai/buildGeneratorInput";

interface Row {
  slug: string;
  name: string;
  crossStreetsCount: number;
  neighbourhoods: string[];
  kAnonLevel: "full" | "thin" | "zero";
  salesCount: number;
}

async function main() {
  console.log("Pulling street list from StreetContent...");
  const all = await prisma.streetContent.findMany({
    select: { streetSlug: true, streetName: true },
  });
  console.log(`Found ${all.length} streets in StreetContent.`);
  console.log("Building generator input for each (sequential)...\n");

  const rows: Row[] = [];
  const errors: Array<{ slug: string; message: string }> = [];

  let processed = 0;
  for (const s of all) {
    processed++;
    if (processed % 25 === 0) {
      console.log(`  ...${processed}/${all.length} processed (${rows.length} succeeded, ${errors.length} errored)`);
    }
    try {
      const input = await buildGeneratorInput(s.streetSlug);
      rows.push({
        slug: s.streetSlug,
        name: input.street.name,
        crossStreetsCount: input.crossStreets.length,
        neighbourhoods: input.neighbourhoods,
        kAnonLevel: input.aggregates.kAnonLevel,
        salesCount: input.aggregates.salesCount,
      });
    } catch (e) {
      errors.push({ slug: s.streetSlug, message: (e as Error).message });
    }
  }
  console.log(`Done. ${rows.length} succeeded, ${errors.length} errored.\n`);

  // Aggregate stats
  const totalStreets = all.length;
  const succeededCount = rows.length;
  const emptyCrossStreets = rows.filter(r => r.crossStreetsCount === 0).length;
  const oneOrMoreCrossStreets = rows.filter(r => r.crossStreetsCount >= 1).length;
  const threeOrMoreCrossStreets = rows.filter(r => r.crossStreetsCount >= 3).length;
  const fullTierCandidates = rows.filter(r => r.salesCount >= 5).length;
  const idealTargets = rows.filter(r => r.crossStreetsCount >= 1 && r.salesCount >= 5);

  console.log("=== Aggregate stats ===");
  console.log(`Total streets in DB:                    ${totalStreets}`);
  console.log(`Successfully built generator input:     ${succeededCount}`);
  console.log(`Errored during input build:             ${errors.length}`);
  console.log(`Empty crossStreets:                     ${emptyCrossStreets}`);
  console.log(`crossStreets.length >= 1:               ${oneOrMoreCrossStreets}`);
  console.log(`crossStreets.length >= 3:               ${threeOrMoreCrossStreets}`);
  console.log(`Full-tier candidates (salesCount >= 5): ${fullTierCandidates}`);
  console.log(`*** Ideal targets (crossStreets >= 1 AND salesCount >= 5): ${idealTargets.length} ***`);
  console.log();

  if (idealTargets.length > 0) {
    console.log("=== IDEAL TARGETS (validates BOTH pending gates in one run) ===");
    for (const r of idealTargets.slice(0, 10)) {
      console.log(`  ${r.slug.padEnd(45)} cs=${r.crossStreetsCount}  sales=${r.salesCount}  kAnon=${r.kAnonLevel}  nbh=[${r.neighbourhoods.join(",")}]`);
    }
    console.log();
  }

  // Top 10 candidates with non-empty crossStreets, sorted by crossStreets.length DESC, salesCount DESC
  const candidates = rows
    .filter(r => r.crossStreetsCount >= 1)
    .sort((a, b) => {
      if (b.crossStreetsCount !== a.crossStreetsCount) return b.crossStreetsCount - a.crossStreetsCount;
      return b.salesCount - a.salesCount;
    });

  console.log("=== Top 10 streets with non-empty crossStreets[] ===");
  console.log("(sort: crossStreets.length DESC, salesCount DESC)\n");
  console.log(`${"slug".padEnd(45)} ${"cs".padStart(3)}  ${"sales".padStart(5)}  ${"kAnon".padEnd(5)}  neighbourhoods`);
  console.log("-".repeat(95));
  for (const r of candidates.slice(0, 10)) {
    const star = (r.crossStreetsCount >= 1 && r.salesCount >= 5) ? " *" : "";
    console.log(`${r.slug.padEnd(45)} ${String(r.crossStreetsCount).padStart(3)}  ${String(r.salesCount).padStart(5)}  ${r.kAnonLevel.padEnd(5)}  [${r.neighbourhoods.join(",")}]${star}`);
  }
  console.log();

  if (errors.length > 0 && errors.length <= 10) {
    console.log("=== Errors (under 10, listing all) ===");
    for (const e of errors) {
      console.log(`  ${e.slug}: ${e.message.slice(0, 100)}`);
    }
  } else if (errors.length > 10) {
    console.log(`=== Errors (${errors.length} total, sample of 5) ===`);
    for (const e of errors.slice(0, 5)) {
      console.log(`  ${e.slug}: ${e.message.slice(0, 100)}`);
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(2); });
