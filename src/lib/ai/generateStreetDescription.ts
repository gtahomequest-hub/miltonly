// Phase 4.1 Step 2 — 8-section AI street description generator.
//
// Entry point for every street-description model call. Callers are the retry
// wrapper `generateWithRetry` (wired in Step 4.1.4), the spot-check script
// (Step 4.1.8), and the backfill (Step 4.1.9). Never called at page-render
// time per kickoff.
//
// Critical contracts (per Phase 4.1 kickoff):
//   - System prompt loaded once at module import via fs.readFileSync, cached.
//   - Retries REQUIRE priorViolations AND priorOutput both passed back to the
//     model. The model cannot revise blind; without the output it produced,
//     the "fix these violations" message has no anchor. This was the defect
//     in the sister window's v3 retry loop.
//   - Defensive JSON parsing: handle plain JSON, fenced blocks, preambles,
//     trailing commas. Strip to first { / last } before JSON.parse.
//   - Shape verification before return: sections.length === 8, faq 6-8 items,
//     each with id/heading/paragraphs (paragraphs array of strings).
//   - Structured logging: one JSON line prefixed "[gen]" per call.
//   - No silent error suppression. All failures throw with context.

// Server-scoped by construction: uses fs.readFileSync + Anthropic SDK, neither
// usable in a client bundle. Omitting `server-only` package guard because it
// breaks Node-script contexts (spot-check, backfill); the fs and Anthropic
// imports would fail at runtime in a browser anyway.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import type {
  StreetGeneratorInput,
  StreetGeneratorOutput,
  StreetSection,
  StreetFAQItem,
  ValidatorViolation,
} from "@/types/street-generator";
import { formatViolationsForRetry } from "./validateStreetGeneration";

// ---------------------------------------------------------------------------
// Error classes — thrown, never caught-and-suppressed inside this module.
// Callers decide retry / fail-over policy.
// ---------------------------------------------------------------------------

export class StreetGenerationParseFailure extends Error {
  readonly rawText: string;
  constructor(message: string, rawText: string) {
    super(message);
    this.name = "StreetGenerationParseFailure";
    this.rawText = rawText;
  }
}

export class StreetGenerationShapeFailure extends Error {
  readonly fragment: unknown;
  constructor(message: string, fragment: unknown) {
    super(message);
    this.name = "StreetGenerationShapeFailure";
    this.fragment = fragment;
  }
}

// ---------------------------------------------------------------------------
// Module-scope constants: system prompt cached once at import.
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT_PATH = path.join(
  process.cwd(),
  "docs/phase-4.1/01-system-prompt.md"
);
const SYSTEM_PROMPT = fs.readFileSync(SYSTEM_PROMPT_PATH, "utf-8");

const MODEL = "claude-opus-4-7" as const;
const MAX_TOKENS = 8000;
const TEMPERATURE = 0.7;

// Lazy Anthropic client — defers API-key check until first call so the module
// imports cleanly in environments where the key isn't set yet (tests, CI).
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set; cannot call the model.");
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

// ---------------------------------------------------------------------------
// Public entry point.
// ---------------------------------------------------------------------------

export async function generateStreetDescription(
  input: StreetGeneratorInput,
  priorViolations?: ValidatorViolation[],
  priorOutput?: StreetGeneratorOutput
): Promise<StreetGeneratorOutput> {
  const startedAt = Date.now();
  const hash = inputHashPrefix(input);
  const isRetry = !!(priorViolations && priorViolations.length > 0);
  const attemptNumber = isRetry ? 2 : 1; // 3 not distinguishable without retry-state; caller supplements.

  const userMessage = buildUserMessage(input, priorViolations, priorOutput);

  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    temperature: TEMPERATURE,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const elapsedMs = Date.now() - startedAt;
  const tokensIn = response.usage.input_tokens;
  const tokensOut = response.usage.output_tokens;

  logLine({
    streetSlug: input.street.slug,
    inputHash: hash,
    attemptNumber,
    tokensIn,
    tokensOut,
    elapsedMs,
  });

  const rawText = extractText(response);
  const parsed = parseJsonDefensively(rawText, input.street.slug);
  return verifyShape(parsed);
}

// ---------------------------------------------------------------------------
// User message construction.
// Retry path MUST pass priorViolations + priorOutput + original input so the
// model can reconcile (a) what rules it broke with (b) the exact words it
// produced and (c) the source facts. Omitting any of the three degrades
// retry quality sharply.
// ---------------------------------------------------------------------------

function buildUserMessage(
  input: StreetGeneratorInput,
  priorViolations: ValidatorViolation[] | undefined,
  priorOutput: StreetGeneratorOutput | undefined
): string {
  if (!priorViolations || priorViolations.length === 0) {
    return JSON.stringify(input, null, 2);
  }
  return (
    formatViolationsForRetry(priorViolations) +
    "\n\nYour previous output (which failed validation):\n\n" +
    JSON.stringify(priorOutput, null, 2) +
    "\n\nOriginal input:\n\n" +
    JSON.stringify(input, null, 2)
  );
}

// ---------------------------------------------------------------------------
// Hashing — sha256 of stringified input, first 12 chars of hex. Used in the
// backfill's idempotency check and in per-call logs.
// ---------------------------------------------------------------------------

function inputHashPrefix(input: StreetGeneratorInput): string {
  const json = JSON.stringify(input);
  return crypto.createHash("sha256").update(json).digest("hex").slice(0, 12);
}

// ---------------------------------------------------------------------------
// Structured log: one JSON line per call, prefixed "[gen]".
// Kept human-readable; downstream observability should parse the JSON.
// ---------------------------------------------------------------------------

interface LogPayload {
  streetSlug: string;
  inputHash: string;
  attemptNumber: 1 | 2 | 3;
  tokensIn: number;
  tokensOut: number;
  elapsedMs: number;
}

function logLine(payload: LogPayload): void {
  // eslint-disable-next-line no-console
  console.log(`[gen] ${JSON.stringify(payload)}`);
}

// ---------------------------------------------------------------------------
// Response text extraction — the SDK returns a typed content array; we need
// the first text block. Anything else (tool-use, image, unknown) is a
// StreetGenerationParseFailure.
// ---------------------------------------------------------------------------

function extractText(response: Anthropic.Messages.Message): string {
  const first = response.content[0];
  if (!first) {
    throw new StreetGenerationParseFailure(
      "response had no content blocks",
      JSON.stringify(response.content).slice(0, 500)
    );
  }
  if (first.type !== "text") {
    throw new StreetGenerationParseFailure(
      `response.content[0].type = ${first.type}, expected "text"`,
      JSON.stringify(first).slice(0, 500)
    );
  }
  return first.text;
}

// ---------------------------------------------------------------------------
// Defensive JSON parsing.
//
// The model may wrap JSON in any of these forms — all must parse:
//   a. Plain:           {...}
//   b. Fenced:          ```json\n{...}\n```    or    ```\n{...}\n```
//   c. With preamble:   "Here is the output:\n\n{...}"
//   d. Trailing whitespace, trailing commas before } or ]
//
// Strategy:
//   1. Strip fence markers.
//   2. Find first "{" and last "}", substring inclusive.
//   3. Remove trailing commas before } or ].
//   4. JSON.parse.
//   5. On failure: log truncated raw and throw with the raw attached.
// ---------------------------------------------------------------------------

function stripFence(text: string): string {
  let s = text.trim();
  s = s.replace(/^```(?:json)?\s*\r?\n?/i, "");
  s = s.replace(/\r?\n?```\s*$/, "");
  return s;
}

function trimTrailingCommas(json: string): string {
  return json.replace(/,(\s*[}\]])/g, "$1");
}

function parseJsonDefensively(rawText: string, slug: string): unknown {
  const stripped = stripFence(rawText);
  const first = stripped.indexOf("{");
  const last = stripped.lastIndexOf("}");
  if (first < 0 || last < 0 || last <= first) {
    // eslint-disable-next-line no-console
    console.error(
      `[gen] parse failure (no JSON braces) for ${slug}. Raw (truncated 500): ${rawText.slice(0, 500)}`
    );
    throw new StreetGenerationParseFailure(
      "no JSON object braces found in response",
      rawText
    );
  }
  const candidate = trimTrailingCommas(stripped.slice(first, last + 1));
  try {
    return JSON.parse(candidate);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(
      `[gen] JSON.parse failure for ${slug}: ${msg}. Raw (truncated 500): ${rawText.slice(0, 500)}`
    );
    throw new StreetGenerationParseFailure(
      `JSON.parse failed: ${msg}`,
      rawText
    );
  }
}

// ---------------------------------------------------------------------------
// Shape verification.
// The validator does semantic checks; this does structural checks only.
// Failures here mean the model produced something this pipeline literally
// can't consume, and no amount of voice-level retry will help — caller
// should surface this to human review.
// ---------------------------------------------------------------------------

function verifyShape(parsed: unknown): StreetGeneratorOutput {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new StreetGenerationShapeFailure(
      "root is not a plain object",
      parsed
    );
  }
  const obj = parsed as Record<string, unknown>;

  if (!Array.isArray(obj.sections)) {
    throw new StreetGenerationShapeFailure(
      `sections is not an array (got ${typeof obj.sections})`,
      obj.sections
    );
  }
  if (obj.sections.length !== 8) {
    throw new StreetGenerationShapeFailure(
      `sections length ${obj.sections.length}, expected 8`,
      obj.sections
    );
  }
  obj.sections.forEach((section, idx) => {
    if (!section || typeof section !== "object") {
      throw new StreetGenerationShapeFailure(
        `sections[${idx}] is not an object`,
        section
      );
    }
    const s = section as Record<string, unknown>;
    if (typeof s.id !== "string") {
      throw new StreetGenerationShapeFailure(
        `sections[${idx}].id not a string`,
        section
      );
    }
    if (typeof s.heading !== "string") {
      throw new StreetGenerationShapeFailure(
        `sections[${idx}].heading not a string`,
        section
      );
    }
    if (!Array.isArray(s.paragraphs)) {
      throw new StreetGenerationShapeFailure(
        `sections[${idx}].paragraphs not an array`,
        section
      );
    }
    s.paragraphs.forEach((p, pIdx) => {
      if (typeof p !== "string") {
        throw new StreetGenerationShapeFailure(
          `sections[${idx}].paragraphs[${pIdx}] not a string`,
          p
        );
      }
    });
  });

  if (!Array.isArray(obj.faq)) {
    throw new StreetGenerationShapeFailure(
      `faq is not an array (got ${typeof obj.faq})`,
      obj.faq
    );
  }
  if (obj.faq.length < 6 || obj.faq.length > 8) {
    throw new StreetGenerationShapeFailure(
      `faq length ${obj.faq.length}, expected 6-8`,
      obj.faq
    );
  }
  obj.faq.forEach((item, idx) => {
    if (!item || typeof item !== "object") {
      throw new StreetGenerationShapeFailure(
        `faq[${idx}] is not an object`,
        item
      );
    }
    const q = item as Record<string, unknown>;
    if (typeof q.question !== "string") {
      throw new StreetGenerationShapeFailure(
        `faq[${idx}].question not a string`,
        item
      );
    }
    if (typeof q.answer !== "string") {
      throw new StreetGenerationShapeFailure(
        `faq[${idx}].answer not a string`,
        item
      );
    }
  });

  return {
    sections: obj.sections as StreetSection[],
    faq: obj.faq as StreetFAQItem[],
  };
}
