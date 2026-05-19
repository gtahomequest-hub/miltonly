// Shared TypeScript types for /about page components. Section components
// stay parameterized — they accept props of these shapes, never read
// config directly — so the same component file composes the Milton
// /about today and a Homesly fork (Oakville, Mississauga, Brampton,
// Toronto) tomorrow with a different config.

export interface Stat {
  /** Tile label, e.g. "closed", "transactions", "years in Milton". */
  label: string;
  /** Display value. String so $X.XM, X.X★, plain counts all fit one slot. */
  value: string;
  /** Optional sub-line, e.g. review count under a rating. */
  sub?: string;
}

export interface Testimonial {
  /** Customer name in "First L." format. PIPEDA-compliant per consent log. */
  customerName: string;
  /** Star rating 1-5. */
  rating: 1 | 2 | 3 | 4 | 5;
  /** Quote text, target ≤30 words. */
  quote: string;
  /** Outcome line with specific numbers, e.g. "Sold in 11 days, $42K over asking". */
  outcome: string;
  /** Month + year, e.g. "March 2025". */
  date: string;
}

export interface PressLogo {
  alt: string;
  src: string;
  href?: string;
}

export interface ProcessStep {
  title: string;
  body: string;
}

export type AudienceId = "buyers" | "tenants" | "landlords";

export interface Audience {
  id: AudienceId;
  tabLabel: string;
  steps: [ProcessStep, ProcessStep, ProcessStep];
}

export interface IntentOption {
  /** Value submitted to /api/leads (e.g. "buying", "selling"). */
  value: string;
  /** Visible label, e.g. "Buying a home". */
  label: string;
}

export interface FAQItem {
  /** Stable id for the GA4 faq_expand event param + Schema.org Question id. */
  id: string;
  question: string;
  answer: string;
}

export interface CallToAction {
  label: string;
  href: string;
  /** GA4 event name fired on click. Tracked via _tracking.ts ABOUT_EVENTS. */
  eventName?: string;
}

export interface GoogleReviewsSnapshot {
  /** 1-5 rating, e.g. 4.9. Null until A5 confirmed. */
  score: number | null;
  /** Review count. Null until A5 confirmed. */
  count: number | null;
}
