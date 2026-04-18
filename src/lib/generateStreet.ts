// Street-content generation core. Extracted from
// src/app/api/sync/generate/route.ts so both the normal cron-driven route
// and the admin force-regenerate route share the exact same prompt,
// validator, compliance gateway, and DB write shape. All Claude calls go
// through src/lib/ai/compliance.ts — no other entry point exists.

import { prisma } from "@/lib/prisma";
import { getStreetStats } from "@/lib/streetDecision";
import { calcMarketDataHash } from "@/lib/streetUtils";
import { sendSMS } from "@/lib/smsAlert";
import {
  generateStreetDescription as aiGenerate,
  type SafeStreetStats,
} from "@/lib/ai/compliance";

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

const MILTON_ANCHORS = [
  "Milton GO", "Union Station", "Craig Kielburger",
  "Bishop Reding", "Milton District Hospital",
  "Tiger Jeet Singh", "Stuart E. Russell",
  "Sam Sherratt", "Escarpment", "Kelso Conservation",
  "Highway 401", "Willmott", "Coates", "Clarke", "Beaty",
  "Dempsey", "Old Milton", "Hawthorne", "Scott", "Harrison",
];

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
  if (!hasSchool) failures.push("Missing Milton school name");
  if (!hasTransit) failures.push("Missing GO station / Highway 401 / Union Station reference");

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 280) failures.push(`Too short: ${wordCount} words (min 280)`);
  if (wordCount > 360) failures.push(`Too long: ${wordCount} words (max 360)`);

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  for (const s of sentences) {
    const sw = s.trim().split(/\s+/).filter(Boolean).length;
    if (sw > 30) failures.push(`Sentence too long (${sw} words): "${s.trim().slice(0, 60)}..."`);
  }

  const foundAnchors = MILTON_ANCHORS.filter((a) => text.includes(a));
  if (foundAnchors.length < 2) failures.push(`Only ${foundAnchors.length} Milton anchors (need 2+). Found: ${foundAnchors.join(", ") || "none"}`);

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

  userPrompt += `Write a street description for ${streetName} in Milton, Ontario.

Real market data — use all of this naturally in the text:
- Street: ${streetName}, ${stats.neighbourhood} neighbourhood
- Average list price: ${formatPrice(stats.avgListPrice)}
- Homes sold in last 12 months: ${stats.totalSold12mo}
- Average days on market: ${stats.avgDOM} days
- Active listings right now: ${stats.activeCount}
- Primary property type: ${stats.dominantPropertyType}
- School zone: ${stats.schoolZone || "Milton public schools"}
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
      a: `The average list price on ${streetName} in Milton is ${formatPrice(stats.avgListPrice)}. Exact sold prices and sold-to-ask ratios for this street are available to registered users via the TREB MLS® sold-data section on the page.`,
    },
    {
      q: `How long do homes take to sell on ${streetName} Milton?`,
      a: `Active listings on ${streetName} in Milton have been on market an average of ${stats.avgDOM} days. ${stats.totalSold12mo} sold transactions recorded on this street in the last 12 months — exact days-on-market per transaction is available to registered users.`,
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

  const passed = description.length > 0;
  if (!passed) description = rawAiOutput;

  const metaTitle = `${streetName} Milton Real Estate | Homes, Prices & Market Data`;
  const metaDescription = `${stats.totalSold12mo} homes sold on ${streetName} in the last 12 months. Average list price ${formatPrice(stats.avgListPrice)}. ${stats.avgDOM} days on market. Milton's most detailed street guide.`;
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
        ? `\u2713 Published: ${streetName}\n${stats.totalSold12mo} sales \u00b7 ${formatPrice(stats.avgListPrice)} avg list\nmiltonly.com/streets/${streetSlug}`
        : `\u{1f4dd} Draft needs review: ${streetName}\n${stats.totalSold12mo} sales \u00b7 ${formatPrice(stats.avgListPrice)} avg list\nmiltonly.vercel.app/admin/review`
    );
  }

  return { streetName, passed, attempts };
}
