import { prisma } from "@/lib/prisma";
import { generateStreetDescription as aiGenerate, type SafeStreetStats } from "@/lib/ai/compliance";

const BANNED_WORDS = [
  "nestled", "charming", "vibrant", "picturesque", "bustling",
  "sought-after", "stunning", "dream home", "perfect blend",
  "a stone's throw", "boasts", "in the heart of", "don't miss",
  "rare opportunity", "pride of ownership", "meticulously",
  "spacious", "truly special", "ideal for families",
  "conveniently located", "this is the one", "look no further",
  "tranquil", "serene", "oasis", "turnkey",
];

const MILTON_TERMS = [
  "go train", "milton go", "union station", "highway 401", "hwy 401",
  "kielburger", "bishop reding", "escarpment", "willmott", "coates",
  "clarke", "beaty", "dempsey", "hawthorne", "harrison", "old milton",
  "scott", "kelso", "milton district",
];

interface ValidationResult {
  pass: boolean;
  reason?: string;
}

export function validateStreetDescription(text: string): ValidationResult {
  const lower = text.toLowerCase();

  // Rule 1: Banned words
  const foundBanned = BANNED_WORDS.find((w) => lower.includes(w));
  if (foundBanned) return { pass: false, reason: `BANNED_WORD: "${foundBanned}"` };

  // Rule 2: Word count
  const wordCount = text.split(/\s+/).length;
  if (wordCount < 260 || wordCount > 340)
    return { pass: false, reason: `WORD_COUNT: ${wordCount} (need 260-340)` };

  // Rule 3: Must contain real data (price)
  if (!/\$[0-9]/.test(text)) return { pass: false, reason: "NO_PRICE_DATA" };

  // Rule 4: Milton specificity
  const hasMilton = MILTON_TERMS.some((t) => lower.includes(t));
  if (!hasMilton) return { pass: false, reason: "NOT_MILTON_SPECIFIC" };

  // Rule 5: Must not start with street name patterns
  if (/^(located|situated)/i.test(text.trim()))
    return { pass: false, reason: "STARTS_WITH_LOCATED" };

  return { pass: true };
}

interface StreetDataForContent {
  streetName: string;
  avgListPrice: number;      // active-listing avg; was (avgSoldPrice + avgListPrice), merged
  avgDOM: number;            // active-listing DOM
  totalSold12mo: number;     // count only — safe aggregate
  activeCount: number;
  neighbourhoods: string[];
  byType: Record<string, { count: number; avgPrice: number }>;
  // soldVsAskPct removed — DB1 no longer holds sold prices; ratios come from DB2
  // aggregates and surface only through the gated StreetSoldBlock, not AI prompts.
}

export async function generateStreetDescription(
  data: StreetDataForContent
): Promise<{ text: string; passed: boolean; attempts: number }> {
  // If no API key, return a data-driven template
  if (!process.env.ANTHROPIC_API_KEY) {
    return generateTemplateDescription(data);
  }

  const types = Object.entries(data.byType)
    .map(([t, d]) => `${t} (${d.count} listings, avg $${d.avgPrice.toLocaleString()})`)
    .join(", ");

  const userPrompt = `Write a detailed description of ${data.streetName} in Milton, Ontario for a real estate website.

Real data to incorporate:
- Average list price: $${data.avgListPrice.toLocaleString()}
- Property types: ${types}
- Neighbourhood: ${data.neighbourhoods.join(", ")}
- Total sold last 12 months: ${data.totalSold12mo}
- Avg days on market: ${data.avgDOM || "not enough data"}
- Active listings: ${data.activeCount}

Paragraph 1 (100 words): What it is like to live on this street. Location within Milton, nearby schools, parks, GO train access, community feel. Be specific to Milton — mention real landmarks, real schools, real transit. Do not use generic real estate clichés.

Paragraph 2 (110 words): The real estate market on this street. What types of homes are here, price range, how fast they sell, who buys here (families, commuters, investors). Mention the specific numbers naturally in the text.

Paragraph 3 (90 words): Why buyers choose this street and investment outlook. Be honest and data-driven. Mention proximity to Highway 401, GO train, schools, or whatever is most relevant based on the data.

Write in second person (you/your) where appropriate. Total: 280-320 words. Do not start with the street name. Do not use bullet points.`;

  const systemPrompt = `You are a local Milton Ontario real estate expert writing for Miltonly.com, a data-driven real estate portal focused exclusively on Milton, Ontario, Canada.

Your job is to write a 3-paragraph street description (280-320 words total) that is specific, data-driven, and genuinely useful to someone researching this street.

STRICT RULES:
1. Never use: nestled, charming, vibrant, picturesque, bustling, sought-after, stunning, boasts, tranquil, serene, oasis, turnkey, in the heart of, a stone's throw, meticulously, truly special, ideal for families, conveniently located
2. Every sentence must be under 25 words
3. No passive voice
4. Include the actual sold price and days on market naturally in the text
5. Reference at least one real Milton school by name
6. Reference the GO train or Highway 401 specifically
7. Do not start with the street name
8. Do not start with 'Located' or 'Situated'
9. Write in second or third person — never first person
10. The description must only apply to THIS street in Milton — it should not work for any other city`;

  const safeStats: SafeStreetStats = {
    streetName: data.streetName,
    neighbourhood: data.neighbourhoods[0] || "Milton",
    avgListPrice: data.avgListPrice,
    medianListPrice: data.avgListPrice, // only avg available from caller; median not tracked here
    totalSold12mo: data.totalSold12mo,
    avgDOM: data.avgDOM,
    activeCount: data.activeCount,
    dominantPropertyType: Object.keys(data.byType)[0] || "detached",
    priceDirection: "remained steady",
    schoolZone: null,
    bestMonth: "N/A",
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const result = await aiGenerate(systemPrompt, userPrompt, safeStats);
      const validation = validateStreetDescription(result.text);

      if (validation.pass) {
        return { text: result.text, passed: true, attempts: attempt };
      }
      console.log(`Validation failed (attempt ${attempt}): ${validation.reason}`);
    } catch (e) {
      console.error(`Generation error (attempt ${attempt}):`, e);
    }
  }

  // After 3 failures, use template with needs_review flag
  const fallback = generateTemplateDescription(data);
  return { ...fallback, passed: false };
}

function generateTemplateDescription(data: StreetDataForContent): { text: string; passed: boolean; attempts: number } {
  const avgPrice = data.avgListPrice > 0 ? `$${(data.avgListPrice / 1000).toFixed(0)}K` : "—";
  const types = Object.keys(data.byType).join(", ");
  const hood = data.neighbourhoods[0] || "Milton";

  const text = `Residents here enjoy direct access to Milton GO station, connecting commuters to Union Station in under an hour. The ${hood} area surrounds this street with parks, walking trails, and daily amenities within a short drive. Craig Kielburger Secondary and several elementary schools serve families in this catchment. Highway 401 sits minutes away, making this street practical for drivers heading to Mississauga or Toronto. The local community blends young families with established homeowners who value Milton's small-town pace.

The real estate market on ${data.streetName} reflects Milton's broader growth story. Current listings average ${avgPrice}, with property types including ${types}. ${data.activeCount} homes are actively listed right now. Buyers here compete for well-priced properties, particularly ${Object.keys(data.byType)[0] || "detached"} homes. Condos and townhouses draw first-time buyers and investors looking for entry points under the Milton average. The street sees steady transaction volume with ${data.totalSold12mo} sales recorded in the past twelve months. Sellers typically list close to market value and move quickly when priced right.

Milton's population growth continues to push demand across all property types. ${data.streetName} benefits from its position near the Escarpment and Kelso Conservation Area. School quality remains a key driver — Bishop Reding and Milton District High School both serve this area. Investment buyers watch this street for rental income potential, especially in the condo segment. Price appreciation over the past three years has tracked above the Halton Region average. The combination of GO train access, Highway 401 proximity, and expanding infrastructure makes this a street worth monitoring for both end users and investors.`;

  return { text, passed: true, attempts: 0 };
}

export async function getOrGenerateStreetContent(
  slug: string,
  data: StreetDataForContent
): Promise<{ description: string; needsReview: boolean }> {
  // Check existing content
  const existing = await prisma.streetContent.findUnique({ where: { streetSlug: slug } });

  if (existing) {
    // Check if stale (> 30 days)
    const daysSinceGen = (Date.now() - existing.generatedAt.getTime()) / 86400000;
    if (daysSinceGen < 30) {
      return { description: existing.description, needsReview: existing.needsReview };
    }
  }

  // Generate new
  const result = await generateStreetDescription(data);

  await prisma.streetContent.upsert({
    where: { streetSlug: slug },
    create: {
      streetSlug: slug,
      streetName: data.streetName,
      description: result.text,
      needsReview: !result.passed,
      metaTitle: `${data.streetName} Milton — Homes For Sale, Sold Prices & Street Intelligence | Miltonly.com`,
      metaDescription: `See what homes are selling for on ${data.streetName} in Milton Ontario. ${data.activeCount} active listings, avg price $${data.avgListPrice.toLocaleString()}. Updated daily.`,
    },
    update: {
      description: result.text,
      needsReview: !result.passed,
      generatedAt: new Date(),
    },
  });

  return { description: result.text, needsReview: !result.passed };
}
