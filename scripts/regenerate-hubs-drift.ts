// scripts/regenerate-hubs-drift.ts
//
// MC-027 item 1, the batch: regenerate every published hub whose stored generation has drifted
// from its live aggregate (src/lib/hubDrift.ts), DeepSeek only, and report the cost. The cron
// (/api/sync/regenerate-hubs) does three a day from here on; this is the first pass over all of
// them, run by hand so the cost is one number in one report.
//
// The generators need URBAN_HUB_ENABLED=true (the urban gate; rural has none) and
// DEEPSEEK_API_KEY. The revalidation each generator calls is skipped outside a request scope
// (it says so); purge the hub paths on the host afterwards with /api/revalidate.
//
//   NODE_OPTIONS="--conditions=react-server" URBAN_HUB_ENABLED=true \
//     npx tsx --tsconfig tsconfig.test.json scripts/regenerate-hubs-drift.ts            # dry run
//     ... --write [--only=beaty,ford] [--limit=5] [--force]

import { readFileSync, appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnvLocal() {
  const content = readFileSync(resolve(__dirname, "..", ".env.local"), "utf8");
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
loadEnvLocal();
const WRITE = process.argv.includes("--write");
// MC-037: --force regenerates every hub the run sees (or --only names) whether or not it has
// drifted; the drift hash does not include the quarterly trend, and a window change moves it.
const FORCE = process.argv.includes("--force");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? new Set(onlyArg.slice(7).split(",").map((s) => s.trim()).filter(Boolean)) : null;
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.slice(8)) : 22;
const LOG = resolve(__dirname, "..", "scratchpad", "mc003", "hub-regen.jsonl");

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { hubDrift } = await import("../src/lib/hubDrift");
  const { generateUrbanHub } = await import("../src/lib/ai/hub/generateUrbanHub");
  const { generateRuralHub } = await import("../src/lib/ai/hub/generateRuralHub");

  const hubs = await prisma.hubContent.findMany({ where: { status: "published" }, select: { neighbourhoodSlug: true }, orderBy: { neighbourhoodSlug: "asc" } });
  const profiles = new Map((await prisma.neighbourhood.findMany({ select: { slug: true, profile: true } })).map((n) => [n.slug, n.profile]));
  console.log(`${WRITE ? "WRITE" : "DRY RUN"} · ${hubs.length} published hubs · URBAN_HUB_ENABLED=${process.env.URBAN_HUB_ENABLED ?? ""} · fallback refused\n`);

  const drifted: string[] = [];
  for (const h of hubs) {
    if (ONLY && !ONLY.has(h.neighbourhoodSlug)) continue;
    const d = await hubDrift(h.neighbourhoodSlug);
    console.log(`${h.neighbourhoodSlug.padEnd(24)} ${(profiles.get(h.neighbourhoodSlug) ?? "?").padEnd(10)} ${d.drifted ? "DRIFTED" : "current"} (${d.reason}) stored ${d.storedHash?.slice(0, 16) ?? "-"} current ${d.currentHash ?? "-"}`);
    if (d.drifted || FORCE) drifted.push(h.neighbourhoodSlug);
  }
  console.log(`\ndrifted ${drifted.length} of ${hubs.length}`);
  if (!WRITE) return;

  let total = 0, done = 0, failed = 0;
  for (const slug of drifted.slice(0, LIMIT)) {
    const t0 = Date.now();
    const before = await prisma.hubGeneration.findUnique({ where: { neighbourhoodSlug: slug }, select: { costUsd: true } });
    try {
      const r = profiles.get(slug) === "urban_hub"
        ? await generateUrbanHub(slug, { primaryProvider: "deepseek", deepseekOnly: true })
        : await generateRuralHub(slug, { deepseekOnly: true });
      const after = await prisma.hubGeneration.findUnique({ where: { neighbourhoodSlug: slug }, select: { costUsd: true, attemptCount: true, status: true, inputHash: true } });
      const cost = after?.costUsd == null ? 0 : Number(after.costUsd);
      total += cost;
      if (r.published) done++; else failed++;
      const line = { slug, published: r.published, validatorPassed: r.validatorPassed, attempts: r.attempts, status: after?.status, costUsd: cost, previousCostUsd: before?.costUsd == null ? null : Number(before.costUsd), hash: after?.inputHash, seconds: Math.round((Date.now() - t0) / 1000), at: new Date().toISOString() };
      appendFileSync(LOG, JSON.stringify(line) + "\n");
      console.log(`${slug.padEnd(24)} ${r.published ? "published" : "NOT published"} attempts ${r.attempts} cost $${cost.toFixed(4)} ${line.seconds}s`);
    } catch (e) {
      failed++;
      appendFileSync(LOG, JSON.stringify({ slug, error: String((e as Error).message).slice(0, 200), at: new Date().toISOString() }) + "\n");
      console.log(`${slug.padEnd(24)} THREW ${String((e as Error).message).slice(0, 120)}`);
    }
  }
  console.log(`\nregenerated ${done} · failed ${failed} · total cost $${total.toFixed(4)}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : String(e)); process.exit(1); });
