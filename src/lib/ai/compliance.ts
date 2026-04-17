/**
 * AI Compliance Gatekeeper
 *
 * This is the ONLY file in the codebase that calls the Claude API.
 * All other files must call functions exported from here.
 *
 * Rules enforced:
 * 1. No raw MLS listing records enter any prompt
 * 2. Only pre-computed stats (averages, counts, percentages) are passed
 * 3. No PropTx record identifiers (MLS numbers, listing keys) in prompts
 * 4. All calls are logged for compliance audit
 */

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-sonnet-4-20250514";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
    client = new Anthropic({ apiKey });
  }
  return client;
}

/** Pre-computed street stats that are safe to pass to Claude (no raw listing data).
 *  Post-Phase-2.6 (2026-04-17): fields renamed to match their actual semantics.
 *  DB1 no longer stores sold prices; these values are all active-listing aggregates
 *  sourced from the operational Listing table. Sold data lives in DB2 and is
 *  surfaced only through the gated StreetSoldBlock, never into AI prompts. */
export interface SafeStreetStats {
  streetName: string;
  neighbourhood: string;
  avgListPrice: number;      // active-listing average (was avgSoldPrice — misleading)
  medianListPrice: number;   // active-listing median (was medianSoldPrice — misleading)
  totalSold12mo: number;     // count of sold listings — safe aggregate, name describes a count
  avgDOM: number;            // active-listing days on market
  activeCount: number;
  dominantPropertyType: string;
  priceDirection: string;
  schoolZone: string | null;
  bestMonth: string;
  // soldVsAskPct removed — ratios would require sold price data which DB1 no longer holds.
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
 * Generate a street description using Claude.
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
