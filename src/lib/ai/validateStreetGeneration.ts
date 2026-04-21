// src/lib/ai/validateStreetGeneration.ts
// Validator for Phase 4.1 street description output.
// Runs against StreetGeneratorOutput post-parse. Returns violations list.
// Hard violations trigger retry. 3 attempts max, then hard fail + needsReview.
//
// v3 changes from v2:
//   - Added hedging_builder, faq_answer_length, faq_question_out_of_bank rules
//     (no more rule-name reuse for unrelated violations)
//   - Added total_word_floor rule at 1,200 (matches system prompt self-check #9)
//     with tiered floors for thin (1,050) and zero (1,000) data streets
//   - Widened rent regex to catch 5-digit rents ($10,500 style)
//   - Expanded KNOWN_MILTON_ANCHORS to cover common schools, parks, transit
//
// Known limitations (documented intentionally):
//   - "average" in METHODOLOGY_LEAK_PHRASES will false-positive on valid usages
//     like "on average" or "average household size". Keep strict for now.
//     Monitor retry rate during backfill; loosen if it causes churn.
//   - K/M shorthand prices like "$1.4M" and "$748K" cannot be rounding-validated
//     because the regex requires comma-separated numeric form. These are
//     structurally hard to emit un-rounded, so the gap is low-risk.
//   - extractCandidateStreetNames is a heuristic. Expand KNOWN_MILTON_ANCHORS
//     as new false positives surface during backfill.

import type {
  StreetGeneratorOutput,
  StreetGeneratorInput,
  StreetSectionId,
  ValidatorViolation,
} from "@/types/street-generator";

// --- Denylists ---

const EM_DASH_CHARS = /[\u2014\u2013]/;  // em-dash, en-dash. Hyphen-minus is allowed.

const SUPERLATIVE_PHRASES = [
  "best", "unbeatable", "nothing comes close", "premier",
  "second to none", "finest", "most desirable", "top-tier",
  "world-class", "unparalleled", "unmatched",
];

const CLICHE_OPENERS_AND_PHRASES = [
  "welcome to", "nestled in", "tucked away", "hidden gem",
  "sought-after", "sought after", "desirable", "charming",
  "stunning", "must-see", "must see", "breathtaking", "boasts",
  "offers the perfect blend", "lifestyle you deserve",
  "dream home", "truly unique", "one of a kind", "gem of a",
];

const METHODOLOGY_LEAK_PHRASES = [
  "last 12 months", "past 12 months", "last twelve months",
  "past twelve months", "last 24 months", "past 24 months",
  "last quarter", "past quarter", "median", "average", "mean",
  "data source", "our dataset", "our algorithm", "MLS feed",
  "TREB", "VOW", "standard deviation", "sample size",
  "k-anonymity", "statistical", "per our data",
];

const HEDGING_PHRASES = [
  "likely built by", "probably built by", "appears to have been built",
  "may have been built", "seems to have been", "likely Mattamy",
  "probably Mattamy", "may be Mattamy", "likely a product of",
  "possibly built", "believed to be built",
];

// --- Price detection ---

const DOLLAR_FIGURE = /\$(\d{1,3}(?:,\d{3})+)(?!\d)/g;
// v3: widened to accept 5-digit rents ($10,500) in addition to 4-digit ($2,100)
const RENT_FIGURE = /\$(\d{1,2},?\d{3})(?!\d)/g;

function isPriceProperlyRounded(figureStr: string): boolean {
  const value = parseInt(figureStr.replace(/,/g, ""), 10);
  if (isNaN(value)) return true;
  if (value < 500_000) return value % 10_000 === 0;
  if (value < 1_000_000) return value % 25_000 === 0;
  if (value < 2_000_000) return value % 50_000 === 0;
  return value % 100_000 === 0;
}

function isRentProperlyRounded(figureStr: string): boolean {
  const value = parseInt(figureStr.replace(/,/g, ""), 10);
  if (isNaN(value)) return true;
  if (value < 2_500) return value % 50 === 0;
  if (value < 4_000) return value % 100 === 0;
  return value % 250 === 0;
}

function findPrecisePrice(text: string): string | null {
  DOLLAR_FIGURE.lastIndex = 0;
  let match;
  while ((match = DOLLAR_FIGURE.exec(text)) !== null) {
    const value = parseInt(match[1].replace(/,/g, ""), 10);
    if (value < 10_000) continue;  // skip rent-sized figures
    if (!isPriceProperlyRounded(match[1])) return match[0];
  }
  return null;
}

function findPreciseRent(text: string): string | null {
  RENT_FIGURE.lastIndex = 0;
  let match;
  while ((match = RENT_FIGURE.exec(text)) !== null) {
    const value = parseInt(match[1].replace(/,/g, ""), 10);
    if (value < 500) continue;      // too low to be rent
    if (value >= 20_000) continue;  // too high, would be sale-side
    if (!isRentProperlyRounded(match[1])) return match[0];
  }
  return null;
}

// --- Heading bank ---

const HEADING_BANK: Record<StreetSectionId, string[]> = {
  about:              ["About {name}", "{name} at a glance"],
  homes:              ["The homes here", "Housing stock on {shortName}"],
  amenities:          ["What's nearby", "Around the corner"],
  market:             ["The market right now", "Trade patterns"],
  gettingAround:      ["Getting around", "Where this street reaches"],
  schools:            ["Schools and catchment"],
  bestFitFor:         ["Who this street suits"],
  differentPriorities:["If different priorities matter more"],
};

// --- Thresholds ---

const SECTION_WORD_FLOORS: Record<StreetSectionId, number> = {
  about: 60, homes: 120, amenities: 80, market: 40,
  gettingAround: 55, schools: 45, bestFitFor: 55, differentPriorities: 55,
};
const SECTION_WORD_CEILINGS: Record<StreetSectionId, number> = {
  about: 180, homes: 350, amenities: 250, market: 350,
  gettingAround: 200, schools: 200, bestFitFor: 180, differentPriorities: 180,
};
// v3: tiered total-word floors matching system prompt self-check #9 (1,200 target)
// Thin and zero data streets get relaxed floors because market section collapses.
const TOTAL_WORD_FLOOR_FULL = 1200;
const TOTAL_WORD_FLOOR_THIN = 1050;
const TOTAL_WORD_FLOOR_ZERO = 1000;
const TOTAL_WORD_CEILING = 2000;

const FAQ_MIN = 6;
const FAQ_MAX = 8;
const FAQ_ANSWER_MIN_SENTENCES = 2;
const FAQ_ANSWER_MAX_SENTENCES = 4;

const CANONICAL_ORDER: StreetSectionId[] = [
  "about","homes","amenities","market","gettingAround","schools","bestFitFor","differentPriorities",
];

// --- Canonical FAQ question bank ---
const FAQ_BANK_TEMPLATES: string[] = [
  "What is the typical price on {Street}?",
  "Why do homes on {Street} trade differently than other Milton streets?",
  "What price range should I expect on {Street}?",
  "How fast do homes sell on {Street}?",
  "How has the market been moving on {Street} recently?",
  "What kinds of homes are on {Street}?",
  "Are lots on {Street} larger or smaller than typical?",
  "What year was most of {Street} built?",
  "Which schools serve {Street}?",
  "Is {Street} in a strong school catchment?",
  "How far is {Street} from Toronto?",
  "What's the commute from {Street} to Pearson?",
  "Is {Street} close to the 401 or 407?",
  "Who built most of the homes on {Street}?",
  "Is {Street} new construction or established?",
  "What's the rental market like on {Street}?",
  "What do two-bedroom condos rent for on {Street}?",
  "Is {Street} a good fit for investors?",
  "What's the typical cap rate pattern on {Street}?",
  "Who is {Street} a good fit for?",
  "If {Street} isn't the right fit, what similar streets should I look at?",
];

// --- Known Milton anchors (for cross-street invention check) ---
const KNOWN_MILTON_ANCHORS = [
  // Neighbourhoods
  "Old Milton", "Milton", "Ford", "Willmott", "Cobban", "Scott",
  "Beaty", "Dempsey", "Bronte Meadows", "Harrison", "Clarke", "Coates",
  // Highways and transit
  "Highway 401", "Highway 407", "Milton GO", "GO", "TTC", "Derry Road",
  // Institutional
  "Milton District Hospital", "Milton Islamic Centre",
  // External anchors
  "Pearson", "Toronto", "Mississauga", "Oakville", "Burlington",
  // School boards
  "HDSB", "HCDSB",
  // Common schools and parks seen in training/examples
  "Rotary Park", "Willmott Park", "Ford District Park",
  "Martin Street Public School", "St. Peter Catholic Elementary",
  "Anne J. MacArthur Public School", "Our Lady of Victory Catholic Elementary",
  "Boyne Public School",
  // Builders and retailers
  "Mattamy", "Sobeys", "Longo's", "FreshCo",
];

// --- Core validator ---

export function validateStreetGeneration(
  output: StreetGeneratorOutput,
  input: StreetGeneratorInput,
): ValidatorViolation[] {
  const violations: ValidatorViolation[] = [];

  // Shape checks first (fail-fast)
  if (!output.sections || output.sections.length !== 8) {
    violations.push({ rule: "invalid_json_shape", excerpt: `sections length = ${output.sections?.length}`, severity: "hard" });
    return violations;
  }
  for (let i = 0; i < 8; i++) {
    if (output.sections[i].id !== CANONICAL_ORDER[i]) {
      violations.push({ rule: "missing_section_id", excerpt: `position ${i} got id "${output.sections[i].id}", expected "${CANONICAL_ORDER[i]}"`, severity: "hard" });
    }
  }
  if (!output.faq || output.faq.length < FAQ_MIN || output.faq.length > FAQ_MAX) {
    violations.push({ rule: "faq_count_out_of_range", excerpt: `faq length = ${output.faq?.length}`, severity: "hard" });
  }

  // Per-section prose scan
  const allProse: string[] = [];

  for (const section of output.sections) {
    const sectionText = section.paragraphs.join("\n\n");
    allProse.push(sectionText);

    // Heading check
    const acceptable = HEADING_BANK[section.id].flatMap(tmpl => [
      tmpl.replace("{name}", input.street.name).replace("{shortName}", input.street.shortName),
    ]);
    if (!acceptable.includes(section.heading)) {
      violations.push({
        rule: "heading_out_of_bank",
        sectionId: section.id,
        excerpt: `got "${section.heading}", expected one of: ${acceptable.join(" | ")}`,
        severity: "hard",
      });
    }

    // Em-dash
    if (EM_DASH_CHARS.test(sectionText)) {
      violations.push({
        rule: "em_dash",
        sectionId: section.id,
        excerpt: excerptAround(sectionText, EM_DASH_CHARS),
        severity: "hard",
      });
    }

    // Superlatives
    for (const phrase of SUPERLATIVE_PHRASES) {
      const re = wordBoundaryRegex(phrase);
      if (re.test(sectionText)) {
        violations.push({ rule: "superlative", sectionId: section.id, excerpt: excerptAround(sectionText, re), severity: "hard" });
        break;
      }
    }

    // Clichés
    for (const phrase of CLICHE_OPENERS_AND_PHRASES) {
      const re = wordBoundaryRegex(phrase);
      if (re.test(sectionText)) {
        violations.push({ rule: "cliche_opener", sectionId: section.id, excerpt: excerptAround(sectionText, re), severity: "hard" });
        break;
      }
    }

    // Methodology leaks
    for (const phrase of METHODOLOGY_LEAK_PHRASES) {
      const re = wordBoundaryRegex(phrase);
      if (re.test(sectionText)) {
        violations.push({ rule: "methodology_leak", sectionId: section.id, excerpt: excerptAround(sectionText, re), severity: "hard" });
        break;
      }
    }

    // v3: hedging emits its own rule
    for (const phrase of HEDGING_PHRASES) {
      const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      if (re.test(sectionText)) {
        violations.push({ rule: "hedging_builder", sectionId: section.id, excerpt: excerptAround(sectionText, re), severity: "hard" });
        break;
      }
    }

    // Precise sale price (rounding violation)
    const preciseSalePrice = findPrecisePrice(sectionText);
    if (preciseSalePrice) {
      violations.push({
        rule: "precise_price",
        sectionId: section.id,
        excerpt: `sale price "${preciseSalePrice}" violates rounding rules`,
        severity: "hard",
      });
    }

    // Precise rent
    const preciseRent = findPreciseRent(sectionText);
    if (preciseRent) {
      violations.push({
        rule: "precise_price",
        sectionId: section.id,
        excerpt: `rent "${preciseRent}" violates rounding rules`,
        severity: "hard",
      });
    }

    // Section word floor/ceiling
    const wordCount = countWords(sectionText);
    const effectiveFloor = (section.id === "market" && input.aggregates.kAnonLevel !== "full")
      ? 30
      : SECTION_WORD_FLOORS[section.id];
    if (wordCount < effectiveFloor) {
      violations.push({ rule: "section_word_floor", sectionId: section.id, excerpt: `${wordCount} words, floor ${effectiveFloor}`, severity: "hard" });
    }
    if (wordCount > SECTION_WORD_CEILINGS[section.id]) {
      violations.push({ rule: "section_word_ceiling", sectionId: section.id, excerpt: `${wordCount} words, ceiling ${SECTION_WORD_CEILINGS[section.id]}`, severity: "hard" });
    }
  }

  // Total word count — v3: both floor and ceiling, tiered by k-anon level
  const totalWords = allProse.reduce((sum, t) => sum + countWords(t), 0);
  if (totalWords > TOTAL_WORD_CEILING) {
    violations.push({ rule: "total_word_ceiling", excerpt: `total ${totalWords}, ceiling ${TOTAL_WORD_CEILING}`, severity: "hard" });
  }
  const effectiveTotalFloor =
    input.aggregates.kAnonLevel === "zero" ? TOTAL_WORD_FLOOR_ZERO
    : input.aggregates.kAnonLevel === "thin" ? TOTAL_WORD_FLOOR_THIN
    : TOTAL_WORD_FLOOR_FULL;
  if (totalWords < effectiveTotalFloor) {
    violations.push({ rule: "total_word_floor", excerpt: `total ${totalWords}, floor ${effectiveTotalFloor} (kAnon=${input.aggregates.kAnonLevel})`, severity: "hard" });
  }

  // Cross-street invention check
  const diffPriorities = output.sections.find(s => s.id === "differentPriorities")?.paragraphs.join(" ") ?? "";
  const allowedShortNames = input.crossStreets.map(c => c.shortName);
  const candidatePhrases = extractCandidateStreetNames(diffPriorities);
  for (const phrase of candidatePhrases) {
    const isAllowed = allowedShortNames.some(s => phrase.includes(s))
      || phrase.includes(input.street.shortName)
      || phrase.includes(input.street.name)
      || input.neighbourhoods.some(n => phrase.includes(n))
      || KNOWN_MILTON_ANCHORS.some(a => phrase.includes(a));
    if (!isAllowed) {
      violations.push({
        rule: "invented_cross_street",
        sectionId: "differentPriorities",
        excerpt: phrase,
        severity: "hard",
      });
    }
  }

  // Builder at insufficient confidence
  const homesText = output.sections.find(s => s.id === "homes")?.paragraphs.join(" ") ?? "";
  if (input.primaryBuilder && input.primaryBuilder.confidence !== "high") {
    if (homesText.toLowerCase().includes(input.primaryBuilder.name.toLowerCase())) {
      violations.push({
        rule: "builder_without_high_confidence",
        sectionId: "homes",
        excerpt: `builder "${input.primaryBuilder.name}" named in prose at confidence=${input.primaryBuilder.confidence}`,
        severity: "hard",
      });
    }
  }

  // FAQ scan
  const faqText = output.faq.map(q => `${q.question} ${q.answer}`).join("\n");

  if (EM_DASH_CHARS.test(faqText)) {
    violations.push({ rule: "em_dash", excerpt: excerptAround(faqText, EM_DASH_CHARS), severity: "hard" });
  }
  const faqSale = findPrecisePrice(faqText);
  if (faqSale) violations.push({ rule: "precise_price", excerpt: `FAQ sale price "${faqSale}" violates rounding`, severity: "hard" });
  const faqRent = findPreciseRent(faqText);
  if (faqRent) violations.push({ rule: "precise_price", excerpt: `FAQ rent "${faqRent}" violates rounding`, severity: "hard" });
  for (const phrase of METHODOLOGY_LEAK_PHRASES) {
    const re = wordBoundaryRegex(phrase);
    if (re.test(faqText)) { violations.push({ rule: "methodology_leak", excerpt: excerptAround(faqText, re), severity: "hard" }); break; }
  }

  // v3: FAQ questions must match bank verbatim (dedicated rule)
  const allowedQuestions = new Set(
    FAQ_BANK_TEMPLATES.map(t => t.replace("{Street}", input.street.name))
  );
  for (const item of output.faq) {
    if (!allowedQuestions.has(item.question)) {
      violations.push({
        rule: "faq_question_out_of_bank",
        excerpt: `FAQ question not in bank: "${item.question}"`,
        severity: "hard",
      });
    }
  }

  // v3: FAQ answer length has its own rule
  for (const item of output.faq) {
    const sentenceCount = countSentences(item.answer);
    if (sentenceCount < FAQ_ANSWER_MIN_SENTENCES || sentenceCount > FAQ_ANSWER_MAX_SENTENCES) {
      violations.push({
        rule: "faq_answer_length",
        excerpt: `answer for "${item.question.slice(0,50)}..." has ${sentenceCount} sentences (allowed ${FAQ_ANSWER_MIN_SENTENCES}-${FAQ_ANSWER_MAX_SENTENCES})`,
        severity: "hard",
      });
    }
  }

  return violations;
}

// --- Helpers ---

function wordBoundaryRegex(phrase: string): RegExp {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i");
}

function excerptAround(text: string, pattern: RegExp): string {
  const match = pattern.exec(text);
  if (!match) return "";
  const idx = match.index;
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + match[0].length + 40);
  return "..." + text.slice(start, end) + "...";
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function countSentences(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const normalized = trimmed
    .replace(/\bSt\./g, "St")
    .replace(/\bMr\./g, "Mr")
    .replace(/\bMrs\./g, "Mrs")
    .replace(/\bMs\./g, "Ms")
    .replace(/\bDr\./g, "Dr")
    .replace(/\be\.g\./gi, "eg")
    .replace(/\bi\.e\./gi, "ie")
    .replace(/\bU\.S\./g, "US");
  const parts = normalized.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  return parts.length;
}

function extractCandidateStreetNames(text: string): string[] {
  const re = /\b(?:[A-Z][a-zA-Z'\-]+(?:\s+[A-Z][a-zA-Z'\-]+){1,4})\b/g;
  const hits = text.match(re) ?? [];
  const ignore = ["We ", "Our ", "If ", "When ", "Where ", "The ", "Milton ", "Toronto ", "Highway "];
  return hits.filter(h => !ignore.some(ig => h.startsWith(ig.trim())));
}

// --- Retry loop wrapper ---

export async function generateWithRetry(
  input: StreetGeneratorInput,
  callModel: (input: StreetGeneratorInput, priorViolations?: ValidatorViolation[]) => Promise<StreetGeneratorOutput>,
): Promise<{ output: StreetGeneratorOutput; attemptCount: 1 | 2 | 3; violations: ValidatorViolation[] }> {
  let lastViolations: ValidatorViolation[] = [];
  for (let attempt = 1; attempt <= 3; attempt++) {
    const output = await callModel(input, lastViolations.length ? lastViolations : undefined);
    const violations = validateStreetGeneration(output, input);
    if (violations.length === 0) {
      return { output, attemptCount: attempt as 1 | 2 | 3, violations: [] };
    }
    lastViolations = violations;
  }
  throw new StreetGenerationFailure(input.street.slug, lastViolations);
}

export class StreetGenerationFailure extends Error {
  constructor(public slug: string, public violations: ValidatorViolation[]) {
    super(`Street generation failed after 3 attempts for ${slug}. ${violations.length} violations.`);
  }
}

export function formatViolationsForRetry(violations: ValidatorViolation[]): string {
  const grouped: Record<string, ValidatorViolation[]> = {};
  for (const v of violations) {
    const key = v.sectionId ? `${v.rule}::${v.sectionId}` : v.rule;
    (grouped[key] ||= []).push(v);
  }
  const lines = ["Your previous output failed validation. Revise and return a new complete output addressing:"];
  for (const [, vs] of Object.entries(grouped)) {
    const first = vs[0];
    const location = first.sectionId ? ` in section "${first.sectionId}"` : "";
    const countNote = vs.length > 1 ? ` (and ${vs.length - 1} similar)` : "";
    lines.push(`- ${first.rule}${location}: ${first.excerpt}${countNote}`);
  }
  lines.push("", "Return the complete revised JSON. Do not include any prose commentary outside the JSON.");
  return lines.join("\n");
}
