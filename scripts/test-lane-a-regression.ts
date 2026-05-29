// WS4 (DEC-WS4) gate (b): the 3 former Lane A streets still validate CLEAN under
// the extended validator (comparison_mismatch added to the union + wired into the
// hub path only). No regression to the residential street validator.
//
// For each street: rebuild input live via buildGeneratorInput, load the stored
// (succeeded) StreetGeneration.sectionsJson + faqJson, run the FULL
// validateStreetGeneration. The street validator never invokes comparison_mismatch
// (it is hub-only), so a clean result proves the extension is isolated.
//
// Needs --conditions react-server (buildGeneratorInput pulls street-data, which
// imports "server-only").

import { readFileSync } from "node:fs";
function loadEnvLocal(): void {
  try {
    const raw = readFileSync(".env.local", "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        let v = m[2].replace(/\\n$/, "");
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  } catch { /* ignore */ }
}
loadEnvLocal();

import { prisma } from "@/lib/prisma";
import { buildGeneratorInput } from "@/lib/ai/buildGeneratorInput";
import { validateStreetGeneration } from "@/lib/ai/validateStreetGeneration";
import type { StreetGeneratorOutput } from "@/types/street-generator";

const STREETS = ["centennial-forest-drive-milton", "belmore-court-milton", "marigold-court-milton"];

async function runOne(slug: string): Promise<boolean> {
  const sg = await prisma.streetGeneration.findUnique({ where: { streetSlug: slug } });
  if (!sg || sg.status !== "succeeded") {
    console.log(`\n[${slug}] SKIP/FAIL — StreetGeneration status=${sg?.status ?? "MISSING"}`);
    return false;
  }
  const input = await buildGeneratorInput(slug);
  const output: StreetGeneratorOutput = {
    sections: sg.sectionsJson as unknown as StreetGeneratorOutput["sections"],
    faq: sg.faqJson as unknown as StreetGeneratorOutput["faq"],
  };
  const violations = validateStreetGeneration(output, input);
  console.log(`\n[${slug}] status=${sg.status}, sections=${output.sections.length}, faq=${output.faq.length}`);
  console.log(`  validateStreetGeneration → ${violations.length} violation(s)`);
  for (const v of violations) console.log(`   - ${v.rule}@${v.sectionId ?? "-"}: ${v.excerpt.slice(0, 150)}`);
  const comparisonLeak = violations.some((v) => v.rule === "comparison_mismatch");
  if (comparisonLeak) console.log("  !! comparison_mismatch leaked into street validation — REGRESSION");
  const ok = violations.length === 0 && !comparisonLeak;
  console.log(`  GATE [${slug}]: ${ok ? "PASS ✓ (clean)" : "FAIL ✗"}`);
  return ok;
}

async function main() {
  console.log("=".repeat(70));
  console.log("WS4 gate (b): Lane A streets validate clean under extended validator");
  console.log("=".repeat(70));
  let all = true;
  for (const slug of STREETS) all = (await runOne(slug)) && all;
  console.log("\n" + "=".repeat(70));
  console.log(`SUMMARY: ${all ? "PASS ✓ — no regression" : "FAIL ✗"}`);
  console.log("=".repeat(70));
  await prisma.$disconnect();
  process.exit(all ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });
