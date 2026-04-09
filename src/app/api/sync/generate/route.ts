import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeStreetDecision, getStreetStats } from "@/lib/streetDecision";
import { calcMarketDataHash } from "@/lib/streetUtils";
import { sendSMS } from "@/lib/smsAlert";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 300;

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

function formatPrice(price: number): string {
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

  // Rule 1: No banned words
  const foundBanned = BANNED_WORDS.filter((w) => lower.includes(w.toLowerCase()));
  if (foundBanned.length > 0) failures.push(`Banned words found: ${foundBanned.join(", ")}`);

  // Rule 2: Contains dollar figure and days on market
  if (!/\$[\d,\.]+[MKB]?/i.test(text)) failures.push("Missing dollar figure");
  if (!/\d+\s*days?/i.test(text)) failures.push("Missing days on market number");

  // Rule 3: Milton school name AND (GO or 401 or Union Station)
  const schools = ["Craig Kielburger", "Bishop Reding", "Tiger Jeet Singh", "Stuart E. Russell", "Sam Sherratt"];
  const hasSchool = schools.some((s) => text.includes(s));
  const hasTransit = /\bGO\b/.test(text) || text.includes("401") || text.includes("Union Station");
  if (!hasSchool) failures.push("Missing Milton school name");
  if (!hasTransit) failures.push("Missing GO station / Highway 401 / Union Station reference");

  // Rule 4: Word count 280-360
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 280) failures.push(`Too short: ${wordCount} words (min 280)`);
  if (wordCount > 360) failures.push(`Too long: ${wordCount} words (max 360)`);

  // Rule 5: No sentence exceeds 30 words
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  for (const s of sentences) {
    const sw = s.trim().split(/\s+/).filter(Boolean).length;
    if (sw > 30) failures.push(`Sentence too long (${sw} words): "${s.trim().slice(0, 60)}..."`);
  }

  // Rule 6: At least 2 Milton anchors
  const foundAnchors = MILTON_ANCHORS.filter((a) => text.includes(a));
  if (foundAnchors.length < 2) failures.push(`Only ${foundAnchors.length} Milton anchors (need 2+). Found: ${foundAnchors.join(", ") || "none"}`);

  // Rule 7: First 30 chars don't contain street name
  const first30 = text.slice(0, 30).toLowerCase();
  if (first30.includes(streetName.toLowerCase())) failures.push("Starts with the street name");

  // Rule 8: Doesn't begin with "Located" or "Situated"
  const trimmed = text.trimStart();
  if (/^(located|situated)/i.test(trimmed)) failures.push("Starts with 'Located' or 'Situated'");

  return { passed: failures.length === 0, failures };
}

async function generateDescription(
  streetName: string,
  stats: NonNullable<Awaited<ReturnType<typeof getStreetStats>>>,
  previousFailure?: string
): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
- Average sold price: ${formatPrice(stats.avgSoldPrice)}
- Median sold price: ${formatPrice(stats.medianSoldPrice)}
- Homes sold in last 12 months: ${stats.totalSold12mo}
- Average days on market: ${stats.avgDOM} days
- Sold vs asking price: ${stats.soldVsAskPct}%
- Active listings right now: ${stats.activeCount}
- Primary property type: ${stats.dominantPropertyType}
- School zone: ${stats.schoolZone || "Milton public schools"}
- Price trend: Prices have ${stats.priceDirection}
- Most active sales month recently: ${bestMonth}`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
    temperature: 0.7,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected response type");
  return block.text.trim();
}

function buildFaqJson(
  streetName: string,
  stats: NonNullable<Awaited<ReturnType<typeof getStreetStats>>>
): string {
  return JSON.stringify([
    {
      q: `What is the average home price on ${streetName} in Milton?`,
      a: `The average sold price on ${streetName} in Milton over the last 12 months is ${formatPrice(stats.avgSoldPrice)}, with a median of ${formatPrice(stats.medianSoldPrice)}. Homes here sold at ${stats.soldVsAskPct}% of their asking price on average.`,
    },
    {
      q: `How long do homes take to sell on ${streetName} Milton?`,
      a: `Homes on ${streetName} in Milton sold in an average of ${stats.avgDOM} days over the last 12 months. ${stats.totalSold12mo} properties traded hands in that period.`,
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

async function processStreet(streetSlug: string, streetName: string) {
  const stats = await getStreetStats(streetSlug);
  if (!stats) throw new Error("No stats available");

  const marketDataHash = calcMarketDataHash(stats);
  let description = "";
  let rawAiOutput = "";
  let attempts = 0;
  let lastFailures: string[] = [];

  // Up to 3 attempts with feedback-informed retry
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
  if (!passed) description = rawAiOutput; // Save last attempt anyway

  const metaTitle = `${streetName} Milton Real Estate | Homes, Prices & Market Data`;
  const metaDescription = `${stats.totalSold12mo} homes sold on ${streetName} in the last 12 months. Average price ${formatPrice(stats.avgSoldPrice)}. ${stats.avgDOM} days on market. Milton's most detailed street guide.`;
  const faqJson = buildFaqJson(streetName, stats);

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
      status: "draft",
      needsReview: true,
      aiGenerated: true,
      publishedAt: null,
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
      status: "draft",
      needsReview: true,
      generatedAt: new Date(),
      attempts,
    },
  });

  await prisma.streetQueue.updateMany({
    where: { streetSlug },
    data: { status: "done", processedAt: new Date() },
  });

  // SMS notification
  await sendSMS(
    `\u{1f4dd} New Miltonly draft ready: ${streetName}\n${stats.totalSold12mo} sales \u00b7 ${formatPrice(stats.avgSoldPrice)} avg\nReview at miltonly.vercel.app/admin/review`
  );

  return { streetName, passed, attempts };
}

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  const secret =
    request.headers.get("authorization")?.replace("Bearer ", "") ||
    request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  const built: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  const keyPrefix = process.env.ANTHROPIC_API_KEY?.slice(0, 10) || "NOT_SET";
  console.log(`[generate] ANTHROPIC_API_KEY defined: ${hasApiKey}, prefix: ${keyPrefix}`);

  if (!hasApiKey) {
    return NextResponse.json({
      error: "ANTHROPIC_API_KEY is not set in environment variables",
      hint: "Add it in Vercel dashboard → Settings → Environment Variables → make sure Production is checked",
    }, { status: 500 });
  }

  // Pick pending items
  const pending = await prisma.streetQueue.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    take: 20,
  });

  // Run decision check and filter
  const toBuild: { streetSlug: string; streetName: string }[] = [];

  for (const item of pending) {
    const decision = await makeStreetDecision(item.streetSlug, item.streetName);
    if (decision === "build" || decision === "regenerate") {
      toBuild.push(item);
    } else {
      skipped.push(`${item.streetName} (${decision})`);
      if (decision !== "skip_current") {
        await prisma.streetQueue.update({
          where: { id: item.id },
          data: { status: decision === "skip_low_data" ? "ineligible" : "done" },
        });
      }
    }
  }

  // Process in batches of 3
  for (let i = 0; i < toBuild.length; i += 3) {
    const batch = toBuild.slice(i, i + 3);

    // Mark as processing
    await Promise.all(
      batch.map((item) =>
        prisma.streetQueue.updateMany({
          where: { streetSlug: item.streetSlug },
          data: { status: "processing" },
        })
      )
    );

    const results = await Promise.allSettled(
      batch.map((item) => processStreet(item.streetSlug, item.streetName))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const item = batch[j];
      if (result.status === "fulfilled") {
        built.push(item.streetName);
      } else {
        failed.push(item.streetName);
        await prisma.streetQueue.updateMany({
          where: { streetSlug: item.streetSlug },
          data: {
            status: "failed",
            lastError: result.reason instanceof Error ? result.reason.message : String(result.reason),
            attempts: { increment: 1 },
          },
        });
        console.error(`Failed to generate ${item.streetName}:`, result.reason);
      }
    }

    // 2 second pause between batches
    if (i + 3 < toBuild.length) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  return NextResponse.json({
    processed: built.length + failed.length,
    built,
    skipped,
    failed,
    durationMs: Date.now() - start,
  });
}
