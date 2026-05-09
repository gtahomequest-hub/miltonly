// scripts/run-task3-subtest.ts
//
// Phase 4.1 Task 3 sub-test runner. Triggers a single Phase 4.1 generation
// against a target slug with a specified architecture variant, captures
// all telemetry (cost, wall-clock, validator violations per attempt, market
// section prose), and writes per-sample output to experiment-output/.
//
// Bypasses PHASE41_HALT in-process by calling generatePhase41StreetContent
// directly (skipping the env-flag gate that lives in generateStreet.ts).
// Does NOT mutate process.env. Does NOT touch the StreetGeneration DB row.
//
// Usage:
//   npx tsx scripts/run-task3-subtest.ts \
//     --variant <sonnet|haiku|deepseek-antifab|deepseek-twopass-causal|deepseek-antifab-validator> \
//     --slug <street-slug> [--n <runs>] [--label <label>]
//
//   Variants map to AI_PROVIDER_MARKET as follows:
//     sonnet                       -> sonnet
//     haiku                        -> haiku
//     deepseek-antifab             -> deepseek (working-tree market prompt = anti-fab)
//     deepseek-twopass-causal      -> deepseek-twopass-causal
//     deepseek-antifab-validator   -> deepseek (validator's numeric_ungrounded already wires via partial validator)
//
// Per-run output: experiment-output/task3-<variant>-run<n>-<ts>.json
//   { variant, slug, runIdx, startedAt, finishedAt, wallClockMs, result, error? }
//
// where result is the full Phase41GenerationResult (output sections + faq +
// attempts trace + per-attempt violations + token + cost) or, on failure,
// the Phase41GenerationError payload.

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

type Variant =
  | "sonnet"
  | "haiku"
  | "deepseek-antifab"
  | "deepseek-twopass-causal"
  | "deepseek-antifab-validator";

const VARIANT_TO_MARKET_MODE: Record<Variant, string> = {
  "sonnet": "sonnet",
  "haiku": "haiku",
  "deepseek-antifab": "deepseek",
  "deepseek-twopass-causal": "deepseek-twopass-causal",
  "deepseek-antifab-validator": "deepseek",
};

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag: string, fallback?: string) => {
    const i = args.indexOf(flag);
    return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
  };
  const variant = get("--variant") as Variant | undefined;
  const slug = get("--slug");
  const n = parseInt(get("--n", "1") ?? "1", 10);
  const label = get("--label", variant);
  if (!variant || !VARIANT_TO_MARKET_MODE[variant]) {
    throw new Error(
      `--variant required. one of: ${Object.keys(VARIANT_TO_MARKET_MODE).join(", ")}`,
    );
  }
  if (!slug) throw new Error("--slug required");
  if (!Number.isFinite(n) || n < 1) throw new Error("--n must be a positive integer");
  return { variant: variant as Variant, slug, n, label };
}

function wordsIn(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

interface AttemptSummary {
  attemptN: number;
  violationCount: number;
  violationRules: string[];
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}

interface RunSummary {
  variant: Variant;
  slug: string;
  runIdx: number;
  marketModeApplied: string;
  startedAt: string;
  finishedAt: string;
  wallClockMs: number;
  outcome: "success" | "phase41_error" | "exception";
  validatorPassed: boolean | null;
  attemptCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  finalViolations: { rule: string; sectionId?: string; excerpt: string; severity: string }[];
  attempts: AttemptSummary[];
  perSectionWordCount: Record<string, number>;
  totalWords: number;
  marketSectionProse: string | null;
  errorMessage?: string;
}

async function main() {
  const { variant, slug, n, label } = parseArgs();
  const marketMode = VARIANT_TO_MARKET_MODE[variant];

  // Set per-process env. Does NOT modify the user's .env.local — only this
  // child process sees it.
  process.env.AI_PROVIDER_MARKET = marketMode;
  // Bypass PHASE41_HALT for this in-process call by NOT going through
  // generateStreetContent (which checks the env flag). We call
  // generatePhase41StreetContent directly. PHASE41_HALT in env stays unchanged.

  // Lazy imports to ensure env vars are set before any module-level reads.
  const { prisma } = await import("@/lib/prisma");
  const { buildGeneratorInput } = await import("@/lib/ai/buildGeneratorInput");
  const { generatePhase41StreetContent, Phase41GenerationError } = await import("@/lib/ai/compliance");

  console.log(`==== Task 3 sub-test: ${label} | slug=${slug} | n=${n} | AI_PROVIDER_MARKET=${marketMode} ====`);

  const phase41Input = await buildGeneratorInput(slug);
  console.log(
    `[task3] input ready: kAnonLevel=${phase41Input.aggregates.kAnonLevel} ` +
    `salesCount=${phase41Input.aggregates.salesCount} ` +
    `activeListings=${(phase41Input.aggregates as { activeListingsCount?: number }).activeListingsCount ?? "n/a"}`,
  );

  const outDir = path.join(process.cwd(), "experiment-output");
  mkdirSync(outDir, { recursive: true });

  for (let i = 1; i <= n; i++) {
    const startedAt = new Date();
    const wallStart = Date.now();
    let summary: RunSummary;

    try {
      const result = await generatePhase41StreetContent(phase41Input);
      const wallClockMs = Date.now() - wallStart;

      const perSectionWordCount: Record<string, number> = {};
      let totalWords = 0;
      for (const s of result.output.sections) {
        const w = wordsIn(s.paragraphs.join(" "));
        perSectionWordCount[s.id] = w;
        totalWords += w;
      }
      const marketSection = result.output.sections.find((s) => s.id === "market");

      summary = {
        variant,
        slug,
        runIdx: i,
        marketModeApplied: marketMode,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        wallClockMs,
        outcome: "success",
        validatorPassed: result.validatorPassed,
        attemptCount: result.attemptCount,
        totalInputTokens: result.totalInputTokens,
        totalOutputTokens: result.totalOutputTokens,
        totalCostUsd: result.totalCostUsd,
        finalViolations: result.finalViolations.map((v) => ({
          rule: v.rule,
          sectionId: v.sectionId,
          excerpt: v.excerpt,
          severity: v.severity,
        })),
        attempts: result.attempts.map((a) => ({
          attemptN: a.attemptN,
          violationCount: a.violations.length,
          violationRules: a.violations.map((v) => (v.sectionId ? `${v.rule}@${v.sectionId}` : v.rule)),
          tokensIn: a.tokens.in,
          tokensOut: a.tokens.out,
          costUsd: a.costUsd,
        })),
        perSectionWordCount,
        totalWords,
        marketSectionProse: marketSection ? marketSection.paragraphs.join("\n\n") : null,
      };
      console.log(
        `[task3] run ${i}/${n} OUTCOME=success validatorPassed=${result.validatorPassed} ` +
        `attempts=${result.attemptCount} totalWords=${totalWords} ` +
        `marketWords=${perSectionWordCount.market ?? "?"} ` +
        `cost=$${result.totalCostUsd.toFixed(5)} wall=${(wallClockMs / 1000).toFixed(1)}s`,
      );
    } catch (e) {
      const wallClockMs = Date.now() - wallStart;
      const isP41 = e instanceof Phase41GenerationError;
      const payload = isP41 ? e.payload : null;
      summary = {
        variant,
        slug,
        runIdx: i,
        marketModeApplied: marketMode,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        wallClockMs,
        outcome: isP41 ? "phase41_error" : "exception",
        validatorPassed: false,
        attemptCount: payload?.attemptCount ?? 0,
        totalInputTokens: payload?.totalInputTokens ?? 0,
        totalOutputTokens: payload?.totalOutputTokens ?? 0,
        totalCostUsd: payload?.totalCostUsd ?? 0,
        finalViolations: (payload?.violations ?? []).map((v) => ({
          rule: v.rule,
          sectionId: v.sectionId,
          excerpt: v.excerpt,
          severity: v.severity,
        })),
        attempts: (payload?.attempts ?? []).map((a) => ({
          attemptN: a.attemptN,
          violationCount: a.violations.length,
          violationRules: a.violations.map((v) => (v.sectionId ? `${v.rule}@${v.sectionId}` : v.rule)),
          tokensIn: a.tokens.in,
          tokensOut: a.tokens.out,
          costUsd: a.costUsd,
        })),
        perSectionWordCount: {},
        totalWords: 0,
        marketSectionProse: null,
        errorMessage: (e as Error).message.slice(0, 600),
      };
      console.log(
        `[task3] run ${i}/${n} OUTCOME=${summary.outcome} attempts=${summary.attemptCount} ` +
        `cost=$${summary.totalCostUsd.toFixed(5)} wall=${(wallClockMs / 1000).toFixed(1)}s ` +
        `error=${summary.errorMessage?.slice(0, 120)}`,
      );
    }

    const outPath = path.join(outDir, `task3-${variant}-run${i}-${Date.now()}.json`);
    writeFileSync(outPath, JSON.stringify(summary, null, 2));
    console.log(`[task3] wrote ${outPath}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
