// src/lib/geni/parsePrompt.ts
// GENI Phase 1 — STAGE 2: constrained LLM parse. DeepSeek JSON mode. The prompt emits ONLY
// the whitelist schema + a declined[] for anything groundable-but-absent. The schema has NO
// community/vibe/quality/who-lives-there field, so the model structurally cannot emit one.
// Output is then ALLOWLIST-ENFORCED in code: any key off the whitelist is dropped + surfaced.
import { callDeepSeek } from "@/lib/ai/compliance";

export type PropertyType = "detached" | "semi" | "townhouse" | "condo";
export type Activity = "fast_selling" | "high_volume";
export type Transaction = "sale" | "rent";

export interface GeniCriteria {
  maxPrice?: number;
  minPrice?: number;
  propertyType?: PropertyType;
  bedrooms?: number; // minimum
  bathrooms?: number; // minimum
  minSqft?: number; // HANDOFF FILTER only
  minLot?: number; // HANDOFF FILTER only
  nearGO?: boolean; // the ONLY proximity signal
  activity?: Activity;
  transaction?: Transaction;
}

export interface DeclinedField {
  field: string;
  reason: string;
}

const ALLOWED_KEYS = new Set<keyof GeniCriteria>([
  "maxPrice", "minPrice", "propertyType", "bedrooms", "bathrooms", "minSqft", "minLot", "nearGO", "activity", "transaction",
]);

const PARSE_SYSTEM_PROMPT = `You convert a home-search sentence into STRICT structured criteria for a Milton neighbourhood finder. You are NOT choosing neighbourhoods and NOT writing prose — only extracting fields.

Return ONLY this JSON shape:
{
  "criteria": {
    "maxPrice": number,            // dollars, e.g. "under $1.1M" -> 1100000, "900k" -> 900000
    "minPrice": number,
    "propertyType": "detached"|"semi"|"townhouse"|"condo",   // townhome->townhouse
    "bedrooms": number,            // minimum beds
    "bathrooms": number,           // minimum baths
    "minSqft": number,
    "minLot": number,              // lot size, sq ft
    "nearGO": true,                // ONLY if they mention the GO station / GO train
    "activity": "fast_selling"|"high_volume",   // "selling fastest"->fast_selling; "lots of sales"->high_volume
    "transaction": "sale"|"rent"   // "rent"/"rental"/"lease"->rent; else omit (defaults to sale)
  },
  "declined": [ { "field": "<name>", "reason": "<why we cannot match it>" } ]
}

RULES:
- Include a key in "criteria" ONLY if the sentence clearly states it. Omit everything else. No nulls.
- There is NO field for area quality, vibe, "who lives there", safety, family-ness, prestige, diversity, or demographics. NEVER invent one.
- Put into "declined" any criterion the user asked for that we CANNOT ground with data:
  commute time to a specific place/workplace, walkability / walk score, quiet / noise, parks,
  new-vs-old / age of stock, school QUALITY or catchment, DISTANCE TO SCHOOLS (not available),
  transit frequency, diversity/demographics/income of residents.
- "near the GO" -> criteria.nearGO=true. "near schools" / "near parks" / "near my office" -> declined (not nearGO).
- Output JSON only. No commentary.`;

export interface Stage2Result {
  criteria: GeniCriteria;
  declined: DeclinedField[];
}

function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export async function parseWithLLM(residue: string): Promise<Stage2Result> {
  const res = await callDeepSeek({
    systemPrompt: PARSE_SYSTEM_PROMPT,
    userPrompt: residue,
    responseFormat: { type: "json_object" },
    maxTokens: 400,
    temperature: 0,
  });
  const m = res.text.match(/\{[\s\S]*\}/);
  const raw = m ? (JSON.parse(m[0]) as { criteria?: Record<string, unknown>; declined?: unknown }) : {};
  const inCrit = (raw.criteria ?? {}) as Record<string, unknown>;
  const criteria: GeniCriteria = {};
  const declined: DeclinedField[] = [];

  // Allowlist enforcement: keep ONLY whitelist keys with valid values; anything else is dropped + surfaced.
  for (const [k, v] of Object.entries(inCrit)) {
    if (!ALLOWED_KEYS.has(k as keyof GeniCriteria)) {
      declined.push({ field: k, reason: "not a matchable criterion (off the allowlist)" });
      continue;
    }
    switch (k) {
      case "maxPrice": case "minPrice": case "bedrooms": case "bathrooms": case "minSqft": case "minLot": {
        const n = num(v); if (n !== undefined) (criteria as Record<string, unknown>)[k] = n; break;
      }
      case "propertyType": {
        const s = String(v).toLowerCase().replace("townhome", "townhouse");
        if (["detached", "semi", "townhouse", "condo"].includes(s)) criteria.propertyType = s as PropertyType; break;
      }
      case "activity": {
        const s = String(v); if (s === "fast_selling" || s === "high_volume") criteria.activity = s; break;
      }
      case "transaction": {
        const s = String(v); if (s === "sale" || s === "rent") criteria.transaction = s; break;
      }
      case "nearGO": { if (v === true || v === "true") criteria.nearGO = true; break; }
    }
  }

  // Carry the model's declined[] through (defensively typed).
  if (Array.isArray(raw.declined)) {
    for (const d of raw.declined as Array<{ field?: unknown; reason?: unknown }>) {
      if (d && typeof d.field === "string") declined.push({ field: d.field, reason: String(d.reason ?? "not groundable") });
    }
  }
  return { criteria, declined };
}
