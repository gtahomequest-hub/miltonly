// src/lib/marketWatch/generate.ts
//
// Writes one edition. Deterministic sections first, then the ONE optional
// generated paragraph, then the row, then revalidation.
//
// THE PARAGRAPH NEVER BLOCKS THE EDITION. It is fail-closed and non-blocking:
// a validator violation, a provider error, a missing key or a refused prompt
// all end the same way — `interpretation` stays null, the attempt is recorded
// on MarketEditionGeneration with its violations, and sections 1 to 6 publish
// exactly as they would have. There is no retry budget worth spending on a
// paragraph the page does not need.
//
// CHEAP-FIRST, AND ONLY CHEAP. This calls callDeepSeek directly. There is no
// escalation path to Claude here and there should not be one: the Anthropic
// account has no credit (root HANDOFF open item 1), and a weekly cron that can
// escalate is a weekly cron that can fail on a balance. `assertPromptSafe`
// runs inside callDeepSeek, so the compliance choke is inherited rather than
// re-implemented.

import "server-only";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { callDeepSeek } from "@/lib/ai/compliance";
import { validateContentProse, type ContentViolation } from "@/lib/content/validateContentProse";
import { figuresForPrompt } from "@/lib/content/groundedFigures";
import { buildEdition, type BuiltEdition } from "./edition";

const CITY = config.CITY_NAME;

const SYSTEM_PROMPT = `You write one short paragraph for a weekly real estate market report about ${CITY}, Ontario.

You are given a list of figures. Those figures are the ONLY facts you have.

HARD RULES. Breaking any one of them means the paragraph is discarded.
1. Use ONLY the figures given. Do not state, estimate, round differently, or infer any number that is not in the list.
2. A figure marked NOT AVAILABLE does not exist. Do not state it, do not approximate it, do not describe it in words ("just over a million", "the high nine hundreds"). Saying a figure is not available is fine.
3. Name only the places listed. Do not name any other neighbourhood, street, building, school, business or person.
4. No superlatives and no sales language. Not "best", "strong", "hot", "premier", "sought-after", "stunning". Describe, do not sell.
5. No forecast. Do not say what happens next, what buyers or sellers should do, or where prices are heading. Write about what has already happened.
6. No em-dashes. Use commas, semicolons or full stops. An en-dash only between two numerals.
7. Third person. No "we", "our", "us", "I", and no address to the reader.
8. Do not characterise who lives anywhere, who is buying, or who a home suits.

WHAT THE PARAGRAPH IS FOR. The reader has just read a table containing every one of these figures. Restating the table is worthless. Say what the figures mean together: how the week sits against the longer window, whether pace and negotiating room point the same way, which figure is doing the work. Pick two or three relationships and state them. Do not walk the list.

FORBIDDEN SPECIFICALLY.
- Do not list the neighbourhood counts. They are already a list on the page.
- Do not restate more than four figures.
- Do not open with "For the week of" or any restatement of the date.
- NEVER compare a weekly figure to a 12-month TOTAL. A week having fewer sales than a year is arithmetic, not a finding. Only compare like windows: this week against last week, or the weekly typical price against the 12-month typical price.

HOW TO WRITE A NUMBER. Money takes a dollar sign, thousands separators and no decimals: $920,000, never 920000. A percentage takes its sign: 97.5%. Days are written as "76 days".

FORM. One paragraph, 60 to 110 words, plain declarative sentences. Return the paragraph as plain text with no heading, no preamble, no quotation marks and no commentary.`;

export interface GenerateResult {
  weekOf: string;
  built: BuiltEdition;
  interpretation: string | null;
  violations: ContentViolation[];
  attempts: number;
  costUsd: number;
  note: string;
}

/**
 * Generate the optional paragraph. Two attempts, because the failure modes are
 * mostly one-shot (a stray superlative, one invented number) and a third
 * attempt on the same prompt buys little. Returns null on anything.
 */
async function generateInterpretation(
  built: BuiltEdition,
): Promise<{ text: string | null; violations: ContentViolation[]; attempts: number; costUsd: number; raw: string | null; note: string }> {
  if (!process.env.DEEPSEEK_API_KEY) {
    return { text: null, violations: [], attempts: 0, costUsd: 0, raw: null, note: "DEEPSEEK_API_KEY not set; paragraph skipped" };
  }

  const userPrompt = `Figures for the ${built.sections.weekLabel}:\n\n${figuresForPrompt(built.figures)}\n\nWrite the paragraph.`;
  let lastViolations: ContentViolation[] = [];
  let lastRaw: string | null = null;
  let cost = 0;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await callDeepSeek({
        systemPrompt: SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 700,
        temperature: 0.4,
      });
      cost += res.costUsd;
      const text = res.text.trim().replace(/^["']|["']$/g, "");
      lastRaw = text;
      const check = validateContentProse(text, built.figures);
      if (check.ok) {
        return { text, violations: [], attempts: attempt, costUsd: cost, raw: text, note: `passed on attempt ${attempt}` };
      }
      lastViolations = check.violations;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        text: null,
        violations: lastViolations,
        attempts: attempt,
        costUsd: cost,
        raw: lastRaw,
        note: `provider error, paragraph dropped: ${msg.slice(0, 200)}`,
      };
    }
  }
  return {
    text: null,
    violations: lastViolations,
    attempts: 2,
    costUsd: cost,
    raw: lastRaw,
    note: `validator rejected both attempts, paragraph dropped (${lastViolations.map((v) => v.rule).join(", ")})`,
  };
}

export interface GenerateOptions {
  weekOf?: string;
  /** Skip the LLM half entirely. The edition publishes sections 1 to 6. */
  skipParagraph?: boolean;
  /** Write as published rather than draft. */
  publish?: boolean;
}

export async function generateEdition(opts: GenerateOptions = {}): Promise<GenerateResult | null> {
  const built = await buildEdition(opts.weekOf);
  if (!built) return null;

  const gen = opts.skipParagraph
    ? { text: null, violations: [] as ContentViolation[], attempts: 0, costUsd: 0, raw: null, note: "paragraph skipped by request" }
    : await generateInterpretation(built);

  const status = opts.publish ? "published" : "draft";

  await prisma.marketEdition.upsert({
    where: { weekOf: built.weekOf },
    create: {
      weekOf: built.weekOf,
      windowStart: built.window.startUtc,
      windowEnd: built.window.endUtc,
      status,
      publishedAt: opts.publish ? new Date() : null,
      sectionsJson: built.sections as unknown as object,
      summarySentence: built.summarySentence,
      interpretation: gen.text,
      metaTitle: built.metaTitle,
      metaDescription: built.metaDescription,
    },
    update: {
      windowStart: built.window.startUtc,
      windowEnd: built.window.endUtc,
      status,
      publishedAt: opts.publish ? new Date() : null,
      sectionsJson: built.sections as unknown as object,
      summarySentence: built.summarySentence,
      interpretation: gen.text,
      metaTitle: built.metaTitle,
      metaDescription: built.metaDescription,
    },
  });

  await prisma.marketEditionGeneration.create({
    data: {
      weekOf: built.weekOf,
      status: gen.text ? "succeeded" : "failed",
      attemptCount: gen.attempts,
      inputJson: built.figures as unknown as object,
      rawOutput: gen.raw,
      violationsJson: gen.violations as unknown as object,
      provider: gen.attempts > 0 ? "deepseek" : null,
      model: gen.attempts > 0 ? "deepseek" : null,
      costUsd: gen.costUsd ? gen.costUsd.toFixed(4) : null,
    },
  });

  return {
    weekOf: built.weekOf,
    built,
    interpretation: gen.text,
    violations: gen.violations,
    attempts: gen.attempts,
    costUsd: gen.costUsd,
    note: gen.note,
  };
}

/** On-demand revalidation for a written edition. Same invariant StreetContent
 *  carries: a successful write refreshes its own page and every index that
 *  lists it. */
export async function revalidateEdition(weekOf: string, baseUrl: string, secret: string): Promise<Array<{ path: string; status: number }>> {
  const paths = [`/market-watch/${weekOf}`, "/market-watch", "/guides"];
  const out: Array<{ path: string; status: number }> = [];
  for (const path of paths) {
    try {
      const res = await fetch(`${baseUrl}/api/revalidate?secret=${encodeURIComponent(secret)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      out.push({ path, status: res.status });
    } catch {
      out.push({ path, status: 0 });
    }
  }
  return out;
}
