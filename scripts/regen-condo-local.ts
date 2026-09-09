// scripts/regen-condo-local.ts
// The CONDO counterpart of scripts/regen-058-local.ts. Regenerates condo building bodies one at
// a time, with the provider and the spend under the operator's control.
//
// WHY THIS EXISTS. There was no standing bulk runner for condos. regen-058-local.ts calls
// generateStreetContent and reads StreetContent; it cannot touch a building. This mirrors its
// discipline verbatim — the same primary-provider assertions, the same explicit order file, the
// same pre-page cost ceiling, the same consecutive-signature halt, the same per-page revalidate
// over HTTP — rather than inventing a second set of habits for the same job.
//
// WHAT IT IS FOR. QUEUE item 4 removed the abbreviated street form from every RENDERED surface
// and backfilled the three stored name columns. It deliberately did NOT touch the generated
// prose, because rewriting sentences by string substitution is how a backfill starts inventing
// claims. 57 published bodies still say "1005 Nadalin Hts" inside their own sentences. The fix
// is a regeneration: buildCondoBuildingInput now hands the model the RESOLVED name, so a clean
// pass writes the full form by construction.
//
// WHY A FAILURE IS SAFE. generateCondoBuilding is fail-closed: on a validator failure or an
// exhausted retry budget it writes CondoGeneration.status=failed and routes the review row, and
// it does NOT write CondoContent — the page keeps the row it already has. A failed building is
// left exactly as it was, with its old prose and its already-correct H1.
//
// THE GATE. CONDO_ENABLED is dormant by deliberate decision so the building batch cannot run by
// accident. This script sets it in the PROCESS ENVIRONMENT ONLY, the same way regen-058-local.ts
// forces AI_PROVIDER: no prod env change, no redeploy, and it says so on every run.
//
// ENV
//   REGEN_ORDER     REQUIRED. A JSON array of { n, slug }. There is no default — inheriting a
//                   previous run's list is how a bulk regeneration happens by accident.
//   REGEN_LOG       JSONL sink, one line per building.
//   REGEN_CAP_USD   Hard ceiling in dollars, checked BEFORE each building, so it can be exceeded
//                   by at most one.
//   REGEN_FALLBACK  Opts INTO Claude escalation. UNSET is the default and deletes the variable,
//                   so a half that exhausts its budget fails closed. Leave it unset: the account
//                   has no credit (HANDOFF open item 1).
import { readFileSync, appendFileSync } from "node:fs";

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

// The dormant gate, flipped for this process and nothing else.
process.env.CONDO_ENABLED = "true";

const modes = {
  AI_PROVIDER_MARKET: (process.env.AI_PROVIDER_MARKET || "").trim(),
  AI_PROVIDER_AHA: (process.env.AI_PROVIDER_AHA || "").trim(),
  AI_PROVIDER_EVAL: (process.env.AI_PROVIDER_EVAL || "").trim(),
};
const CLAUDE_WORDS = new Set(["claude", "opus", "sonnet", "haiku"]);
for (const [k, v] of Object.entries(modes)) {
  if (CLAUDE_WORDS.has(v)) throw new Error(`${k}="${v}" routes a PRIMARY pass to Claude. Refusing to start.`);
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
  `[regen-condo] CONDO_ENABLED forced true for THIS PROCESS ONLY; ` +
  `primaries ${JSON.stringify(modes)} -> all deepseek; ` +
  `fallback ${wantFallback ? `ENABLED (${wantFallback})` : "disabled"}`
);

const LOG = process.env.REGEN_LOG || "scratchpad/audit/062-regen-condo.jsonl";
const ORDER = (process.env.REGEN_ORDER || "").trim();
if (!ORDER) {
  throw new Error(
    "REGEN_ORDER is required: a JSON array of { n, slug } naming the set to run. There is no " +
    "default — inheriting a previous run's list is how a bulk regeneration happens by accident."
  );
}
const CAP_USD = Number(process.env.REGEN_CAP_USD || "0");
const HALT_RUN = 5;
const BASE = process.env.BASE || "https://miltonly.com";

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { generateCondoBuilding } = await import("../src/lib/ai/hub/generateCondoBuilding");
  const secret = (process.env.REVALIDATION_SECRET || process.env.CRON_SECRET || "").trim();

  const order: Array<{ n: number; slug: string }> = JSON.parse(readFileSync(ORDER, "utf-8"));
  let ok = 0;
  let failed = 0;
  let skipped = 0;
  let cost = 0;
  const recent: Array<string | null> = [];

  for (const item of order) {
    if (CAP_USD > 0 && cost >= CAP_USD) {
      console.error(`\n[regen-condo] CAP REACHED — $${cost.toFixed(4)} of $${CAP_USD.toFixed(2)}. Stopping before ${item.slug}.`);
      break;
    }
    const slug = item.slug;
    const t0 = Date.now();
    const before = await prisma.condoContent.findUnique({
      where: { buildingSlug: slug },
      select: { status: true, buildingName: true, description: true },
    });
    if (!before) {
      appendFileSync(LOG, JSON.stringify({ n: item.n, slug, terminal: true, passed: false, signature: "no_content_row" }) + "\n");
      failed++;
      console.log(`[${String(item.n).padStart(3)}/${order.length}] SKIP ${slug} — no CondoContent row`);
      continue;
    }

    let passed = false;
    let wasSkipped = false;
    let attempts: number | null = null;
    let thrown: string | null = null;
    try {
      const r = await generateCondoBuilding(slug);
      passed = r.published && r.validatorPassed;
      wasSkipped = r.skipped;
      attempts = r.attempts;
    } catch (e) {
      thrown = e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 200) : String(e).slice(0, 200);
    }

    const gen = await prisma.condoGeneration.findUnique({
      where: { buildingSlug: slug },
      select: { status: true, attemptCount: true, costUsd: true, totalWords: true },
    });
    const after = await prisma.condoContent.findUnique({
      where: { buildingSlug: slug },
      select: { status: true, buildingName: true, description: true },
    });

    const thisCost = gen?.costUsd ? Number(gen.costUsd) : 0;
    cost += thisCost;

    // Did the abbreviation actually leave the prose? A pass that still says "Nadalin Hts" is not
    // a pass for THIS purpose, so it is measured rather than assumed.
    const ABBR = /\b(St|Rd|Dr|Ave|Blvd|Cres|Crt|Ct|Hts|Terr|Pl|Ln|Gdns|Cir|Pkwy)\b\.?/;
    const abbrBefore = ABBR.test(before.description ?? "");
    const abbrAfter = ABBR.test(after?.description ?? "");

    const signature = passed ? null : wasSkipped ? "zero_data" : thrown ? `threw:${thrown.split(":")[0]}` : `gen:${gen?.status ?? "unknown"}`;

    let rv: number | null = null;
    if (passed && secret) {
      rv = await fetch(`${BASE}/api/revalidate?secret=${encodeURIComponent(secret)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: `/condos/${slug}` }),
      }).then((r) => r.status).catch(() => null);
    }

    appendFileSync(LOG, JSON.stringify({
      n: item.n, slug, terminal: true, passed, skipped: wasSkipped,
      attempts: attempts ?? gen?.attemptCount ?? null,
      costUsd: Number(thisCost.toFixed(5)),
      words: gen?.totalWords ?? null,
      genStatus: gen?.status ?? null,
      pageStatusBefore: before.status,
      pageStatusAfter: after?.status ?? null,
      abbrBefore, abbrAfter,
      signature, thrown, revalidate: rv,
      seconds: Math.round((Date.now() - t0) / 1000),
      at: new Date().toISOString(),
    }) + "\n");

    if (wasSkipped) skipped++;
    else if (passed) ok++;
    else failed++;
    console.log(
      `[${String(item.n).padStart(3)}/${order.length}] ${wasSkipped ? "SKIP" : passed ? "PASS" : "FAIL"} ${slug.padEnd(38)} ` +
      `att=${attempts ?? "-"} $${thisCost.toFixed(5)} ${after?.status ?? "-"} abbr ${abbrBefore ? "Y" : "n"}->${abbrAfter ? "Y" : "n"} ` +
      `${Math.round((Date.now() - t0) / 1000)}s${signature ? "  " + signature : ""}`
    );

    recent.push(signature);
    if (recent.length > HALT_RUN) recent.shift();
    if (recent.length === HALT_RUN && recent.every((s) => s && s === recent[0])) {
      console.error(`\n[regen-condo] HALT — same failure signature on ${HALT_RUN} consecutive buildings: ${recent[0]}`);
      console.error(`[regen-condo] ran ${ok + failed + skipped}, passed ${ok}, failed ${failed}, skipped ${skipped}, cost $${cost.toFixed(4)}`);
      await prisma.$disconnect();
      process.exit(2);
    }
  }

  console.log(`\n[regen-condo] complete. passed ${ok}, failed ${failed}, skipped ${skipped}, deepseek cost $${cost.toFixed(4)}`);
  if (secret) {
    const r = await fetch(`${BASE}/api/revalidate?secret=${encodeURIComponent(secret)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: "/condos" }),
    });
    console.log(`[regen-condo] revalidate /condos -> ${r.status}`);
  }
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
