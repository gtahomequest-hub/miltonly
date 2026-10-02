// src/components/home-design/links.ts
// MH-012, MH-013: the hero's links, chosen by intent. One list feeds both options, the report's link
// table (scratchpad/mh013/links.ts) and the preview check, so they cannot drift apart. The seller
// comes first: MH-013's bar is a homeowner finding the Selling door first.
//
// Every link names a task, never a kind of person: nothing here is chosen by age, family status,
// religion, origin or disability, and no row sends a group of people to a group of neighbourhoods.
// A target that does not exist yet is `planned`: the mockup draws it, marked, and it is not a link.
import { config } from "@/lib/config";

export type HeroSide = "sell" | "buy" | "invest" | "rent";
export type HeroCounts = { onMarket: number; newThisWeek: number; rentalsAvailable: number };

export type HeroTarget =
  | { kind: "page"; href: string }
  | { kind: "tel"; href: string }
  | { kind: "focus"; href: string }
  | { kind: "planned"; path: string };

export type HeroLink = {
  side: HeroSide;
  intent: string;
  role: "primary" | "row" | "door" | "line";
  label: string;
  detail: (c: HeroCounts) => string;
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
    side: "sell",
    intent: "home-value",
    role: "primary",
    label: "Get my home's value",
    detail: () => "A written report from Aamir, by email within 24 business hours.",
    target: { kind: "page", href: "/sell" },
    serves: "Owner deciding whether and when to sell: wants a number for their home.",
  },
  {
    side: "sell",
    intent: "own-street",
    role: "row",
    label: "Look up your own street",
    detail: () => "Its page opens with a valuation form, your street filled in",
    target: { kind: "focus", href: `#${SEARCH_INPUT_ID}` },
    serves: "Owner who starts from their own street: its page opens with a valuation form, the street prefilled.",
  },
  {
    side: "sell",
    intent: "sell-and-buy",
    role: "row",
    label: "Selling and buying at once",
    detail: () => "How to time the sale and the purchase together",
    target: { kind: "planned", path: "/sell-and-buy" },
    serves: "Owner moving within Milton: two transactions to time against each other.",
  },
  {
    side: "sell",
    intent: "call",
    role: "row",
    label: "Talk it through first",
    detail: () => `Call or text Aamir at ${PHONE}`,
    target: { kind: "tel", href: `tel:${PHONE_E164}` },
    serves: "Owner ready to speak to an agent now.",
  },
  {
    side: "buy",
    intent: "book-showing",
    role: "primary",
    label: "Book a showing",
    detail: () => "Your name and number, and Aamir calls to set a time.",
    target: { kind: "page", href: "/book?ref=%2F" },
    serves: "Ready to see a home: wants a time with an agent.",
  },
  {
    // MH-013: /listings has no "this week" filter, so the label now says what the page is: every
    // home for sale, newest first. The week's count stays in the detail, as a fact about that page.
    side: "buy",
    intent: "new-listings",
    role: "row",
    label: "Every home for sale, newest first",
    detail: (c) => `${n(c.onMarket)} in Milton today, ${n(c.newThisWeek)} of them listed in the last 7 days`,
    target: { kind: "page", href: "/listings" },
    serves: "Active searcher checking fresh inventory before a showing.",
  },
  {
    side: "buy",
    intent: "first-home",
    role: "row",
    label: "Buying your first home",
    detail: () => "Down payment, land transfer tax and the stress test",
    target: { kind: "page", href: "/guides/what-it-costs-to-buy-your-first-home-in-milton" },
    serves: "First-time buyer setting a budget before booking showings.",
  },
  {
    // Option C keeps it as the buyer's planned row (MH-012); option D gives it its own smaller door.
    side: "invest",
    intent: "investor",
    role: "door",
    label: "Investing",
    detail: () =>
      "Asking rents beside asking prices, by home type, from active listings. Leased rents and sold prices for signed-in readers.",
    target: { kind: "planned", path: "/invest" },
    serves: "Investor sizing a rental purchase: what homes ask in rent against what they ask to buy.",
  },
  {
    side: "rent",
    intent: "rentals",
    role: "line",
    label: "Renting instead?",
    detail: (c) => `${n(c.rentalsAvailable)} homes available to rent now`,
    target: { kind: "page", href: "/rentals" },
    serves: "Renter who arrived at a buy-or-sell page.",
  },
];

export const primaryOf = (side: "sell" | "buy") => HERO_LINKS.find((l) => l.side === side && l.role === "primary")!;
export const rowsOf = (side: "sell" | "buy") => HERO_LINKS.filter((l) => l.side === side && l.role === "row");
export const investDoor = HERO_LINKS.find((l) => l.side === "invest")!;
export const rentLine = HERO_LINKS.find((l) => l.side === "rent")!;

/** The data attributes GA4 will read: which side, which intent, and whether it is only planned. */
export function heroAttrs(l: Pick<HeroLink, "side" | "intent" | "target">) {
  return {
    "data-hero-side": l.side,
    "data-hero-intent": l.intent,
    ...(l.target.kind === "planned" ? { "data-hero-status": "planned" } : {}),
  } as Record<string, string>;
}
