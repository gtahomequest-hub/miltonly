// scripts/geni-phase3-battery.ts
// GENI Phase 3 Gate B — the grounded-explanation proof. The two PLANTS are the core:
// a false number caught by the grounding gate, and a steer caught by the OHRC judge, each
// falling through to the deterministic null. Guard-firing cases use an INJECTED generate
// (deterministic control of what the "LLM" returns); CLEAN + STEER also exercise the REAL
// DeepSeek judge; CLEAN attempts a REAL end-to-end generation.
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../.env", "../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }

async function main() {
  const { explainMatch, runExplainPipeline, bucketMaxPrice } = await import("@/lib/geni/explainMatch");
  const { findUngroundedInDrivers, checkFormat } = await import("@/lib/geni/groundProse");
  type Ref = Parameters<typeof explainMatch>[0];
  type Bucket = Parameters<typeof explainMatch>[1];
  type Drivers = Parameters<typeof explainMatch>[2];

  const DORSET: Ref = { slug: "dorset-park", name: "Dorset Park", profile: "urban_hub" };
  const BRONTE: Ref = { slug: "bronte-meadows", name: "Bronte Meadows", profile: "rural_hub" };
  const dorsetDrivers: Drivers = { typical: 1010185, distGoKm: 1.47, sold12mo: 41, domAvg: 58, tags: [{ key: "budget_comfortable", met: true }, { key: "near_go", met: true }] };
  const bronteDrivers: Drivers = { typical: 998955, distGoKm: 1.57, sold12mo: 9, domAvg: 70, tags: [{ key: "near_go", met: true }] };
  const detachedNearGo: Bucket = { propertyType: "detached", priceBand: "up to $1.1M", maxPriceBucket: bucketMaxPrice(1100000), nearGO: true, activity: null, transaction: "sale" };

  const noCache = async <T,>(_k: string, _t: number, f: () => Promise<T>): Promise<T> => f();
  const line = (s = "") => console.log(s);

  // ── CLEAN (real end-to-end): real generate + real judge ──
  line("═══ CLEAN — real DeepSeek generation, both guards ═══");
  try {
    const r = await explainMatch(DORSET, detachedNearGo, dorsetDrivers, { cache: noCache });
    if (r.prose) {
      line(`  prose: "${r.prose}"`);
      const pool = { prices: [dorsetDrivers.typical!], volumes: [dorsetDrivers.sold12mo!], doms: [dorsetDrivers.domAvg!], kms: [dorsetDrivers.distGoKm!] };
      const ung = findUngroundedInDrivers(r.prose, pool);
      const fmt = checkFormat(r.prose);
      const sentences = (r.prose.match(/[.!?]+(?=\s|$)/g) ?? []).length; // decimal-safe (matches checkFormat)
      line(`  grounding hits: ${ung.length} (0 = every number traces to payload)  |  format issues: ${fmt.length}  |  sentences: ${sentences}  |  em-dash: ${/[—–]/.test(r.prose)}  |  'median': ${/median/i.test(r.prose)}`);
    } else {
      line("  prose: null (real API unreachable or a guard fired — fail-closed; guard proofs below are deterministic).");
    }
  } catch (e) { line(`  CLEAN threw: ${(e as Error).message}`); }

  // ── PLANT A FALSE NUMBER — grounding gate must catch a $ not in the payload ──
  line("\n═══ PLANT A: FALSE NUMBER ($720,000 — payload typical is ~$1.01M) ═══");
  {
    const attempts: unknown[] = [];
    const falseProse = "Detached homes in Dorset Park typically sell around $720,000, which fits your budget, and the Milton GO station sits about 1.5 km away.";
    const r = await runExplainPipeline(DORSET, detachedNearGo, dorsetDrivers, {
      generate: async () => falseProse,
      onAttempt: (i) => attempts.push(i),
    });
    const firstFail = attempts.find((a: any) => a.stage === "grounding_fail") as any;
    line(`  grounding gate fired: ${!!firstFail}  attempts=${attempts.length}`);
    if (firstFail) firstFail.detail.forEach((h: any) => line(`    CAUGHT: "${h.raw}" — ${h.reason}`));
    line(`  result prose: ${r === null ? "null (deterministic fallback)" : `"${r}"`}`);
  }

  // ── PLANT A STEER — grounding passes, OHRC judge must fire ──
  line("\n═══ PLANT A: STEER ('great community for families' + 'young professionals') ═══");
  {
    const attempts: unknown[] = [];
    const steerProse = "Detached homes in Dorset Park typically sell around $1.0M, and the Milton GO is about 1.5 km away. It is a great community for families and popular with young professionals.";
    const r = await runExplainPipeline(DORSET, detachedNearGo, dorsetDrivers, {
      generate: async () => steerProse,
      onAttempt: (i) => attempts.push(i),
    });
    const grounded = !attempts.some((a: any) => a.stage === "grounding_fail");
    const judgeFail = attempts.find((a: any) => a.stage === "judge_fail") as any;
    line(`  passed grounding (so judge is the catcher): ${grounded}`);
    line(`  OHRC judge fired: ${!!judgeFail}`);
    if (judgeFail) {
      if (judgeFail.detail.judgeError) line(`    judge error (fail-closed): ${judgeFail.detail.judgeError}`);
      (judgeFail.detail.findings ?? []).forEach((f: any) => line(`    FINDING: "${f.span}" [${f.class}]`));
    }
    line(`  result prose: ${r === null ? "null (deterministic fallback)" : `"${r}"`}`);
  }

  // ── LIVE-COUNT EXCLUSION (DEC-GENI-11) ──
  line("\n═══ LIVE-COUNT EXCLUSION — '2 listed right now' has no grounding (count not in payload) ═══");
  {
    const attempts: unknown[] = [];
    const countProse = "Detached homes in Dorset Park typically sell around $1.0M, and the Milton GO is about 1.5 km away, with only 2 listed right now.";
    const r = await runExplainPipeline(DORSET, detachedNearGo, dorsetDrivers, {
      generate: async () => countProse,
      onAttempt: (i) => attempts.push(i),
    });
    const gf = attempts.find((a: any) => a.stage === "grounding_fail") as any;
    line(`  grounding gate fired on a live count: ${!!gf}`);
    if (gf) gf.detail.forEach((h: any) => line(`    CAUGHT: "${h.raw}" — ${h.reason}`));
    line(`  result prose: ${r === null ? "null (deterministic fallback)" : `"${r}"`}`);
  }

  // ── CACHE HIT — 2nd call for same (slug,bucket) makes NO generate call ──
  line("\n═══ CACHE HIT — same (slug,bucket) served from cache, no LLM ═══");
  {
    const store = new Map<string, unknown>();
    let genCalls = 0;
    const memCache = async <T,>(k: string, _t: number, f: () => Promise<T>): Promise<T> => {
      if (store.has(k)) return store.get(k) as T;
      const v = await f(); store.set(k, v); return v;
    };
    const deps = {
      cache: memCache,
      generate: async () => { genCalls++; return "Detached homes in Dorset Park typically sell around $1.0M, which fits your budget, and the Milton GO station sits about 1.5 km away."; },
      judge: async () => ({ pass: true }),
    };
    const a = await explainMatch(DORSET, detachedNearGo, dorsetDrivers, deps);
    const b = await explainMatch(DORSET, detachedNearGo, dorsetDrivers, deps);
    line(`  call 1 prose set: ${!!a.prose}  |  call 2 prose set: ${!!b.prose}  |  identical: ${a.prose === b.prose}`);
    line(`  generate calls total: ${genCalls}  (expect 1 — 2nd call was a cache hit)`);
  }

  // ── RURAL (DEC-GENI-7): payload excludes typical; prose cannot make a budget claim ──
  line("\n═══ RURAL — rural_hub profile excludes typical price from the payload ═══");
  {
    let captured = "";
    // (i) prove the prompt handed to the model has no price fact
    await runExplainPipeline(BRONTE, detachedNearGo, bronteDrivers, {
      generate: async (_s, u) => { captured = u; return "Bronte Meadows sits about 1.6 km from the Milton GO station and has detached homes in your search. Inventory here is limited but present."; },
      judge: async () => ({ pass: true }),
    });
    line(`  payload contains a typical-price line: ${/Typical .*price/i.test(captured)}  (must be false)`);
    line(`  payload flags price as non-confidence-bearing: ${/not a confidence-bearing signal/i.test(captured)}  (true)`);

    // (ii) a rural generation that TRIES a $ budget claim is rejected by the grounding gate
    const attempts: unknown[] = [];
    const budgetProse = "Bronte Meadows sits about 1.6 km from the Milton GO, and detached homes typically sell around $1.0M, fitting your budget.";
    const r = await runExplainPipeline(BRONTE, detachedNearGo, bronteDrivers, {
      generate: async () => budgetProse,
      judge: async () => ({ pass: true }),
      onAttempt: (i) => attempts.push(i),
    });
    const gf = attempts.find((a: any) => a.stage === "grounding_fail") as any;
    line(`  rural $ budget claim rejected by grounding: ${!!gf}`);
    if (gf) gf.detail.forEach((h: any) => line(`    CAUGHT: "${h.raw}" — ${h.reason}`));
    line(`  result prose: ${r === null ? "null (structurally cannot claim a budget fit)" : `"${r}"`}`);

    // (iii) a clean rural generation (inventory/GO only, no $) passes grounding + a pass-judge
    const clean = await runExplainPipeline(BRONTE, detachedNearGo, bronteDrivers, {
      generate: async () => "Bronte Meadows sits about 1.6 km from the Milton GO station and has detached homes available in your search. Inventory here is limited but present.",
      judge: async () => ({ pass: true }),
    });
    line(`  clean rural prose (no budget claim) accepted: ${clean !== null}  → "${clean}"`);
  }

  // ── FAIL-CLOSED — DeepSeek error and judge error both → null ──
  line("\n═══ FAIL-CLOSED — generate error and judge error both return null ═══");
  {
    const genErr = await runExplainPipeline(DORSET, detachedNearGo, dorsetDrivers, {
      generate: async () => { throw new Error("DeepSeek 500 (simulated)"); },
    });
    line(`  generate always errors → prose: ${genErr === null ? "null" : `"${genErr}"`}`);
    const judgeErr = await runExplainPipeline(DORSET, detachedNearGo, dorsetDrivers, {
      generate: async () => "Detached homes in Dorset Park typically sell around $1.0M, and the Milton GO is about 1.5 km away.",
      judge: async () => ({ pass: false, judgeError: "judge 500 (simulated)" }),
    });
    line(`  judge always errors (grounded prose) → prose: ${judgeErr === null ? "null" : `"${judgeErr}"`}`);
  }

  // ── VOICE — deterministic format gate spot-checks ──
  line("\n═══ VOICE — format gate spot-checks ═══");
  {
    const em = checkFormat("Detached homes here — the good ones — sell around $1.0M.");
    const med = checkFormat("The median detached price here is about one million dollars and the area sits close to transit lines.");
    const sup = checkFormat("This is the finest detached neighbourhood in all of Milton for a buyer on any budget at all right now.");
    const long = checkFormat(Array.from({ length: 80 }, () => "word").join(" "));
    line(`  em-dash rejected: ${em.some((i) => /dash/.test(i.reason))}`);
    line(`  'median' rejected: ${med.some((i) => /median/.test(i.reason))}`);
    line(`  superlative rejected: ${sup.some((i) => /superlative/.test(i.reason))}`);
    line(`  over-length rejected: ${long.some((i) => /length/.test(i.reason))}`);
  }

  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
