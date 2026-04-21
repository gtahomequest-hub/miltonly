// Phase 4.1 Step 9 — backfill script for generated street descriptions.
//
// Walks the candidate universe of renderable streets (union of DB1 Listing,
// DB2 sold_records, DB3 street_sold_stats, DB1 StreetContent — mirrors the
// Step 7b widened existence gate) and generates an 8-section description
// for each via the same generator the spot-check uses. Writes successful
// outputs to StreetGeneration; writes failure rows to StreetGenerationReview.
//
// This is the ONLY generation path for Phase 4.1. Page rendering never calls
// the model; it reads StreetGeneration rows populated here.
//
// Flags:
//   --dry-run            Log planned actions only. No API calls. No DB writes.
//   --budget-usd N       Hard stop when cumulative cost >= N USD. Default 1200.
//   --concurrency N      Parallel workers. Default 3.
//   --slug X             Operate on a single street (overrides the universe).
//
// Idempotency:
//   A slug is SKIPPED when StreetGeneration.status='succeeded' AND inputHash
//   matches the freshly-computed inputHash. If the inputs change (new sold
//   records, etc.) the hash changes and the slug is re-generated.
//
// Atomic claim:
//   Before generating, the script upserts a row with status='generating'
//   via INSERT ... ON CONFLICT ... WHERE status <> 'generating'. If no row
//   is returned, another worker owns it and this worker moves on.
//
// Cooldown:
//   Slugs with a StreetGenerationReview row less than 24h old are SKIPPED
//   unless --slug forces them (re-run intent).
//
// Rate-limit backoff:
//   On Anthropic 429, sleep 2^n * 1000ms (n = retry attempt, capped at 30s)
//   and retry the CURRENT attempt. This is orthogonal to the 3-attempt
//   retry loop inside generateWithRetry.
//
// Run:
//   TSX_TSCONFIG_PATH=./tsconfig.test.json npx --yes tsx scripts/backfill-descriptions.ts --dry-run
//   TSX_TSCONFIG_PATH=./tsconfig.test.json npx --yes tsx scripts/backfill-descriptions.ts --budget-usd 200 --concurrency 3
//   TSX_TSCONFIG_PATH=./tsconfig.test.json npx --yes tsx scripts/backfill-descriptions.ts --slug main-st-e-milton

import { readFileSync } from "node:fs";
import crypto from "node:crypto";

// ─── Env loader (pattern: spot-check.ts) ────────────────────────────────────

function loadEnvLocal() {
  try {
    const raw = readFileSync(".env.local", "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=["']?([^"'\n]+?)["']?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/\\n$/, "");
    }
  } catch {
    /* ignore — fall through to .env */
  }
}

// ─── Pricing (claude-opus-4-7) ──────────────────────────────────────────────
// Cache write = 1.25× base, cache read = 0.10× base. System-prompt caching
// enabled in generateStreetDescription; cache_creation/cache_read fields are
// emitted on the [gen] log line alongside input/output counts.

const PRICE_IN_PER_MTOK = 15;
const PRICE_OUT_PER_MTOK = 75;
const PRICE_CACHE_WRITE_PER_MTOK = 18.75;
const PRICE_CACHE_READ_PER_MTOK = 1.5;

// ─── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_BUDGET_USD = 1200;
const DEFAULT_CONCURRENCY = 3;
const REVIEW_COOLDOWN_HOURS = 24;
const MAX_RATE_LIMIT_RETRIES = 5;
const RATE_LIMIT_SLEEP_CAP_MS = 30_000;

// ─── Arg parsing ────────────────────────────────────────────────────────────

interface CliArgs {
  dryRun: boolean;
  budgetUsd: number;
  concurrency: number;
  slug: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    dryRun: false,
    budgetUsd: DEFAULT_BUDGET_USD,
    concurrency: DEFAULT_CONCURRENCY,
    slug: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--budget-usd") {
      const v = Number(argv[++i]);
      if (!Number.isFinite(v) || v <= 0) die(`--budget-usd requires a positive number`);
      out.budgetUsd = v;
    } else if (a === "--concurrency") {
      const v = Number(argv[++i]);
      if (!Number.isInteger(v) || v < 1) die(`--concurrency requires a positive integer`);
      out.concurrency = v;
    } else if (a === "--slug") {
      const v = argv[++i];
      if (!v || v.startsWith("--")) die(`--slug requires a value`);
      out.slug = v;
    } else {
      die(`unknown arg: ${a}`);
    }
  }
  return out;
}

function die(msg: string): never {
  console.error(`backfill: ${msg}`);
  process.exit(2);
}

// ─── Structured log ─────────────────────────────────────────────────────────

function log(event: string, payload: Record<string, unknown>): void {
  // eslint-disable-next-line no-console
  console.log(`[backfill:${event}] ${JSON.stringify({ ...payload })}`);
}

// ─── Universe query: renderable slugs matching the Step 7b gate ─────────────

async function loadCandidateUniverse(): Promise<string[]> {
  // Dynamic imports: env must be loaded before these modules initialize.
  const { prisma } = await import("@/lib/prisma");
  const { analyticsDb, soldDb } = await import("@/lib/db");

  const permListingRows = await prisma.listing.findMany({
    where: { permAdvertise: true },
    distinct: ["streetSlug"],
    select: { streetSlug: true },
  });

  const contentRows = await prisma.streetContent.findMany({
    select: { streetSlug: true },
  });

  const statsRows = analyticsDb
    ? ((await analyticsDb`
        SELECT DISTINCT street_slug AS slug FROM analytics.street_sold_stats
        WHERE street_slug IS NOT NULL
      `) as unknown as Array<{ slug: string }>)
    : [];

  const soldRows = soldDb
    ? ((await soldDb`
        SELECT DISTINCT street_slug AS slug FROM sold.sold_records
        WHERE street_slug IS NOT NULL
      `) as unknown as Array<{ slug: string }>)
    : [];

  const universe = new Set<string>();
  for (const r of permListingRows) if (r.streetSlug) universe.add(r.streetSlug);
  for (const r of contentRows) universe.add(r.streetSlug);
  for (const r of statsRows) universe.add(r.slug);
  for (const r of soldRows) universe.add(r.slug);

  return Array.from(universe).sort();
}

// ─── Hash helper — must match generateStreetDescription.inputHashPrefix ─────

function hashInput(input: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, 12);
}

// ─── Word-count helper ──────────────────────────────────────────────────────

function wordCountsFor(sections: Array<{ id: string; paragraphs: string[] }>): {
  perSection: Record<string, number>;
  total: number;
} {
  const perSection: Record<string, number> = {};
  let total = 0;
  for (const s of sections) {
    let n = 0;
    for (const p of s.paragraphs) n += p.split(/\s+/).filter(Boolean).length;
    perSection[s.id] = n;
    total += n;
  }
  return { perSection, total };
}

// ─── Skip decisions ─────────────────────────────────────────────────────────

type SkipReason =
  | "already_succeeded_same_input"
  | "cooldown_active"
  | "claimed_by_other_worker";

interface SkipCheck {
  skip: false;
}
interface SkipReasonCheck {
  skip: true;
  reason: SkipReason;
}

async function preflightSkip(
  slug: string,
  inputHash: string,
  forceSlug: boolean,
): Promise<SkipCheck | SkipReasonCheck> {
  const { prisma } = await import("@/lib/prisma");
  const existing = await prisma.streetGeneration.findUnique({
    where: { streetSlug: slug },
    select: { status: true, inputHash: true },
  });

  if (existing?.status === "succeeded" && existing.inputHash === inputHash && !forceSlug) {
    return { skip: true, reason: "already_succeeded_same_input" };
  }

  if (!forceSlug) {
    const review = await prisma.streetGenerationReview.findUnique({
      where: { streetSlug: slug },
      select: { lastAttemptAt: true },
    });
    if (review) {
      const ageHours =
        (Date.now() - review.lastAttemptAt.getTime()) / (60 * 60 * 1000);
      if (ageHours < REVIEW_COOLDOWN_HOURS) {
        return { skip: true, reason: "cooldown_active" };
      }
    }
  }

  return { skip: false };
}

/**
 * Atomic claim. Returns true iff this worker now owns the row with
 * status='generating'. Another worker holding 'generating' returns false.
 *
 * Uses INSERT ... ON CONFLICT with a conditional WHERE on the update branch.
 * Required columns (sectionsJson, faqJson, wordCounts) are initialized to
 * neutral placeholders; they are overwritten on success.
 */
async function claimRow(slug: string, inputHash: string): Promise<boolean> {
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.$queryRaw<Array<{ streetSlug: string }>>`
    INSERT INTO "StreetGeneration" (
      "streetSlug", "sectionsJson", "faqJson", "inputHash",
      "status", "generatedAt", "attemptCount", "wordCounts", "totalWords"
    ) VALUES (
      ${slug}, '[]'::jsonb, '[]'::jsonb, ${inputHash},
      'generating'::"GenerationStatus", NOW(), 0, '{}'::jsonb, 0
    )
    ON CONFLICT ("streetSlug") DO UPDATE
      SET "status"    = 'generating'::"GenerationStatus",
          "inputHash" = EXCLUDED."inputHash",
          "generatedAt" = NOW()
      WHERE "StreetGeneration"."status" <> 'generating'::"GenerationStatus"
    RETURNING "streetSlug"
  `;
  return rows.length > 0;
}

async function writeSuccess(
  slug: string,
  inputHash: string,
  sections: Array<{ id: string; heading: string; paragraphs: string[] }>,
  faq: Array<{ question: string; answer: string }>,
  attemptCount: number,
  tokensIn: number,
  tokensOut: number,
  costUsd: number,
): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  const { perSection, total } = wordCountsFor(sections);
  await prisma.streetGeneration.update({
    where: { streetSlug: slug },
    data: {
      sectionsJson: sections,
      faqJson: faq,
      inputHash,
      status: "succeeded",
      generatedAt: new Date(),
      attemptCount,
      wordCounts: perSection,
      totalWords: total,
      tokensIn,
      tokensOut,
      costUsd,
    },
  });
  // If there was a stale review row, clear it — the street is green now.
  await prisma.streetGenerationReview
    .delete({ where: { streetSlug: slug } })
    .catch(() => undefined);
}

async function writeFailure(
  slug: string,
  inputHash: string,
  violations: unknown,
  attemptCount: number,
  tokensIn: number,
  tokensOut: number,
  costUsd: number,
): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  await prisma.streetGeneration.update({
    where: { streetSlug: slug },
    data: {
      status: "failed",
      attemptCount,
      tokensIn,
      tokensOut,
      costUsd,
      inputHash,
    },
  });
  await prisma.streetGenerationReview.upsert({
    where: { streetSlug: slug },
    update: {
      violations: violations as object,
      lastAttemptAt: new Date(),
      lastInputHash: inputHash,
    },
    create: {
      streetSlug: slug,
      violations: violations as object,
      lastAttemptAt: new Date(),
      lastInputHash: inputHash,
    },
  });
}

// ─── Rate-limit-aware wrapper around the generator ─────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRateLimitError(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 429;
}

// ─── Main worker flow ──────────────────────────────────────────────────────

interface WorkerState {
  totalCost: number;
  budgetUsd: number;
  succeeded: number;
  failed: number;
  skipped: Record<SkipReason, number>;
  aborted: boolean;
}

async function processOne(
  slug: string,
  args: CliArgs,
  state: WorkerState,
): Promise<void> {
  if (state.aborted) return;

  const { buildGeneratorInput } = await import("@/lib/ai/buildGeneratorInput");
  const { generateStreetDescription } = await import(
    "@/lib/ai/generateStreetDescription"
  );
  const {
    generateWithRetry,
    StreetGenerationFailure,
  } = await import("@/lib/ai/validateStreetGeneration");

  // 1. Build input (DB-only, no API calls) so we can compute inputHash.
  let input;
  try {
    input = await buildGeneratorInput(slug);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("input_build_failed", { slug, error: msg });
    state.failed++;
    return;
  }
  const inputHash = hashInput(input);

  // 2. Idempotency / cooldown preflight (no writes yet).
  const preflight = await preflightSkip(slug, inputHash, !!args.slug);
  if (preflight.skip) {
    state.skipped[preflight.reason]++;
    log("skip", { slug, reason: preflight.reason });
    return;
  }

  if (args.dryRun) {
    log("dry_run_would_generate", { slug, inputHash });
    return;
  }

  // 3. Atomic claim.
  const owned = await claimRow(slug, inputHash);
  if (!owned) {
    state.skipped.claimed_by_other_worker++;
    log("skip", { slug, reason: "claimed_by_other_worker" });
    return;
  }

  // 4. Generate with rate-limit backoff wrapping each attempt.
  const callRecords: Array<{
    tokensIn: number;
    tokensOut: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
  }> = [];
  const genWithBackoff: typeof generateStreetDescription = async (
    inp,
    priorViolations,
    priorOutput,
  ) => {
    for (let rlRetry = 0; rlRetry <= MAX_RATE_LIMIT_RETRIES; rlRetry++) {
      try {
        // Intercept [gen] log to capture token usage per call.
        const origLog = console.log;
        let captured: {
          tokensIn: number;
          tokensOut: number;
          cacheCreationTokens: number;
          cacheReadTokens: number;
        } | null = null;
        console.log = (...a: unknown[]) => {
          const f = a[0];
          if (typeof f === "string" && f.startsWith("[gen] ")) {
            try {
              const p = JSON.parse(f.slice("[gen] ".length));
              if (typeof p.tokensIn === "number" && typeof p.tokensOut === "number") {
                captured = {
                  tokensIn: p.tokensIn,
                  tokensOut: p.tokensOut,
                  cacheCreationTokens: p.cacheCreationTokens ?? 0,
                  cacheReadTokens: p.cacheReadTokens ?? 0,
                };
              }
            } catch {
              /* ignore */
            }
          }
          origLog(...a);
        };
        try {
          const out = await generateStreetDescription(inp, priorViolations, priorOutput);
          if (captured) callRecords.push(captured);
          return out;
        } finally {
          console.log = origLog;
        }
      } catch (err) {
        if (isRateLimitError(err) && rlRetry < MAX_RATE_LIMIT_RETRIES) {
          const sleepMs = Math.min(2 ** rlRetry * 1000, RATE_LIMIT_SLEEP_CAP_MS);
          log("rate_limit_backoff", { slug, rlRetry, sleepMs });
          await sleep(sleepMs);
          continue;
        }
        throw err;
      }
    }
    throw new Error(`rate_limit_exhausted for ${slug}`);
  };

  let cost = 0;
  try {
    const { output, attemptCount } = await generateWithRetry(input, genWithBackoff);
    const tokensIn = callRecords.reduce((s, r) => s + r.tokensIn, 0);
    const tokensOut = callRecords.reduce((s, r) => s + r.tokensOut, 0);
    const cacheCreate = callRecords.reduce((s, r) => s + r.cacheCreationTokens, 0);
    const cacheRead = callRecords.reduce((s, r) => s + r.cacheReadTokens, 0);
    cost =
      (tokensIn / 1_000_000) * PRICE_IN_PER_MTOK +
      (tokensOut / 1_000_000) * PRICE_OUT_PER_MTOK +
      (cacheCreate / 1_000_000) * PRICE_CACHE_WRITE_PER_MTOK +
      (cacheRead / 1_000_000) * PRICE_CACHE_READ_PER_MTOK;
    state.totalCost += cost;

    await writeSuccess(
      slug,
      inputHash,
      output.sections,
      output.faq,
      attemptCount,
      tokensIn,
      tokensOut,
      cost,
    );
    state.succeeded++;
    log("success", {
      slug,
      attempts: attemptCount,
      totalWords: wordCountsFor(output.sections).total,
      tokensIn,
      tokensOut,
      cost: Number(cost.toFixed(4)),
      runningCost: Number(state.totalCost.toFixed(4)),
    });
  } catch (err) {
    const tokensIn = callRecords.reduce((s, r) => s + r.tokensIn, 0);
    const tokensOut = callRecords.reduce((s, r) => s + r.tokensOut, 0);
    const cacheCreate = callRecords.reduce((s, r) => s + r.cacheCreationTokens, 0);
    const cacheRead = callRecords.reduce((s, r) => s + r.cacheReadTokens, 0);
    cost =
      (tokensIn / 1_000_000) * PRICE_IN_PER_MTOK +
      (tokensOut / 1_000_000) * PRICE_OUT_PER_MTOK +
      (cacheCreate / 1_000_000) * PRICE_CACHE_WRITE_PER_MTOK +
      (cacheRead / 1_000_000) * PRICE_CACHE_READ_PER_MTOK;
    state.totalCost += cost;

    if (err instanceof StreetGenerationFailure) {
      await writeFailure(slug, inputHash, err.violations, 3, tokensIn, tokensOut, cost);
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      await writeFailure(
        slug,
        inputHash,
        [{ rule: "runtime_error", excerpt: msg.slice(0, 500), severity: "hard" }],
        0,
        tokensIn,
        tokensOut,
        cost,
      );
    }
    state.failed++;
    log("failure", {
      slug,
      error: err instanceof Error ? err.message : String(err),
      tokensIn,
      tokensOut,
      cost: Number(cost.toFixed(4)),
      runningCost: Number(state.totalCost.toFixed(4)),
    });
  }

  if (state.totalCost >= state.budgetUsd) {
    state.aborted = true;
    log("budget_exhausted", {
      totalCost: Number(state.totalCost.toFixed(4)),
      budgetUsd: state.budgetUsd,
    });
  }
}

// ─── Concurrency pool ──────────────────────────────────────────────────────

async function runPool(
  slugs: string[],
  args: CliArgs,
  state: WorkerState,
): Promise<void> {
  const queue = [...slugs];
  const workers: Promise<void>[] = [];
  for (let w = 0; w < args.concurrency; w++) {
    workers.push(
      (async () => {
        while (!state.aborted) {
          const slug = queue.shift();
          if (!slug) return;
          await processOne(slug, args, state);
        }
      })(),
    );
  }
  await Promise.all(workers);
}

// ─── Entry point ───────────────────────────────────────────────────────────

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));

  if (!args.dryRun && !process.env.ANTHROPIC_API_KEY) {
    die("ANTHROPIC_API_KEY missing from env. Check .env.local.");
  }

  log("start", {
    dryRun: args.dryRun,
    budgetUsd: args.budgetUsd,
    concurrency: args.concurrency,
    slug: args.slug,
  });

  const slugs = args.slug ? [args.slug] : await loadCandidateUniverse();
  log("universe_loaded", { count: slugs.length });

  const state: WorkerState = {
    totalCost: 0,
    budgetUsd: args.budgetUsd,
    succeeded: 0,
    failed: 0,
    skipped: {
      already_succeeded_same_input: 0,
      cooldown_active: 0,
      claimed_by_other_worker: 0,
    },
    aborted: false,
  };

  await runPool(slugs, args, state);

  log("done", {
    succeeded: state.succeeded,
    failed: state.failed,
    skipped: state.skipped,
    totalCost: Number(state.totalCost.toFixed(4)),
    aborted: state.aborted,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
