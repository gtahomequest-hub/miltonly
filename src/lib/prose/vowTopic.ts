// THE VOW TOPIC FILTER (MC-046 Stage 1, rulings R1 and R2).
//
// Stored street, hub and condo prose was written from inputs that carried sold and leased
// aggregates. The numeric stripper (numericSentences.ts) removes every sentence with a figure,
// but a claim like "prices have firmed through the year" or "homes here move quickly" carries no
// digit and is still derived from VOW records. Regeneration is barred, so the render drops them.
//
// The rule is deliberately wide: a sentence (or an FAQ item) that speaks about price, sales,
// leases, rents, time to sell or the market is dropped from the visitor view, whether or not
// the particular claim came from a VOW figure. Losing a harmless sentence costs a line of copy;
// keeping a VOW-derived one is the finding a TRREB auditor would write up.

import { splitSentences } from "./sentences";

const VOW_TOPIC = new RegExp(
  [
    String.raw`\bsold\b`, String.raw`\bsell(?:s|ing|er|ers)?\b`, String.raw`\bsales?\b`, String.raw`\bresales?\b`, String.raw`\bresold\b`,
    String.raw`\bpric(?:e|es|ed|ing|ier|iest|ey)\b`, String.raw`\bvalu(?:e|es|ed|ation|ations)\b`, String.raw`\bworth\b`,
    String.raw`\bmarkets?\b`, String.raw`\bon market\b`, String.raw`\btime to sell\b`,
    String.raw`\bleas(?:e|es|ed|ing)\b`, String.raw`\brent(?:s|ed|al|als|ing)?\b`,
    String.raw`\bappreciat\w*`, String.raw`\bcomparables?\b`, String.raw`\bcomps\b`,
    String.raw`\bask(?:ing)?\b`, String.raw`\blist(?:ing)? price\b`, String.raw`\btypical(?:ly)?\b`, String.raw`\bmedian\b`, String.raw`\baverage\b`,
    String.raw`\btrad(?:e|es|ed|ing)\b`, String.raw`\bturnover\b`, String.raw`\bdemand\b`, String.raw`\bcompetitive\b`, String.raw`\bbidding\b`,
    String.raw`\boffers?\b`, String.raw`\bfirm(?:ed|ing|er)?\b`, String.raw`\bsoft(?:en|ened|ening|er)\b`, String.raw`\bcool(?:ed|ing)\b`,
    String.raw`\bquickly\b`, String.raw`\bmove fast\b`, String.raw`\bpremium\b`, String.raw`\bdiscount\b`, String.raw`\bafford\w*`, String.raw`\bexpensive\b`, String.raw`\bcheap\w*`,
    String.raw`\binvest(?:ment|ors?)?\b`, String.raw`\byields?\b`, String.raw`\breturns?\b`,
  ].join("|"),
  "i",
);

/** True when a sentence, question or answer speaks about price, sales, leases, rents or the market. */
export function mentionsVowTopic(text: string | null | undefined): boolean {
  return !!text && VOW_TOPIC.test(text);
}

/** Drop every sentence that speaks about a VOW topic; returns what is left, trimmed. */
export function stripVowTopicSentences(text: string | null | undefined): string {
  if (!text) return "";
  return splitSentences(text)
    .filter((s) => !mentionsVowTopic(s))
    .join(" ")
    .trim();
}

/** Paragraph form: each paragraph filtered, empty ones dropped. */
export function stripVowTopicParagraphs(paragraphs: string[]): string[] {
  return paragraphs.map(stripVowTopicSentences).filter((p) => p.length > 0);
}

/** An FAQ item stays only if neither its question nor its answer speaks about a VOW topic. */
export function isVowTopicFaq(question: string, answer: string): boolean {
  return mentionsVowTopic(question) || mentionsVowTopic(answer);
}
