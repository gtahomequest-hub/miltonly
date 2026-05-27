/**
 * Track 2 Pass 1 — 11-street batch test
 *
 * Runs generateStreetContent() locally against the spec'd test set:
 *   - 7 historical-only (the hard cases): aird, hincks, blinco, brassard,
 *     ellenton, plum, raftis
 *   - 4 baseline (currently published, Track 2 re-validation): asleton,
 *     scott, main, derry
 *
 * For each slug: outcome (pass/fail/error), attempt count, total words,
 * cost, and the failed-validation rule(s) if any. Skips SMS. Writes to
 * production DB — be aware.
 */
import { readFileSync } from "node:fs";

// Load .env.local before any module that constructs Prisma/Neon/DeepSeek clients.
// Mirrors loadEnvLocal() in smoke-test-phase41.ts.
function loadEnvLocal(): void {
  try {
    const raw = readFileSync(".env.local", "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        let value = m[2].replace(/\\n$/, "");
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

import { generateStreetContent } from "../src/lib/generateStreet";
import { Phase41GenerationError } from "../src/lib/ai/compliance";

const TEST_SET: { slug: string; name: string; cohort: "historical" | "baseline" }[] = [
  { slug: "aird-court-milton",         name: "Aird Court",         cohort: "historical" },
  { slug: "hincks-drive-milton",       name: "Hincks Drive",       cohort: "historical" },
  { slug: "blinco-terrace-milton",     name: "Blinco Terrace",     cohort: "historical" },
  { slug: "brassard-circle-milton",    name: "Brassard Circle",    cohort: "historical" },
  { slug: "ellenton-crescent-milton",  name: "Ellenton Crescent",  cohort: "historical" },
  { slug: "plum-place-milton",         name: "Plum Place",         cohort: "historical" },
  { slug: "raftis-crescent-milton",    name: "Raftis Crescent",    cohort: "historical" },
  { slug: "asleton-boulevard-milton",  name: "Asleton Boulevard",  cohort: "baseline" },
  { slug: "scott-boulevard-milton",    name: "Scott Boulevard",    cohort: "baseline" },
  { slug: "main-street-milton",        name: "Main Street",        cohort: "baseline" },
  { slug: "derry-road-milton",         name: "Derry Road",         cohort: "baseline" },
];

interface Result {
  slug: string;
  name: string;
  cohort: string;
  outcome: "pass" | "fail" | "error";
  attempts: number;
  totalWords: number | null;
  costUsd: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  elapsedMs: number;
  failureRules: string[];
  errorMessage: string | null;
}

async function runOne(slug: string, name: string, cohort: string): Promise<Result> {
  const t0 = Date.now();
  try {
    const r = await generateStreetContent(slug, name, { skipSms: true });
    const elapsedMs = Date.now() - t0;
    if (r.passed && r.v2) {
      return {
        slug, name, cohort,
        outcome: "pass",
        attempts: r.attempts,
        totalWords: r.v2.totalWords,
        costUsd: r.v2.costUsd,
        tokensIn: r.v2.tokensIn,
        tokensOut: r.v2.tokensOut,
        elapsedMs,
        failureRules: [],
        errorMessage: null,
      };
    }
    return {
      slug, name, cohort,
      outcome: "fail",
      attempts: r.attempts,
      totalWords: r.v2?.totalWords ?? null,
      costUsd: r.v2?.costUsd ?? null,
      tokensIn: r.v2?.tokensIn ?? null,
      tokensOut: r.v2?.tokensOut ?? null,
      elapsedMs,
      failureRules: [],
      errorMessage: "passed=false, no v2 telemetry",
    };
  } catch (err) {
    const elapsedMs = Date.now() - t0;
    if (err instanceof Phase41GenerationError) {
      const p = err.payload;
      const rules = Array.from(new Set(p.violations.map(v => `${v.rule}@${v.sectionId ?? "?"}`)));
      return {
        slug, name, cohort,
        outcome: "fail",
        attempts: p.attemptCount,
        totalWords: null,
        costUsd: p.totalCostUsd,
        tokensIn: p.totalInputTokens,
        tokensOut: p.totalOutputTokens,
        elapsedMs,
        failureRules: rules,
        errorMessage: null,
      };
    }
    return {
      slug, name, cohort,
      outcome: "error",
      attempts: 0,
      totalWords: null,
      costUsd: null,
      tokensIn: null,
      tokensOut: null,
      elapsedMs,
      failureRules: [],
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }
}

function fmt(n: number | null, places = 2): string {
  if (n === null || n === undefined) return "-";
  return n.toFixed(places);
}

async function main() {
  console.log("=".repeat(78));
  console.log("Track 2 Pass 1 — 11-street batch test");
  console.log(`AI_PROVIDER=${process.env.AI_PROVIDER}`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log("=".repeat(78));

  const results: Result[] = [];
  for (let i = 0; i < TEST_SET.length; i++) {
    const t = TEST_SET[i];
    process.stdout.write(`[${i+1}/${TEST_SET.length}] ${t.slug} (${t.cohort}) ... `);
    const r = await runOne(t.slug, t.name, t.cohort);
    results.push(r);
    const tag = r.outcome === "pass" ? "PASS" : r.outcome === "fail" ? "FAIL" : "ERROR";
    const detail = r.outcome === "pass"
      ? `${r.attempts} att, ${r.totalWords}w, $${fmt(r.costUsd, 4)}`
      : r.outcome === "fail"
        ? `${r.attempts} att, $${fmt(r.costUsd, 4)}, rules=[${r.failureRules.join(", ") || "none"}]`
        : `error: ${r.errorMessage}`;
    console.log(`${tag} (${(r.elapsedMs/1000).toFixed(1)}s) — ${detail}`);
  }

  console.log();
  console.log("=".repeat(78));
  console.log("SUMMARY");
  console.log("=".repeat(78));

  const pass = results.filter(r => r.outcome === "pass");
  const fail = results.filter(r => r.outcome === "fail");
  const error = results.filter(r => r.outcome === "error");
  const totalCost = results.reduce((s, r) => s + (r.costUsd ?? 0), 0);
  const totalTime = results.reduce((s, r) => s + r.elapsedMs, 0);

  console.log(`Pass:  ${pass.length}/${results.length}`);
  console.log(`Fail:  ${fail.length}/${results.length}`);
  console.log(`Error: ${error.length}/${results.length}`);
  console.log(`Total cost:   $${totalCost.toFixed(4)}`);
  console.log(`Total time:   ${(totalTime/1000).toFixed(1)}s`);
  console.log();

  for (const cohort of ["historical", "baseline"]) {
    const subset = results.filter(r => r.cohort === cohort);
    const subsetPass = subset.filter(r => r.outcome === "pass").length;
    console.log(`  ${cohort}: ${subsetPass}/${subset.length} pass`);
  }
  console.log();

  if (fail.length > 0) {
    const ruleCount: Record<string, number> = {};
    for (const r of fail) {
      for (const rule of r.failureRules) {
        ruleCount[rule] = (ruleCount[rule] ?? 0) + 1;
      }
    }
    console.log("Failure rules (frequency across failed streets):");
    for (const [rule, count] of Object.entries(ruleCount).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${count}x  ${rule}`);
    }
    console.log();
  }

  console.log("DETAILED RESULTS:");
  console.table(results.map(r => ({
    slug: r.slug.replace("-milton", ""),
    cohort: r.cohort,
    outcome: r.outcome,
    attempts: r.attempts,
    words: r.totalWords,
    cost: r.costUsd ? `$${r.costUsd.toFixed(4)}` : "-",
    s: (r.elapsedMs/1000).toFixed(1),
    rules: r.failureRules.join(",") || (r.errorMessage ? `err: ${r.errorMessage.slice(0, 40)}` : ""),
  })));

  const fs = await import("fs/promises");
  const outPath = `experiment-output/batch-phase41-${Date.now()}.json`;
  await fs.mkdir("experiment-output", { recursive: true }).catch(() => {});
  await fs.writeFile(outPath, JSON.stringify({ startedAt: new Date().toISOString(), results }, null, 2));
  console.log(`\nFull JSON written to: ${outPath}`);
}

main().catch(err => {
  console.error("BATCH RUNNER CRASHED:", err);
  process.exit(1);
});