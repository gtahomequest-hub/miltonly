// BULK STREET CREATION. The standing runner for creating street pages that do not exist yet,
// one at a time, with the provider and the spend under the operator's control.
//
// WHY THIS EXISTS RATHER THAN regen-058-local.ts. That runner is a REgeneration runner: it
// looks up the StreetContent row first and logs "SKIP - no StreetContent row" when there is
// none. Every street in the QUEUE item 7 creation programme is exactly that case, so the regen
// runner would skip all 249 of them and report a clean run having done nothing.
// scripts/create-street-page.ts is the single-slug creator; this is its bulk counterpart, and
// it copies regen-058-local's controls verbatim so a bulk creation run is governed the same way
// a bulk regeneration is.
//
// THE ENTITY FLOOR APPLIES. A slug absent from both the Town registry and the off-registry
// allowlist is refused, not warned about: publish floor = entity floor.
//
// PROVIDER DISCIPLINE, copied from the regen runner. The three PRIMARY halves are forced to
// DeepSeek and the script refuses to start if any of them is aimed at Claude.
//
// WHY A FAILURE IS SAFE. generateStreetContent is fail-closed: on a validation failure it skips
// the StreetContent upsert entirely. For a creation run that means no row is written at all, so
// a failed page is a page that still does not exist, never a bad page that does. Nothing to
// unpublish, nothing to repair.
//
// It is RESUMABLE (REGEN_LOG, one JSON line per terminal outcome) and it HALTS on five
// consecutive failures sharing one signature, which is a systemic fault rather than a bad page.
//
// ── env ────────────────────────────────────────────────────────────────────────────────────
//   REGEN_ORDER     REQUIRED. Path to a JSON array of { n, slug } naming the set, in order.
//   REGEN_LIMIT     Stop after N pages. The 249-page programme is run in reviewed batches.
//   REGEN_LOG       Resumable JSONL log. Default scratchpad/audit/066-create-deepseek.jsonl.
//   REGEN_CAP_USD   Hard spend ceiling, checked BEFORE each page, so it can be exceeded by at
//                   most one page's cost. 0 or unset means no cap.
//   REGEN_FALLBACK  Opt IN to the Claude escalation. Unset deletes AI_PROVIDER_FALLBACK so a
//                   half that exhausts its retries fails closed instead of escalating.
//   BASE            Default https://miltonly.com, used only for cache purges.
//
//   REGEN_ORDER=scratchpad/audit/066-creation-order.json REGEN_LIMIT=50 REGEN_CAP_USD=3
//   npx tsx --tsconfig tsconfig.test.json scripts/create-street-pages-local.ts
import { readFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

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

const wantFallback = (process.env.REGEN_FALLBACK || "").trim();
if (wantFallback) process.env.AI_PROVIDER_FALLBACK = wantFallback;
else delete process.env.AI_PROVIDER_FALLBACK;
process.env.AI_PROVIDER = "phase41_v2";

const CLAUDE_WORDS = new Set(["claude", "opus", "sonnet", "haiku"]);
for (const k of ["AI_PROVIDER_MARKET", "AI_PROVIDER_AHA", "AI_PROVIDER_EVAL"]) {
  const v = (process.env[k] || "").trim();
  if (CLAUDE_WORDS.has(v)) throw new Error(`${k}="${v}" routes a PRIMARY pass to Claude. Refusing to start.`);
}
if (!process.env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY unset; the primary path is DeepSeek");
if (wantFallback && !CLAUDE_WORDS.has(wantFallback)) throw new Error(`REGEN_FALLBACK="${wantFallback}" is not a Claude model key`);
if (wantFallback && !process.env.ANTHROPIC_API_KEY) throw new Error("REGEN_FALLBACK set but ANTHROPIC_API_KEY unset");

const ORDER_PATH = process.env.REGEN_ORDER;
if (!ORDER_PATH) throw new Error("REGEN_ORDER unset. No default on purpose.");
const LOG = process.env.REGEN_LOG || "scratchpad/audit/066-create-deepseek.jsonl";
const CAP_USD = Number(process.env.REGEN_CAP_USD || "0");
const LIMIT = Number(process.env.REGEN_LIMIT || "0");
const BASE = process.env.BASE || "https://miltonly.com";

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const { generateStreetContent } = await import("../src/lib/generateStreet");
  const { resolveStreetName } = await import("../src/lib/streetName");
  const { MILTON_STREET_REGISTRY } = await import("../src/data/miltonStreetRegistry");
  const { OFF_REGISTRY_SET } = await import("../src/data/offRegistryStreets");
  const { makeStreetDecision } = await import("../src/lib/streetDecision");
  const registry = new Set(MILTON_STREET_REGISTRY.map((r) => r.slug));

  const order = JSON.parse(readFileSync(ORDER_PATH!, "utf-8")) as Array<{ n: number; slug: string }>;
  mkdirSync(dirname(LOG), { recursive: true });
  const alreadyDone = new Set<string>();
  if (existsSync(LOG)) {
    for (const l of readFileSync(LOG, "utf-8").split("\n")) {
      if (!l.trim()) continue;
      try { const r = JSON.parse(l); if (r.terminal) alreadyDone.add(r.slug); } catch { /* ignore */ }
    }
  }
  let todo = order.filter((o) => !alreadyDone.has(o.slug));
  if (LIMIT > 0) todo = todo.slice(0, LIMIT);

  console.log(`[create-bulk] primaries -> deepseek; fallback ${wantFallback ? `ENABLED (${wantFallback})` : "disabled"}`);
  console.log(`[create-bulk] ${order.length} in set, ${alreadyDone.size} already done, ${todo.length} to run` +
    (CAP_USD > 0 ? `, cap $${CAP_USD.toFixed(2)}` : ", no cap"));

  const secret = process.env.REVALIDATION_SECRET;
  const recent: Array<string | null> = [];
  let ok = 0, failed = 0, refused = 0, cost = 0;
  const published: string[] = [];

  for (const item of todo) {
    if (CAP_USD > 0 && cost >= CAP_USD) {
      console.error(`\n[create-bulk] CAP REACHED - $${cost.toFixed(4)} of $${CAP_USD.toFixed(2)}. Stopping before ${item.slug}.`);
      break;
    }
    const slug = item.slug;

    if (!registry.has(slug) && !OFF_REGISTRY_SET.has(slug)) {
      appendFileSync(LOG, JSON.stringify({ n: item.n, slug, terminal: true, passed: false, signature: "off_entity_floor" }) + "\n");
      refused++;
      console.log(`[${String(item.n).padStart(3)}/${order.length}] REFUSED ${slug} - off the entity floor`);
      continue;
    }
    const existing = await prisma.streetContent.findUnique({ where: { streetSlug: slug }, select: { status: true } });
    if (existing) {
      appendFileSync(LOG, JSON.stringify({ n: item.n, slug, terminal: true, passed: false, signature: "row_already_exists" }) + "\n");
      refused++;
      console.log(`[${String(item.n).padStart(3)}/${order.length}] SKIP ${slug} - a row already exists (${existing.status}); use the regen runner`);
      continue;
    }

    const name = resolveStreetName(slug).name;
    const decision = await makeStreetDecision(slug, name);
    if (decision === "skip_low_data" || decision === "skip_review") {
      appendFileSync(LOG, JSON.stringify({ n: item.n, slug, terminal: true, passed: false, signature: `decision:${decision}` }) + "\n");
      refused++;
      console.log(`[${String(item.n).padStart(3)}/${order.length}] SKIP ${slug} - decision=${decision}`);
      continue;
    }

    const t0 = Date.now();
    let passed = false, thrown: string | null = null, attempts: number | null = null;
    try {
      const r = await generateStreetContent(slug, name, { skipSms: true });
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
      select: { status: true, publishedAt: true, template: true },
    });
    const review = await prisma.streetGenerationReview.findUnique({
      where: { streetSlug: slug }, select: { violations: true },
    });
    const rules: string[] = Array.isArray(review?.violations)
      ? [...new Set((review!.violations as Array<{ rule?: string }>).map((v) => v?.rule).filter(Boolean) as string[])]
      : [];

    const thisCost = gen?.costUsd ? Number(gen.costUsd) : 0;
    cost += thisCost;
    const signature = passed ? null
      : thrown ? `threw:${thrown.split(":")[0]}`
      : rules.length ? `rules:${rules.slice(0, 2).sort().join("+")}`
      : "unknown";

    let rv: number | null = null;
    if (passed && secret) {
      rv = await fetch(`${BASE}/api/revalidate?secret=${encodeURIComponent(secret)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: `/streets/${slug}` }),
      }).then((r) => r.status).catch(() => null);
    }

    if (passed) { ok++; if (after?.status === "published") published.push(slug); } else failed++;
    appendFileSync(LOG, JSON.stringify({
      n: item.n, slug, terminal: true, passed,
      attempts: attempts ?? gen?.attemptCount ?? null,
      costUsd: Number(thisCost.toFixed(5)),
      words: gen?.totalWords ?? null,
      genStatus: gen?.status ?? null,
      pageStatusAfter: after?.status ?? null,
      template: after?.template ?? null,
      published: !!after?.publishedAt,
      snapshot: gen?.inputJson ? "stored" : "absent",
      rules, signature, thrown, revalidate: rv,
      seconds: Math.round((Date.now() - t0) / 1000),
    }) + "\n");

    console.log(
      `[${String(item.n).padStart(3)}/${order.length}] ${passed ? "PASS" : "FAIL"} ${slug.padEnd(36)}` +
      ` ${after?.status ?? "no-row"} $${thisCost.toFixed(4)} cum $${cost.toFixed(4)} ${Math.round((Date.now() - t0) / 1000)}s` +
      (signature ? ` ${signature}` : "")
    );

    recent.push(signature);
    if (recent.length > 5) recent.shift();
    if (recent.length === 5 && recent.every((s) => s !== null && s === recent[0])) {
      console.error(`\n[create-bulk] HALT - 5 consecutive failures with signature "${recent[0]}". Systemic, not per-page.`);
      break;
    }
  }

  console.log(`\n[create-bulk] ran ${ok + failed}, passed ${ok}, failed ${failed}, refused ${refused}, $${cost.toFixed(4)}`);
  console.log(`[create-bulk] published: ${published.length}`);
  for (const s of published) console.log(`  https://miltonly.com/streets/${s}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
