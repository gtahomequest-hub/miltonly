// src/types/street-generator.ts
// Schema contract between generateStreet.ts and DescriptionBody component.

export type StreetSectionId =
  | "about"
  | "homes"
  | "amenities"
  | "market"
  | "gettingAround"
  | "schools"
  | "bestFitFor"
  | "differentPriorities";

export interface StreetSection {
  id: StreetSectionId;
  heading: string;
  paragraphs: string[];
}

export interface StreetFAQItem {
  question: string;
  answer: string;
}

export interface StreetGeneratorOutput {
  sections: StreetSection[];    // length = 8, ordered per canonical sequence
  faq: StreetFAQItem[];         // length 6-8
}

// --- Validation-facing augment (persisted alongside output, not returned by model) ---

export interface StreetGenerationMeta {
  model: "claude-opus-4-7";
  generatedAt: string;          // ISO
  inputHash: string;            // sha256 of StreetGeneratorInput for drift detection
  attemptCount: 1 | 2 | 3;
  validatorPassed: boolean;
  validatorViolations: ValidatorViolation[];  // empty if passed
  wordCounts: Record<StreetSectionId, number>;
  totalWords: number;
}

export interface ValidatorViolation {
  rule: ValidatorRule;
  sectionId?: StreetSectionId;
  excerpt: string;              // the offending substring, ~80 chars window
  severity: "hard" | "soft";    // hard = always retry; soft = retry only if other hard fails
}

export type ValidatorRule =
  | "em_dash"
  | "superlative"
  | "cliche_opener"
  | "methodology_leak"
  | "hedging_builder"
  | "precise_price"
  | "invented_cross_street"
  | "builder_without_high_confidence"
  | "section_word_floor"
  | "section_word_ceiling"
  | "total_word_floor"
  | "total_word_ceiling"
  | "missing_section_id"
  | "heading_out_of_bank"
  | "faq_count_out_of_range"
  | "faq_answer_length"
  | "faq_question_out_of_bank"
  | "invalid_json_shape";

// --- Frontend contract (what DescriptionBody consumes) ---

export interface DescriptionBodyProps {
  sections: StreetSection[];                    // all 8, frontend filters as needed
  faq: StreetFAQItem[];
}
