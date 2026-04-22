// Phase 4.1 Step 9b — backfill script for generated street descriptions.
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
//   --dry-run                    Log planned actions only. No API calls. No writes.
//   --budget-usd N               Per-run hard stop. Default 1200.
//   --daily-budget-usd N         Rolling-24h cap across runs (.backfill-state.json).
//                                Default 25. Exits if exceeded; resumes after 24h.
//   --batch-size N               Pause after every N successful generations and
//                                require --approve-batch K to continue. Default 25.
//   --approve-batch K            Approves batch K that was awaiting approval.
//   --concurrency N              Parallel workers. Default 3.
//   --slug X                     Operate on a single street (bypasses universe).
//   --status                     Read-only status summary. No API. No writes.
//
// State files (at repo root, gitignored):
//   .backfill-state.json         Persisted across runs: cumulative cost, 24h
//                                window, batch progress, noCentroid tally.
//   .backfill-batch-N.json       One per completed batch — approval artifact.
//
// Idempotency, atomic claim, cooldown, and rate-limit backoff are unchanged
// from Step 9; see section headings below for details.
//
// Run:
//   TSX_TSCONFIG_PATH=./tsconfig.test.json npx --yes tsx scripts/backfill-descriptions.ts --dry-run
//   TSX_TSCONFIG_PATH=./tsconfig.test.json npx --yes tsx scripts/backfill-descriptions.ts --status
//   TSX_TSCONFIG_PATH=./tsconfig.test.json npx --yes tsx scripts/backfill-descriptions.ts \
//       --budget-usd 50 --daily-budget-usd 25 --batch-size 25 --concurrency 3
//   TSX_TSCONFIG_PATH=./tsconfig.test.json npx --yes tsx scripts/backfill-descriptions.ts --approve-batch 1

import { readFileSync, writeFileSync, existsSync, renameSync } from "node:fs";
import crypto from "node:crypto";

// ─── Env loader ─────────────────────────────────────────────────────────────

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

const PRICE_IN_PER_MTOK = 15;
const PRICE_OUT_PER_MTOK = 75;
const PRICE_CACHE_WRITE_PER_MTOK = 18.75;
const PRICE_CACHE_READ_PER_MTOK = 1.5;

// ─── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_BUDGET_USD = 1200;
const DEFAULT_DAILY_BUDGET_USD = 25;
const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_CONCURRENCY = 3;
const REVIEW_COOLDOWN_HOURS = 24;
const MAX_RATE_LIMIT_RETRIES = 5;
const RATE_LIMIT_SLEEP_CAP_MS = 30_000;
const WINDOW_HOURS = 24;

const STATE_FILE = ".backfill-state.json";
const FALLBACK_PER_STREET_USD = 0.84; // used in dry-run projection when no history

// ─── State schema ───────────────────────────────────────────────────────────

interface PendingBatch {
  number: number;
  startedAt: string;
  finishedAt: string | null;
  status: "in_progress" | "awaiting_approval";
  successes: number;
  failures: number;
  slugs: Array<{
    slug: string;
    status: "succeeded" | "failed";
    attempts: number;
    cost: number;
  }>;
  cost: number;
}

interface BackfillState {
  firstRunAt: string | null;
  windowStartedAt: string;
  dailySpent: number;
  dailyBudgetExhaustedAt: string | null;
  cumulativeCost: number;
  cumulativeSuccesses: number;
  cumulativeFailures: number;
  noCentroidSlugs: string[];
  lastApprovedBatch: number;
  pendingBatch: PendingBatch | null;
}

function emptyState(): BackfillState {
  return {
    firstRunAt: null,
    windowStartedAt: new Date().toISOString(),
    dailySpent: 0,
    dailyBudgetExhaustedAt: null,
    cumulativeCost: 0,
    cumulativeSuccesses: 0,
    cumulativeFailures: 0,
    noCentroidSlugs: [],
    lastApprovedBatch: 0,
    pendingBatch: null,
  };
}

function loadState(): BackfillState {
  if (!existsSync(STATE_FILE)) return emptyState();
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return emptyState();
  }
}

// Serialize concurrent saveState calls. On Windows, renameSync on the same
// path from multiple workers races and can fail with EPERM when another
// worker's handle on the tmp file is still resolving. The mutex threads all
// writes through a single Promise chain so renames happen one at a time.
let saveStateMutex: Promise<void> = Promise.resolve();

function actuallyWriteState(state: BackfillState): void {
  const tmp = `${STATE_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), "utf-8");
  renameSync(tmp, STATE_FILE);
}

function saveState(state: BackfillState): Promise<void> {
  saveStateMutex = saveStateMutex.then(() => {
    actuallyWriteState(state);
  });
  return saveStateMutex;
}

// ─── Arg parsing ────────────────────────────────────────────────────────────

interface CliArgs {
  dryRun: boolean;
  status: boolean;
  budgetUsd: number;
  dailyBudgetUsd: number;
  batchSize: number;
  approveBatch: number | null;
  concurrency: number;
  slug: string | null;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = {
    dryRun: false,
    status: false,
    budgetUsd: DEFAULT_BUDGET_USD,
    dailyBudgetUsd: DEFAULT_DAILY_BUDGET_USD,
    batchSize: DEFAULT_BATCH_SIZE,
    approveBatch: null,
    concurrency: DEFAULT_CONCURRENCY,
    slug: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--status") out.status = true;
    else if (a === "--budget-usd") out.budgetUsd = requirePositiveNumber("--budget-usd", argv[++i]);
    else if (a === "--daily-budget-usd") out.dailyBudgetUsd = requirePositiveNumber("--daily-budget-usd", argv[++i]);
    else if (a === "--batch-size") out.batchSize = requirePositiveInt("--batch-size", argv[++i]);
    else if (a === "--approve-batch") out.approveBatch = requirePositiveInt("--approve-batch", argv[++i]);
    else if (a === "--concurrency") out.concurrency = requirePositiveInt("--concurrency", argv[++i]);
    else if (a === "--slug") {
      const v = argv[++i];
      if (!v || v.startsWith("--")) die(`--slug requires a value`);
      out.slug = v;
    } else {
      die(`unknown arg: ${a}`);
    }
  }
  return out;
}

function requirePositiveNumber(name: string, raw: string | undefined): number {
  const v = Number(raw);
  if (!Number.isFinite(v) || v <= 0) die(`${name} requires a positive number`);
  return v;
}

function requirePositiveInt(name: string, raw: string | undefined): number {
  const v = Number(raw);
  if (!Number.isInteger(v) || v < 1) die(`${name} requires a positive integer`);
  return v;
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

// ─── Universe query ─────────────────────────────────────────────────────────

async function loadCandidateUniverse(): Promise<string[]> {
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

// ─── Hash helper ────────────────────────────────────────────────────────────

function hashInput(input: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, 12);
}

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

type Preflight = { skip: false } | { skip: true; reason: SkipReason };

async function preflightSkip(
  slug: string,
  inputHash: string,
  forceSlug: boolean,
): Promise<Preflight> {
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
      const ageHours = (Date.now() - review.lastAttemptAt.getTime()) / 3_600_000;
      if (ageHours < REVIEW_COOLDOWN_HOURS) {
        return { skip: true, reason: "cooldown_active" };
      }
    }
  }
  return { skip: false };
}

// ─── Atomic claim ───────────────────────────────────────────────────────────

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

// ─── Rate-limit-aware generator wrapper ─────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRateLimitError(err: unknown): boolean {
  return (err as { status?: number })?.status === 429;
}

// ─── Worker state (per-run scratch) ─────────────────────────────────────────

interface WorkerState {
  runCost: number;
  runBudgetUsd: number;
  runSucceeded: number;
  runFailed: number;
  runSkipped: Record<SkipReason, number>;
  runNoCentroid: number;
  runInputBuildErrors: number;
  aborted: boolean;
  abortReason: "budget_exhausted" | "daily_budget_exhausted" | "batch_awaiting_approval" | null;
  // Persistent state, mutated in-place and written on each terminal event
  // and at end-of-run. Protected by the serial nature of processOne updates
  // (workers await one slug at a time; cross-worker writes compete on the
  // batch-complete check which is guarded below).
  persisted: BackfillState;
  batchSize: number;
  dailyBudgetUsd: number;
}

// ─── Per-slug flow ──────────────────────────────────────────────────────────

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

  // 1. Build input.
  let input;
  try {
    input = await buildGeneratorInput(slug);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNoCentroid = err instanceof Error && err.name === "NoCentroidError";
    if (isNoCentroid) {
      state.runNoCentroid++;
      if (!state.persisted.noCentroidSlugs.includes(slug)) {
        state.persisted.noCentroidSlugs.push(slug);
      }
      log("skip", { slug, reason: "no_centroid" });
    } else {
      state.runInputBuildErrors++;
      log("input_build_failed", { slug, error: msg });
    }
    return;
  }
  const inputHash = hashInput(input);

  // 2. Preflight skip (idempotency, cooldown).
  const pf = await preflightSkip(slug, inputHash, !!args.slug);
  if (pf.skip) {
    state.runSkipped[pf.reason]++;
    log("skip", { slug, reason: pf.reason });
    return;
  }

  if (args.dryRun) {
    log("dry_run_would_generate", { slug, inputHash });
    return;
  }

  // 3. Atomic claim.
  const owned = await claimRow(slug, inputHash);
  if (!owned) {
    state.runSkipped.claimed_by_other_worker++;
    log("skip", { slug, reason: "claimed_by_other_worker" });
    return;
  }

  // 4. Generate with rate-limit backoff.
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
  let slugOutcome: "succeeded" | "failed" = "failed";
  let attemptsUsed = 0;
  try {
    const { output, attemptCount } = await generateWithRetry(input, genWithBackoff);
    attemptsUsed = attemptCount;
    const tokensIn = callRecords.reduce((s, r) => s + r.tokensIn, 0);
    const tokensOut = callRecords.reduce((s, r) => s + r.tokensOut, 0);
    const cacheCreate = callRecords.reduce((s, r) => s + r.cacheCreationTokens, 0);
    const cacheRead = callRecords.reduce((s, r) => s + r.cacheReadTokens, 0);
    cost =
      (tokensIn / 1_000_000) * PRICE_IN_PER_MTOK +
      (tokensOut / 1_000_000) * PRICE_OUT_PER_MTOK +
      (cacheCreate / 1_000_000) * PRICE_CACHE_WRITE_PER_MTOK +
      (cacheRead / 1_000_000) * PRICE_CACHE_READ_PER_MTOK;

    await writeSuccess(slug, inputHash, output.sections, output.faq, attemptCount, tokensIn, tokensOut, cost);
    slugOutcome = "succeeded";
    state.runSucceeded++;
    log("success", {
      slug,
      attempts: attemptCount,
      totalWords: wordCountsFor(output.sections).total,
      tokensIn,
      tokensOut,
      cost: Number(cost.toFixed(4)),
      runCost: Number((state.runCost + cost).toFixed(4)),
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

    if (err instanceof StreetGenerationFailure) {
      attemptsUsed = 3;
      await writeFailure(slug, inputHash, err.violations, 3, tokensIn, tokensOut, cost);
    } else {
      attemptsUsed = 0;
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
    slugOutcome = "failed";
    state.runFailed++;
    log("failure", {
      slug,
      error: err instanceof Error ? err.message : String(err),
      tokensIn,
      tokensOut,
      cost: Number(cost.toFixed(4)),
      runCost: Number((state.runCost + cost).toFixed(4)),
    });
  }

  // Update run + persisted counters, persist, then check budget/batch gates.
  state.runCost += cost;
  state.persisted.cumulativeCost += cost;
  state.persisted.dailySpent += cost;
  if (slugOutcome === "succeeded") state.persisted.cumulativeSuccesses++;
  else state.persisted.cumulativeFailures++;

  // Ensure a pendingBatch exists (the current working batch).
  if (!state.persisted.pendingBatch) {
    state.persisted.pendingBatch = {
      number: state.persisted.lastApprovedBatch + 1,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      status: "in_progress",
      successes: 0,
      failures: 0,
      slugs: [],
      cost: 0,
    };
  }
  const batch = state.persisted.pendingBatch;
  batch.slugs.push({ slug, status: slugOutcome, attempts: attemptsUsed, cost });
  if (slugOutcome === "succeeded") batch.successes++;
  else batch.failures++;
  batch.cost += cost;

  await saveState(state.persisted);

  // Budget gates.
  //
  // Note on budget overshoot: the daily budget cap is enforced after each
  // completed call, not mid-call. With concurrency=N, up to N-1 inflight
  // calls can complete after the cap is hit, causing overshoot bounded by
  // (N-1) × max_per_street_cost. At concurrency=3 and max ~$1.20/street,
  // expect up to $2.40 overshoot. Set --daily-budget-usd to your target
  // effective spend minus this buffer if you need a hard ceiling.
  if (state.runCost >= state.runBudgetUsd) {
    state.aborted = true;
    state.abortReason = "budget_exhausted";
    log("budget_exhausted", {
      runCost: Number(state.runCost.toFixed(4)),
      runBudgetUsd: state.runBudgetUsd,
    });
    return;
  }
  if (state.persisted.dailySpent >= state.dailyBudgetUsd) {
    state.aborted = true;
    state.abortReason = "daily_budget_exhausted";
    state.persisted.dailyBudgetExhaustedAt = new Date().toISOString();
    await saveState(state.persisted);
    log("daily_budget_exhausted", {
      dailySpent: Number(state.persisted.dailySpent.toFixed(4)),
      dailyBudgetUsd: state.dailyBudgetUsd,
      windowStartedAt: state.persisted.windowStartedAt,
      resumesAt: new Date(Date.now() + WINDOW_HOURS * 3_600_000).toISOString(),
    });
    return;
  }

  // Batch-completion gate: when successes reach batchSize, finalize and halt.
  if (batch.successes >= state.batchSize) {
    batch.status = "awaiting_approval";
    batch.finishedAt = new Date().toISOString();
    writeBatchArtifact(batch);
    await saveState(state.persisted);
    state.aborted = true;
    state.abortReason = "batch_awaiting_approval";
    log("batch_awaiting_approval", {
      batchNumber: batch.number,
      successes: batch.successes,
      failures: batch.failures,
      cost: Number(batch.cost.toFixed(4)),
      approveWith: `--approve-batch ${batch.number}`,
    });
  }
}

function writeBatchArtifact(batch: PendingBatch): void {
  const path = `.backfill-batch-${batch.number}.json`;
  writeFileSync(path, JSON.stringify(batch, null, 2), "utf-8");
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

// ─── Daily window management ────────────────────────────────────────────────

function maybeResetDailyWindow(state: BackfillState): void {
  const now = Date.now();
  const started = new Date(state.windowStartedAt).getTime();
  if (now - started >= WINDOW_HOURS * 3_600_000) {
    state.windowStartedAt = new Date(now).toISOString();
    state.dailySpent = 0;
    state.dailyBudgetExhaustedAt = null;
  }
}

function formatHoursMins(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h${m.toString().padStart(2, "0")}m`;
}

// ─── --status path ──────────────────────────────────────────────────────────

async function statusCommand(state: BackfillState, args: CliArgs): Promise<void> {
  const { prisma } = await import("@/lib/prisma");

  const universe = await loadCandidateUniverse();
  const succeededRows = await prisma.streetGeneration.count({
    where: { status: "succeeded" },
  });
  const reviewRows = await prisma.streetGenerationReview.count();

  const accountedFor =
    succeededRows + reviewRows + state.noCentroidSlugs.length;
  const pending = Math.max(universe.length - accountedFor, 0);

  const dailyRemaining =
    state.dailyBudgetExhaustedAt && new Date(state.dailyBudgetExhaustedAt).getTime() > 0
      ? Math.max(args.dailyBudgetUsd - state.dailySpent, 0)
      : args.dailyBudgetUsd - state.dailySpent;

  const windowAgeMs = Date.now() - new Date(state.windowStartedAt).getTime();
  const windowStatus =
    windowAgeMs >= WINDOW_HOURS * 3_600_000
      ? "expired (resets on next run)"
      : `active, ${formatHoursMins(WINDOW_HOURS * 3_600_000 - windowAgeMs)} remaining`;

  const batchStatus = state.pendingBatch
    ? `batch ${state.pendingBatch.number} ${state.pendingBatch.status} (${state.pendingBatch.successes}/${args.batchSize} successes)`
    : `no open batch (last approved: ${state.lastApprovedBatch})`;

  log("status", {
    universe: universe.length,
    completed: succeededRows,
    failed: reviewRows,
    noCentroid: state.noCentroidSlugs.length,
    pending,
    cumulativeCost: Number(state.cumulativeCost.toFixed(4)),
    cumulativeSuccesses: state.cumulativeSuccesses,
    cumulativeFailures: state.cumulativeFailures,
    dailyBudgetRemaining: Number(Math.max(dailyRemaining, 0).toFixed(4)),
    dailyBudgetWindow: windowStatus,
    batchStatus,
    dailyBudgetExhaustedAt: state.dailyBudgetExhaustedAt,
  });
}

// ─── Entry point ────────────────────────────────────────────────────────────

async function main() {
  loadEnvLocal();
  const args = parseArgs(process.argv.slice(2));

  // --status is read-only and has no other action; short-circuit.
  if (args.status) {
    const state = loadState();
    maybeResetDailyWindow(state);
    await statusCommand(state, args);
    return;
  }

  if (!args.dryRun && !process.env.ANTHROPIC_API_KEY) {
    die("ANTHROPIC_API_KEY missing from env. Check .env.local.");
  }

  const state = loadState();
  maybeResetDailyWindow(state);
  if (!state.firstRunAt) state.firstRunAt = new Date().toISOString();

  // Handle --approve-batch first. Approving unlocks the next batch; it does
  // NOT by itself start work. If the user also passes normal flags, we proceed
  // after approval.
  if (args.approveBatch !== null) {
    if (!state.pendingBatch || state.pendingBatch.status !== "awaiting_approval") {
      die(`--approve-batch ${args.approveBatch} but no batch is awaiting approval.`);
    }
    if (state.pendingBatch.number !== args.approveBatch) {
      die(
        `--approve-batch ${args.approveBatch} does not match pending batch ${state.pendingBatch.number}.`,
      );
    }
    log("batch_approved", {
      batchNumber: state.pendingBatch.number,
      successes: state.pendingBatch.successes,
      failures: state.pendingBatch.failures,
      cost: Number(state.pendingBatch.cost.toFixed(4)),
    });
    state.lastApprovedBatch = state.pendingBatch.number;
    state.pendingBatch = null;
    await saveState(state);
  }

  // If a batch is pending approval and no --approve-batch was passed, refuse
  // to do any further work — print the pending batch summary and exit.
  if (state.pendingBatch && state.pendingBatch.status === "awaiting_approval") {
    log("batch_pending_approval", {
      batchNumber: state.pendingBatch.number,
      successes: state.pendingBatch.successes,
      failures: state.pendingBatch.failures,
      cost: Number(state.pendingBatch.cost.toFixed(4)),
      approveWith: `--approve-batch ${state.pendingBatch.number}`,
      batchFile: `.backfill-batch-${state.pendingBatch.number}.json`,
    });
    return;
  }

  // Daily-budget gate: if we previously exhausted and the 24h window has NOT
  // expired, refuse to run.
  if (state.dailyBudgetExhaustedAt) {
    const ageMs = Date.now() - new Date(state.dailyBudgetExhaustedAt).getTime();
    if (ageMs < WINDOW_HOURS * 3_600_000) {
      const resumeAt = new Date(
        new Date(state.dailyBudgetExhaustedAt).getTime() + WINDOW_HOURS * 3_600_000,
      ).toISOString();
      log("daily_budget_still_exhausted", {
        dailySpent: Number(state.dailySpent.toFixed(4)),
        dailyBudgetUsd: args.dailyBudgetUsd,
        exhaustedAt: state.dailyBudgetExhaustedAt,
        resumesAt: resumeAt,
      });
      return;
    }
    // Window elapsed — reset (maybeResetDailyWindow already covers this).
  }

  log("start", {
    dryRun: args.dryRun,
    budgetUsd: args.budgetUsd,
    dailyBudgetUsd: args.dailyBudgetUsd,
    batchSize: args.batchSize,
    concurrency: args.concurrency,
    slug: args.slug,
    lastApprovedBatch: state.lastApprovedBatch,
    pendingBatchInProgress: state.pendingBatch?.number ?? null,
  });

  const slugs = args.slug ? [args.slug] : await loadCandidateUniverse();
  log("universe_loaded", { count: slugs.length });

  const workerState: WorkerState = {
    runCost: 0,
    runBudgetUsd: args.budgetUsd,
    runSucceeded: 0,
    runFailed: 0,
    runSkipped: {
      already_succeeded_same_input: 0,
      cooldown_active: 0,
      claimed_by_other_worker: 0,
    },
    runNoCentroid: 0,
    runInputBuildErrors: 0,
    aborted: false,
    abortReason: null,
    persisted: state,
    batchSize: args.batchSize,
    dailyBudgetUsd: args.dailyBudgetUsd,
  };

  await runPool(slugs, args, workerState);

  if (args.dryRun) {
    // Dry-run summary: projection using current per-street average (falls back
    // to a static baseline if no history exists yet).
    const history = state.cumulativeSuccesses;
    const perStreet = history > 0 ? state.cumulativeCost / history : FALLBACK_PER_STREET_USD;
    const wouldGenerate =
      slugs.length -
      workerState.runNoCentroid -
      workerState.runSkipped.already_succeeded_same_input -
      workerState.runSkipped.cooldown_active -
      workerState.runInputBuildErrors;
    const estimatedCost = wouldGenerate * perStreet;
    log("dry_run_summary", {
      universeSize: slugs.length,
      wouldGenerate,
      wouldNoCentroid: workerState.runNoCentroid,
      wouldSkipAlreadySucceeded: workerState.runSkipped.already_succeeded_same_input,
      wouldSkipCooldown: workerState.runSkipped.cooldown_active,
      inputBuildErrors: workerState.runInputBuildErrors,
      perStreetAvg: Number(perStreet.toFixed(4)),
      perStreetSource: history > 0 ? `history (n=${history})` : "baseline",
      estimatedCost: Number(estimatedCost.toFixed(2)),
    });
  }

  // Final save — dry-run paths never mutate persistent counters, but
  // noCentroidSlugs WAS mutated in processOne. Suppress that in dry-run by
  // restoring from the snapshot we loaded.
  if (args.dryRun) {
    // Reload to drop any in-memory mutations from this dry-run.
    // (State on disk is unchanged since we never saved during dry-run.)
  } else {
    await saveState(state);
  }

  log("done", {
    dryRun: args.dryRun,
    succeeded: workerState.runSucceeded,
    failed: workerState.runFailed,
    skipped: workerState.runSkipped,
    noCentroid: workerState.runNoCentroid,
    inputBuildErrors: workerState.runInputBuildErrors,
    runCost: Number(workerState.runCost.toFixed(4)),
    cumulativeCost: Number(state.cumulativeCost.toFixed(4)),
    aborted: workerState.aborted,
    abortReason: workerState.abortReason,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
