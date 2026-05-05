// Street-content generation core. Extracted from
// src/app/api/sync/generate/route.ts so both the normal cron-driven route
// and the admin force-regenerate route share the exact same prompt,
// validator, compliance gateway, and DB write shape. All Claude calls go
// through src/lib/ai/compliance.ts — no other entry point exists.

import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { getStreetStats } from "@/lib/streetDecision";
import { calcMarketDataHash } from "@/lib/streetUtils";
import { sendSMS } from "@/lib/smsAlert";
import {
  generateStreetDescription as aiGenerate,
  generateLongFormStreetDescription,
  type SafeStreetStats,
} from "@/lib/ai/compliance";

// UPG-4 Stage 2 Piece 2: Feature flag selects AI provider.
// AI_PROVIDER unset OR "anthropic" → legacy 300-word Anthropic path (default).
// AI_PROVIDER="deepseek_v2" → new 1,400-word DeepSeek 7-pass path.
// Flag is read at runtime so flipping in Vercel env takes effect on next request,
// no rebuild required.
const AI_PROVIDER_V2 = "deepseek_v2";
function isDeepSeekV2(): boolean {
  return (process.env.AI_PROVIDER || "").trim() === AI_PROVIDER_V2;
}

const BANNED_WORDS = [
  "nestled", "charming", "vibrant", "picturesque", "bustling",
  "sought-after", "stunning", "dream home", "perfect blend",
  "a stone's throw", "boasts", "in the heart of", "don't miss",
  "rare opportunity", "pride of ownership", "meticulously",
  "truly special", "ideal for families", "conveniently located",
  "this is the one", "look no further", "tranquil", "serene",
  "oasis", "turnkey", "hidden gem", "breathtaking", "sophisticated",
  "prestigious", "remarkable", "exceptional", "incredible", "amazing",
];

// Milton-specific anchor list used by the validator's "needs ≥2 known anchors"
// rule. Sources from config.ai.knownAnchors so a city fork can swap in
// destination-specific anchors. Note: SYSTEM_PROMPT below still embeds the
// historical Milton anchor list inline — full prompt extraction is deferred
// until the prompt is rewritten as a city-agnostic template.
const KNOWN_ANCHORS = config.ai.knownAnchors;

const SYSTEM_PROMPT = `You are a local Milton Ontario real estate expert writing for Miltonly.com. You have 10+ years of experience selling homes in Milton. You know every street personally.

Write a 3-paragraph street description (300-340 words total) that is specific, data-driven, and reads like a knowledgeable local expert wrote it — not a machine.

BANNED WORDS — never use any of these:
nestled, charming, vibrant, picturesque, bustling, sought-after, stunning, dream home, perfect blend, a stone's throw, boasts, in the heart of, don't miss, rare opportunity, pride of ownership, meticulously, truly special, ideal for families, conveniently located, this is the one, look no further, tranquil, serene, oasis, turnkey, hidden gem, breathtaking, sophisticated, prestigious, remarkable, exceptional, incredible, amazing

HARD RULES:
1. No sentence longer than 25 words
2. No passive voice
3. Must include the actual dollar figure (e.g. $1.24M)
4. Must include the actual days on market as a number
5. Must name at least one real Milton school
6. Must reference Milton GO station or Highway 401 by name
7. Must not start with the street name
8. Must not start with "Located" or "Situated"
9. Write in second or third person — never first person
10. Must include at least 2 Milton-specific anchors from: Milton GO station, Union Station, Craig Kielburger, Bishop Reding, Milton District Hospital, Tiger Jeet Singh PS, Stuart E. Russell PS, Sam Sherratt PS, Escarpment, Kelso Conservation Area, Highway 401, Willmott, Coates, Clarke, Beaty, Dempsey, Old Milton, Hawthorne, Scott, Harrison

STRUCTURE:
Paragraph 1 (~100 words): Life on this street. Location in Milton, nearest schools and parks, GO train access, neighbourhood character. Be specific. Name real Milton places.

Paragraph 2 (~120 words): The real estate market. Property types found here, price range, how fast homes sell, who typically buys here. Use real numbers. Write the dollar figure and days on market naturally inside a sentence — never as a bullet point.

Paragraph 3 (~100 words): Buyer perspective. Why people specifically choose this street, price trend context, commute story (GO or 401), what makes this street different from adjacent ones. End with a specific insight — not a call to action.

Total: 300-340 words.
Write the description only. No preamble. No explanation.`;

export function formatPrice(price: number): string {
  if (price >= 1000000) return `$${(price / 1000000).toFixed(2).replace(/\.?0+$/, "")}M`;
  if (price >= 1000) return `$${Math.round(price / 1000)}K`;
  return `$${price.toLocaleString()}`;
}

interface ValidationResult {
  passed: boolean;
  failures: string[];
}

function validateContent(text: string, streetName: string): ValidationResult {
  const failures: string[] = [];
  const lower = text.toLowerCase();

  const foundBanned = BANNED_WORDS.filter((w) => lower.includes(w.toLowerCase()));
  if (foundBanned.length > 0) failures.push(`Banned words found: ${foundBanned.join(", ")}`);

  if (!/\$[\d,\.]+[MKB]?/i.test(text)) failures.push("Missing dollar figure");
  if (!/\d+\s*days?/i.test(text)) failures.push("Missing days on market number");

  const schools = ["Craig Kielburger", "Bishop Reding", "Tiger Jeet Singh", "Stuart E. Russell", "Sam Sherratt"];
  const hasSchool = schools.some((s) => text.includes(s));
  const hasTransit = /\bGO\b/.test(text) || text.includes("401") || text.includes("Union Station");
  if (!hasSchool) failures.push(`Missing ${config.CITY_NAME} school name`);
  if (!hasTransit) failures.push("Missing GO station / Highway 401 / Union Station reference");

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 280) failures.push(`Too short: ${wordCount} words (min 280)`);
  if (wordCount > 360) failures.push(`Too long: ${wordCount} words (max 360)`);

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  for (const s of sentences) {
    const sw = s.trim().split(/\s+/).filter(Boolean).length;
    if (sw > 30) failures.push(`Sentence too long (${sw} words): "${s.trim().slice(0, 60)}..."`);
  }

  const foundAnchors = KNOWN_ANCHORS.filter((a) => text.includes(a));
  if (foundAnchors.length < 2) failures.push(`Only ${foundAnchors.length} ${config.CITY_NAME} anchors (need 2+). Found: ${foundAnchors.join(", ") || "none"}`);

  const first30 = text.slice(0, 30).toLowerCase();
  if (first30.includes(streetName.toLowerCase())) failures.push("Starts with the street name");

  const trimmed = text.trimStart();
  if (/^(located|situated)/i.test(trimmed)) failures.push("Starts with 'Located' or 'Situated'");

  return { passed: failures.length === 0, failures };
}

async function generateDescription(
  streetName: string,
  stats: NonNullable<Awaited<ReturnType<typeof getStreetStats>>>,
  previousFailure?: string
): Promise<string> {
  const bestMonth = stats.monthlyTrend.length > 0
    ? stats.monthlyTrend.reduce((a, b) => (b.salesCount > a.salesCount ? b : a)).month
    : "N/A";

  let userPrompt = "";
  if (previousFailure) {
    userPrompt += `Your previous attempt failed because: ${previousFailure}\nFix only that issue. Keep everything else the same.\n\n`;
  }

  userPrompt += `Write a street description for ${streetName} in ${config.CITY_NAME}, ${config.CITY_PROVINCE}.

Real market data — use all of this naturally in the text:
- Street: ${streetName}, ${stats.neighbourhood} neighbourhood
- Average list price: ${formatPrice(stats.avgListPrice)}
- Closed home sales on record: ${stats.totalSold12mo}
- Average days on market: ${stats.avgDOM} days
- Active listings right now: ${stats.activeCount}
- Primary property type: ${stats.dominantPropertyType}
- School zone: ${stats.schoolZone || `${config.CITY_NAME} public schools`}
- Price trend: Prices have ${stats.priceDirection}
- Most active month recently: ${bestMonth}`;

  const safeStats: SafeStreetStats = {
    streetName,
    neighbourhood: stats.neighbourhood,
    avgListPrice: stats.avgListPrice,
    medianListPrice: stats.medianListPrice,
    totalSold12mo: stats.totalSold12mo,
    avgDOM: stats.avgDOM,
    activeCount: stats.activeCount,
    dominantPropertyType: stats.dominantPropertyType,
    priceDirection: stats.priceDirection,
    schoolZone: stats.schoolZone,
    bestMonth,
  };

  // UPG-4 Stage 2 Piece 2: Feature-flag-gated provider selection.
  if (isDeepSeekV2()) {
    const deepSeekResult = await generateLongFormStreetDescription(safeStats, {
      cityName: config.CITY_NAME,
      cityProvince: config.CITY_PROVINCE,
    });
    // The DeepSeek function runs its own v2 validator internally and applies
    // post-trim. We trust its output; the legacy validateContent() in this
    // module will be bypassed by generateStreetContent() when the flag is set.
    return deepSeekResult.text;
  }

  const result = await aiGenerate(SYSTEM_PROMPT, userPrompt, safeStats);
  return result.text;
}

function buildFaqJson(
  streetName: string,
  stats: NonNullable<Awaited<ReturnType<typeof getStreetStats>>>
): string {
  return JSON.stringify([
    {
      q: `What is the average home price on ${streetName} in Milton?`,
      a: `The average list price on ${streetName} in Milton is ${formatPrice(stats.avgListPrice)}. Register for full MLS® access to see detailed market data for this street, including historical transaction records.`,
    },
    {
      q: `How long do homes take to sell on ${streetName} Milton?`,
      a: `Active listings on ${streetName} in Milton have been on market an average of ${stats.avgDOM} days. ${stats.totalSold12mo} sold transactions on record for this street — exact days-on-market per transaction is available to registered users.`,
    },
    {
      q: `What types of homes are on ${streetName} in Milton?`,
      a: `The most common property type on ${streetName} is ${stats.dominantPropertyType}. The street is in the ${stats.neighbourhood} neighbourhood of Milton, Ontario.`,
    },
    {
      q: `What school zone is ${streetName} Milton in?`,
      a: `${streetName} in Milton falls within the ${stats.schoolZone || "Milton public"} school catchment area.`,
    },
    {
      q: `How far is ${streetName} Milton from the GO station?`,
      a: `${streetName} is located in Milton's ${stats.neighbourhood} neighbourhood. Milton GO station provides direct service to Union Station in downtown Toronto. Drive times to Highway 401 vary by exact location on the street.`,
    },
  ]);
}

export interface GenerateResult {
  streetName: string;
  passed: boolean;
  attempts: number;
}

export interface GenerateOptions {
  // Suppress the per-street SMS. Used for bulk force-regenerate to avoid
  // texting the owner 45+ times in a row.
  skipSms?: boolean;
}

/**
 * Full pipeline: stats → AI (up to 3 attempts with feedback retry) →
 * validator → upsert StreetContent row. Does NOT touch StreetQueue — that
 * housekeeping is the caller's responsibility because it differs between
 * normal cron runs and one-off force regenerations.
 */
export async function generateStreetContent(
  streetSlug: string,
  streetName: string,
  opts: GenerateOptions = {}
): Promise<GenerateResult> {
  const stats = await getStreetStats(streetSlug);
  if (!stats) throw new Error("No stats available");

  const marketDataHash = calcMarketDataHash(stats);
  let description = "";
  let rawAiOutput = "";
  let attempts = 0;
  let lastFailures: string[] = [];

  // UPG-4 Stage 2 Piece 2: When AI_PROVIDER=deepseek_v2 is set, the new
  // generateLongFormStreetDescription() function runs its own v2 validator
  // internally (1,200-1,500 words, 6 section headings, sentence rhythm, etc.)
  // and applies a programmatic post-trim. The legacy validateContent() in this
  // module would fail it on every attempt because it requires 280-360 words.
  // Single-pass when DeepSeek mode — the multi-pass retry already happens
  // inside the DeepSeek function across its 7 internal passes.
  if (isDeepSeekV2()) {
    rawAiOutput = await generateDescription(streetName, stats);
    description = rawAiOutput;
    attempts = 1;
  } else {
    for (attempts = 1; attempts <= 3; attempts++) {
      const failureReason = lastFailures.length > 0 ? lastFailures.join("; ") : undefined;
      rawAiOutput = await generateDescription(streetName, stats, failureReason);
      const validation = validateContent(rawAiOutput, streetName);

      if (validation.passed) {
        description = rawAiOutput;
        break;
      }

      lastFailures = validation.failures;
      console.log(`${streetName} attempt ${attempts} failed:`, validation.failures);
    }
  }

  const passed = description.length > 0;
  if (!passed) description = rawAiOutput;

  const metaTitle = `${streetName} ${config.CITY_NAME} Real Estate | Homes, Prices & Market Data`;
  const metaDescription = `${stats.totalSold12mo} homes sold on ${streetName} recently. Average list price ${formatPrice(stats.avgListPrice)}. ${stats.avgDOM} days on market. ${config.CITY_NAME}'s most detailed street guide.`;
  const faqJson = buildFaqJson(streetName, stats);

  const contentStatus = passed ? "published" : "draft";

  await prisma.streetContent.upsert({
    where: { streetSlug },
    create: {
      streetSlug,
      streetName,
      neighbourhood: stats.neighbourhood,
      description,
      rawAiOutput,
      metaTitle,
      metaDescription,
      faqJson,
      statsJson: JSON.stringify(stats),
      marketDataHash,
      status: contentStatus,
      needsReview: !passed,
      aiGenerated: true,
      publishedAt: passed ? new Date() : null,
      generatedAt: new Date(),
      attempts,
    },
    update: {
      description,
      rawAiOutput,
      neighbourhood: stats.neighbourhood,
      metaTitle,
      metaDescription,
      faqJson,
      statsJson: JSON.stringify(stats),
      marketDataHash,
      status: contentStatus,
      needsReview: !passed,
      publishedAt: passed ? new Date() : undefined,
      generatedAt: new Date(),
      attempts,
    },
  });

  if (!opts.skipSms) {
    await sendSMS(
      passed
        ? `\u2713 Published: ${streetName}\n${stats.totalSold12mo} sales \u00b7 ${formatPrice(stats.avgListPrice)} avg list\n${config.SITE_DOMAIN}/streets/${streetSlug}`
        : `\u{1f4dd} Draft needs review: ${streetName}\n${stats.totalSold12mo} sales \u00b7 ${formatPrice(stats.avgListPrice)} avg list\nmiltonly.vercel.app/admin/review`
    );
  }

  return { streetName, passed, attempts };
}

/**
 * Render-time fallback used by /streets/[slug]. Returns the stored
 * StreetContent description if one exists and is fresher than 30 days;
 * otherwise triggers the canonical generation pipeline, then returns the
 * newly written row. If generation fails (e.g. no DB3 stats yet for a
 * new street), returns a minimal placeholder — the cron will re-try
 * and populate a full description on the next pass.
 */
export async function getOrGenerateStreetContent(
  slug: string,
  data: { streetName: string }
): Promise<{ description: string; needsReview: boolean }> {
  const existing = await prisma.streetContent.findUnique({ where: { streetSlug: slug } });
  if (existing) {
    const daysSince = (Date.now() - existing.generatedAt.getTime()) / 86400000;
    if (daysSince < 30) {
      return { description: existing.description, needsReview: existing.needsReview };
    }
  }

  try {
    await generateStreetContent(slug, data.streetName, { skipSms: true });
    const after = await prisma.streetContent.findUnique({ where: { streetSlug: slug } });
    if (after) return { description: after.description, needsReview: after.needsReview };
  } catch (e) {
    console.error(`[generateStreet] render-time fallback failed for ${slug}:`, e);
  }

  return {
    description:
      `${data.streetName} in ${config.CITY_NAME}, ${config.CITY_PROVINCE}. Full street data is being prepared — ` +
      `registered users will see detailed market intelligence here shortly.`,
    needsReview: true,
  };
}
