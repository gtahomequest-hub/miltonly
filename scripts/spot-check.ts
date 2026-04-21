// Phase 4.1 Step 8 — spot-check harness.
//
// Runs the 8-section generator against 5 canonical Milton streets and writes
// each output to docs/phase-4.1/spot-check/. Read-only against the DB; the
// only writes are to disk. Prisma writes are reserved for Step 9 backfill.
//
// Cost estimate: claude-opus-4-7 at $15/Mtok input, $75/Mtok output. A typical
// call is ~12K in / 2-4K out → $0.35-$0.48 per attempt. Budget for 5 streets
// with some retry overhead: $5-$8. Script STOPS if running cost exceeds $10.
//
// Run: `TSX_TSCONFIG_PATH=./tsconfig.test.json npx --yes tsx scripts/spot-check.ts`
// Env: reads .env.local for ANTHROPIC_API_KEY and DB URLs.

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const FIXTURE_SLUGS = [
  "main-st-e-milton",
  "scott-blvd-milton",
  "ruddy-cres-milton",
  "lily-cres-milton",
  "calla-point-milton",
];

const OUT_DIR = path.join(process.cwd(), "docs/phase-4.1/spot-check");

// claude-opus-4-7 pricing (USD per million tokens). No prompt caching in use.
const PRICE_IN_PER_MTOK = 15;
const PRICE_OUT_PER_MTOK = 75;
const COST_STOP_USD = 10;

interface AttemptUsage {
  attemptNumber: number;
  tokensIn: number;
  tokensOut: number;
}

function loadEnvLocal() {
  try {
    const raw = readFileSync(".env.local", "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=["']?([^"'\n]+?)["']?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/\\n$/, "");
    }
  } catch {
    /* ignore — fall through to .env and real env */
  }
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

function hashInput(input: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, 12);
}

function costOf(usage: AttemptUsage[]): number {
  let c = 0;
  for (const u of usage) {
    c += (u.tokensIn / 1_000_000) * PRICE_IN_PER_MTOK;
    c += (u.tokensOut / 1_000_000) * PRICE_OUT_PER_MTOK;
  }
  return c;
}

/**
 * Intercept stdout for `[gen] {json}` lines emitted by generateStreetDescription.
 * Each call emits exactly one line with tokensIn/tokensOut/attemptNumber.
 */
function installGenLogCapture() {
  const origLog = console.log;
  let buffer: AttemptUsage[] = [];
  console.log = (...args: unknown[]) => {
    const first = args[0];
    if (typeof first === "string" && first.startsWith("[gen] ")) {
      try {
        const payload = JSON.parse(first.slice("[gen] ".length));
        if (
          typeof payload.tokensIn === "number" &&
          typeof payload.tokensOut === "number"
        ) {
          buffer.push({
            attemptNumber: payload.attemptNumber ?? buffer.length + 1,
            tokensIn: payload.tokensIn,
            tokensOut: payload.tokensOut,
          });
        }
      } catch {
        /* unparseable — ignore */
      }
    }
    origLog(...args);
  };
  return {
    take: () => {
      const out = buffer;
      buffer = [];
      return out;
    },
    restore: () => {
      console.log = origLog;
    },
  };
}

async function main() {
  // Env MUST load before any module that reads process.env at import time
  // (prisma, db.ts, generator). That's why the heavy imports below are
  // dynamic — static imports would hoist above this call.
  loadEnvLocal();

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY missing from env. Check .env.local.");
    process.exit(1);
  }
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const { buildGeneratorInput } = await import("@/lib/ai/buildGeneratorInput");
  const { generateStreetDescription } = await import(
    "@/lib/ai/generateStreetDescription"
  );
  const { generateWithRetry, validateStreetGeneration, StreetGenerationFailure } =
    await import("@/lib/ai/validateStreetGeneration");
  type StreetGeneratorInput = Awaited<ReturnType<typeof buildGeneratorInput>>;
  type StreetGeneratorOutput = Awaited<
    ReturnType<typeof generateStreetDescription>
  >;

  function totalWordCount(output: StreetGeneratorOutput): number {
    let n = 0;
    for (const section of output.sections) {
      for (const p of section.paragraphs) n += wordCount(p);
    }
    for (const q of output.faq) n += wordCount(q.question) + wordCount(q.answer);
    return n;
  }

  console.log(
    `Spot-check: ${FIXTURE_SLUGS.length} streets, budget $${COST_STOP_USD}`,
  );

  const capture = installGenLogCapture();
  const results: Array<{
    slug: string;
    status: "succeeded" | "failed";
    attempts: number;
    totalWords: number;
    violations: Array<{ rule: string; sectionId?: string; excerpt: string }>;
    usage: AttemptUsage[];
    cost: number;
    output?: StreetGeneratorOutput;
    error?: string;
  }> = [];
  let runningCost = 0;

  try {
    for (const slug of FIXTURE_SLUGS) {
      let input: StreetGeneratorInput;
      try {
        input = await buildGeneratorInput(slug);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(
          `[${slug}] INPUT_BUILD_FAILED: ${msg}`,
        );
        const failedPath = path.join(OUT_DIR, `${slug}-FAILED.json`);
        writeFileSync(
          failedPath,
          JSON.stringify(
            {
              streetSlug: slug,
              violations: [],
              lastAttemptAt: new Date().toISOString(),
              lastInputHash: "n/a",
              error: msg,
              phase: "buildGeneratorInput",
            },
            null,
            2,
          ),
          "utf-8",
        );
        results.push({
          slug,
          status: "failed",
          attempts: 0,
          totalWords: 0,
          violations: [],
          usage: [],
          cost: 0,
          error: msg,
        });
        continue;
      }
      const inputHash = hashInput(input);

      let output: StreetGeneratorOutput | undefined;
      let attemptCount = 0;
      let violations: Array<{ rule: string; sectionId?: string; excerpt: string }> =
        [];
      let errorMsg: string | undefined;

      try {
        const r = await generateWithRetry(input, generateStreetDescription);
        output = r.output;
        attemptCount = r.attemptCount;
        // Independent re-validation as the kickoff specifies.
        violations = validateStreetGeneration(output, input);
      } catch (err) {
        if (err instanceof StreetGenerationFailure) {
          attemptCount = 3;
          violations = err.violations;
          errorMsg = err.message;
        } else {
          errorMsg = err instanceof Error ? err.message : String(err);
        }
      }

      const usage = capture.take();
      const cost = costOf(usage);
      runningCost += cost;
      const status: "succeeded" | "failed" =
        !!output && violations.length === 0 ? "succeeded" : "failed";
      const totalWords = output ? totalWordCount(output) : 0;

      results.push({
        slug,
        status,
        attempts: attemptCount,
        totalWords,
        violations,
        usage,
        cost,
        output,
        error: errorMsg,
      });

      if (status === "succeeded" && output) {
        writeFileSync(
          path.join(OUT_DIR, `${slug}.json`),
          JSON.stringify(
            {
              slug,
              inputHash,
              attempts: attemptCount,
              totalWords,
              usage,
              cost,
              output,
            },
            null,
            2,
          ),
          "utf-8",
        );
      } else {
        writeFileSync(
          path.join(OUT_DIR, `${slug}-FAILED.json`),
          JSON.stringify(
            {
              streetSlug: slug,
              violations,
              lastAttemptAt: new Date().toISOString(),
              lastInputHash: inputHash,
              attempts: attemptCount,
              error: errorMsg,
              usage,
              cost,
              partialOutput: output,
            },
            null,
            2,
          ),
          "utf-8",
        );
      }

      const violPart =
        violations.length === 0 ? "0" : violations.map((v) => v.rule).join(",");
      console.log(
        `[${slug}] attempts=${attemptCount} totalWords=${totalWords} violations=${violPart} cost=$${cost.toFixed(2)}`,
      );

      if (runningCost > COST_STOP_USD) {
        console.error(
          `\nABORT: running cost $${runningCost.toFixed(2)} exceeded cap $${COST_STOP_USD}. Retry-loop suspected.`,
        );
        break;
      }
    }
  } finally {
    capture.restore();
  }

  const succeeded = results.filter((r) => r.status === "succeeded").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const totalCost = results.reduce((s, r) => s + r.cost, 0);

  console.log("");
  console.log(
    `TOTALS: succeeded=${succeeded} failed=${failed} totalCost=$${totalCost.toFixed(2)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
