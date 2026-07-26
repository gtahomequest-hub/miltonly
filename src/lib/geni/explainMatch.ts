// src/lib/geni/explainMatch.ts
// GENI Phase 3 — the ONLY LLM in the matcher path: a grounded, guarded, cached
// explanation of why one neighbourhood fits one criteria bucket. Fail-closed: any
// failure returns { prose: null } and the caller shows the deterministic card facts alone.
//
// NOT here: no React/page/search-input, no routing, no change to the matcher's numbers,
// no data reads beyond the drivers passed in.
//
// DEC-GENI-11: the grounding payload = STABLE nightly drivers only (typical price, GO km,
//   sold_12mo, dom_avg, fit-tags). The live active count is NEVER passed — so any count in
//   prose is ungrounded and the grounding gate rejects it.
// DEC-GENI-7 (kind != profile): for rural_hub-PROFILE matches (incl. bronte-meadows &
//   milton-north, which are kind=urban), typical price is a low-confidence signal and is
//   EXCLUDED from the payload — rural prose talks inventory/GO/volume and structurally
//   cannot claim "typical price fits your budget".
import crypto from "crypto";
import { cached, CACHE_TTL } from "@/lib/cache";
import { callDeepSeek } from "@/lib/ai/compliance";
import { findUngroundedInDrivers, checkFormat, type GroundingPool } from "./groundProse";
import { judgeGeniProse } from "./judgeProse";
import type { PropertyType } from "./parsePrompt";

export interface NeighbourhoodRef {
  slug: string;
  name: string;
  profile: "urban_hub" | "rural_hub" | "standard_no_hub";
}

// The stable nightly-table drivers for THIS match. NO live active count (DEC-GENI-11).
export interface StableDrivers {
  typical: number | null; // typical price for the requested type
  distGoKm: number | null;
  sold12mo: number | null;
  domAvg: number | null;
  tags: Array<{ key: "budget_comfortable" | "near_go" | "active_market"; met: boolean }>;
}

export interface CriteriaBucket {
  propertyType: PropertyType | "any";
  priceBand: string | null; // human label, e.g. "up to $1.1M" (already bucketed by the caller)
  maxPriceBucket: number | null; // bucketed number used for the cache key
  nearGO: boolean;
  activity: "fast_selling" | "high_volume" | null;
  transaction: "sale" | "rent";
}

export interface ExplainResult {
  prose: string | null;
}

// Injection seams for the battery — production uses the real implementations.
export interface ExplainDeps {
  generate?: (systemPrompt: string, userPrompt: string) => Promise<string>;
  judge?: (prose: string) => Promise<{ pass: boolean; findings?: unknown[]; judgeError?: string }>;
  cache?: <T>(key: string, ttl: number, compute: () => Promise<T>) => Promise<T>;
  onAttempt?: (info: { attempt: number; stage: string; detail?: unknown }) => void;
}

const MAX_ATTEMPTS = 3; // initial + up to 2 retries

const SYSTEM_PROMPT = `You write for a boutique Milton, Ontario real estate advisory. Given ONLY the facts below about ONE neighbourhood and what the buyer asked for, write a short explanation of why this area fits.

HARD RULES:
- 2 to 3 sentences, 40 to 60 words. Never longer.
- Ground EVERY number ONLY in the numeric facts given below. Invent nothing. If a fact is absent, do not mention it.
- The buyer's budget is NOT given to you as a figure. Refer to their budget only in words ("within your budget", "at the upper end of your budget"). NEVER state a budget dollar figure — the only dollar figure you may write is the typical price fact, if one is given.
- Do NOT mention current availability, inventory, or how many homes are listed, available, or for sale. Say nothing about what is on the market now, in numbers OR in words ("available", "limited inventory", "plenty of options" are all banned). You MAY cite PAST sales (homes sold in the past year) and average days on market.
- Say "typical" never "median". Round currency by band ($1.0M, $850K, $700K).
- No em dashes. No superlatives (best, finest, premier, most desirable). No percentages. No methodology or data-source talk.
- Explain ONLY objective fit: price/budget, property type, distance to the GO station, and PAST sales activity (homes sold in the past year, days on market, fast-selling or high volume), sale vs rent.
- NEVER describe who lives in the area or who it suits (no families, professionals, retirees, "good for kids", "nice part of town", "close-knit", "safe/quiet neighbourhood").

Return ONLY JSON: {"prose": "<your explanation>"}.`;

function moneyBand(v: number): string {
  if (v >= 1_000_000) return `$${(Math.round(v / 100_000) / 10).toFixed(1)}M`;
  return `$${Math.round(v / 1_000)}K`;
}

function buildPool(ref: NeighbourhoodRef, d: StableDrivers, bucket: CriteriaBucket): GroundingPool {
  const isRent = bucket.transaction === "rent";
  const budgetConfident = ref.profile === "urban_hub"; // DEC-GENI-7
  return {
    prices: !isRent && budgetConfident && d.typical != null ? [d.typical] : [],
    volumes: !isRent && d.sold12mo != null ? [d.sold12mo] : [],
    doms: !isRent && d.domAvg != null ? [d.domAvg] : [],
    kms: d.distGoKm != null ? [d.distGoKm] : [],
  };
}

function buildUserPrompt(ref: NeighbourhoodRef, d: StableDrivers, bucket: CriteriaBucket, pool: GroundingPool): string {
  const isRent = bucket.transaction === "rent";
  const wants: string[] = [bucket.propertyType === "any" ? "any home type" : bucket.propertyType];
  if (bucket.nearGO) wants.push("near the GO station");
  if (bucket.activity === "fast_selling") wants.push("in a fast-selling area");
  else if (bucket.activity === "high_volume") wants.push("where sales volume is high");
  wants.push(isRent ? "to rent" : "to buy");

  const facts: string[] = [`Neighbourhood: ${ref.name}`, `Buyer wants: ${wants.join(", ")}`];
  // typical only when it is a confidence-bearing signal for this match (DEC-GENI-7 strips rural).
  if (pool.prices.length) facts.push(`Typical ${bucket.propertyType === "any" ? "" : bucket.propertyType + " "}price here: ${moneyBand(pool.prices[0])}`);
  // Budget FIT is expressed qualitatively (no figure) — derived from the matcher's tag so the
  // model never needs, and cannot echo, the buyer's budget number.
  const budgetTag = d.tags.find((t) => t.key === "budget_comfortable");
  if (!isRent && budgetTag) {
    facts.push(budgetTag.met
      ? `Budget fit: this typical price is within the buyer's budget.`
      : `Budget fit: this typical price is above the buyer's budget — homes here are an entry point for the area.`);
  }
  if (pool.kms.length) facts.push(`Distance to Milton GO station: ${pool.kms[0]} km`);
  if (pool.volumes.length) facts.push(`Homes sold here in the past year: ${pool.volumes[0]}`);
  if (pool.doms.length) facts.push(`Average days on market: ${pool.doms[0]}`);
  if (!pool.prices.length && !isRent) facts.push(`(Price is not a confidence-bearing signal for this area; explain fit via availability, GO distance, and sales activity instead.)`);
  return facts.join("\n");
}

// Bucket the max price to ~$100K–$200K bands so near-identical budgets share a cache entry.
export function bucketMaxPrice(maxPrice: number | null | undefined): number | null {
  if (maxPrice == null) return null;
  const band = maxPrice >= 1_000_000 ? 200_000 : 100_000;
  return Math.round(maxPrice / band) * band;
}

function cacheKey(ref: NeighbourhoodRef, bucket: CriteriaBucket): string {
  const shape = {
    slug: ref.slug,
    pt: bucket.propertyType,
    price: bucket.maxPriceBucket,
    go: bucket.nearGO,
    act: bucket.activity,
    tx: bucket.transaction,
  };
  const hash = crypto.createHash("sha256").update(JSON.stringify(shape)).digest("hex").slice(0, 24);
  return `geni:explain:v1:${hash}`;
}

async function defaultGenerate(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await callDeepSeek({
    systemPrompt,
    userPrompt,
    responseFormat: { type: "json_object" },
    maxTokens: 400,
    temperature: 0.3,
  });
  const m = res.text.match(/\{[\s\S]*\}/);
  const parsed = m ? (JSON.parse(m[0]) as { prose?: unknown }) : {};
  const prose = typeof parsed.prose === "string" ? parsed.prose.trim() : "";
  if (!prose) throw new Error("generation produced empty prose");
  return prose;
}

/**
 * Run the two-guard pipeline once (no cache). Exposed for the battery; production goes
 * through explainMatch (cached). Returns prose on success or null on fail-closed.
 */
export async function runExplainPipeline(
  ref: NeighbourhoodRef,
  bucket: CriteriaBucket,
  drivers: StableDrivers,
  deps: ExplainDeps = {},
): Promise<string | null> {
  const generate = deps.generate ?? defaultGenerate;
  const judge = deps.judge ?? judgeGeniProse;
  const pool = buildPool(ref, drivers, bucket);
  const userPrompt = buildUserPrompt(ref, drivers, bucket, pool);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let prose: string;
    try {
      prose = await generate(SYSTEM_PROMPT, userPrompt);
    } catch (e) {
      deps.onAttempt?.({ attempt, stage: "generate_error", detail: (e as Error).message });
      continue; // DeepSeek error → retry, then fail-closed
    }

    const fmt = checkFormat(prose);
    if (fmt.length) {
      deps.onAttempt?.({ attempt, stage: "format_fail", detail: fmt });
      continue;
    }

    const ungrounded = findUngroundedInDrivers(prose, pool);
    if (ungrounded.length) {
      deps.onAttempt?.({ attempt, stage: "grounding_fail", detail: ungrounded });
      continue;
    }

    const verdict = await judge(prose);
    if (!verdict.pass) {
      deps.onAttempt?.({ attempt, stage: "judge_fail", detail: verdict });
      continue;
    }

    deps.onAttempt?.({ attempt, stage: "pass" });
    return prose;
  }
  return null; // fail-closed
}

/**
 * Public entry — cached by inputHash over { slug, criteriaBucket }. A second call for the
 * same (slug, bucket) is served from cache with NO LLM call.
 */
export async function explainMatch(
  ref: NeighbourhoodRef,
  bucket: CriteriaBucket,
  drivers: StableDrivers,
  deps: ExplainDeps = {},
): Promise<ExplainResult> {
  const run = deps.cache ?? cached;
  const key = cacheKey(ref, bucket);
  const prose = await run<string | null>(key, CACHE_TTL.predictions, () =>
    runExplainPipeline(ref, bucket, drivers, deps),
  );
  return { prose };
}
