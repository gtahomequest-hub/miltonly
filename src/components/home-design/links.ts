// src/components/home-design/links.ts
// MH-012: the hero's links, chosen by intent. One list feeds all three options, the report's link
// table (scratchpad/mh012/links.ts) and the preview check, so the three cannot drift apart.
//
// Every link names a task, never a kind of person: nothing here is chosen by age, family status,
// religion, origin or disability, and no row sends a group of people to a group of neighbourhoods.
// A target that does not exist yet is `planned`: the mockup draws it, marked, and it is not a link.
import { config } from "@/lib/config";

export type HeroSide = "buy" | "sell" | "rent";
export type HeroCounts = { onMarket: number; newThisWeek: number; rentalsAvailable: number };

export type HeroTarget =
  | { kind: "page"; href: string }
  | { kind: "tel"; href: string }
  | { kind: "focus"; href: string }
  | { kind: "planned"; path: string };

export type HeroLink = {
  side: HeroSide;
  intent: string;
  role: "primary" | "row" | "line";
  /** what the visitor reads on options A and C */
  label: string;
  /** option B's sentence ending, after "I'm buying" or "I'm selling" */
  sentence: string;
  /** the action words option B prints after the sentence */
  action: string;
  detail: (c: HeroCounts) => string;
  badge?: (c: HeroCounts) => string;
  target: HeroTarget;
  /** the intent, in a sentence, for the report */
  serves: string;
};

const PHONE = config.realtor.phone;
const PHONE_E164 = config.realtor.phoneE164;
const n = (v: number) => v.toLocaleString("en-CA");

export const SEARCH_INPUT_ID = "hd-q";

export const HERO_LINKS: HeroLink[] = [
  {
    side: "buy",
    intent: "book-showing",
    role: "primary",
    label: "Book a showing",
    sentence: "and want to see a home",
    action: "Book a showing",
    detail: () => "Your name and number, and Aamir calls to set a time.",
    target: { kind: "page", href: "/book?ref=%2F" },
    serves: "Ready to see a home: wants a time with an agent.",
  },
  {
    side: "buy",
    intent: "new-listings",
    role: "row",
    label: "Homes listed this week",
    sentence: "and want what is new",
    action: "Homes listed this week",
    detail: (c) => `${n(c.onMarket)} for sale today, newest first`,
    badge: (c) => `${n(c.newThisWeek)} new`,
    target: { kind: "page", href: "/listings" },
    serves: "Active searcher checking fresh inventory before a showing.",
  },
  {
    side: "buy",
    intent: "first-home",
    role: "row",
    label: "Buying your first home",
    sentence: "my first home",
    action: "What it costs here",
    detail: () => "Down payment, land transfer tax and the stress test",
    target: { kind: "page", href: "/guides/what-it-costs-to-buy-your-first-home-in-milton" },
    serves: "First-time buyer setting a budget before booking showings.",
  },
  {
    side: "buy",
    intent: "investor",
    role: "row",
    label: "Buying to rent it out",
    sentence: "to rent it out",
    action: "Rents beside prices",
    detail: () => "Asking rents beside asking prices, by home type",
    target: { kind: "planned", path: "/invest" },
    serves: "Investor sizing a rental purchase against what homes ask in rent.",
  },
  {
    side: "sell",
    intent: "home-value",
    role: "primary",
    label: "Get my home's value",
    sentence: "and want a price",
    action: "Get my home's value",
    detail: () => "A written report from Aamir, by email within 24 business hours.",
    target: { kind: "page", href: "/sell" },
    serves: "Owner deciding whether and when to sell: wants a number for their home.",
  },
  {
    side: "sell",
    intent: "own-street",
    role: "row",
    label: "Look up your own street",
    sentence: "and want to see my street first",
    action: "Look up my street",
    detail: () => "Its page opens with a valuation form, your street filled in",
    target: { kind: "focus", href: `#${SEARCH_INPUT_ID}` },
    serves: "Owner who starts from their own street: its page opens with a valuation form, the street prefilled.",
  },
  {
    side: "sell",
    intent: "sell-and-buy",
    role: "row",
    label: "Selling and buying at once",
    sentence: "and buying my next one",
    action: "Line up both closings",
    detail: () => "How to time the sale and the purchase together",
    target: { kind: "planned", path: "/sell-and-buy" },
    serves: "Owner moving within Milton: two transactions to time against each other.",
  },
  {
    side: "sell",
    intent: "call",
    role: "row",
    label: "Talk it through first",
    sentence: "and would rather talk first",
    action: `Call or text ${PHONE}`,
    detail: () => `Call or text Aamir at ${PHONE}`,
    target: { kind: "tel", href: `tel:${PHONE_E164}` },
    serves: "Owner ready to speak to an agent now.",
  },
  {
    side: "rent",
    intent: "rentals",
    role: "line",
    label: "Renting instead?",
    sentence: "",
    action: "Homes for rent",
    detail: (c) => `${n(c.rentalsAvailable)} homes available to rent now`,
    target: { kind: "page", href: "/rentals" },
    serves: "Renter who arrived at a buy-or-sell page.",
  },
];

export const sideLinks = (side: HeroSide) => HERO_LINKS.filter((l) => l.side === side);
export const primaryOf = (side: HeroSide) => HERO_LINKS.find((l) => l.side === side && l.role === "primary")!;
export const rowsOf = (side: HeroSide) => HERO_LINKS.filter((l) => l.side === side && l.role === "row");
export const rentLine = HERO_LINKS.find((l) => l.side === "rent")!;

/** The data attributes GA4 will read: which side, which intent, and whether it is only planned. */
export function heroAttrs(l: Pick<HeroLink, "side" | "intent" | "target">) {
  return {
    "data-hero-side": l.side,
    "data-hero-intent": l.intent,
    ...(l.target.kind === "planned" ? { "data-hero-status": "planned" } : {}),
  } as Record<string, string>;
}
