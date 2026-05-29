// WS4 patch 2 (DEC-WS4-5, ADR 0002) gate (e): a sub-k condo building whose
// generated content trips a hard validator rule routes to StreetGenerationReview
// (under the reserved `condo:<slug>` key) and does NOT publish. The street tier
// (StreetContent) is left byte-identical. Mirrors test-hub-fail-closed.ts exactly
// — the fail is synthesized WITHOUT any LLM call: the real condo validator runs
// on a genuinely sub-k synthetic building that makes a per-trade sale claim, which
// fires per_trade_fabrication (the building tier carries no per-trade rows).
//
// WRITE TARGET (intentional): StreetGenerationReview row keyed `condo:<slug>`.
// NON-WRITE TARGET (the fail-closed invariant): StreetContent — a sentinel street
// row must be byte-identical pre/post, and no StreetContent row exists for the
// condo key. The synthetic review row is deleted at the end (no prod pollution).

import { readFileSync } from "node:fs";
import crypto from "node:crypto";
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
import { validateCondoSectionsSubset } from "@/lib/ai/validateCondoGeneration";
import { routeCondoGeneration, condoReviewKey } from "@/lib/ai/hub/condoFailClosed";
import { assembleAggregates } from "@/lib/ai/buildHubInput";
import type { CondoBuildingGeneratorInput, CondoSection } from "@/types/hub-generator";

const BUILDING_SLUG = "ws4-failclosed-synthetic-subk-condo";
const SENTINEL_STREET = "centennial-forest-drive-milton"; // a real published street, must stay untouched

function fp(row: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(row)).digest("hex").slice(0, 16);
}

// Sub-k sale-active building: 3 sale trades (< K_ANON_PRICE=5 → typicalPrice
// suppressed). A generator emits a per-trade sale claim ("one unit sold for…"),
// which fires per_trade_fabrication — the building tier carries no per-trade rows.
const SUBK_SALE = assembleAggregates({ n: 3, lo: "610000", hi: "705000", avg_price: "660000", avg_dom: "30" }, 0);
const SUBK_INPUT: CondoBuildingGeneratorInput = {
  building: {
    slug: BUILDING_SLUG, displayName: "Synthetic Sub-K Condo", buildingAddress: "1 Synthetic Way",
    streetNumber: "1", streetName: "Synthetic Way", streetSlug: "synthetic-way-milton",
    neighbourhoodName: "Synthetic", totalUnits: 80, legalStories: 8, managementCo: null,
    avgMaintenanceFee: 500, yearBuilt: 2020, condoCorpNumbers: [],
  },
  saleAggregates: SUBK_SALE, saleByType: {}, saleQuarterly: [],
  lease: { leaseCount12mo: 2, kAnonLevel: "thin" },
  saleActive: true, leaseOnly: false, vipEligible: true, isVip: false,
  currentRank: 40, recencyWeightedSold: 1.2,
};
const SECTIONS: CondoSection[] = [
  { id: "condoMarket", heading: "Synthetic Sub-K Condo — recent sales",
    paragraphs: ["One unit at the building recently sold for $682,500 after just nine days on the market."] },
];

async function main() {
  console.log("=".repeat(70));
  console.log("WS4 gate (e): condo fail-closed — sub-k synthetic building");
  console.log("building slug:", BUILDING_SLUG, "| review key:", condoReviewKey(BUILDING_SLUG));
  console.log("=".repeat(70));

  const preSentinel = await prisma.streetContent.findUnique({ where: { streetSlug: SENTINEL_STREET } });
  const preCondoContent = await prisma.streetContent.findUnique({ where: { streetSlug: condoReviewKey(BUILDING_SLUG) } });
  await prisma.streetGenerationReview.delete({ where: { streetSlug: condoReviewKey(BUILDING_SLUG) } }).catch(() => undefined);

  const preSentinelHash = preSentinel
    ? fp({ d: preSentinel.description, s: preSentinel.status, p: preSentinel.publishedAt, m: preSentinel.metaTitle })
    : "MISSING";
  console.log("\nPRE-STATE:");
  console.log("  sentinel StreetContent rowHash:", preSentinelHash, `(status=${preSentinel?.status})`);
  console.log("  StreetContent for condo key exists?:", preCondoContent ? "YES (unexpected)" : "no");

  const violations = validateCondoSectionsSubset(SECTIONS, SUBK_INPUT);
  const inputHash = crypto.createHash("sha256").update(JSON.stringify(SUBK_INPUT)).digest("hex");
  console.log("\nVALIDATOR:");
  console.log(`  sale typicalPrice (sub-k suppressed): ${SUBK_SALE.typicalPrice}`);
  console.log(`  total violations: ${violations.length}`);
  for (const v of violations) console.log(`   - ${v.rule}: ${v.excerpt.slice(0, 150)}`);

  const route = await routeCondoGeneration(BUILDING_SLUG, violations, inputHash);
  console.log("\nROUTE:", JSON.stringify(route));

  const postSentinel = await prisma.streetContent.findUnique({ where: { streetSlug: SENTINEL_STREET } });
  const postCondoContent = await prisma.streetContent.findUnique({ where: { streetSlug: condoReviewKey(BUILDING_SLUG) } });
  const queueRow = await prisma.streetGenerationReview.findUnique({ where: { streetSlug: condoReviewKey(BUILDING_SLUG) } });
  const postSentinelHash = postSentinel
    ? fp({ d: postSentinel.description, s: postSentinel.status, p: postSentinel.publishedAt, m: postSentinel.metaTitle })
    : "MISSING";

  console.log("\nPOST-STATE:");
  console.log("  sentinel StreetContent rowHash:", postSentinelHash);
  console.log("  StreetContent for condo key exists?:", postCondoContent ? "YES (FAIL)" : "no");
  console.log("  StreetGenerationReview (queue) row:", queueRow ? {
    streetSlug: queueRow.streetSlug,
    lastInputHash: queueRow.lastInputHash.slice(0, 16),
    violationCount: Array.isArray(queueRow.violations) ? (queueRow.violations as unknown[]).length : 0,
    sample: Array.isArray(queueRow.violations) ? JSON.stringify((queueRow.violations as unknown[])[0]).slice(0, 160) : null,
  } : "MISSING");

  console.log("\n=== GATES ===");
  const gA = violations.some((v) => v.severity === "hard");
  const gB = route.published === false && route.queued === true;
  const gC = !!queueRow && (Array.isArray(queueRow.violations) ? (queueRow.violations as unknown[]).length >= 1 : false);
  const gD = !postCondoContent;
  const gE = preSentinelHash === postSentinelHash;
  console.log(`Gate A — sub-k condo fires a hard violation:                ${gA ? "PASS ✓" : "FAIL ✗"}`);
  console.log(`Gate B — routeCondoGeneration: published=false, queued:     ${gB ? "PASS ✓" : "FAIL ✗"}`);
  console.log(`Gate C — StreetGenerationReview queue row written:          ${gC ? "PASS ✓" : "FAIL ✗"}`);
  console.log(`Gate D — no StreetContent row for condo key (not published): ${gD ? "PASS ✓" : "FAIL ✗"}`);
  console.log(`Gate E — sentinel StreetContent untouched (street tier):    ${gE ? "PASS ✓" : "FAIL ✗"}`);
  console.log(`        pre  ${preSentinelHash}`);
  console.log(`        post ${postSentinelHash}`);

  await prisma.streetGenerationReview.delete({ where: { streetSlug: condoReviewKey(BUILDING_SLUG) } }).catch(() => undefined);
  console.log("\n(cleanup) synthetic review row deleted.");

  const all = gA && gB && gC && gD && gE;
  console.log(`\n=== RESULT: ${all ? "PASS ✓ (condo fail-closed correct)" : "FAIL ✗"} ===`);
  await prisma.$disconnect();
  process.exit(all ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });
