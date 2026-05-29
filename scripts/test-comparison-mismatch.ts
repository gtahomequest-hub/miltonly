// WS4 (DEC-WS4-3) gate (c): comparison_mismatch fires on an ungrounded synthetic
// comparison and passes a grounded one. Mirrors scripts/test-class-a-c-hardening.ts.
//
// Pure validator test — no API calls, no DB. Synthetic HubGeneratorInput +
// MiltonWideContext, three compared-to-milton prose samples.

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

import { validateHubSectionsSubset, findComparisonMismatch } from "@/lib/ai/validateHubGeneration";
import type { HubGeneratorInput, MiltonWideContext, HubSection } from "@/types/hub-generator";

// Neighbourhood typical $1,100,000 sits ABOVE Milton-wide $950,000; pace 70d vs 90d (faster).
const HUB: HubGeneratorInput = {
  neighbourhood: { slug: "testville", name: "Testville", profile: "urban_hub", kind: "urban", rawStrings: ["TEST"] },
  aggregates: { txCount: 200, salesCount: 120, leasesCount: 80, typicalPrice: 1_100_000, priceRange: { low: 800_000, high: 1_600_000 }, daysOnMarket: 70, kAnonLevel: "full" },
  byType: {}, quarterlyTrend: [], activeListingsCount: 30, activeByType: {},
  projectedStreets: [], vipStreetCount: 0, streetCount: 0, schools: { sourced: false },
};
const MILTON: MiltonWideContext = {
  scope: "milton-wide",
  aggregates: { txCount: 4000, salesCount: 1900, leasesCount: 2100, typicalPrice: 950_000, priceRange: { low: 90_000, high: 5_000_000 }, daysOnMarket: 90, kAnonLevel: "full" },
  quarterlyTrend: [], activeListingsCount: 490, neighbourhoodCount: 14,
};

// Sub-k variant: neighbourhood typical suppressed (null).
const HUB_THIN: HubGeneratorInput = { ...HUB, aggregates: { ...HUB.aggregates, typicalPrice: null, priceRange: null, daysOnMarket: null, salesCount: 4, kAnonLevel: "thin" } };

function sec(paragraph: string): HubSection {
  return { id: "comparedToMilton", heading: "How Testville compares to Milton", paragraphs: [paragraph] };
}

function run(label: string, hub: HubGeneratorInput, prose: string, expectFire: boolean) {
  const direct = findComparisonMismatch(prose, hub, MILTON);
  const violations = validateHubSectionsSubset([sec(prose)], hub, MILTON);
  const cm = violations.filter((v) => v.rule === "comparison_mismatch");
  console.log(`\n=== ${label} ===`);
  console.log(`prose: ${prose}`);
  console.log(`findComparisonMismatch: ${direct.length} finding(s)` + (direct[0] ? ` [${direct[0].type}]` : ""));
  for (const f of direct) console.log(`   - ${f.type}: ${f.reason}`);
  console.log(`validateHubSectionsSubset → comparison_mismatch=${cm.length}`);
  const ok = expectFire ? cm.length >= 1 : cm.length === 0;
  console.log(`GATE [${label}]: expect comparison_mismatch ${expectFire ? "≥1" : "=0"} → ${ok ? "PASS ✓" : "FAIL ✗"}`);
  return ok;
}

function main() {
  const r1 = run(
    "GROUNDED comparison (nbhd $1.1M ABOVE Milton $950K, asserted above)",
    HUB,
    "Across Testville, the typical home trades above the rest of Milton, settling higher than the wider Milton market over the past year.",
    false,
  );
  const r2 = run(
    "UNGROUNDED direction (asserted below, actual above)",
    HUB,
    "Across Testville, the typical home trades below the rest of Milton, coming in cheaper than the wider Milton market.",
    true,
  );
  const r3 = run(
    "SIDE ungrounded (nbhd typicalPrice suppressed sub-k, comparison attempted)",
    HUB_THIN,
    "Testville sits above the rest of Milton on price.",
    true,
  );
  const r4 = run(
    "GROUNDED pace (nbhd 70d faster than Milton 90d, asserted faster)",
    HUB,
    "Homes in Testville sell faster than the rest of Milton.",
    false,
  );

  console.log("\n" + "=".repeat(70));
  const all = r1 && r2 && r3 && r4;
  console.log(`SUMMARY: grounded=${r1 ? "PASS" : "FAIL"}, wrong-direction=${r2 ? "PASS" : "FAIL"}, side-ungrounded=${r3 ? "PASS" : "FAIL"}, grounded-pace=${r4 ? "PASS" : "FAIL"}`);
  console.log("=".repeat(70));
  process.exit(all ? 0 : 1);
}
main();
