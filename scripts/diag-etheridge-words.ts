// scripts/diag-etheridge-words.ts
// One-off: pull the Etheridge StreetGeneration row, recompute word counts
// the validator's way and the generateStreet.ts way, and surface kAnonLevel
// from a fresh buildGeneratorInput run so we can see which floor the
// validator was checking against.

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

const SLUG = process.env.DIAG_SLUG || "etheridge-avenue-milton";
const NAME = process.env.DIAG_NAME || "Etheridge Ave";

interface SectionShape { id: string; heading: string; paragraphs: string[] }
interface FaqShape { question: string; answer: string }

function words(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

async function main() {
  const row = await prisma.streetGeneration.findUnique({ where: { streetSlug: SLUG } });
  if (!row) {
    console.error("Row not found");
    process.exit(1);
  }
  const sections = (row.sectionsJson as unknown as SectionShape[]) ?? [];
  const faq = (row.faqJson as unknown as FaqShape[]) ?? [];

  console.log("=== StreetGeneration row ===");
  console.log("totalWords (DB):", row.totalWords);
  console.log("attemptCount:   ", row.attemptCount);
  console.log("status:         ", row.status);
  console.log("");

  console.log("=== Sections ===");
  let validatorStyle = 0;   // paragraphs.join("\n\n")
  let writerStyle = 0;      // paragraphs.join(" ")
  for (const s of sections) {
    const v = words(s.paragraphs.join("\n\n"));
    const w = words(s.paragraphs.join(" "));
    validatorStyle += v;
    writerStyle += w;
    console.log(`  ${s.id.padEnd(22)} validator=${v}  writer=${w}  paragraphs=${s.paragraphs.length}`);
  }
  console.log("");
  console.log("Sections totals:");
  console.log("  validator-style (\\n\\n):", validatorStyle);
  console.log("  writer-style (single space):", writerStyle);
  console.log("");

  console.log("=== FAQ ===");
  let faqQ = 0, faqA = 0;
  for (let i = 0; i < faq.length; i++) {
    const f = faq[i];
    const q = words(f.question);
    const a = words(f.answer);
    faqQ += q;
    faqA += a;
    console.log(`  [${i}] q=${q}w  a=${a}w`);
  }
  console.log(`FAQ total: q=${faqQ} a=${faqA} combined=${faqQ + faqA}`);
  console.log(`Sections + FAQ combined: ${writerStyle + faqQ + faqA}`);
  console.log("");

  // Look up kAnonLevel by rebuilding the generator input from current data
  console.log("=== kAnonLevel (from fresh buildGeneratorInput) ===");
  try {
    const input = await buildGeneratorInput(SLUG);
    console.log("  txCount:    ", input.aggregates.txCount);
    console.log("  salesCount: ", input.aggregates.salesCount);
    console.log("  leasesCount:", input.aggregates.leasesCount);
    console.log("  kAnonLevel: ", input.aggregates.kAnonLevel);
    console.log("");
    const floor =
      input.aggregates.kAnonLevel === "zero" ? 750
      : input.aggregates.kAnonLevel === "thin" ? 800
      : 900;
    console.log(`  effective TOTAL_WORD_FLOOR for this kAnonLevel: ${floor}`);
    console.log(`  validatorStyle total (${validatorStyle}) >= floor (${floor})? ${validatorStyle >= floor ? "YES (passes)" : "NO (would violate)"}`);
  } catch (e) {
    console.error("  buildGeneratorInput failed:", (e as Error).message);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
