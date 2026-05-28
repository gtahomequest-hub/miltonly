// Step 2 verification: fail-closed orchestration.
//
// Confirms that when a Phase 4.1 generation fails (via the v2Passed=false
// path), the existing StreetContent row is preserved exactly and the
// queue mechanism (StreetGeneration + StreetGenerationReview) reflects
// the failure.
//
// Uses PHASE41_FORCE_FAIL_CLOSED=true to short-circuit the LLM call — no
// API tokens burned, no waiting for a real combined-validator failure.
//
// WRITE TARGETS (intentional):
//   - StreetGeneration: row marked status=failed (this is the queue signal)
//   - StreetGenerationReview: row with synthetic violation (the queue payload)
// NON-WRITE TARGETS (the fail-closed invariant):
//   - StreetContent: must be EXACTLY unchanged (description, status,
//     publishedAt, generatedAt, faqJson, etc.)

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
  } catch {
    /* ignore */
  }
}
loadEnvLocal();
process.env.AI_PROVIDER = "phase41_v2";
process.env.PHASE41_FORCE_FAIL_CLOSED = "true";

import { prisma } from "@/lib/prisma";
import { generateStreetContent } from "@/lib/generateStreet";

const SLUG = "centennial-forest-drive-milton";
const NAME = "Centennial Forest Drive";

function fp(row: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(row)).digest("hex").slice(0, 16);
}

async function main() {
  console.log("=".repeat(70));
  console.log("Step 2 verification: fail-closed orchestration");
  console.log("Slug:", SLUG);
  console.log("PHASE41_FORCE_FAIL_CLOSED:", process.env.PHASE41_FORCE_FAIL_CLOSED);
  console.log("=".repeat(70));

  // Pre-state snapshot
  const preSC = await prisma.streetContent.findUnique({ where: { streetSlug: SLUG } });
  const preSG = await prisma.streetGeneration.findUnique({ where: { streetSlug: SLUG } });
  const preSGR = await prisma.streetGenerationReview.findUnique({ where: { streetSlug: SLUG } });

  console.log("\nPRE-STATE:");
  console.log("  StreetContent: ", preSC ? {
    status: preSC.status,
    descLen: preSC.description.length,
    descHash: fp(preSC.description),
    publishedAt: preSC.publishedAt?.toISOString() ?? null,
    generatedAt: preSC.generatedAt?.toISOString() ?? null,
    needsReview: preSC.needsReview,
    rowHash: fp({ d: preSC.description, s: preSC.status, p: preSC.publishedAt, m: preSC.metaTitle }),
  } : "MISSING");
  console.log("  StreetGeneration: ", preSG ? {
    status: preSG.status,
    attemptCount: preSG.attemptCount,
    generatedAt: preSG.generatedAt.toISOString(),
  } : "MISSING");
  console.log("  StreetGenerationReview: ", preSGR ? {
    lastAttemptAt: preSGR.lastAttemptAt.toISOString(),
    violationCount: Array.isArray(preSGR.violations) ? (preSGR.violations as unknown[]).length : 0,
  } : "MISSING");

  // Run generation with forced fail
  console.log("\nRunning generateStreetContent() (force-fail-closed)...");
  let runError: Error | null = null;
  let result: Awaited<ReturnType<typeof generateStreetContent>> | undefined;
  const t0 = Date.now();
  try {
    result = await generateStreetContent(SLUG, NAME, { skipSms: true });
  } catch (e) {
    runError = e as Error;
  }
  const dt = Date.now() - t0;
  console.log(`Elapsed: ${(dt / 1000).toFixed(1)}s`);
  if (runError) console.log(`THREW: ${runError.message}`);
  if (result) console.log(`RESULT: passed=${result.passed}, attempts=${result.attempts}`);

  // Post-state
  const postSC = await prisma.streetContent.findUnique({ where: { streetSlug: SLUG } });
  const postSG = await prisma.streetGeneration.findUnique({ where: { streetSlug: SLUG } });
  const postSGR = await prisma.streetGenerationReview.findUnique({ where: { streetSlug: SLUG } });

  console.log("\nPOST-STATE:");
  console.log("  StreetContent: ", postSC ? {
    status: postSC.status,
    descLen: postSC.description.length,
    descHash: fp(postSC.description),
    publishedAt: postSC.publishedAt?.toISOString() ?? null,
    generatedAt: postSC.generatedAt?.toISOString() ?? null,
    needsReview: postSC.needsReview,
    rowHash: fp({ d: postSC.description, s: postSC.status, p: postSC.publishedAt, m: postSC.metaTitle }),
  } : "MISSING");
  console.log("  StreetGeneration: ", postSG ? {
    status: postSG.status,
    attemptCount: postSG.attemptCount,
    generatedAt: postSG.generatedAt.toISOString(),
  } : "MISSING");
  console.log("  StreetGenerationReview: ", postSGR ? {
    lastAttemptAt: postSGR.lastAttemptAt.toISOString(),
    violationCount: Array.isArray(postSGR.violations) ? (postSGR.violations as unknown[]).length : 0,
    sampleViolation: Array.isArray(postSGR.violations) && (postSGR.violations as unknown[])[0]
      ? JSON.stringify((postSGR.violations as unknown[])[0]).slice(0, 200)
      : null,
  } : "MISSING");

  // Gates
  console.log("\n=== GATES ===");
  const preRowHash = preSC ? fp({ d: preSC.description, s: preSC.status, p: preSC.publishedAt, m: preSC.metaTitle }) : "MISSING";
  const postRowHash = postSC ? fp({ d: postSC.description, s: postSC.status, p: postSC.publishedAt, m: postSC.metaTitle }) : "MISSING";
  const scUnchanged = preRowHash === postRowHash;

  const sgFailed = postSG?.status === "failed";
  const sgrHasViolations = postSGR ? (Array.isArray(postSGR.violations) ? (postSGR.violations as unknown[]).length >= 1 : false) : false;

  console.log(`Gate A — StreetContent unchanged (description/status/publishedAt/metaTitle):    ${scUnchanged ? "PASS ✓" : "FAIL ✗"}`);
  console.log(`        pre rowHash:  ${preRowHash}`);
  console.log(`        post rowHash: ${postRowHash}`);
  console.log(`Gate B — StreetGeneration.status === "failed":                                  ${sgFailed ? "PASS ✓" : "FAIL ✗"}`);
  console.log(`        post status: ${postSG?.status}`);
  console.log(`Gate C — StreetGenerationReview has at least 1 violation:                      ${sgrHasViolations ? "PASS ✓" : "FAIL ✗"}`);
  console.log(`        violation count: ${postSGR ? (Array.isArray(postSGR.violations) ? (postSGR.violations as unknown[]).length : "non-array") : "MISSING"}`);

  const allPass = scUnchanged && sgFailed && sgrHasViolations;
  console.log(`\n=== RESULT: ${allPass ? "PASS ✓ (fail-closed correct)" : "FAIL ✗"} ===`);

  await prisma.$disconnect();
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
