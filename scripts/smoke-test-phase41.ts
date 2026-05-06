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
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/\\n$/, "");
    }
  } catch {
    /* ignore — fall through to .env */
  }
}
loadEnvLocal();

import { generateStreetContent } from "@/lib/generateStreet";
import { prisma } from "@/lib/prisma";
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
  let result;
  let runError: Error | null = null;
  try {
    result = await generateStreetContent(SLUG, NAME, { skipSms: true });
  } catch (e) {
    runError = e as Error;
    console.error(`\nERROR during generation: ${runError.message}`);
    console.error(runError.stack);
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

  // Gate 2: StreetGeneration row exists with terminal status
  const gen = postStreetGeneration;
  gate(
    "Gate 2: StreetGeneration row written with terminal status",
    !!gen && (gen.status === "succeeded" || gen.status === "failed"),
    gen ? `status=${gen.status}, attemptCount=${gen.attemptCount}, totalWords=${gen.totalWords}` : "row missing",
  );

  // Gate 3: StreetContent row updated with flattened description and Phase 4.1 FAQ
  const sc = postStreetContent;
  const descLen = sc?.description.length ?? 0;
  const faqLooksPhase41 = (() => {
    if (!sc?.faqJson) return false;
    try {
      const parsed = JSON.parse(sc.faqJson);
      if (!Array.isArray(parsed)) return false;
      // Phase 4.1 FAQ items have { question, answer } shape (not legacy { q, a })
      return parsed.length >= 6 && parsed.length <= 8 &&
        typeof parsed[0]?.question === "string" && typeof parsed[0]?.answer === "string";
    } catch {
      return false;
    }
  })();
  gate(
    "Gate 3a: StreetContent.description is non-empty flattened content",
    descLen >= 1000,
    sc ? `description.length=${descLen} chars` : "row missing",
  );
  gate(
    "Gate 3b: StreetContent.faqJson is Phase 4.1 shape (6-8 items, question/answer)",
    faqLooksPhase41,
    sc?.faqJson ? `parsed length signal: ${faqLooksPhase41 ? "phase41" : "legacy or malformed"}` : "faqJson missing",
  );

  // Gate 4: Token usage and cost are populated and reasonable
  const tokensIn = gen?.tokensIn ?? 0;
  const tokensOut = gen?.tokensOut ?? 0;
  const costUsd = gen?.costUsd ? parseFloat(gen.costUsd.toString()) : 0;
  gate(
    "Gate 4a: tokensIn populated and reasonable (1000-5000 range expected)",
    tokensIn >= 1000 && tokensIn <= 10000,
    `tokensIn=${tokensIn}`,
  );
  gate(
    "Gate 4b: tokensOut populated and reasonable (2000-6000 range expected per attempt)",
    tokensOut >= 1000 && tokensOut <= 20000,
    `tokensOut=${tokensOut}`,
  );
  gate(
    "Gate 4c: costUsd populated and within expected band (~$0.0005 - $0.02)",
    costUsd > 0 && costUsd < 0.05,
    `costUsd=$${costUsd.toFixed(6)}`,
  );

  // Gate 5: Sections + FAQ shape valid
  const sections = (gen?.sectionsJson as unknown as Array<{ id: string; heading: string; paragraphs: string[] }>) ?? [];
  const faq = (gen?.faqJson as unknown as Array<{ question: string; answer: string }>) ?? [];
  gate(
    "Gate 5a: sectionsJson has 8 sections in canonical order",
    sections.length === 8 &&
      ["about", "homes", "amenities", "market", "gettingAround", "schools", "bestFitFor", "differentPriorities"]
        .every((id, i) => sections[i]?.id === id),
    `sections.length=${sections.length}, ids=[${sections.map(s => s.id).join(",")}]`,
  );
  gate(
    "Gate 5b: faqJson has 6-8 items with question/answer shape",
    faq.length >= 6 && faq.length <= 8 &&
      faq.every(item => typeof item.question === "string" && typeof item.answer === "string"),
    `faq.length=${faq.length}`,
  );

  // Gate 6: Total word count within tier-appropriate floor (full-data: ≥1,200)
  const totalWords = gen?.totalWords ?? 0;
  gate(
    "Gate 6: totalWords meets full-data floor (≥1,200)",
    totalWords >= 1200 && totalWords <= 2000,
    `totalWords=${totalWords}`,
  );

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
    streetGeneration: gen,
    streetContent: sc ? {
      ...sc,
      description: sc.description.slice(0, 500) + "...[truncated]",
      faqJson: sc.faqJson?.slice(0, 500) + "...[truncated]",
      statsJson: "[omitted]",
    } : null,
    sectionsPreview: sections.map(s => ({
      id: s.id,
      heading: s.heading,
      paragraphCount: s.paragraphs.length,
      firstParagraph: s.paragraphs[0]?.slice(0, 200) + "...",
    })),
    faqPreview: faq,
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
