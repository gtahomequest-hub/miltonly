// One scoring rule, reproducing every score the four old branches produced.
//
// The monolith scored in four places. Three of them agreed by accident and the fourth did
// not: the generic path gave 30 points for a phone and 0 without one, on a scale where every
// other branch used 25/50/75, so a homepage lead and an ads lead with identical contact
// details sorted differently in the same admin list. The rule below is the one the three
// paid branches used, stated once:
//
//   hot   a seller, or a pre-approved buyer with a timeline inside three months
//   warm  reachable by phone
//   cold  an email address and nothing else
//
// Scoring on the NORMALIZED intent is what makes it one rule. "seller", "home-valuation" and
// "list-rental" are the same economic event and all three now score the same.

import type { LeadIntent } from "@/lib/leads";

export type LeadScore = "hot" | "warm" | "cold";

const NEAR_TERM = new Set(["asap", "1month", "1-3months", "within 1 month", "1–3 months"]);

export interface ScoreInput {
  /** The normalized bucket, not the raw token the form sent. */
  intent: LeadIntent;
  hasPhone: boolean;
  /** "yes" | "no" | undefined, as the surface collected it. */
  preApproved?: string | null;
  timeline?: string | null;
}

export interface LeadScoring {
  score: LeadScore;
  points: number;
  /** Lead.leadTemperatureAtSubmit — the same verdict, in the admin column's spelling. */
  temperature: "Hot" | "Warm" | "Cold";
}

export function scoreLead(input: ScoreInput): LeadScoring {
  const timeline = (input.timeline ?? "").trim().toLowerCase();
  const preApproved = (input.preApproved ?? "").trim().toLowerCase() === "yes";
  const nearTerm = NEAR_TERM.has(timeline);

  if (input.intent === "sell") return { score: "hot", points: 75, temperature: "Hot" };
  if (preApproved && nearTerm) return { score: "hot", points: 75, temperature: "Hot" };
  if (input.hasPhone) return { score: "warm", points: 50, temperature: "Warm" };
  return { score: "cold", points: 25, temperature: "Cold" };
}
