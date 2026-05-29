// WS4 (DEC-WS4) gate (d): a deliberately-thin synthetic urban_hub (sub-k market
// segment) routes to StreetGenerationReview and does NOT publish. StreetContent
// (street tier) is left untouched. Mirrors the PHASE41_FORCE_FAIL_CLOSED scaffold
// pattern in scripts/test-fail-closed.ts: the fail is synthesized WITHOUT any LLM
// call — here by running the real hub validator on a genuinely-thin synthetic
// input, which fires comparison_mismatch (side_ungrounded) because the sub-k
// neighbourhood typicalPrice is suppressed.
//
// WRITE TARGET (intentional): StreetGenerationReview row keyed `hub:<slug>` (queue).
// NON-WRITE TARGET (the fail-closed invariant): StreetContent — a sentinel street
// row must be byte-identical pre/post, and no StreetContent row may exist for the
// hub key. The synthetic review row is deleted at the end (no prod pollution).

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
import { validateHubSectionsSubset } from "@/lib/ai/validateHubGeneration";
import { routeHubGeneration, hubReviewKey } from "@/lib/ai/hub/hubFailClosed";
import type { HubGeneratorInput, MiltonWideContext, HubSection } from "@/types/hub-generator";

const HUB_SLUG = "ws4-failclosed-synthetic-thin-hub";
const SENTINEL_STREET = "centennial-forest-drive-milton"; // a real published street, must stay untouched

function fp(row: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(row)).digest("hex").slice(0, 16);
}

// Deliberately-thin synthetic urban_hub: market segment sub-k (typicalPrice
// suppressed). A compared-to-milton claim cannot be grounded on the nbhd side.
const THIN_HUB: HubGeneratorInput = {
  neighbourhood: { slug: HUB_SLUG, name: "Synthetic Thin Hub", profile: "urban_hub", kind: "urban", rawStrings: ["SYNTH"] },
  aggregates: { txCount: 4, salesCount: 3, leasesCount: 1, typicalPrice: null, priceRange: null, daysOnMarket: null, kAnonLevel: "thin" },
  byType: {}, quarterlyTrend: [], activeListingsCount: 2, activeByType: {},
  projectedStreets: [], vipStreetCount: 0, streetCount: 0, schools: { sourced: false },
};
const MILTON: MiltonWideContext = {
  scope: "milton-wide",
  aggregates: { txCount: 4000, salesCount: 1900, leasesCount: 2100, typicalPrice: 950_000, priceRange: { low: 90_000, high: 5_000_000 }, daysOnMarket: 90, kAnonLevel: "full" },
  quarterlyTrend: [], activeListingsCount: 490, neighbourhoodCount: 14,
};
// A compared-to-milton section a generator might emit despite the thin data.
const SECTIONS: HubSection[] = [
  { id: "comparedToMilton", heading: "How Synthetic Thin Hub compares to Milton",
    paragraphs: ["The neighbourhood trades above the rest of Milton, sitting higher than the wider Milton market."] },
];

async function main() {
  console.log("=".repeat(70));
  console.log("WS4 gate (d): hub fail-closed — thin synthetic urban_hub");
  console.log("hub slug:", HUB_SLUG, "| review key:", hubReviewKey(HUB_SLUG));
  console.log("=".repeat(70));

  // Pre-state: sentinel StreetContent + (absence of) hub review row.
  const preSentinel = await prisma.streetContent.findUnique({ where: { streetSlug: SENTINEL_STREET } });
  const preHubContent = await prisma.streetContent.findUnique({ where: { streetSlug: hubReviewKey(HUB_SLUG) } });
  // clean any stale synthetic review row from a prior run
  await prisma.streetGenerationReview.delete({ where: { streetSlug: hubReviewKey(HUB_SLUG) } }).catch(() => undefined);

  const preSentinelHash = preSentinel
    ? fp({ d: preSentinel.description, s: preSentinel.status, p: preSentinel.publishedAt, m: preSentinel.metaTitle })
    : "MISSING";
  console.log("\nPRE-STATE:");
  console.log("  sentinel StreetContent rowHash:", preSentinelHash, `(status=${preSentinel?.status})`);
  console.log("  StreetContent for hub key exists?:", preHubContent ? "YES (unexpected)" : "no");

  // 1. Validate the thin synthetic hub (no LLM). Expect hard violations.
  const violations = validateHubSectionsSubset(SECTIONS, THIN_HUB, MILTON);
  const inputHash = crypto.createHash("sha256").update(JSON.stringify(THIN_HUB)).digest("hex");
  console.log("\nVALIDATOR:");
  console.log(`  total violations: ${violations.length}`);
  for (const v of violations) console.log(`   - ${v.rule}: ${v.excerpt.slice(0, 150)}`);

  // 2. Route fail-closed.
  const route = await routeHubGeneration(HUB_SLUG, violations, inputHash);
  console.log("\nROUTE:", JSON.stringify(route));

  // Post-state.
  const postSentinel = await prisma.streetContent.findUnique({ where: { streetSlug: SENTINEL_STREET } });
  const postHubContent = await prisma.streetContent.findUnique({ where: { streetSlug: hubReviewKey(HUB_SLUG) } });
  const queueRow = await prisma.streetGenerationReview.findUnique({ where: { streetSlug: hubReviewKey(HUB_SLUG) } });
  const postSentinelHash = postSentinel
    ? fp({ d: postSentinel.description, s: postSentinel.status, p: postSentinel.publishedAt, m: postSentinel.metaTitle })
    : "MISSING";

  console.log("\nPOST-STATE:");
  console.log("  sentinel StreetContent rowHash:", postSentinelHash);
  console.log("  StreetContent for hub key exists?:", postHubContent ? "YES (FAIL)" : "no");
  console.log("  StreetGenerationReview (queue) row:", queueRow ? {
    streetSlug: queueRow.streetSlug,
    lastInputHash: queueRow.lastInputHash.slice(0, 16),
    violationCount: Array.isArray(queueRow.violations) ? (queueRow.violations as unknown[]).length : 0,
    sample: Array.isArray(queueRow.violations) ? JSON.stringify((queueRow.violations as unknown[])[0]).slice(0, 160) : null,
  } : "MISSING");

  // Gates.
  console.log("\n=== GATES ===");
  const gA = violations.some((v) => v.rule === "comparison_mismatch" && v.severity === "hard");
  const gB = route.published === false && route.queued === true;
  const gC = !!queueRow && (Array.isArray(queueRow.violations) ? (queueRow.violations as unknown[]).length >= 1 : false);
  const gD = !postHubContent; // no hub content published
  const gE = preSentinelHash === postSentinelHash; // street tier untouched
  console.log(`Gate A — thin hub fires hard comparison_mismatch:        ${gA ? "PASS ✓" : "FAIL ✗"}`);
  console.log(`Gate B — routeHubGeneration: published=false, queued:    ${gB ? "PASS ✓" : "FAIL ✗"}`);
  console.log(`Gate C — StreetGenerationReview queue row written:       ${gC ? "PASS ✓" : "FAIL ✗"}`);
  console.log(`Gate D — no StreetContent row for hub key (not published): ${gD ? "PASS ✓" : "FAIL ✗"}`);
  console.log(`Gate E — sentinel StreetContent untouched (street tier):  ${gE ? "PASS ✓" : "FAIL ✗"}`);
  console.log(`        pre  ${preSentinelHash}`);
  console.log(`        post ${postSentinelHash}`);

  // Cleanup the synthetic review row (no prod pollution).
  await prisma.streetGenerationReview.delete({ where: { streetSlug: hubReviewKey(HUB_SLUG) } }).catch(() => undefined);
  console.log("\n(cleanup) synthetic review row deleted.");

  const all = gA && gB && gC && gD && gE;
  console.log(`\n=== RESULT: ${all ? "PASS ✓ (hub fail-closed correct)" : "FAIL ✗"} ===`);
  await prisma.$disconnect();
  process.exit(all ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(2); });
