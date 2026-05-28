// Step 4 verification: Class A + C validator hardening.
//
// Feeds the ORIGINAL pre-Step-3 centennial raw output (which contains
// bracket-shorthand "$770" / "$920" + chained "firmed" direction verb)
// through the HARDENED validator. Expected:
//   - Class A "$770" / "$920" must NOT fire (false rejections fixed).
//   - Class C "firmed" → Q4 2024 must NOT fire (wider quarter sweep accepts
//     the verb against Q2 2025's up transition).
//   - Class B $775K per-trade must STILL fire (real fabrication).
//
// Also runs against the Step 3 NEW raw output to confirm $600K
// neighbourhoodComparable false-rejection is now fixed.
//
// Pure validator test — no API calls, no DB writes.

import { readFileSync } from "node:fs";
import path from "node:path";

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
  } catch {
    /* ignore */
  }
}
loadEnvLocal();

import { validateSectionsSubset } from "@/lib/ai/validateStreetGeneration";
import { roundPricesInOutput } from "@/lib/ai/roundPricesInOutput";
import type { StreetGeneratorInput, StreetSectionId, StreetSection } from "@/types/street-generator";

const MARKET_IDS: StreetSectionId[] = ["market", "neighbourhoodComparable"];

const PRE_STEP3_DIR = "experiment-output/centennial-lane-a-diag-1779960429929";
const POST_STEP3_DIR = "experiment-output/centennial-lane-a-diag-1779962744781";

function loadInput(dir: string): StreetGeneratorInput {
  return JSON.parse(readFileSync(path.resolve(dir, "input.json"), "utf-8"));
}
function loadRaw(dir: string): { sections: StreetSection[] } {
  return JSON.parse(readFileSync(path.resolve(dir, "raw-model-output.txt"), "utf-8"));
}

function run(label: string, dir: string, expectations: { mustFire: string[]; mustNotFire: string[] }) {
  const input = loadInput(dir);
  const raw = loadRaw(dir);
  // Mirror runHalfWithRetry: round prices then validate.
  const rounded = roundPricesInOutput(
    { sections: raw.sections, faq: [] },
    input,
  );
  const violations = validateSectionsSubset(rounded.sections, MARKET_IDS, input);

  console.log("\n" + "=".repeat(70));
  console.log(label);
  console.log("=".repeat(70));
  console.log(`Total violations: ${violations.length}`);
  for (const v of violations) {
    console.log(`  - ${v.rule}@${v.sectionId ?? "-"}: ${v.excerpt.slice(0, 180)}`);
  }

  let allGood = true;
  console.log("\nGate checks:");
  for (const expected of expectations.mustFire) {
    const fired = violations.some((v) => v.excerpt.includes(expected) || v.rule === expected);
    console.log(`  MUST FIRE [${expected}]: ${fired ? "PASS ✓" : "FAIL ✗"}`);
    if (!fired) allGood = false;
  }
  for (const notExpected of expectations.mustNotFire) {
    const fired = violations.some((v) => v.excerpt.includes(notExpected));
    console.log(`  MUST NOT FIRE [${notExpected}]: ${fired ? "FAIL ✗" : "PASS ✓"}`);
    if (fired) allGood = false;
  }
  return allGood;
}

function main() {
  const r1 = run(
    "Original pre-Step-3 raw output (bracket-shorthand $770/$920 + chained 'firmed' + $775K per-trade)",
    PRE_STEP3_DIR,
    {
      mustFire: ["per_trade_fabrication"], // Class B real fabrication MUST still fire
      mustNotFire: [
        '"$770"',          // Class A false rejection — must NOT fire now
        '"$920"',          // Class A false rejection — must NOT fire now
        'Q4 2024 described as up (via "firmed")', // Class C false rejection — must NOT fire now
      ],
    },
  );

  const r2 = run(
    "Step-3-prompt raw output ($600K neighbourhoodComparable + chained 'firmed')",
    POST_STEP3_DIR,
    {
      mustFire: [],        // no must-fires for the cleaner output
      mustNotFire: [
        '"$600,000,"',     // gap-fix: NC.typicalSoldPrice now in collectInputPrices
        'Q4 2024 described as up (via "firmed")', // Class C: Q2 2025 up matches "firmed"
      ],
    },
  );

  console.log("\n" + "=".repeat(70));
  console.log(`SUMMARY: r1=${r1 ? "PASS" : "FAIL"}, r2=${r2 ? "PASS" : "FAIL"}`);
  console.log("=".repeat(70));
  process.exit(r1 && r2 ? 0 : 1);
}

main();
