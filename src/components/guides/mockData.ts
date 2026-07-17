// src/components/guides/mockData.ts
// Mirrors GuidesIndexData / GuideArticleData. Data window replaces with
// getGuidesIndexData() and getGuideArticle(slug).
import type { GuidesIndexData, GuideArticleData, GuideTeaser } from './types';

const t = (
  slug: string,
  title: string,
  dek: string,
  category: GuideTeaser['category'],
  categoryLabel: string,
  readMinutes: number,
): GuideTeaser => ({ slug, title, dek, category, categoryLabel, readMinutes, updated: 'May 2026' });

const firstTimeBuyer = t(
  'first-time-buyer-milton',
  'The first-time buyer’s playbook for Milton',
  'From pre-approval to keys: every step, every cost, and the mistakes that cost Milton buyers the most.',
  'buying',
  'Buying',
  14,
);
const howOffersWork = t(
  'how-offers-work-halton',
  'How offers actually work in Halton',
  'Bully offers, conditions, deposits, and what “firm” really commits you to.',
  'buying',
  'Buying',
  9,
);
const preConVsResale = t(
  'pre-construction-vs-resale',
  'Pre-construction vs. resale in Milton',
  'Why the discount isn’t free: assignment rules, development charges, and delayed closings.',
  'buying',
  'Buying',
  11,
);
const choosingNbhd = t(
  'choosing-a-neighbourhood',
  'Choosing a Milton neighbourhood',
  'Old Milton charm vs. new-build space: how commute, schools, and budget actually trade off.',
  'living',
  'Living',
  12,
);

export const mockGuidesIndex: GuidesIndexData = {
  heading: 'Know the move before you make it.',
  sub: 'Plain-English guides to buying, selling, renting, and living in Milton — written from the ground here, not syndicated from a content farm.',
  stats: [
    { n: '11', l: 'guides' },
    { n: '4', l: 'topics' },
    { n: 'May 2026', l: 'last updated' },
  ],
  featured: firstTimeBuyer,
  categories: [
    {
      key: 'buying',
      label: 'Buying in Milton',
      blurb: 'Get in right',
      guides: [firstTimeBuyer, howOffersWork, preConVsResale],
    },
    {
      key: 'selling',
      label: 'Selling your home',
      blurb: 'Leave nothing on the table',
      guides: [
        t(
          'pricing-strategy-milton',
          'Pricing a Milton home in a shifting market',
          'Anchor too high and you chase the market down. How list price actually drives your final number.',
          'selling',
          'Selling',
          10,
        ),
        t(
          'staging-what-matters',
          'Staging: what actually moves the needle',
          'Where staging dollars return and where they evaporate — room by room.',
          'selling',
          'Selling',
          7,
        ),
        t(
          'seller-closing-costs',
          'What it really costs to sell',
          'Commission, legal, mortgage discharge, and the bridge-financing trap between two closings.',
          'selling',
          'Selling',
          8,
        ),
      ],
    },
    {
      key: 'renting',
      label: 'Renting & investing',
      blurb: 'Lease smart, both sides',
      guides: [
        t(
          'tenants-guide-milton',
          'A tenant’s guide to renting in Milton',
          'What landlords can and can’t ask, typical deposits, and how to compete for a good unit.',
          'renting',
          'Renting',
          8,
        ),
        t(
          'leasing-your-condo',
          'Leasing out your Milton condo',
          'Building rules, realistic yield math, and screening that protects you under Ontario’s LTB.',
          'renting',
          'Renting',
          10,
        ),
      ],
    },
    {
      key: 'living',
      label: 'Living in Milton',
      blurb: 'Settle in',
      guides: [
        choosingNbhd,
        t(
          'go-train-commuters-guide',
          'The GO commuter’s guide',
          'Living in Milton and working downtown: line realities, parking, and what proximity is worth.',
          'living',
          'Living',
          6,
        ),
        t(
          'schools-and-catchments',
          'Schools and catchments, demystified',
          'How catchment boundaries work in Halton and what to verify before you waive conditions.',
          'living',
          'Living',
          9,
        ),
      ],
    },
  ],
  ctaBuyer: {
    heading: 'Ready to start looking?',
    body: 'Reading is the easy part. When you want eyes on actual Milton listings, I’m here.',
    buttonLabel: 'Start your search',
    href: '/listings',
  },
  ctaSeller: {
    heading: 'Thinking of selling?',
    body: 'Get a grounded valuation built on real Milton comparables — not a postal-code algorithm.',
    buttonLabel: 'Value my home',
    href: '/sell',
  },
};

export const mockGuideArticle: GuideArticleData = {
  slug: 'first-time-buyer-milton',
  title: 'The first-time buyer’s playbook for Milton',
  dek: 'From pre-approval to keys: every step, every cost, and the mistakes that cost Milton buyers the most.',
  category: { key: 'buying', label: 'Buying' },
  readMinutes: 14,
  updated: 'May 2026',
  takeaways: [
    'Get a true pre-approval — a rate hold is not the same thing — before you book a single showing.',
    'Budget roughly 1.5–4% of the purchase price for closing costs on top of your down payment.',
    'First-time buyers in Milton compete hardest in the townhouse segment — set your walk-away number before offer night, not during it.',
    'A financing condition is protection, not weakness. Going firm without one is a decision you only get to make once.',
  ],
  sections: [
    {
      heading: 'Start with the number, not the house',
      paragraphs: [
        'Most first-time buyers do this backwards: they fall for a house, then scramble to find out whether they can afford it. By the time the lender answers, the house is gone — or worse, it isn’t, and the financing falls apart with a deposit on the line.',
        'A genuine pre-approval means a lender has verified your income, your debts, and your credit, and committed to a number. It tells you what you can actually spend, locks a rate while you shop, and signals to sellers that your offer will close. In a competitive segment, that signal has real value.',
      ],
      tip: 'A pre-qualification is an estimate based on what you tell the lender. A pre-approval is a commitment based on what they verify. Listing agents know the difference — make sure you have the second one.',
    },
    {
      heading: 'Where a first budget goes furthest',
      paragraphs: [
        'Milton’s entry point for most first-time buyers is the townhouse — freehold if the budget reaches, condo townhouse if it doesn’t. Detached homes in the established neighbourhoods carry a premium; newer phases trade a longer commute for more square footage per dollar.',
        'The honest trade-off is rarely house vs. no house — it’s location vs. space vs. condition. Decide which of the three you’ll compromise on before you start touring, because touring has a way of deciding for you.',
      ],
      tip: null,
    },
    {
      heading: 'The offer: conditions are not weakness',
      paragraphs: [
        'When a listing draws multiple offers, you’ll feel pressure to drop conditions — financing, inspection, sometimes both. Understand exactly what that means: a firm offer is a binding commitment to close, whether or not your lender comes through, whether or not the furnace is original.',
        'There are situations where going firm is a calculated, informed risk. There are far more where it’s a panic response to losing the last three offers. The deposit — typically due within 24 hours of acceptance — is what you stand to lose first, and it is rarely the full extent of the damage.',
      ],
      tip: 'Your deposit is usually payable within 24 hours of acceptance and counts toward your down payment at closing. Have it liquid — a bank draft from investments takes longer than offer night gives you.',
    },
    {
      heading: 'Closing costs nobody warns you about',
      paragraphs: [
        'The down payment is the number everyone plans for. The closing costs are the ones that surprise people: Ontario land transfer tax, legal fees and disbursements, title insurance, a lender appraisal, and the adjustments that reimburse the seller for prepaid property tax or utilities.',
        'Plan for roughly 1.5–4% of the purchase price, all-in, due at closing. Qualifying first-time buyers get a rebate of up to $4,000 on Ontario’s land transfer tax, which meaningfully softens the hit at Milton’s typical entry prices — but it doesn’t erase it.',
      ],
      tip: 'Milton has no municipal land transfer tax — that second tax is a Toronto-only cost. Buying here instead of Toronto saves you the entire second LTT bill.',
    },
  ],
  faqs: [
    {
      question: 'How much do I need for a down payment?',
      answer:
        'The federal minimum is 5% on the first $500,000 of the price and 10% on the portion above that, for homes under $1.5 million. Below 20% down you’ll also pay mortgage default insurance, which is added to the loan rather than paid in cash.',
    },
    {
      question: 'Do first-time buyers get a break on land transfer tax?',
      answer:
        'Yes — Ontario rebates up to $4,000 of provincial land transfer tax for qualifying first-time buyers. Milton has no municipal land transfer tax, so unlike Toronto there is no second LTT bill to rebate.',
    },
    {
      question: 'Should I waive the home inspection to win an offer?',
      answer:
        'Sometimes buyers pre-inspect before offer night, which keeps the protection without the condition. Waiving inspection entirely on an older home is a real risk; on a newer build with Tarion coverage the calculus is different. It’s a judgement call — make it deliberately, not under pressure.',
    },
  ],
  related: [howOffersWork, preConVsResale, choosingNbhd],
  ctaBuyer: {
    heading: 'Ready to put this to work?',
    body: 'A guide gets you oriented. A first conversation gets you a plan built around your actual numbers.',
    buttonLabel: 'Start your search',
    href: '/listings',
  },
  ctaSeller: {
    heading: 'Have a home to sell first?',
    body: 'Buying and selling at the same time is its own puzzle. Let’s sequence it properly.',
    buttonLabel: 'Value my home',
    href: '/sell',
  },
};

export default mockGuidesIndex;