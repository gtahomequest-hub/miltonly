// src/lib/comparisonData.ts
//
// THE COMPARE SEAM (composer-only — NO new data layer). A ComparisonConfig pairs
// TWO tenure dataSources; getComparisonData(cfg) resolves each side by calling
// the EXISTING getTenureHubData seam (FREEHOLD_CONFIG / CONDO_CONFIG) and returns
// two HubData objects -> two grounded, k-anon-gated columns. The flagship sources
// both sides live; drift is expected (read at request/build time, never hardcoded).
//
// CONFIG-DRIVEN: future comparisons (detached-vs-townhome, buy-vs-rent) are new
// configs, not new code. Each side carries its own tenureConfig + display copy.
// A null-stats side (future POTL pairs) degrades cleanly — getTenureHubData emits
// all-null compareFacts and the table renders silent cells (never $0/NaN).

import type { HubData } from "@/components/hub/types";
import {
  getTenureHubData,
  FREEHOLD_CONFIG,
  CONDO_CONFIG,
  type TenureConfig,
} from "@/lib/tenureHubData";

// ---- config contract -------------------------------------------------------

export interface CompareColumn {
  key: string; // "freehold"
  label: string; // "Freehold" — column header
  blurb: string; // one-line under the header
  href: string; // "/freehold" — the side's own hub
  hrefLabel: string; // "Explore freehold"
  tenureConfig: TenureConfig; // the dataSource — fed to getTenureHubData
}

export interface CompareTrade {
  name: string; // "Money"
  body: string;
}

export interface ComparisonConfig {
  slug: string; // "freehold-vs-condo"
  h1: string;
  eyebrow: string;
  metaTitle: string;
  metaDescription: string;
  breadcrumbLabel: string; // 3rd breadcrumb crumb
  sideA: CompareColumn;
  sideB: CompareColumn;
  lede: string;
  // {GAP} -> live "median A vs median B" fragment, injected by the composer.
  tableIntro: string;
  threeTradesIntro: string;
  trades: CompareTrade[];
  whoChooseA: { heading: string; body: string };
  whoChooseB: { heading: string; body: string };
  honestTradeoff: string;
  bottomLine: string;
  sectionTitles: { trades: string; choose: string; tradeoff: string; faq: string };
  // FAQ answers may carry a {GAP} token (Q2) -> same live median fragment.
  faqs: { question: string; answer: string }[];
  ctas: { label: string; sub: string; href: string }[];
}

// ---- the composer seam -----------------------------------------------------

export interface ComparisonData {
  cfg: ComparisonConfig;
  sideA: HubData | null;
  sideB: HubData | null;
}

export async function getComparisonData(cfg: ComparisonConfig): Promise<ComparisonData> {
  // 100% data reuse — both columns come from the tenure seam. Resolved in
  // parallel; each returns k-anon-gated HubData (with structured compareFacts).
  const [sideA, sideB] = await Promise.all([
    getTenureHubData(cfg.sideA.tenureConfig),
    getTenureHubData(cfg.sideB.tenureConfig),
  ]);
  return { cfg, sideA, sideB };
}

// ---------------------------------------------------------------------------
// FLAGSHIP CONFIG — Freehold vs Condo. Editorial verbatim from the approved
// blocks; the (live:) slots inject from each side's compareFacts at render.
// ---------------------------------------------------------------------------

export const FREEHOLD_VS_CONDO_CONFIG: ComparisonConfig = {
  slug: "freehold-vs-condo",
  h1: "Freehold vs. Condo in Milton — Which Is Right for You?",
  eyebrow: "Milton ownership comparison",
  metaTitle: "Freehold vs Condo in Milton — Which Should You Buy?",
  metaDescription:
    "Freehold vs condo in Milton: the honest side-by-side. Live median prices and the real price difference, monthly fees, the three trades, and a clear read on which to choose.",
  breadcrumbLabel: "Freehold vs Condo",
  sideA: {
    key: "freehold",
    label: "Freehold",
    blurb: "Own the home and the land — no monthly fee, full control.",
    href: "/freehold",
    hrefLabel: "Explore freehold",
    tenureConfig: FREEHOLD_CONFIG,
  },
  sideB: {
    key: "condo",
    label: "Condo",
    blurb: "Own your unit, pay a fee — someone else handles the building.",
    href: "/condos-guide",
    hrefLabel: "Explore condos",
    tenureConfig: CONDO_CONFIG,
  },
  lede:
    "Once you understand what freehold and condo ownership each mean, the hard part begins: deciding which fits your life, budget, and stage. This isn't a question of which is better — both are good ways to own a home in Milton, and the right answer is different for different people. What follows is the honest side-by-side: what each costs in Milton today, what you're really trading, and a clear read on who should choose which.",
  tableIntro:
    "The headline gap is price: {GAP}. That difference is the single biggest reason Milton buyers choose one over the other — a condo gets you into ownership at a price point freehold often can't match. But the sticker price isn't the whole cost, and the cheaper entry comes with a monthly fee and less control. The rest of this page is about whether that trade is right for you.",
  threeTradesIntro: "Strip away the details and the choice comes down to three trades.",
  trades: [
    {
      name: "Money — entry price vs. ongoing fee",
      body: "A condo costs less up front but carries a monthly fee for life; freehold costs more to buy but has no fee. Over years, neither is automatically cheaper — a low condo price with a high fee can cost more than a freehold over time, and a freehold owner who ignores maintenance can spend more than any fee. Run the all-in monthly number, not just the purchase price.",
    },
    {
      name: "Maintenance — your problem vs. theirs",
      body: "With freehold, the roof, furnace, lawn, and snow are yours to handle and pay for. With a condo, the corporation handles the building and grounds — you trade money and some control for never thinking about the roof. If your time and energy for upkeep are limited, the condo fee buys something real.",
    },
    {
      name: "Control — full vs. shared",
      body: "A freehold owner answers to no one; a condo owner is one vote among many, bound by the corporation's rules on everything from renovations to pets to rentals. Freehold is maximum autonomy; a condo trades some of that for shared, managed living.",
    },
  ],
  whoChooseA: {
    heading: "Who should choose freehold",
    body: "Freehold is the better fit if you want a yard, room to expand or renovate, full control over your property, and no recurring fee — and you're prepared to budget for your own maintenance and the occasional big repair. It tends to suit families sizing into detached homes, buyers planning to stay and put down roots, and anyone moving to Milton from elsewhere in the GTA for more house and land. If you see your home as something to shape over years and you'd rather not answer to a board, freehold is your side.",
  },
  whoChooseB: {
    heading: "Who should choose a condo",
    body: "A condo is the better fit if you want into Milton's market at a lower entry price, value predictable costs and low personal maintenance, or want a lock-and-leave home that doesn't tie you to a lawn and a snow shovel. It tends to suit first-time buyers, downsizers trading a house for simplicity, investors wanting a lower-maintenance rental, and anyone whose life is busy or mobile. If you'd rather pay a fee and never think about exterior upkeep, the condo is your side — just buy the building's financial health as carefully as the unit (a well-run corporation is everything).",
  },
  honestTradeoff:
    "The real risk on each side is different, and worth naming. Freehold's risk is deferred maintenance — \"no fee\" tempts owners to skip budgeting for repairs until a $15,000 roof arrives all at once. A condo's risk is the building, not the unit — a poorly run corporation with an underfunded reserve can hit you with a special assessment of tens of thousands, no matter how nice your unit is. The freehold buyer protects themselves with discipline (reserve for your own repairs); the condo buyer protects themselves with diligence (read the status certificate, buy a healthy building). Neither risk is a reason to avoid that side — they're reasons to go in clear-eyed.",
  bottomLine:
    "If maximum control, a yard, and no monthly fee matter most — and you'll budget for upkeep — freehold is your side. If lower entry cost, predictable expenses, and freedom from maintenance matter most — and you'll vet the building — a condo is your side. Most Milton buyers feel the pull of one over the other once they see the trade laid out plainly. If you're still between them, that's exactly the conversation worth having before you start touring.",
  sectionTitles: {
    trades: "The three trades",
    choose: "Which side is yours",
    tradeoff: "The honest tradeoff",
    faq: "Freehold vs condo questions",
  },
  faqs: [
    {
      question: "Is freehold or condo better in Milton?",
      answer:
        "Neither is universally better — freehold suits buyers wanting control, a yard, and no fee who'll budget for maintenance; condos suit buyers wanting a lower entry price, predictable costs, and low upkeep. The right choice depends on your stage, budget, and how hands-on you want to be.",
    },
    {
      question: "Why are condos cheaper than freehold in Milton?",
      answer:
        "Condos have a lower entry price because you own your unit and share the building/land rather than owning a full house and lot — but they carry a monthly fee freehold doesn't. {GAP} Compare the all-in monthly cost, not just the purchase price.",
    },
    {
      question: "What's the catch with a low condo fee?",
      answer:
        "A suspiciously low fee can mean an underfunded reserve — the corporation may not be saving enough for big future repairs, risking a special assessment later. Always read the status certificate before buying.",
    },
  ],
  ctas: [
    { label: "Talk to Aamir", sub: "Free, no-obligation conversation", href: "/sell" },
    { label: "Explore freehold", sub: "Freehold homes in Milton", href: "/freehold" },
    { label: "Explore condos", sub: "Condos in Milton", href: "/condos-guide" },
    { label: "Browse listings", sub: "Active Milton homes for sale", href: "/listings" },
  ],
};

// ---------------------------------------------------------------------------
// THE COMPARISON INDEX. /compare lists these as cards. For now the ONE live
// comparison; detached-vs-townhome / buy-vs-rent slot in as new configs + rows.
// ---------------------------------------------------------------------------

export interface ComparisonIndexEntry {
  slug: string; // "freehold-vs-condo" -> /compare/<slug>
  title: string; // card title
  blurb: string; // card body
  sideALabel: string;
  sideBLabel: string;
}

export const COMPARISONS: ComparisonIndexEntry[] = [
  {
    slug: FREEHOLD_VS_CONDO_CONFIG.slug,
    title: "Freehold vs. Condo",
    blurb:
      "The honest side-by-side: live Milton prices, monthly fees, the three trades, and a clear read on which to choose.",
    sideALabel: "Freehold",
    sideBLabel: "Condo",
  },
];
