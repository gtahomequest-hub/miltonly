// scripts/regen-streets.ts
// Force-regenerate street pages through the REAL production path
// (generateStreetContent -> buildGeneratorInput -> generatePhase41StreetContent
// -> validators -> dual-write StreetGeneration + StreetContent, fail-closed on
// validation failure). Built for the batch-001 remediation pilot; reusable for
// the full roll.
//
// Run: npx tsx --tsconfig tsconfig.test.json scripts/regen-streets.ts <slug> [slug ...]
//      npx tsx --tsconfig tsconfig.test.json scripts/regen-streets.ts --file slugs.txt
// Writes to the production DB - be aware.
import { readFileSync } from "node:fs";

function loadEnvLocal(): void {
  for (const file of [".env.local", ".env"]) {
    try {
      const raw = readFileSync(file, "utf-8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
        if (m && !process.env[m[1]]) {
          let v = m[2].replace(/\r$/, "").replace(/\\n$/, "");
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
          process.env[m[1]] = v;
        }
      }
    } catch {}
  }
}
loadEnvLocal();
// The phase41 path is flag-selected inside generateStreetContent; force it on
// for this driver regardless of the local .env contents.
process.env.AI_PROVIDER = "phase41_v2";
delete process.env.PHASE41_HALT;

import { prisma } from "../src/lib/prisma";
import { generateStreetContent } from "../src/lib/generateStreet";
import { Phase41GenerationError } from "../src/lib/ai/compliance";

const CONCURRENCY = 3;

interface Row {
  slug: string;
  outcome: "pass" | "fail" | "error";
  attempts: number;
  totalWords: number | null;
  costUsd: number | null;
  elapsedS: number;
  note: string;
}

async function runOne(slug: string): Promise<Row> {
  const t0 = Date.now();
  const content = await prisma.streetContent.findUnique({
    where: { streetSlug: slug },
    select: { streetName: true },
  });
  const name = content?.streetName ?? slug;
  try {
    const r = await generateStreetContent(slug, name, { skipSms: true });
    const elapsedS = Math.round((Date.now() - t0) / 1000);
    return {
      slug,
      outcome: r.passed ? "pass" : "fail",
      attempts: r.attempts,
      totalWords: r.v2?.totalWords ?? null,
      costUsd: r.v2?.costUsd ?? null,
      elapsedS,
      note: r.passed ? "" : "validation failed - fail-closed, prior published row preserved",
    };
  } catch (e) {
    const elapsedS = Math.round((Date.now() - t0) / 1000);
    const msg =
      e instanceof Phase41GenerationError
        ? `Phase41GenerationError: ${(e.violations ?? []).map((v: { rule: string }) => v.rule).slice(0, 5).join(",")}`
        : (e as Error).message.slice(0, 140);
    return { slug, outcome: "error", attempts: 0, totalWords: null, costUsd: null, elapsedS, note: msg };
  }
}

async function main() {
  const args = process.argv.slice(2);
  let slugs: string[] = [];
  const fileIdx = args.indexOf("--file");
  if (fileIdx >= 0) {
    slugs = readFileSync(args[fileIdx + 1], "utf-8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  } else {
    slugs = args.filter((a) => !a.startsWith("--"));
  }
  if (slugs.length === 0) {
    console.error("Usage: regen-streets.ts <slug> [slug ...] | --file slugs.txt");
    process.exit(1);
  }

  console.log(`Regenerating ${slugs.length} streets (concurrency ${CONCURRENCY}) via phase41_v2...`);
  const results: Row[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < slugs.length) {
      const slug = slugs[cursor++];
      console.log(`  -> ${slug}`);
      const row = await runOne(slug);
      results.push(row);
      console.log(
        `  <- ${row.slug}: ${row.outcome.toUpperCase()} attempts=${row.attempts} ` +
        `words=${row.totalWords ?? "-"} cost=$${row.costUsd?.toFixed(3) ?? "-"} ${row.elapsedS}s ${row.note}`,
      );
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const pass = results.filter((r) => r.outcome === "pass").length;
  const fail = results.filter((r) => r.outcome === "fail").length;
  const err = results.filter((r) => r.outcome === "error").length;
  const cost = results.reduce((s, r) => s + (r.costUsd ?? 0), 0);
  console.log(`\n=== ${pass} pass / ${fail} fail-closed / ${err} error · total cost $${cost.toFixed(2)} ===`);
  for (const r of results.filter((x) => x.outcome !== "pass")) {
    console.log(`  ${r.outcome.toUpperCase()} ${r.slug}: ${r.note}`);
  }
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
