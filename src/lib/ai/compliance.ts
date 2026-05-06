/**
 * AI Compliance Gatekeeper
 *
 * This is the ONLY file in the codebase that calls external LLM APIs.
 * All other files must call functions exported from here.
 *
 * Rules enforced:
 * 1. No raw MLS listing records enter any prompt
 * 2. Only pre-computed stats (averages, counts, percentages) are passed
 * 3. No PropTx record identifiers (MLS numbers, listing keys) in prompts
 * 4. All calls are logged for compliance audit
 *
 * UPG-4 (2026-05-04): Added DeepSeek 7-pass long-form generation alongside
 * existing single-pass Anthropic path. Selection via AI_PROVIDER env var.
 *   - AI_PROVIDER unset OR "anthropic" → existing behaviour (no change)
 *   - AI_PROVIDER="deepseek_v2" → DeepSeek 7-pass for long-form, Anthropic
 *     remains the only option for the legacy short-form function
 *
 * Production callers should use the NEW generateLongFormStreetDescription()
 * function for the multi-section 1,200-1,500 word output. The legacy
 * generateStreetDescription() is preserved untouched for the existing
 * short-form (300-word) path while the production migration is staged.
 */

import Anthropic from "@anthropic-ai/sdk";
import * as fs from 'fs';
import * as path from 'path';
import {
  validateStreetGeneration,
  generateWithRetry,
  formatViolationsForRetry,
  formatViolationsForRetryEnriched,
} from './validateStreetGeneration';
import type {
  StreetGeneratorInput,
  StreetGeneratorOutput,
  ValidatorViolation,
} from '../../types/street-generator';

const MODEL = "claude-opus-4-7";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
    client = new Anthropic({ apiKey });
  }
  return client;
}

/** Pre-computed street stats that are safe to pass to LLMs (no raw listing data).
 *  Post-Phase-2.6 (2026-04-17): fields renamed to match their actual semantics.
 *  DB1 no longer stores sold prices; these values are all active-listing aggregates
 *  sourced from the operational Listing table. Sold data lives in DB2 and is
 *  surfaced only through the gated StreetSoldBlock, never into AI prompts. */
export interface SafeStreetStats {
  streetName: string;
  neighbourhood: string;
  avgListPrice: number;      // active-listing average
  medianListPrice: number;   // active-listing median
  totalSold12mo: number;     // count only — safe aggregate
  avgDOM: number;            // active-listing days on market
  activeCount: number;
  dominantPropertyType: string;
  priceDirection: string;
  schoolZone: string | null;
  bestMonth: string;
}

/** Validates that no raw listing data leaks into a prompt */
function validatePromptSafety(text: string): { safe: boolean; reason?: string } {
  // Check for MLS number patterns (e.g., W1234567, C1234567, N1234567)
  if (/\b[A-Z]\d{7,}\b/.test(text)) {
    return { safe: false, reason: "Prompt contains what appears to be an MLS number" };
  }

  // Check for listing key patterns (long alphanumeric strings typical of TREB keys)
  if (/\b[a-f0-9]{24,}\b/i.test(text)) {
    return { safe: false, reason: "Prompt contains what appears to be a listing key or database ID" };
  }

  // Check for raw address patterns with house numbers + full postal info
  // (Street names alone are OK since they're public knowledge)
  if (/\b\d+\s+\w+\s+\w+.*[A-Z]\d[A-Z]\s*\d[A-Z]\d/i.test(text)) {
    return { safe: false, reason: "Prompt contains a full property address with postal code" };
  }

  return { safe: true };
}

/**
 * LEGACY — Generate a short-form (300-word) street description using Claude.
 * Preserved untouched as part of UPG-4 Stage 1. Existing callers
 * (generateStreet.ts) continue to use this. Migration to long-form happens
 * in UPG-4 Stage 2 (tomorrow).
 *
 * Only accepts pre-computed stats — never raw listing records.
 */
export async function generateStreetDescription(
  systemPrompt: string,
  userPrompt: string,
  stats: SafeStreetStats
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  // Validate the user prompt doesn't contain raw data
  const safety = validatePromptSafety(userPrompt);
  if (!safety.safe) {
    console.error(`[AI Compliance] Blocked unsafe prompt: ${safety.reason}`);
    throw new Error(`AI compliance violation: ${safety.reason}`);
  }

  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1200,
    temperature: 0.7,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type from Claude API");

  console.log(
    `[AI Compliance] Street description generated for ${stats.streetName}: ` +
    `${response.usage.input_tokens} in / ${response.usage.output_tokens} out`
  );

  return {
    text: block.text.trim(),
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// ============================================================================
// UPG-4 Stage 1: DeepSeek 7-pass long-form generation
// ============================================================================
//
// Architecture proven 2026-05-04 in deepseek-experiment-v2.ts:
//   - Trafalgar Rd W: 1,686 words, 16.4% AI on ZeroGPT, $0.018 cost
//   - 66x cheaper than Claude single-pass at the same word target
//   - Quality (manual review): 8.5/10 vs Claude baseline 6.5/10
//
// Pass chain:
//   Passes 1-5: Quality generation with validator-driven retry feedback
//   Pass 6:     Humanization (separate prompt + system role)
//   Pass 7:     Surgical polish for remaining AI patterns
//
// Validator updates resolve DEF-13, DEF-14, DEF-16 simultaneously.

const DEEPSEEK_MODEL = "deepseek-chat";
const DEEPSEEK_INPUT_PRICE_PER_M = 0.27;
const DEEPSEEK_OUTPUT_PRICE_PER_M = 1.10;

const KNOWN_ANCHORS_V2 = [
  "Milton GO", "Milton GO station", "Highway 401", "Highway 407",
  "Craig Kielburger", "Bishop Reding", "Tiger Jeet Singh", "Stuart E. Russell",
  "Sam Sherratt", "Kelso Conservation Area", "Bruce Trail", "Milton District Hospital",
  "James Snow Parkway", "Derry Road", "Main Street", "Old Milton",
  "Hawthorne Village", "Hawthorne", "Willmott", "Beaty", "Dempsey",
  "Coates", "Clarke", "Scott", "Harrison", "Ford", "Cobban",
  "Milton Islamic Centre", "Union Station", "Escarpment",
];

const REQUIRED_SECTION_HEADINGS_V2 = [
  "The street itself", "For buyers", "For investors",
  "For sellers", "For renters", "The honest take",
];

const BANNED_AI_PHRASES_V2 = [
  "furthermore", "moreover", "additionally", "in conclusion",
  "it's worth noting", "importantly", "ultimately", "that said",
  "on the other hand", "in essence", "as we can see",
  "delve into", "navigate the complexities", "tapestry",
  "in today's", "in the realm of", "it is important to note",
];

const BANNED_CLICHE_PHRASES_V2 = [
  "nestled", "charming", "vibrant", "picturesque", "bustling",
  "sought-after", "stunning", "dream home", "perfect blend",
  "a stone's throw", "boasts", "in the heart of", "don't miss",
  "rare opportunity", "pride of ownership", "meticulously",
  "truly special", "ideal for families", "conveniently located",
  "this is the one", "look no further", "tranquil", "serene",
  "oasis", "turnkey", "hidden gem", "breathtaking", "sophisticated",
  "prestigious", "remarkable", "exceptional", "incredible", "amazing",
];

const FIRST_PERSON_PATTERNS_V2 = [
  /\bI[' ]ve\s/i, /\bmy clients\b/i, /\bin my experience\b/i,
  /\bI had\s/i, /\bI tell\b/i, /\bI[' ]d\b/i,
  /\bI[' ]ll\s/i, /\bI[' ]m\s/i, /\bwhat I\b/i,
  /\bI think\b/i, /\bI know\b/i, /\bI see\b/i,
];

export interface ValidationResultV2 {
  passed: boolean;
  failures: string[];
  metrics: {
    wordCount: number;
    sentenceLengthStdDev: number;
    firstPersonHits: number;
    anchorsFound: string[];
    sectionsFound: string[];
    bannedAiHits: string[];
    bannedClicheHits: string[];
  };
}

function calculateSentenceLengthStdDev(text: string): number {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const lengths = sentences.map((s) => s.trim().split(/\s+/).filter(Boolean).length);
  if (lengths.length === 0) return 0;
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((sum, len) => sum + Math.pow(len - mean, 2), 0) / lengths.length;
  return Math.sqrt(variance);
}

/** v2 validator — resolves DEF-13 (regex), DEF-14 (first-word check), DEF-16 (burstiness threshold).
 *  Empirically calibrated against ZeroGPT's human-classification threshold. */
export function validateLongFormContent(text: string, streetName: string): ValidationResultV2 {
  const failures: string[] = [];
  const lower = text.toLowerCase();

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 1200) failures.push(`Too short: ${wordCount} words (min 1,200)`);
  if (wordCount > 1600) failures.push(`Too long: ${wordCount} words (max 1,500, hard cap 1,600)`);

  const sectionsFound = REQUIRED_SECTION_HEADINGS_V2.filter((h) => lower.includes(h.toLowerCase()));
  const missingSections = REQUIRED_SECTION_HEADINGS_V2.filter((h) => !sectionsFound.includes(h));
  if (missingSections.length > 0) {
    failures.push(`Missing sections: ${missingSections.join(", ")}`);
  }

  const anchorsFound = Array.from(new Set(KNOWN_ANCHORS_V2.filter((a) => text.includes(a))));
  if (anchorsFound.length < 3) {
    failures.push(`Only ${anchorsFound.length} anchors (need 3+). Found: ${anchorsFound.join(", ") || "none"}`);
  }

  const bannedAiHits = BANNED_AI_PHRASES_V2.filter((p) => lower.includes(p.toLowerCase()));
  if (bannedAiHits.length > 0) failures.push(`AI-tell phrases: ${bannedAiHits.join(", ")}`);

  const bannedClicheHits = BANNED_CLICHE_PHRASES_V2.filter((p) => lower.includes(p.toLowerCase()));
  if (bannedClicheHits.length > 0) failures.push(`Cliché phrases: ${bannedClicheHits.join(", ")}`);

  let firstPersonHits = 0;
  for (const pattern of FIRST_PERSON_PATTERNS_V2) {
    if (pattern.test(text)) firstPersonHits++;
  }
  if (firstPersonHits < 2) failures.push(`First-person too sparse: ${firstPersonHits} (need 2+)`);

  // DEF-16 fix: threshold lowered from >8 to >4.5 — empirically calibrated to clear
  // ZeroGPT-classified human content (Pass 7 stddev 5.0 scored 16.4% AI = human).
  const stdDev = calculateSentenceLengthStdDev(text);
  if (stdDev < 4.5) failures.push(`Sentence rhythm too monotone: stddev ${stdDev.toFixed(1)} (need >4.5)`);

  // DEF-14 fix: first-WORD check, not 30-char substring
  const firstWord = text.trim().split(/\s+/)[0]?.toLowerCase() || "";
  const firstWordOfStreet = streetName.split(/\s+/)[0]?.toLowerCase() || "";
  if (firstWord && firstWordOfStreet && firstWord === firstWordOfStreet) {
    failures.push(`Starts with the street name's first word ("${firstWord}")`);
  }

  // MLS code leakage check (e.g. "1044 - TR Rural Trafalgar")
  if (/\b\d{3,4}\s*-\s*[A-Z]{2}\s+\w+/.test(text)) {
    failures.push("MLS code pattern detected (e.g. '1044 - TR Rural Trafalgar')");
  }

  return {
    passed: failures.length === 0,
    failures,
    metrics: {
      wordCount,
      sentenceLengthStdDev: stdDev,
      firstPersonHits,
      anchorsFound,
      sectionsFound,
      bannedAiHits,
      bannedClicheHits,
    },
  };
}

interface DeepSeekRawResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

interface CallDeepSeekOptions {
  systemPrompt: string;
  userPrompt: string;
  responseFormat?: { type: 'json_object' };
  maxTokens?: number;
}

async function callDeepSeek({
  systemPrompt,
  userPrompt,
  responseFormat,
  maxTokens = 3000,
}: CallDeepSeekOptions): Promise<DeepSeekRawResponse> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not configured");

  const requestBody: Record<string, unknown> = {
    model: DEEPSEEK_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: maxTokens,
  };
  if (responseFormat) {
    requestBody.response_format = responseFormat;
  }

  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey.trim()}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("DeepSeek returned no text");

  const inputTokens = data.usage?.prompt_tokens ?? 0;
  const outputTokens = data.usage?.completion_tokens ?? 0;
  const costUsd =
    (inputTokens / 1_000_000) * DEEPSEEK_INPUT_PRICE_PER_M +
    (outputTokens / 1_000_000) * DEEPSEEK_OUTPUT_PRICE_PER_M;

  return { text: text.trim(), inputTokens, outputTokens, costUsd };
}

function buildSystemPromptV2(streetName: string, cityName: string = "Milton", cityProvince: string = "Ontario"): string {
  return `You are Aamir Yaqoob, a RE/MAX Hall of Fame realtor in ${cityName}, ${cityProvince} with 14 years of experience selling homes street-by-street. You're writing a comprehensive guide for ${streetName} for Miltonly.com. Buyers, investors, sellers, and renters all read this page.

Write a 1,200 to 1,400 word guide covering all stakeholder perspectives. Use real market data. Write like a working realtor — direct, opinionated, specific.

STRUCTURE — use these exact section headings:

## The street itself (200 words)
What ${streetName} physically is. Where in ${cityName}. Length, ambiance, era of homes, geography. Connect to a recognizable ${cityName} anchor.

## For buyers (250 words)
Price ranges, property types, what the money buys vs adjacent streets. What to look for and avoid. Comparable streets nearby.

## For investors (250 words)
Rental yield expectations, tenant demographics, vacancy patterns, appreciation history, capex realities. Exit liquidity. Comparable streets.

## For sellers (200 words)
Listing strategy. Buyer profile. Pricing positioning. Staging. Timing. What to fix before listing.

## For renters (200 words)
Rental types, monthly rent ranges, utilities, lease patterns, daily life, amenities within walking distance.

## The honest take (100 words)
What this street IS and ISN'T. The tradeoff. End with an unexpected observation, not a CTA.

HARD RULES:
- 1,200 to 1,400 words total (humanization may add up to 100, hard cap 1,500)
- Use the exact section headings above (markdown ##)
- Include actual dollar figures and day numbers
- Reference 3+ ${cityName} anchors from: Milton GO station, Highway 401, Craig Kielburger, Bishop Reding, Tiger Jeet Singh PS, Sam Sherratt PS, Kelso Conservation Area, Bruce Trail, Milton District Hospital, James Snow Parkway, Derry Road, Main Street, Old Milton, Hawthorne Village, Willmott, Beaty, Dempsey, Coates, Clarke
- Name 2+ nearby ${cityName} streets for comparison
- Make 2+ opinionated claims AI would normally hedge on
- NEVER include MLS neighbourhood codes like "1044 - TR Rural Trafalgar" — use clean naming like "Rural Trafalgar"

VOICE:
- VARY SENTENCE LENGTH AGGRESSIVELY. Mix 4-word sentences with 30-word sentences.
- Use first-person: "I've sold," "in my experience," "what I tell my clients"
- NEVER use: furthermore, moreover, additionally, in conclusion, it's worth noting, importantly, ultimately, that said, on the other hand, in essence, nestled, charming, vibrant, sophisticated, prestigious, hidden gem, perfect blend, pride of ownership
- Use sentence fragments occasionally.
- End paragraphs mid-thought sometimes.
- Use em-dashes, brief parentheticals.
- Don't end with summary closer.

Write the guide only. No preamble. Start with the first section heading.`;
}

const HUMANIZATION_PROMPT_V2 = `Rewrite this draft to sound like a working realtor wrote it themselves. Keep ALL facts, all section headings (##), all structure exactly the same. But:
- Vary sentence length aggressively (mix 3-word sentences with 25-word sentences)
- Add 3-4 first-person realtor anecdotes
- Strip remaining AI-tell phrases
- Add 2-3 opinions with stakes
- Add 1-2 sentence fragments
- Add 1-2 conversational asides (em-dashes, parentheticals)
- One paragraph ends mid-thought
- HARD WORD CAP: final output must be 1,200-1,400 words. If anecdotes push over 1,400, trim factual restatements or transitional sentences to compensate. Do NOT exceed 1,500 words under any circumstance.
- NEVER include MLS neighbourhood codes like "1044 - TR Rural Trafalgar"

Output the rewritten guide only.`;

const POLISH_PROMPT_V2 = `Where does this still sound AI-generated? Surgical fixes only. If word count exceeds 1,500, trim to 1,400 — preserving anecdotes and opinion lines, cutting redundant restatement sentences. Don't restructure. Keep all section headings. Output the polished guide only.`;

function formatPriceForPrompt(price: number): string {
  if (price >= 1000000) return `$${(price / 1000000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (price >= 1000) return `$${Math.round(price / 1000)}K`;
  return `$${price.toLocaleString()}`;
}

function buildUserPromptV2(stats: SafeStreetStats, previousFailure?: string, cityName: string = "Milton", cityProvince: string = "Ontario"): string {
  let prompt = "";
  if (previousFailure) {
    prompt += `Previous attempt failed: ${previousFailure}\n\nFix those issues. Keep 1,200-1,400 words and all 6 section headings.\n\n`;
  }
  prompt += `Write the comprehensive street guide for ${stats.streetName} in ${cityName}, ${cityProvince}.

REAL MARKET DATA:
- Street: ${stats.streetName}, ${stats.neighbourhood} neighbourhood
- Average list price: ${formatPriceForPrompt(stats.avgListPrice)}
- Closed home sales on record: ${stats.totalSold12mo}
- Average days on market: ${stats.avgDOM} days
- Active listings right now: ${stats.activeCount}
- Primary property type: ${stats.dominantPropertyType}
- School zone: ${stats.schoolZone || `${cityName} public schools`}
- Price trend: Prices have ${stats.priceDirection}
- Most active month recently: ${stats.bestMonth}`;
  return prompt;
}

export interface LongFormGenerationResult {
  text: string;
  passed: boolean;
  validationFailures: string[];
  metrics: ValidationResultV2["metrics"];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  passes: Array<{
    pass: number;
    label: string;
    wordCount: number;
    validatorPassed: boolean;
    failures: string[];
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }>;
  provider: "deepseek_v2";
  trimResult: TrimResult | null;
}

/**
 * UPG-4 Stage 2 Piece 1: Programmatic post-trim function
 *
 * DEF-15 root cause: prompt-only word caps don't bind on DeepSeek (verified
 * 2026-05-04 — humanization pass inflated 1,431w → 1,843w despite explicit
 * "HARD WORD CAP" instructions in both humanization AND polish prompts).
 *
 * Solution: deterministic post-trim. Splits text into sections by ## heading,
 * classifies each sentence, removes lowest-priority sentences from largest
 * sections until under cap. Anecdotes, opinions, data points, and section
 * headings are NEVER removed. Only transitional/restatement sentences.
 *
 * Returns trimmed text + metrics. If text is already under cap, returns
 * unchanged with removedSentences = 0.
 */

const KEEP_ALWAYS_PATTERNS = [
  // First-person markers (anecdotes, realtor voice)
  /\bI[' ]ve\s/i, /\bmy clients\b/i, /\bin my experience\b/i,
  /\bI had\s/i, /\bI tell\b/i, /\bI[' ]d\b/i,
  /\bI[' ]ll\s/i, /\bI[' ]m\s/i, /\bI think\b/i,
  /\bI know\b/i, /\bI saw\b/i, /\bI sold\b/i,
  /\bI leased\b/i, /\bI showed\b/i, /\bI listed\b/i,
  /\bone (guy|client|tenant|seller|buyer)\b/i,
  // Specific data points (dollar figures, day counts)
  /\$\d/i, /\b\d+\s*(days?|months?|years?)\b/i,
  /\b\d+(\.\d+)?[KkMm]\b/, // shorthand like 1.5M, 800K
  /\b\d+%/, // percentages
  // Opinion verbs (operator stance)
  /\bthe truth is\b/i, /\bhonestly\b/i, /\bI[' ]d argue\b/i,
  /\bin my view\b/i, /\bmy take\b/i, /\bmy advice\b/i,
];

const TRIM_FIRST_PATTERNS = [
  // Generic transitional openers
  /^(?:Beyond that|On top of that|What this means is|That said|All in all)\b/i,
  /^(?:In essence|Essentially|Basically|Overall|In summary|To sum up)\b/i,
  // Self-summarizing restatements
  /^(?:This (?:is|means|reflects)|These (?:are|represent))\b/i,
  // Hedge openers that add nothing
  /^(?:It[' ]s worth (?:noting|mentioning)|Worth noting)\b/i,
  /^(?:It should be noted|It[' ]s important to)\b/i,
];

export interface TrimResult {
  text: string;
  removedSentences: number;
  finalWordCount: number;
  initialWordCount: number;
  sectionsTouched: string[];
}

export function trimToWordCap(text: string, targetWordCount: number = 1400): TrimResult {
  const initialWordCount = text.split(/\s+/).filter(Boolean).length;

  if (initialWordCount <= targetWordCount) {
    return {
      text,
      removedSentences: 0,
      finalWordCount: initialWordCount,
      initialWordCount,
      sectionsTouched: [],
    };
  }

  // Split into sections by ## heading. Keep the heading attached to its body.
  // First section may not have a heading (intro paragraph before first ##).
  const lines = text.split("\n");
  const sections: Array<{ heading: string | null; bodyLines: string[] }> = [];
  let current: { heading: string | null; bodyLines: string[] } = { heading: null, bodyLines: [] };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (current.heading !== null || current.bodyLines.length > 0) {
        sections.push(current);
      }
      current = { heading: line, bodyLines: [] };
    } else {
      current.bodyLines.push(line);
    }
  }
  sections.push(current);

  // For each section, classify each sentence and build a removable-sentence pool.
  type Removable = {
    sectionIdx: number;
    bodyLineIdx: number;
    sentenceIdxInLine: number;
    sentenceText: string;
    sentenceWordCount: number;
    priority: number; // lower = trim first
  };

  const removables: Removable[] = [];

  function classifySentence(s: string): { keepAlways: boolean; trimFirst: boolean; priority: number } {
    const trimmed = s.trim();
    if (!trimmed) return { keepAlways: false, trimFirst: false, priority: 99 };

    const keepAlways = KEEP_ALWAYS_PATTERNS.some((p) => p.test(trimmed));
    if (keepAlways) return { keepAlways: true, trimFirst: false, priority: 99 };

    const trimFirst = TRIM_FIRST_PATTERNS.some((p) => p.test(trimmed));
    if (trimFirst) return { keepAlways: false, trimFirst: true, priority: 1 };

    // Default: trimmable but lower priority than explicit TRIM_FIRST patterns
    return { keepAlways: false, trimFirst: false, priority: 5 };
  }

  for (let sIdx = 0; sIdx < sections.length; sIdx++) {
    for (let lIdx = 0; lIdx < sections[sIdx].bodyLines.length; lIdx++) {
      const line = sections[sIdx].bodyLines[lIdx];
      // Split the line into sentences
      const sentences = line.match(/[^.!?]+[.!?]+/g) || (line.trim() ? [line] : []);
      for (let sentIdx = 0; sentIdx < sentences.length; sentIdx++) {
        const sentence = sentences[sentIdx];
        const cls = classifySentence(sentence);
        if (cls.keepAlways) continue;
        const wordCount = sentence.split(/\s+/).filter(Boolean).length;
        if (wordCount < 4) continue; // too short to be worth removing
        removables.push({
          sectionIdx: sIdx,
          bodyLineIdx: lIdx,
          sentenceIdxInLine: sentIdx,
          sentenceText: sentence,
          sentenceWordCount: wordCount,
          priority: cls.priority,
        });
      }
    }
  }

  // Sort: lowest priority first (most trimmable), then largest word count first
  // (cuts more per removal, fewer iterations needed)
  removables.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.sentenceWordCount - a.sentenceWordCount;
  });

  // Greedy removal: take the next removable until we're under the cap
  const removedKeys = new Set<string>();
  const sectionsTouched = new Set<string>();
  let currentWordCount = initialWordCount;

  for (const r of removables) {
    if (currentWordCount <= targetWordCount) break;
    const key = `${r.sectionIdx}:${r.bodyLineIdx}:${r.sentenceIdxInLine}`;
    removedKeys.add(key);
    currentWordCount -= r.sentenceWordCount;
    if (sections[r.sectionIdx].heading) {
      sectionsTouched.add(sections[r.sectionIdx].heading || "(intro)");
    } else {
      sectionsTouched.add("(intro)");
    }
  }

  // Reassemble with removed sentences stripped out
  const newSections: string[] = [];
  for (let sIdx = 0; sIdx < sections.length; sIdx++) {
    const section = sections[sIdx];
    const newBodyLines: string[] = [];
    for (let lIdx = 0; lIdx < section.bodyLines.length; lIdx++) {
      const line = section.bodyLines[lIdx];
      const sentences = line.match(/[^.!?]+[.!?]+/g) || (line.trim() ? [line] : []);
      if (sentences.length === 0) {
        newBodyLines.push(line);
        continue;
      }
      const keptSentences: string[] = [];
      for (let sentIdx = 0; sentIdx < sentences.length; sentIdx++) {
        const key = `${sIdx}:${lIdx}:${sentIdx}`;
        if (!removedKeys.has(key)) keptSentences.push(sentences[sentIdx]);
      }
      newBodyLines.push(keptSentences.join("").trim());
    }
    const sectionText = (section.heading ? section.heading + "\n" : "") + newBodyLines.join("\n");
    newSections.push(sectionText);
  }

  const newText = newSections.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const finalWordCount = newText.split(/\s+/).filter(Boolean).length;

  return {
    text: newText,
    removedSentences: removedKeys.size,
    finalWordCount,
    initialWordCount,
    sectionsTouched: Array.from(sectionsTouched),
  };
}


 /**
 * DeepSeek 7-pass chain. Architecture proven 2026-05-04 — produces content that
 * ZeroGPT classifies as human-written (16.4% AI on Trafalgar Rd W test).
 *
 * Pass chain: 5 quality + 1 humanization + 1 polish.
 * Cost: ~$0.018/page (vs $1.20 Claude single-pass = 66x cheaper).
 *
 * Returns the polished output (Pass 7) along with the full per-pass metrics for
 * audit. The caller is responsible for writing the result to StreetContent and
 * updating StreetQueue.status.
 */
export async function generateLongFormStreetDescription(
  stats: SafeStreetStats,
  options: {
    cityName?: string;
    cityProvince?: string;
    maxPasses?: number;
  } = {}
): Promise<LongFormGenerationResult> {
  const cityName = options.cityName ?? "Milton";
  const cityProvince = options.cityProvince ?? "Ontario";
  const maxPasses = options.maxPasses ?? 7;
  const HUMANIZATION_PASS = maxPasses - 1;

  // Compliance check on the user prompt up front (before we burn any DeepSeek tokens)
  const systemPromptV2 = buildSystemPromptV2(stats.streetName, cityName, cityProvince);
  const initialUserPrompt = buildUserPromptV2(stats, undefined, cityName, cityProvince);
  const safety = validatePromptSafety(initialUserPrompt);
  if (!safety.safe) {
    console.error(`[AI Compliance v2] Blocked unsafe prompt: ${safety.reason}`);
    throw new Error(`AI compliance violation: ${safety.reason}`);
  }

  const passes: LongFormGenerationResult["passes"] = [];
  let lastFailures: string[] = [];
  let lastText = "";

  for (let pass = 1; pass <= maxPasses; pass++) {
    let passLabel: string;
    let systemPrompt: string;
    let userPrompt: string;

    if (pass <= HUMANIZATION_PASS - 1) {
      // Quality passes 1..N (N = HUMANIZATION_PASS - 1, i.e. passes 1..5 when maxPasses=7)
      passLabel = pass === 1 ? "fresh-generation" : `quality-revision-${pass - 1}`;
      systemPrompt = systemPromptV2;
      const failureReason = lastFailures.length > 0 ? lastFailures.join("; ") : undefined;
      userPrompt = buildUserPromptV2(stats, failureReason, cityName, cityProvince);
    } else if (pass === HUMANIZATION_PASS) {
      passLabel = "humanization";
      systemPrompt = "You are a senior real estate copywriter specializing in making content sound human. Preserve all facts and structure exactly while rewriting voice.";
      userPrompt = `${HUMANIZATION_PROMPT_V2}\n\n--- DRAFT ---\n\n${lastText}`;
    } else {
      passLabel = "polish";
      systemPrompt = "You are an editor making surgical fixes. Minimum changes, maximum impact.";
      userPrompt = `${POLISH_PROMPT_V2}\n\n--- DRAFT ---\n\n${lastText}`;
    }

    const response = await callDeepSeek({ systemPrompt, userPrompt });
    const validation = validateLongFormContent(response.text, stats.streetName);

    passes.push({
      pass,
      label: passLabel,
      wordCount: validation.metrics.wordCount,
      validatorPassed: validation.passed,
      failures: validation.failures,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      costUsd: response.costUsd,
    });

    console.log(
      `[AI Compliance v2] ${stats.streetName} pass ${pass} (${passLabel}): ` +
      `${validation.metrics.wordCount}w | stddev ${validation.metrics.sentenceLengthStdDev.toFixed(1)} | ` +
      `1stP ${validation.metrics.firstPersonHits} | anc ${validation.metrics.anchorsFound.length} | ` +
      `sec ${validation.metrics.sectionsFound.length}/6 | ` +
      `${validation.passed ? "PASS" : `FAIL(${validation.failures.length})`} | ` +
      `$${response.costUsd.toFixed(5)}`
    );

    lastFailures = validation.failures;
    lastText = response.text;
  }

  // UPG-4 Stage 2 Piece 1: Programmatic post-trim if word count exceeds cap.
  // DEF-15 fix — prompt-only enforcement doesn't bind on DeepSeek, so we trim
  // deterministically. Anecdotes, opinions, data points are preserved by the
  // trimToWordCap heuristics; only transitional/restatement sentences cut.
  // Target 1,300 (not 1,400) accounts for ~100w reassembly drift from
  // paragraph spacing not counted in the loop's running total — empirically
  // calibrated against the 1,847w → 1,541w test run on Trafalgar Rd W.
  let trimResult: TrimResult | null = null;
  const HARD_WORD_CAP = 1500;
  const TARGET_WORD_COUNT = 1300;
  const lastWordCount = lastText.split(/\s+/).filter(Boolean).length;
  if (lastWordCount > HARD_WORD_CAP) {
    trimResult = trimToWordCap(lastText, TARGET_WORD_COUNT);
    lastText = trimResult.text;
    console.log(
      `[AI Compliance v2] ${stats.streetName} post-trim: ` +
      `${trimResult.initialWordCount}w → ${trimResult.finalWordCount}w | ` +
      `removed ${trimResult.removedSentences} sentences from ${trimResult.sectionsTouched.length} section(s)`
    );
  }

  // Final result is always the last pass (polish output, possibly trimmed)
  const finalValidation = validateLongFormContent(lastText, stats.streetName);
  const totalInputTokens = passes.reduce((sum, p) => sum + p.inputTokens, 0);
  const totalOutputTokens = passes.reduce((sum, p) => sum + p.outputTokens, 0);
  const totalCostUsd = passes.reduce((sum, p) => sum + p.costUsd, 0);

  console.log(
    `[AI Compliance v2] ${stats.streetName} final: ` +
    `${finalValidation.metrics.wordCount}w | ${finalValidation.passed ? "PASS" : `FAIL(${finalValidation.failures.length})`} | ` +
    `total cost $${totalCostUsd.toFixed(5)} (${totalInputTokens}in/${totalOutputTokens}out)` +
    (trimResult ? ` | trimmed -${trimResult.removedSentences}s` : "")
  );

  return {
    text: lastText,
    passed: finalValidation.passed,
    validationFailures: finalValidation.failures,
    metrics: finalValidation.metrics,
    totalInputTokens,
    totalOutputTokens,
    totalCostUsd,
    passes,
    provider: "deepseek_v2",
    trimResult,
  };
}

// --- Phase 4.1 system prompt (lazy-loaded once per warm container) ---

let phase41SystemPromptCache: string | null = null;

function loadPhase41SystemPrompt(): string {
  if (phase41SystemPromptCache !== null) return phase41SystemPromptCache;
  const specPath = path.join(process.cwd(), 'docs', 'phase-4.1', '01-system-prompt.md');
  try {
    phase41SystemPromptCache = fs.readFileSync(specPath, 'utf8');
  } catch (e) {
    throw new Error(
      `Failed to load Phase 4.1 system prompt at ${specPath}: ${(e as Error).message}`,
    );
  }
  return phase41SystemPromptCache;
}

// --- Phase 4.1 generator (DEC-PH41-CANONICAL) ---

interface Phase41Attempt {
  attemptN: number;
  violations: ValidatorViolation[];
  tokens: { in: number; out: number };
  costUsd: number;
}

export interface Phase41GenerationResult {
  output: StreetGeneratorOutput;
  attemptCount: number;
  validatorPassed: boolean;
  finalViolations: ValidatorViolation[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  attempts: Phase41Attempt[];
}

export interface Phase41GenerationErrorPayload {
  violations: ValidatorViolation[];
  attemptCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  attempts: Phase41Attempt[];
}

export class Phase41GenerationError extends Error {
  public readonly payload: Phase41GenerationErrorPayload;

  constructor(message: string, payload: Phase41GenerationErrorPayload) {
    super(message);
    this.name = 'Phase41GenerationError';
    this.payload = payload;
  }
}

/**
 * Generate Phase 4.1-aligned street content via DeepSeek + validator retry loop.
 *
 * Architecture:
 *  - System prompt: docs/phase-4.1/01-system-prompt.md (verbatim, lazy-cached)
 *  - User message: JSON.stringify(input) + (on retry) formatViolationsForRetry feedback
 *  - DeepSeek call: callDeepSeek with response_format: json_object, maxTokens 5000
 *  - Validation: validateStreetGeneration() inside generateWithRetry()
 *  - Retry: up to 3 attempts (managed by generateWithRetry)
 *
 * Known limitations (v1):
 *  - Per-attempt `violations` arrays in the returned `attempts[]` are populated only for
 *    the FINAL attempt. Earlier attempts retain empty `violations: []` because
 *    generateWithRetry() does not expose per-attempt violation lists. Tracked for
 *    follow-up if smoke testing surfaces a need for richer telemetry.
 */
export async function generatePhase41StreetContent(
  input: StreetGeneratorInput,
): Promise<Phase41GenerationResult> {
  const systemPrompt = loadPhase41SystemPrompt();

  const attempts: Phase41Attempt[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCostUsd = 0;
  let attemptCounter = 0;

  const callModel = async (
    inp: StreetGeneratorInput,
    priorViolations?: ValidatorViolation[],
    priorOutput?: StreetGeneratorOutput,
  ): Promise<StreetGeneratorOutput> => {
    attemptCounter += 1;

    let userPrompt = JSON.stringify(inp, null, 2);
    if (priorViolations && priorViolations.length > 0 && priorOutput) {
      const retryFeedback = formatViolationsForRetryEnriched(priorViolations, priorOutput, inp);
      userPrompt += '\n\n---\n' + retryFeedback;
      console.log(
        `[Phase41] ${inp.street.slug} retry-feedback for attempt ${attemptCounter} ` +
        `(${retryFeedback.length} chars):\n--- BEGIN RETRY FEEDBACK ---\n${retryFeedback}\n--- END RETRY FEEDBACK ---`
      );
    } else if (priorViolations && priorViolations.length > 0) {
      // Fallback to generic format when prior output isn't available (rare —
      // mostly for the first attempt-2 case if the generator helper changes).
      const legacyFeedback = formatViolationsForRetry(priorViolations);
      userPrompt += '\n\n---\nYour previous attempt failed validation. Fix these specific issues and return clean JSON:\n\n' + legacyFeedback;
      console.log(
        `[Phase41] ${inp.street.slug} retry-feedback (legacy format) for attempt ${attemptCounter} ` +
        `(${legacyFeedback.length} chars):\n--- BEGIN RETRY FEEDBACK ---\n${legacyFeedback}\n--- END RETRY FEEDBACK ---`
      );
    }

    const response = await callDeepSeek({
      systemPrompt,
      userPrompt,
      responseFormat: { type: 'json_object' },
      maxTokens: 5000,
    });

    totalInputTokens += response.inputTokens;
    totalOutputTokens += response.outputTokens;
    totalCostUsd += response.costUsd;

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.text);
    } catch (e) {
      attempts.push({
        attemptN: attemptCounter,
        violations: [
          {
            rule: 'invalid_json_shape',
            excerpt: response.text.slice(0, 80),
            severity: 'hard',
          },
        ],
        tokens: { in: response.inputTokens, out: response.outputTokens },
        costUsd: response.costUsd,
      });
      throw new Error(`Phase41 JSON parse failure: ${(e as Error).message}`);
    }

    const candidate = parsed as Partial<StreetGeneratorOutput>;
    if (
      !candidate ||
      !Array.isArray(candidate.sections) ||
      !Array.isArray(candidate.faq)
    ) {
      attempts.push({
        attemptN: attemptCounter,
        violations: [
          {
            rule: 'invalid_json_shape',
            excerpt: JSON.stringify(parsed).slice(0, 80),
            severity: 'hard',
          },
        ],
        tokens: { in: response.inputTokens, out: response.outputTokens },
        costUsd: response.costUsd,
      });
      throw new Error('Phase41 output failed runtime shape narrowing');
    }

    // Run the validator now so per-attempt violations are recorded as they
    // happen. generateWithRetry will run the validator again to make its
    // retry/exit decision; the second call is pure and cheap (regex scans
    // over already-parsed text), and re-running it avoids the bug where the
    // throw path left attempts[*].violations as the empty placeholder.
    const candidateOutput = candidate as StreetGeneratorOutput;
    const attemptViolations = validateStreetGeneration(candidateOutput, inp);
    attempts.push({
      attemptN: attemptCounter,
      violations: attemptViolations,
      tokens: { in: response.inputTokens, out: response.outputTokens },
      costUsd: response.costUsd,
    });

    const ruleSummary = attemptViolations.length === 0
      ? "clean"
      : attemptViolations.map(v => v.sectionId ? `${v.rule}@${v.sectionId}` : v.rule).join(", ");
    console.log(
      `[Phase41] ${inp.street.slug} attempt ${attemptCounter}: ` +
      `${attemptViolations.length} violation${attemptViolations.length === 1 ? "" : "s"} (${ruleSummary}) ` +
      `| tokens ${response.inputTokens}in/${response.outputTokens}out | $${response.costUsd.toFixed(5)}`
    );

    return candidateOutput;
  };

  let output: StreetGeneratorOutput;
  let attemptCount: number;
  let finalViolations: ValidatorViolation[];

  try {
    const result = await generateWithRetry(input, callModel);
    output = result.output;
    attemptCount = result.attemptCount;
    finalViolations = result.violations;
  } catch (err) {
    // generateWithRetry throws StreetGenerationFailure on retry exhaustion. The
    // class carries the slug + violations array. We rethrow a custom error
    // that surfaces violations + telemetry to the caller, so the caller can
    // write a review row and populate cost/token fields on the failed DB row.
    const violations: ValidatorViolation[] =
      err && typeof err === 'object' && 'violations' in err
        ? ((err as { violations: ValidatorViolation[] }).violations ?? [])
        : [];

    throw new Phase41GenerationError(
      `Phase41 generation failed after ${attemptCounter} attempts. ${violations.length} violations. Cause: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`,
      {
        violations,
        attemptCount: attemptCounter,
        totalInputTokens,
        totalOutputTokens,
        totalCostUsd,
        attempts,
      },
    );
  }

  return {
    output,
    attemptCount,
    validatorPassed: finalViolations.length === 0,
    finalViolations,
    totalInputTokens,
    totalOutputTokens,
    totalCostUsd,
    attempts,
  };
}
