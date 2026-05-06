// scripts/smoke-test-phase41.ts
//
// Phase 4.1 v2 path smoke test against etheridge-avenue-milton.
// Calls generateStreetContent() with AI_PROVIDER=phase41_v2 and verifies the
// full chain: buildGeneratorInput → generatePhase41StreetContent → DeepSeek
// JSON output → validator → dual-write to StreetContent + StreetGeneration.
//
// Run: AI_PROVIDER=phase41_v2 npx tsx scripts/smoke-test-phase41.ts
// Or:  $env:AI_PROVIDER="phase41_v2"; npx tsx scripts/smoke-test-phase41.ts  (PowerShell)
//
// Does NOT clean up rows after run. The Etheridge Ave production page goes
// from legacy 300-word draft → Phase 4.1 1,500-word published on first
// successful run. That's intentional — first production v2 canary.

import { readFileSync } from "node:fs";

// Load .env.local before any module that constructs Prisma/Neon clients runs.
// Done before imports take effect via require-time hoisting wouldn't work, so
// we use Node's --env-file flag at the CLI; this fallback covers manual runs.
function loadEnvLocal(): void {
  try {
    const raw = readFileSync(".env.local", "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        let value = m[2].replace(/\\n$/, "");
        // Strip a single matched pair of surrounding quotes (dotenv-spec behavior)
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        process.env[m[1]] = value;
      }
    }
  } catch {
    /* ignore — fall through to .env */
  }
}
loadEnvLocal();

import { generateStreetContent } from "@/lib/generateStreet";
import { prisma } from "@/lib/prisma";
import { getTotalWordFloor } from "@/lib/ai/validateStreetGeneration";
import * as fs from "fs";
import * as path from "path";

const SLUG = process.env.SMOKE_TEST_SLUG || "etheridge-avenue-milton";
const NAME = process.env.SMOKE_TEST_NAME || "Etheridge Ave";

// Track gate outcomes
type Gate = { name: string; passed: boolean; detail: string };
const gates: Gate[] = [];
function gate(name: string, passed: boolean, detail: string) {
  gates.push({ name, passed, detail });
  const mark = passed ? "✓" : "✗";
  console.log(`  [${mark}] ${name}: ${detail}`);
}

async function main() {
  console.log("=".repeat(70));
  console.log(`Phase 4.1 v2 smoke test`);
  console.log(`Slug: ${SLUG}`);
  console.log(`Name: ${NAME}`);
  console.log(`AI_PROVIDER: ${process.env.AI_PROVIDER || "(unset)"}`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log("=".repeat(70));

  // Pre-flight: confirm AI_PROVIDER is set correctly
  if ((process.env.AI_PROVIDER || "").trim() !== "phase41_v2") {
    console.error("ERROR: AI_PROVIDER must be set to 'phase41_v2' for this test.");
    console.error("Run: AI_PROVIDER=phase41_v2 npx tsx scripts/smoke-test-phase41.ts");
    process.exit(2);
  }

  // Pre-flight: snapshot existing DB state
  const preStreetContent = await prisma.streetContent.findUnique({ where: { streetSlug: SLUG } });
  const preStreetGeneration = await prisma.streetGeneration.findUnique({ where: { streetSlug: SLUG } });
  console.log("\nPre-state:");
  console.log(`  StreetContent: ${preStreetContent ? `exists (status=${preStreetContent.status})` : "null"}`);
  console.log(`  StreetGeneration: ${preStreetGeneration ? `exists (status=${preStreetGeneration.status})` : "null"}`);

  // Run the generator
  console.log("\nRunning generateStreetContent()...");
  const startTime = Date.now();
  const startDate = new Date();
  let result: Awaited<ReturnType<typeof generateStreetContent>> | undefined;
  let runError: Error | null = null;
  try {
    result = await generateStreetContent(SLUG, NAME, { skipSms: true });
  } catch (e) {
    runError = e as Error;
    const errAny = e as unknown as Record<string, unknown> & { cause?: unknown; payload?: Record<string, unknown> };
    console.error(`\n=== ERROR during generation ===`);
    console.error(`name:    ${runError.name}`);
    console.error(`message: ${runError.message}`);
    console.error(`stack:\n${runError.stack}`);
    if (errAny.cause !== undefined) {
      console.error(`\ncause:`);
      console.error(errAny.cause);
      const cause = errAny.cause as { message?: string; stack?: string };
      if (cause && typeof cause === "object") {
        if (cause.message) console.error(`cause.message: ${cause.message}`);
        if (cause.stack) console.error(`cause.stack:\n${cause.stack}`);
      }
    } else {
      console.error(`\ncause: (none)`);
    }
    // Phase41GenerationError carries its real payload here
    if (errAny.payload && typeof errAny.payload === "object") {
      console.error(`\npayload keys: ${Object.keys(errAny.payload).join(", ")}`);
      console.error(`payload.attemptCount:    ${errAny.payload.attemptCount}`);
      console.error(`payload.totalInputTokens:  ${errAny.payload.totalInputTokens}`);
      console.error(`payload.totalOutputTokens: ${errAny.payload.totalOutputTokens}`);
      console.error(`payload.totalCostUsd:      ${errAny.payload.totalCostUsd}`);
      console.error(`payload.violations (${Array.isArray(errAny.payload.violations) ? (errAny.payload.violations as unknown[]).length : "n/a"}):`);
      console.error(JSON.stringify(errAny.payload.violations, null, 2));
      console.error(`\npayload.attempts:`);
      console.error(JSON.stringify(errAny.payload.attempts, null, 2));
    } else {
      console.error(`\npayload: (none — not a Phase41GenerationError)`);
    }
    // Probe optional debug fields the user asked about (may not exist yet)
    for (const key of ["lastResponseRaw", "lastParseError", "finalViolations", "attemptCount"]) {
      if (key in errAny) {
        console.error(`\nerror.${key}:`);
        console.error(errAny[key]);
      }
    }
    // Custom-prop dump for anything else
    const ownKeys = Object.getOwnPropertyNames(errAny).filter(
      k => !["name", "message", "stack", "cause", "payload"].includes(k),
    );
    if (ownKeys.length > 0) {
      console.error(`\nother own props: ${ownKeys.join(", ")}`);
      for (const k of ownKeys) {
        console.error(`  ${k}:`, errAny[k]);
      }
    }
    console.error(`=== END ERROR ===\n`);
  }
  const elapsedMs = Date.now() - startTime;

  console.log(`\nElapsed: ${(elapsedMs / 1000).toFixed(1)}s`);
  if (result) {
    console.log(`Result: passed=${result.passed} attempts=${result.attempts}`);
  }

  // Gate 1: function returned without throwing
  gate(
    "Gate 1: generateStreetContent() returned without throwing",
    runError === null,
    runError ? `threw: ${runError.message}` : `returned in ${(elapsedMs / 1000).toFixed(1)}s`,
  );

  // Read post-state from both tables
  const postStreetContent = await prisma.streetContent.findUnique({ where: { streetSlug: SLUG } });
  const postStreetGeneration = await prisma.streetGeneration.findUnique({ where: { streetSlug: SLUG } });

  console.log("\nPost-state:");
  console.log(`  StreetContent: ${postStreetContent ? `exists (status=${postStreetContent.status})` : "null"}`);
  console.log(`  StreetGeneration: ${postStreetGeneration ? `exists (status=${postStreetGeneration.status})` : "null"}`);

  // Pull in-memory output from the success path, or err.payload from the throw
  // path. Content gates (3, 5, 6) MUST validate against THIS run's data; the DB
  // row may carry stale content from a prior succeeded run on the failure path.
  type ErrPayload = {
    violations: Array<{ rule: string; sectionId?: string; excerpt: string }>;
    attemptCount: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostUsd: number;
    attempts: Array<{
      attemptN: number;
      violations: Array<{ rule: string; sectionId?: string; excerpt: string }>;
      tokens: { in: number; out: number };
      costUsd: number;
    }>;
  };
  const errPayload: ErrPayload | null =
    (runError && (runError as unknown as { payload?: ErrPayload }).payload) || null;
  const inMemV2 = result?.v2;
  const inMemAttemptCount = result?.attempts ?? errPayload?.attemptCount ?? 0;
  const inMemTokensIn = inMemV2?.tokensIn ?? errPayload?.totalInputTokens ?? 0;
  const inMemTokensOut = inMemV2?.tokensOut ?? errPayload?.totalOutputTokens ?? 0;
  const inMemCostUsd = inMemV2?.costUsd ?? errPayload?.totalCostUsd ?? 0;

  function naGate(name: string, reason: string) {
    console.log(`  [N/A] ${name}: ${reason}`);
    gates.push({ name: `${name} [N/A]`, passed: true, detail: `N/A — ${reason}` });
  }

  // Gate 2: StreetGeneration row exists with terminal status
  const gen = postStreetGeneration;
  gate(
    "Gate 2: StreetGeneration row written with terminal status",
    !!gen && (gen.status === "succeeded" || gen.status === "failed"),
    gen ? `status=${gen.status}, attemptCount=${gen.attemptCount}, totalWords=${gen.totalWords}` : "row missing",
  );

  // Gate 2b: row reflects THIS run, not a prior one. Checks generatedAt is at
  // or after the smoke-test start time, and attemptCount matches in-memory.
  if (gen) {
    const generatedAtFresh = gen.generatedAt >= startDate;
    const attemptMatches = gen.attemptCount === inMemAttemptCount;
    gate(
      "Gate 2b: row reflects THIS run (generatedAt fresh, attemptCount matches in-memory)",
      generatedAtFresh && attemptMatches,
      `generatedAt=${gen.generatedAt.toISOString()} (start=${startDate.toISOString()}, fresh=${generatedAtFresh}), row.attemptCount=${gen.attemptCount} vs in-memory=${inMemAttemptCount}`,
    );
  } else {
    gate("Gate 2b: row reflects THIS run (generatedAt fresh, attemptCount matches in-memory)", false, "row missing");
  }

  // Gate 3: StreetContent description and FAQ — gated on in-memory v2 output
  // when the generator succeeded; N/A on the throw path because there's no
  // in-memory content to validate.
  if (inMemV2) {
    const flatDesc = inMemV2.sections.flatMap(s => s.paragraphs).join("\n\n");
    gate(
      "Gate 3a: in-memory description (flattened sections) ≥ 1000 chars",
      flatDesc.length >= 1000,
      `flat description length=${flatDesc.length}`,
    );
    const faqLooksPhase41 =
      Array.isArray(inMemV2.faq) &&
      inMemV2.faq.length >= 6 &&
      inMemV2.faq.length <= 8 &&
      inMemV2.faq.every(item => typeof item.question === "string" && typeof item.answer === "string");
    gate(
      "Gate 3b: in-memory FAQ is Phase 4.1 shape (6-8 items, question/answer)",
      faqLooksPhase41,
      `faq.length=${inMemV2.faq.length}`,
    );
  } else {
    naGate("Gate 3a: in-memory description (flattened sections) ≥ 1000 chars", "no in-memory output — generator failed at gate 1");
    naGate("Gate 3b: in-memory FAQ is Phase 4.1 shape (6-8 items, question/answer)", "no in-memory output — generator failed at gate 1");
  }

  // Gate 4: Token usage and cost — pulled from in-memory totals (success or
  // err.payload). Never from the DB row.
  gate(
    "Gate 4a: tokensIn populated and total ≤ 25000 across all attempts",
    inMemTokensIn > 0 && inMemTokensIn <= 25000,
    `tokensIn=${inMemTokensIn}`,
  );
  gate(
    "Gate 4b: tokensOut populated and total ≤ 20000 across all attempts",
    inMemTokensOut >= 1000 && inMemTokensOut <= 20000,
    `tokensOut=${inMemTokensOut}`,
  );
  gate(
    "Gate 4c: costUsd populated and within expected band (~$0.0005 - $0.02)",
    inMemCostUsd > 0 && inMemCostUsd < 0.05,
    `costUsd=$${inMemCostUsd.toFixed(6)}`,
  );

  // Gate 5: Sections + FAQ shape — in-memory only.
  if (inMemV2) {
    gate(
      "Gate 5a: in-memory sections has 8 entries in canonical order",
      inMemV2.sections.length === 8 &&
        ["about", "homes", "amenities", "market", "gettingAround", "schools", "bestFitFor", "differentPriorities"]
          .every((id, i) => inMemV2.sections[i]?.id === id),
      `sections.length=${inMemV2.sections.length}, ids=[${inMemV2.sections.map(s => s.id).join(",")}]`,
    );
    gate(
      "Gate 5b: in-memory FAQ has 6-8 items with question/answer shape",
      inMemV2.faq.length >= 6 && inMemV2.faq.length <= 8 &&
        inMemV2.faq.every(item => typeof item.question === "string" && typeof item.answer === "string"),
      `faq.length=${inMemV2.faq.length}`,
    );
  } else {
    naGate("Gate 5a: in-memory sections has 8 entries in canonical order", "no in-memory output — generator failed at gate 1");
    naGate("Gate 5b: in-memory FAQ has 6-8 items with question/answer shape", "no in-memory output — generator failed at gate 1");
  }

  // Gate 6: Total word count meets the validator's tier-aware floor for THIS
  // run's kAnonLevel. Floor via getTotalWordFloor (single source of truth).
  if (inMemV2) {
    const floor = getTotalWordFloor(inMemV2.kAnonLevel);
    gate(
      `Gate 6: in-memory totalWords meets validator floor for kAnon=${inMemV2.kAnonLevel} (≥${floor})`,
      inMemV2.totalWords >= floor && inMemV2.totalWords <= 2000,
      `totalWords=${inMemV2.totalWords}, kAnonLevel=${inMemV2.kAnonLevel}, floor=${floor}`,
    );
  } else {
    naGate("Gate 6: in-memory totalWords meets validator floor", "no in-memory output — generator failed at gate 1");
  }

  // Write full output to inspection file
  const outputDir = path.join(process.cwd(), "experiment-output");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `phase41-smoke-${SLUG}-${Date.now()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify({
    slug: SLUG,
    name: NAME,
    runError: runError ? { message: runError.message, stack: runError.stack } : null,
    elapsedMs,
    gates,
    streetGeneration: postStreetGeneration,
    streetContent: postStreetContent ? {
      ...postStreetContent,
      description: postStreetContent.description.slice(0, 500) + "...[truncated]",
      faqJson: postStreetContent.faqJson?.slice(0, 500) + "...[truncated]",
      statsJson: "[omitted]",
    } : null,
    inMemoryV2: inMemV2 ? {
      kAnonLevel: inMemV2.kAnonLevel,
      totalWords: inMemV2.totalWords,
      tokensIn: inMemV2.tokensIn,
      tokensOut: inMemV2.tokensOut,
      costUsd: inMemV2.costUsd,
      sectionsPreview: inMemV2.sections.map(s => ({
        id: s.id,
        heading: s.heading,
        paragraphCount: s.paragraphs.length,
        firstParagraph: s.paragraphs[0]?.slice(0, 200) + "...",
      })),
      faqPreview: inMemV2.faq,
    } : null,
    errPayload,
  }, null, 2));
  console.log(`\nFull output written to: ${outputPath}`);

  // Final summary
  console.log("\n" + "=".repeat(70));
  const passed = gates.filter(g => g.passed).length;
  const total = gates.length;
  console.log(`SUMMARY: ${passed}/${total} gates passed`);
  console.log("=".repeat(70));

  if (passed < total) {
    console.log("\nFAILED GATES:");
    gates.filter(g => !g.passed).forEach(g => console.log(`  ✗ ${g.name}: ${g.detail}`));
  }

  await prisma.$disconnect();
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => {
  console.error("Unhandled error in smoke test:", e);
  process.exit(2);
});
