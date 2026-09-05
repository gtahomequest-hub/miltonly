// BULK STREET REGENERATION. The standing runner for regenerating a named set of street
// pages, one at a time, with the provider and the spend under the operator's control.
// Written for the 058 corpus grounding audit (hence the name) and kept because the shape
// generalises: any remediation that has to re-run N pages wants exactly these controls.
//
// WHY IT RUNS IN THIS PROCESS rather than calling /api/admin/force-regenerate: the provider
// choice is read from the process environment, and a script cannot reach Vercel's. Going
// through the production API means running whatever production is configured for, which on
// 2026-09-05 was a Claude escalation costing ~118x the DeepSeek path. Running here is the
// only way to choose.
//
// WHAT IT CANNOT DO. The three PRIMARY halves always run on DeepSeek; the script refuses to
// start if AI_PROVIDER_{MARKET,AHA,EVAL} points any of them at Claude. A Claude primary pass
// across a bulk set is the expensive mistake this guard exists to prevent.
//
// WHY A FAILURE IS SAFE. generateStreetContent is fail-closed: on a validation failure it
// skips the StreetContent upsert entirely, so the page keeps the row it already had. A failed
// page here is a page left alone, never a page blanked or degraded. Failures are logged and
// named; the run continues.
//
// It is RESUMABLE. Every terminal outcome is appended to REGEN_LOG as one JSON line, and a
// re-run skips any slug already carrying one. To retry a page, delete its line.
//
// It HALTS on five consecutive failures sharing one signature — a systemic fault (rate limit,
// a bad env var, a validator regression), where burning the rest of the set is pure waste.
// Isolated failures do not halt it.
//
// ── The four env knobs ──────────────────────────────────────────────────────────────────
//
//   REGEN_ORDER     REQUIRED. Path to a JSON array of { n, slug } naming the set to run, in
//                   order. No default on purpose: a standing bulk runner that defaults to
//                   some previous run's list is a way to regenerate 154 pages by accident.
//
//   REGEN_LOG       Path to the resumable JSONL log. Default
//                   scratchpad/audit/058-regen-deepseek.jsonl. Give each distinct run its
//                   own, or the resume logic will treat the previous run's pages as done.
//
//   REGEN_FALLBACK  Opt IN to the Claude escalation, naming the model key: "opus", "sonnet"
//                   or "haiku". Unset (the default) deletes AI_PROVIDER_FALLBACK from the
//                   process environment, so a half that exhausts its retry budget fails
//                   closed instead of escalating. Production carries "opus". Escalation costs
//                   roughly $0.4 a page against $0.006 on DeepSeek alone, so leave it unset
//                   unless the set is known to need it.
//
//   REGEN_CAP_USD   A hard spend ceiling in dollars. Checked BEFORE each page, so the cap can
//                   be exceeded by at most one page's cost. 0 or unset means no cap. Always
//                   set one when REGEN_FALLBACK is on.
//
// BASE also applies (default https://miltonly.com) and is only used for cache purges.
//
//   REGEN_ORDER=scratchpad/audit/my-set.json REGEN_LOG=scratchpad/audit/my-run.jsonl //   REGEN_FALLBACK=opus REGEN_CAP_USD=25 //   npx tsx --tsconfig tsconfig.test.json scripts/regen-058-local.ts
//
// NOTE ON COST FIGURES. costUsd comes from CLAUDE_MODELS in src/lib/ai/compliance.ts, which
// is hand-maintained and has been wrong before. Verify it against the current rate sheet
// before quoting a total.
import { readFileSync, appendFileSync, existsSync } from "node:fs";

function loadEnvLocal(): void {
  for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      let v = m[2].replace(/\r$/, "");
      const dq = v.startsWith('"') && v.endsWith('"');
      const sq = v.startsWith("'") && v.endsWith("'");
      if (dq || sq) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
}
loadEnvLocal();

// THE OVERRIDE. Process environment only - no prod env change, no redeploy.
//
// REGEN_FALLBACK opts a run INTO the Claude escalation, naming the model explicitly
// ("opus" is what production carries). Unset - the default - deletes the variable, so a
// half that exhausts its budget fails closed instead of escalating. The three PRIMARY
// knobs are forced to DeepSeek either way: this script never runs a Claude primary pass,
// because that is the expensive path nobody asked for.
const wantFallback = (process.env.REGEN_FALLBACK || "").trim();
if (wantFallback) process.env.AI_PROVIDER_FALLBACK = wantFallback;
else delete process.env.AI_PROVIDER_FALLBACK;
process.env.AI_PROVIDER = "phase41_v2";

// resolveSimpleMode in compliance.ts maps anything that is not claude/opus/sonnet/haiku
// to "deepseek". Assert the three generation knobs here so no primary pass can be Claude.
const modes = {
  AI_PROVIDER_MARKET: (process.env.AI_PROVIDER_MARKET || "").trim(),
  AI_PROVIDER_AHA: (process.env.AI_PROVIDER_AHA || "").trim(),
  AI_PROVIDER_EVAL: (process.env.AI_PROVIDER_EVAL || "").trim(),
};
const CLAUDE_WORDS = new Set(["claude", "opus", "sonnet", "haiku"]);
for (const [k, v] of Object.entries(modes)) {
  if (CLAUDE_WORDS.has(v)) {
    throw new Error(`${k}="${v}" routes a PRIMARY pass to Claude. Refusing to start.`);
  }
}
if (!process.env.DEEPSEEK_API_KEY) {
  throw new Error("DEEPSEEK_API_KEY unset; the primary path is DeepSeek and cannot run");
}
if (wantFallback && !CLAUDE_WORDS.has(wantFallback)) {
  throw new Error(`REGEN_FALLBACK="${wantFallback}" is not a Claude model key`);
}
if (wantFallback && !process.env.ANTHROPIC_API_KEY) {
  throw new Error("REGEN_FALLBACK set but ANTHROPIC_API_KEY unset");
}
console.log(
  `[regen-local] primaries ${JSON.stringify(modes)} -> all deepseek; ` +
  `fallback ${wantFallback ? `ENABLED (${wantFallback})` : "disabled"}`
);

const LOG = process.env.REGEN_LOG || "scratchpad/audit/058-regen-deepseek.jsonl";
const ORDER = (process.env.REGEN_ORDER || "").trim();
if (!ORDER) {
  throw new Error(
    "REGEN_ORDER is required: a JSON array of { n, slug } naming the set to run. " +
    "There is no default - inheriting a previous run's list is how a bulk regeneration " +
    "happens by accident."
  );
}
// Hard ceiling. Checked BEFORE each page, so the cap can be exceeded by at most one page.
const CAP_USD = Number(process.env.REGEN_CAP_USD || "0");
const HALT_RUN = 5;
const BASE = process.env.BASE || "https://miltonly.com";

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { generateStreetContent } = await import("../src/lib/generateStreet");

  const order: Array<{ n: number; slug: string; rules: string[] }> =
    JSON.parse(readFileSync(ORDER, "utf-8"));

  // The four already regenerated through the production path are done; do not redo them.
  const alreadyDone = new Set<string>();
  if (existsSync("scratchpad/audit/058-regen.jsonl")) {
    for (const l of readFileSync("scratchpad/audit/058-regen.jsonl", "utf-8").split("\n")) {
      if (!l.trim()) continue;
      try { const r = JSON.parse(l); if (r.terminal && r.passed) alreadyDone.add(r.slug); } catch { /* ignore */ }
    }
  }
  if (existsSync(LOG)) {
    for (const l of readFileSync(LOG, "utf-8").split("\n")) {
      if (!l.trim()) continue;
      try { const r = JSON.parse(l); if (r.terminal) alreadyDone.add(r.slug); } catch { /* ignore */ }
    }
  }
  const todo = order.filter((o) => !alreadyDone.has(o.slug));
  console.log(`[regen-local] ${order.length} in set, ${alreadyDone.size} already done, ${todo.length} to run`);

  const secret = process.env.REVALIDATION_SECRET;
  const recent: Array<string | null> = [];
  let ok = 0;
  let failed = 0;
  let cost = 0;

  for (const item of todo) {
    if (CAP_USD > 0 && cost >= CAP_USD) {
      console.error(`
[regen-local] CAP REACHED - $${cost.toFixed(4)} of $${CAP_USD.toFixed(2)}. Stopping before ${item.slug}.`);
      console.error(`[regen-local] ran ${ok + failed}, passed ${ok}, failed ${failed}`);
      break;
    }
    const slug = item.slug;
    const t0 = Date.now();
    const content = await prisma.streetContent.findUnique({
      where: { streetSlug: slug },
      select: { streetName: true, status: true },
    });
    if (!content) {
      appendFileSync(LOG, JSON.stringify({ n: item.n, slug, terminal: true, passed: false, signature: "no_content_row" }) + "\n");
      failed++;
      console.log(`[${String(item.n).padStart(3)}/${order.length}] SKIP ${slug} - no StreetContent row`);
      continue;
    }

    let passed = false;
    let thrown: string | null = null;
    let attempts: number | null = null;
    try {
      const r = await generateStreetContent(slug, content.streetName, { skipSms: true });
      passed = r.passed;
      attempts = r.attempts;
    } catch (e) {
      thrown = e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 200) : String(e).slice(0, 200);
    }

    const gen = await prisma.streetGeneration.findUnique({
      where: { streetSlug: slug },
      select: { status: true, attemptCount: true, costUsd: true, totalWords: true, inputJson: true },
    });
    const after = await prisma.streetContent.findUnique({
      where: { streetSlug: slug },
      select: { status: true, publishedAt: true },
    });
    const review = await prisma.streetGenerationReview.findUnique({
      where: { streetSlug: slug },
      select: { violations: true },
    });
    const rules: string[] = Array.isArray(review?.violations)
      ? [...new Set((review!.violations as Array<{ rule?: string }>).map((v) => v?.rule).filter(Boolean) as string[])]
      : [];

    const thisCost = gen?.costUsd ? Number(gen.costUsd) : 0;
    cost += thisCost;
    // The fair-housing judge is fail-closed inside generation, so a pass implies a judge pass.
    const judge = passed ? "PASS" : rules.includes("fair_housing_register") ? "FAIL" : "n/a";
    const signature = passed
      ? null
      : thrown
        ? `threw:${thrown.split(":")[0]}`
        : rules.length
          ? `rules:${rules.slice(0, 2).sort().join("+")}`
          : "unknown";

    // Per-page purge. revalidatePath inside generateStreetContent needs a request scope a
    // script does not have, so it is swallowed there and done over HTTP here instead.
    let rv: number | null = null;
    if (passed && secret) {
      rv = await fetch(`${BASE}/api/revalidate?secret=${encodeURIComponent(secret)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: `/streets/${slug}` }),
      }).then((r) => r.status).catch(() => null);
    }

    appendFileSync(LOG, JSON.stringify({
      n: item.n, slug, terminal: true, passed,
      attempts: attempts ?? gen?.attemptCount ?? null,
      costUsd: Number(thisCost.toFixed(5)),
      judge, words: gen?.totalWords ?? null,
      genStatus: gen?.status ?? null,
      pageStatusBefore: content.status,
      pageStatusAfter: after?.status ?? null,
      published: !!after?.publishedAt,
      snapshot: gen?.inputJson ? "stored" : "absent",
      rules, signature, thrown, revalidate: rv,
      seconds: Math.round((Date.now() - t0) / 1000),
      at: new Date().toISOString(),
    }) + "\n");

    if (passed) ok++; else failed++;
    console.log(
      `[${String(item.n).padStart(3)}/${order.length}] ${passed ? "PASS" : "FAIL"} ${slug.padEnd(36)} ` +
      `att=${attempts ?? "-"} $${thisCost.toFixed(5)} judge=${judge} ${after?.status ?? "-"} ` +
      `${Math.round((Date.now() - t0) / 1000)}s${signature ? "  " + signature : ""}`
    );

    recent.push(signature);
    if (recent.length > HALT_RUN) recent.shift();
    if (recent.length === HALT_RUN && recent.every((s) => s && s === recent[0])) {
      console.error(`\n[regen-local] HALT - same failure signature on ${HALT_RUN} consecutive streets: ${recent[0]}`);
      console.error(`[regen-local] ran ${ok + failed}, passed ${ok}, failed ${failed}, deepseek cost $${cost.toFixed(4)}`);
      await prisma.$disconnect();
      process.exit(2);
    }
  }

  console.log(`\n[regen-local] complete. passed ${ok}, failed ${failed}, deepseek cost $${cost.toFixed(4)}`);
  if (secret) {
    const r = await fetch(`${BASE}/api/revalidate?secret=${encodeURIComponent(secret)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: "/streets" }),
    });
    console.log(`[regen-local] revalidate /streets -> ${r.status}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
