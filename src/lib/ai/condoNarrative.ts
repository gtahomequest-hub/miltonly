// src/lib/ai/condoNarrative.ts
// Build B (revision) — per-building GENERATED narrative, grounded ONLY on Build A's k-anon
// aggregate facts. Routed through the site's model path: callDeepSeek (which runs the
// assertPromptSafe choke, fail-closed) + a grounding gate that rejects any number not traceable
// to the payload. NEVER reads/paraphrases listing descriptions or remarks — the payload contains
// only aggregate medians/yield/area + the amenity/management/fee strings Build A already derived.
// Fail-closed: any failure returns { prose: null } and the page shows deterministic copy alone.
import crypto from "crypto";
import { cached, CACHE_TTL } from "@/lib/cache";
import { callDeepSeek } from "@/lib/ai/compliance";
import {
  extractNumerics,
  parseDollarTokenForGrounding,
  isPriceWithinInputTolerance,
} from "@/lib/ai/validateStreetGeneration";
import type { BuildingAttributes } from "./buildingAttributes.types";

export interface CondoNarrative {
  prose: string | null;
}

type Attrs = Omit<BuildingAttributes, "_debug">;

interface Pool {
  prices: number[]; // sale/lease/area medians (k-gated) the prose may cite
  percents: number[]; // yields the prose may cite
}

function buildPool(a: Attrs): Pool {
  const prices: number[] = [];
  if (a.gyield.saleMedian != null) prices.push(a.gyield.saleMedian);
  if (a.gyield.leaseMedian != null) prices.push(a.gyield.leaseMedian);
  if (a.areaContext.typicalCondo != null) prices.push(a.areaContext.typicalCondo);
  for (const p of a.gyield.perBed) {
    if (p.saleMedian != null) prices.push(p.saleMedian);
    if (p.leaseMedian != null) prices.push(p.leaseMedian);
  }
  const percents: number[] = [];
  if (a.gyield.headlinePct != null) percents.push(a.gyield.headlinePct);
  for (const p of a.gyield.perBed) if (p.yieldPct != null) percents.push(p.yieldPct);
  return { prices, percents };
}

const AVAILABILITY = /\b\d+\s+(?:units?|condos?|listings?|sales?|leases?|sold|listed|for sale|for lease|available|on the market)\b/i;
const SUPERLATIVE = /\b(best|finest|premier|luxurious|prestigious|unbeatable|most desirable|stunning|breathtaking)\b/i;

function findUngrounded(prose: string, pool: Pool): string[] {
  const hits: string[] = [];
  for (const n of extractNumerics(prose)) {
    if (n.type === "dollar") {
      const v = parseDollarTokenForGrounding(n.raw);
      if (v === null) continue;
      if (!isPriceWithinInputTolerance(v, pool.prices)) hits.push(`${n.raw} (no matching aggregate price)`);
    } else if (n.type === "percent") {
      const v = parseFloat(n.raw);
      if (!pool.percents.some((p) => Math.abs(p - v) <= 0.6)) hits.push(`${n.raw} (no matching yield)`);
    } else {
      // counts / days / ratios / years / quarters have no place in an aggregate condo narrative
      hits.push(`${n.raw} (${n.type} — not a groundable aggregate)`);
    }
  }
  const av = prose.match(AVAILABILITY);
  if (av) hits.push(`"${av[0]}" (states a unit/transaction count)`);
  return hits;
}

function formatIssues(prose: string): string[] {
  const issues: string[] = [];
  const words = prose.trim().split(/\s+/).filter(Boolean).length;
  const sentences = (prose.match(/[.!?]+(?=\s|$)/g) ?? []).length;
  if (words < 20) issues.push("too short");
  if (words > 90) issues.push(`too long (${words}w)`);
  if (sentences > 4) issues.push(`too many sentences (${sentences})`);
  if (/[—–]/.test(prose)) issues.push("em/en dash");
  if (/\bmedian\b/i.test(prose)) issues.push('"median"');
  if (SUPERLATIVE.test(prose)) issues.push(`superlative (${prose.match(SUPERLATIVE)?.[0]})`);
  return issues;
}

const SYSTEM = `You write one short paragraph for a Milton, Ontario condo building page, for a boutique real-estate advisory. You are given ONLY aggregate facts about the building. Write 3 to 4 sentences (45 to 75 words) that capture what makes THIS building distinctive as an investment/home.

HARD RULES:
- Ground every claim ONLY in the facts given. Invent nothing. Do NOT reference any individual listing, unit, or its description/remarks — you have none.
- The ONLY dollar figures allowed are the typical buy price, typical rent, and neighbourhood typical given to you. The ONLY percentage allowed is the gross yield given to you. Never state a count of units, sales, or leases (no "12 units", "7 sales", "N leased").
- Lead with the RELATIONSHIP between the numbers — buy price vs rent vs yield — and what it means (a high yield = investor demand competing with owner-occupiers; a rental-heavy building = a landlord's building). Then you may mention amenities, management, or fee inclusions ONLY from the lists provided.
- Say "typical" never "median". No em dashes. No superlatives (best, finest, luxurious, stunning). Advisory and honest, not salesy.
- If the sale price is not provided (a quiet-selling building), do not invent one; write the building's story around its rental strength and the neighbourhood typical instead.

Return ONLY JSON: {"prose": "<your paragraph>"}.`;

function factLines(a: Attrs): string {
  const money = (n: number | null) => (n == null ? null : `$${Math.round(n).toLocaleString("en-CA")}`);
  const lines: string[] = [`Building: ${a.buildingName.name} (${a.areaContext.neighbourhoodName ?? "Milton"})`];
  if (a.gyield.saleMedian != null) lines.push(`Typical buy price: ${money(a.gyield.saleMedian)}`);
  else lines.push(`Typical buy price: not published (fewer than 5 recent sales — a quiet-selling building)`);
  if (a.gyield.leaseMedian != null) lines.push(`Typical rent: ${money(a.gyield.leaseMedian)} per month`);
  if (a.gyield.headlinePct != null) lines.push(`Gross yield: ${a.gyield.headlinePct}% (annual rent over buy price)`);
  if (a.areaContext.typicalCondo != null) lines.push(`Neighbourhood typical condo price: ${money(a.areaContext.typicalCondo)}`);
  const rentalTilt = a.records.saleAll + a.records.leaseAll > 0 && a.records.leaseAll > a.records.saleAll * 1.5;
  lines.push(`Trading character: ${rentalTilt ? "rental-heavy (leases outweigh sales — investor-owned)" : a.kFloors.saleTypical ? "actively resold (owner-occupier demand)" : "thin sale market"}`);
  if (a.amenities.rendered.length) lines.push(`Amenities on record: ${a.amenities.rendered.slice(0, 8).join(", ")}`);
  if (a.feeIncludes.stated) lines.push(`Maintenance fee includes: ${a.feeIncludes.items.map((i) => i.replace(/ Included$/i, "")).join(", ")}`);
  if (a.management.company) lines.push(`Managed by: ${a.management.company}`);
  return lines.join("\n");
}

async function generate(a: Attrs): Promise<string | null> {
  const pool = buildPool(a);
  const userPrompt = factLines(a);
  for (let attempt = 0; attempt < 3; attempt++) {
    let prose: string;
    try {
      const res = await callDeepSeek({
        systemPrompt: SYSTEM,
        userPrompt,
        responseFormat: { type: "json_object" },
        maxTokens: 400,
        temperature: 0.35,
      });
      const m = res.text.match(/\{[\s\S]*\}/);
      const parsed = m ? (JSON.parse(m[0]) as { prose?: unknown }) : {};
      prose = typeof parsed.prose === "string" ? parsed.prose.trim() : "";
      if (!prose) continue;
    } catch {
      continue; // choke rejection / API error / parse error → retry, then fail-closed
    }
    if (formatIssues(prose).length) continue;
    if (findUngrounded(prose, pool).length) continue;
    return prose;
  }
  return null;
}

/** Public entry — cached by (slug + the facts that drive the prose). Fail-closed to null. */
export async function generateCondoNarrative(a: Attrs): Promise<CondoNarrative> {
  // Nothing groundable to write about (identity-only): let the page's deterministic copy carry it.
  if (a.records.total <= 1 && a.areaContext.typicalCondo == null) return { prose: null };
  const shape = {
    slug: a.slug,
    s: a.gyield.saleMedian,
    l: a.gyield.leaseMedian,
    y: a.gyield.headlinePct,
    area: a.areaContext.typicalCondo,
    am: a.amenities.rendered.slice(0, 8),
    fee: a.feeIncludes.stated ? a.feeIncludes.items : [],
    mgmt: a.management.company,
  };
  const key = `condo:narrative:v1:${crypto.createHash("sha256").update(JSON.stringify(shape)).digest("hex").slice(0, 24)}`;
  const prose = await cached<string | null>(key, CACHE_TTL.predictions, () => generate(a));
  return { prose };
}
