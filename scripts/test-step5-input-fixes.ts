// Step 5 verification: buildGeneratorInput input fixes.
//
// Expect:
//   - quarterlyTrend sorted chronologically (year asc, quarter asc within year)
//   - sales-side aggregates reconciled from live sold.sold_records query
//     (salesCount, typicalPrice, priceRange, daysOnMarket all from same source)
//
// READ + LIVE_API_FREE. No writes to operational DB. The only DB write
// is the existing fire-and-forget analytics.street_lease_coverage_log
// row inside buildGeneratorInput.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
  } catch {}
}
loadEnvLocal();

import { prisma } from "@/lib/prisma";
import { buildGeneratorInput } from "@/lib/ai/buildGeneratorInput";

async function main() {
  const slug = "centennial-forest-drive-milton";
  const outDir = path.join(process.cwd(), "experiment-output", `step5-input-${Date.now()}`);
  mkdirSync(outDir, { recursive: true });

  const input = await buildGeneratorInput(slug);
  writeFileSync(path.join(outDir, "input.json"), JSON.stringify(input, null, 2));

  console.log("=== AGGREGATES (live source after Step 5 fix) ===");
  console.log({
    salesCount: input.aggregates.salesCount,
    leasesCount: input.aggregates.leasesCount,
    txCount: input.aggregates.txCount,
    typicalPrice: input.aggregates.typicalPrice,
    priceRange: input.aggregates.priceRange,
    daysOnMarket: input.aggregates.daysOnMarket,
    kAnonLevel: input.aggregates.kAnonLevel,
  });

  console.log("\n=== QUARTERLY TREND (must be chronological) ===");
  for (const q of input.quarterlyTrend ?? []) {
    console.log(`  ${q.quarter}: typical=${q.typical}, count=${q.count}`);
  }

  // Verification gates
  console.log("\n=== GATES ===");

  // Chronological ordering: parse (year, quarter) from each label, confirm strictly non-decreasing.
  const trend = input.quarterlyTrend ?? [];
  let chronological = true;
  let prevKey = -Infinity;
  for (const q of trend) {
    const m = q.quarter.match(/^Q([1-4])\s*'(\d{2})$/);
    if (!m) { chronological = false; break; }
    const yr = 2000 + parseInt(m[2], 10);
    const qn = parseInt(m[1], 10);
    const key = yr * 4 + qn;
    if (key < prevKey) { chronological = false; break; }
    prevKey = key;
  }
  console.log(`Gate A — quarterlyTrend chronologically sorted:        ${chronological ? "PASS ✓" : "FAIL ✗"}`);

  // Consistency: typicalPrice and priceRange should both come from same n. If salesCount >= K_ANON_PRICE (5) typicalPrice should be non-null. If salesCount >= K_ANON_RANGE (10) priceRange should be non-null.
  const K_PRICE = 5;
  const K_RANGE = 10;
  const sc = input.aggregates.salesCount;
  const tpOk = sc >= K_PRICE ? input.aggregates.typicalPrice !== null : input.aggregates.typicalPrice === null;
  const prOk = sc >= K_RANGE ? input.aggregates.priceRange !== null : input.aggregates.priceRange === null;
  console.log(`Gate B — typicalPrice consistent with salesCount k=${K_PRICE}:  ${tpOk ? "PASS ✓" : "FAIL ✗"}`);
  console.log(`        salesCount=${sc}, typicalPrice=${input.aggregates.typicalPrice}`);
  console.log(`Gate C — priceRange consistent with salesCount k=${K_RANGE}:    ${prOk ? "PASS ✓" : "FAIL ✗"}`);
  console.log(`        salesCount=${sc}, priceRange=${JSON.stringify(input.aggregates.priceRange)}`);

  // For centennial specifically: salesCount should now be 9 (live), not 10 (analytics)
  const centennialSpecific = sc === 9;
  console.log(`Gate D — centennial salesCount reconciled to live (9, not 10): ${centennialSpecific ? "PASS ✓" : "INFO " + sc}`);

  const allPass = chronological && tpOk && prOk;
  console.log(`\nSUMMARY: ${allPass ? "PASS ✓" : "FAIL ✗"}`);
  console.log(`Output: ${outDir}`);
  await prisma.$disconnect();
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
