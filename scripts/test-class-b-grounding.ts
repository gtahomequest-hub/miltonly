// Step 1 verification: Class B per-trade fabrication detector.
//
// Two fixtures over the SAME input.json (centennial-forest-drive):
//   Fixture A — the actual raw model output that contains
//     "A three-bedroom condo unit changed hands around $775,000 in Q4 2024".
//     MUST flag per_trade_fabrication.
//   Fixture B — synthetic aggregate variant that swaps the per-trade
//     sentence for "The typical condo sold around $776,000 across the
//     period". MUST NOT flag per_trade_fabrication.
//
// Diagnosis-only — no DB writes. Reads input.json from the prior diagnostic
// run; validators are pure functions over (prose, input).

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

import { validateSectionsSubset, findPerTradeFabrications } from "@/lib/ai/validateStreetGeneration";
import type { StreetGeneratorInput, StreetSectionId, StreetSection } from "@/types/street-generator";

const INPUT_PATH = "experiment-output/centennial-lane-a-diag-1779960429929/input.json";
const RAW_PATH = "experiment-output/centennial-lane-a-diag-1779960429929/raw-model-output.txt";
const MARKET_IDS: StreetSectionId[] = ["market", "neighbourhoodComparable"];

function loadInput(): StreetGeneratorInput {
  const raw = readFileSync(path.resolve(INPUT_PATH), "utf-8");
  return JSON.parse(raw) as StreetGeneratorInput;
}

function loadFixtureA(): { sections: StreetSection[] } {
  const raw = readFileSync(path.resolve(RAW_PATH), "utf-8");
  return JSON.parse(raw) as { sections: StreetSection[] };
}

function buildFixtureB(fixtureA: { sections: StreetSection[] }): { sections: StreetSection[] } {
  // Swap the per-trade sentence with aggregate language. Same dollar value.
  const cloned: { sections: StreetSection[] } = JSON.parse(JSON.stringify(fixtureA));
  const market = cloned.sections.find((s) => s.id === "market")!;
  market.paragraphs = market.paragraphs.map((p) =>
    p.replace(
      /A three-bedroom condo unit changed hands around \$775,000 in Q4 2024[^.]*\./,
      "The typical condo sold around $776,000 across the period.",
    ),
  );
  return cloned;
}

function runFixture(label: string, sections: StreetSection[], input: StreetGeneratorInput, expectPerTrade: boolean) {
  console.log(`\n=== ${label} ===`);
  // First, the raw findPerTradeFabrications output across all market+nc sections
  for (const s of sections) {
    if (s.id !== "market" && s.id !== "neighbourhoodComparable") continue;
    const text = s.paragraphs.join("\n\n");
    const findings = findPerTradeFabrications(text, input);
    console.log(`[${s.id}] findPerTradeFabrications: ${findings.length} finding(s)`);
    for (const f of findings) {
      console.log(`  - side=${f.side} matchedPhrase="${f.matchedPhrase}"`);
      console.log(`    reason: ${f.reason}`);
      console.log(`    context: ${f.context}`);
    }
  }
  // Then full validateSectionsSubset
  const violations = validateSectionsSubset(sections, MARKET_IDS, input);
  const perTradeViolations = violations.filter((v) => v.rule === "per_trade_fabrication");
  console.log(`\nvalidateSectionsSubset → total=${violations.length}, per_trade_fabrication=${perTradeViolations.length}`);
  for (const v of perTradeViolations) {
    console.log(`  - ${v.rule}@${v.sectionId}: ${v.excerpt.slice(0, 200)}`);
  }
  // Gate
  const ok = expectPerTrade ? perTradeViolations.length >= 1 : perTradeViolations.length === 0;
  console.log(`\nGATE [${label}]: expect per_trade_fabrication ${expectPerTrade ? "≥1" : "=0"} → ${ok ? "PASS ✓" : "FAIL ✗"}`);
  return ok;
}

function main() {
  const input = loadInput();
  const fixtureA = loadFixtureA();
  const fixtureB = buildFixtureB(fixtureA);

  console.log("Input slug:", input.street.slug);
  console.log("Input has leaseActivity.recentRecords?",
    Boolean(input.leaseActivity?.recentRecords?.length));

  const aOk = runFixture("Fixture A — actual per-trade fabrication", fixtureA.sections, input, true);
  const bOk = runFixture("Fixture B — synthetic aggregate variant", fixtureB.sections, input, false);

  console.log("\n=== SUMMARY ===");
  console.log(`Fixture A (fabrication must fire): ${aOk ? "PASS" : "FAIL"}`);
  console.log(`Fixture B (aggregate must NOT fire): ${bOk ? "PASS" : "FAIL"}`);
  process.exit(aOk && bOk ? 0 : 1);
}

main();
