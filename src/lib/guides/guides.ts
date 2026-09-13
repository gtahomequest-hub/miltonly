// src/lib/guides/guides.ts
//
// THE GUIDES REGISTRY, AND THE SIX FIGURE-GROUNDED BUILDERS. Template-authored
// structure, live grounded figures (ruling 2, 2026-09-10). No model writes any
// sentence in this file. The only generated prose a guide may carry is one
// optional paragraph, and that is validated by
// src/lib/content/validateContentProse.ts and dropped on any violation.
//
// ORDER IS THE GSC EVIDENCE'S ORDER (ruling 8): milton real estate market,
// sold prices milton, is it a good time to sell, condos in milton, first-time
// buyer, schools. Then the two source-grounded guides (MCT-001, 2026-09-11):
// parking, which was held while the Town's bylaw pages were not in this repo
// (report 062, G7) and is built from their fetched text now that they are
// (src/data/sources/milton-parking/), and the GO train guide, computed from a
// stored GTFS feed (src/data/sources/goGtfsMilton.ts). Their builders live in
// ./parking.ts and ./goTransit.ts; the registry row is here so the index, the
// sitemap and the uplinks all read one list.
//
// THE ONE DISCIPLINE THAT MATTERS HERE. A sentence that needs a suppressed
// figure is DROPPED WHOLE. It is never rendered with a gap, a dash, a zero or
// a hedge. `sentence()` returns null when its figure is null and `para()`
// discards nulls, so suppression removes prose rather than damaging it.

import "server-only";
import { config } from "@/lib/config";
import type { GuideFaq, GuideSection, GuideTeaser } from "@/components/guides/types";
import type { GroundedFigures } from "@/lib/content/groundedFigures";
import {
  getSoldFigures,
  getActiveCondoFees,
  getActiveSupply,
  getSchoolRows,
  minimumDownPayment,
  BOC_POLICY_RATE,
  fig,
  type CondoFeeRow,
  type SchoolRow,
} from "./figures";
import { policyRateLabel } from "@/data/policyRate";
import {
  monthlyPayment,
  ontarioLTT,
  cmhcPremium,
  stressTestRate,
  formatMoney,
} from "@/lib/mortgage-math";

import { GUIDES_UPDATED, CTA_BUYER, CTA_SELLER, readMinutes, type GuideDef, type BuiltGuide } from "./shared";
import { buildParking } from "./parking";
import { buildGoTrain } from "./goTransit";

const CITY = config.CITY_NAME;
export { GUIDES_UPDATED };
export type { GuideDef, BuiltGuide };

// ── prose plumbing ────────────────────────────────────────────────────────

/** A sentence that exists only when its figure does. */
function sentence(value: unknown, text: string): string | null {
  return value === null || value === undefined || value === "" ? null : text;
}
function para(...sentences: Array<string | null>): string | null {
  const kept = sentences.filter(Boolean) as string[];
  return kept.length ? kept.join(" ") : null;
}
function paras(...ps: Array<string | null>): string[] {
  return ps.filter(Boolean) as string[];
}

// ── the registry ──────────────────────────────────────────────────────────

export const GUIDE_DEFS: GuideDef[] = [
  {
    slug: "what-milton-neighbourhoods-cost",
    title: `What each ${CITY} neighbourhood costs`,
    dek: `Typical sold prices by neighbourhood and by housing form, drawn from the same figures each neighbourhood page shows.`,
    category: "buying",
    categoryLabel: "Buying",
    gscQuery: "milton real estate market",
    metaTitle: `What Each ${CITY} Neighbourhood Costs`,
    metaDescription: `Typical sold prices across ${CITY} by neighbourhood and housing form, over the trailing 12 months, with the sample size behind every figure.`,
  },
  {
    slug: "how-to-read-a-milton-sold-price",
    title: `How to read a ${CITY} sold price`,
    dek: `Typical against average, the middle-half band, days on market and sold-to-ask, and why a range needs more sales behind it than a midpoint.`,
    category: "buying",
    categoryLabel: "Buying",
    gscQuery: "sold prices milton",
    metaTitle: `How to Read a ${CITY} Sold Price`,
    metaDescription: `What a typical sold price does and does not tell you in ${CITY}, how a middle-half band is built, and why some figures are withheld.`,
  },
  {
    slug: "is-it-a-good-time-to-sell-in-milton",
    title: `Is it a good time to sell in ${CITY}?`,
    dek: `What the last four quarters, the current supply and the sold-to-ask figure actually show, with no forecast attached.`,
    category: "selling",
    categoryLabel: "Selling",
    gscQuery: "is it a good time to sell",
    metaTitle: `Is It a Good Time to Sell in ${CITY}?`,
    metaDescription: `The trailing quarters, days on market, sold-to-ask and live supply in ${CITY}, stated as a record of what has happened rather than a prediction.`,
  },
  {
    slug: "milton-condo-fees-parking-and-lockers",
    title: `${CITY} condo fees, parking and lockers`,
    dek: `What monthly fees, parking and lockers are stated on condos for sale in ${CITY} right now, listing by listing.`,
    category: "living",
    categoryLabel: "Everyday life",
    gscQuery: "condos in milton",
    metaTitle: `${CITY} Condo Fees, Parking and Lockers`,
    metaDescription: `Monthly maintenance fees, parking and locker details as stated on ${CITY} condo listings currently for sale, with a link to each listing.`,
  },
  {
    slug: "what-it-costs-to-buy-your-first-home-in-milton",
    title: `What it costs to buy your first home in ${CITY}`,
    dek: `Down payment, land transfer tax, mortgage insurance and the stress test, worked against ${CITY} prices.`,
    category: "buying",
    categoryLabel: "Buying",
    gscQuery: "first-time buyer",
    metaTitle: `What It Costs to Buy Your First Home in ${CITY}`,
    metaDescription: `Minimum down payment, Ontario land transfer tax, CMHC premium and the stress test, worked against typical ${CITY} sold prices.`,
  },
  {
    slug: "milton-schools-what-the-data-shows",
    title: `${CITY} schools, and what this data can tell you`,
    dek: `Every ${CITY} school on this site with its board, level and grades, and a plain statement of what the data does not cover.`,
    category: "living",
    categoryLabel: "Everyday life",
    gscQuery: "schools",
    metaTitle: `${CITY} Schools by Board and Grade`,
    metaDescription: `${CITY} schools listed with board, level and grades. Placement is set by the school boards, and this page says plainly what it cannot tell you.`,
  },
  {
    slug: "parking-in-milton",
    title: `Parking in ${CITY}: the rules, the permits and the tickets`,
    dek: `On-street limits, the overnight ban, winter suspensions, exceptions and permits, and where to check a ticket, each sentence read from the Town's own pages and dated.`,
    category: "living",
    categoryLabel: "Everyday life",
    gscQuery: "parking",
    metaTitle: `Parking in ${CITY}: Rules, Overnight, Winter, Permits and Tickets`,
    metaDescription: `${CITY}'s five-hour street limit, the 2 to 6 a.m. rule, winter storm suspensions, parking exceptions and park permits, and where to pay or dispute a ticket, cited to the Town's pages with the date they were read.`,
  },
  {
    slug: "milton-go-train-to-toronto",
    title: `Getting to Toronto from ${CITY} GO`,
    dek: `Every weekday train to Union and back, the first and last, how long it takes, what runs at the weekend, and the buses that fill the gaps, computed from GO Transit's published timetable feed.`,
    category: "living",
    categoryLabel: "Everyday life",
    gscQuery: "milton go train",
    metaTitle: `${CITY} GO to Union Station: Trains, Times and Buses`,
    metaDescription: `Weekday and weekend departures from ${CITY} GO to Union Station, first and last train, journey time, the 21 bus and the other routes, from the GO Transit GTFS feed with its version and validity dates.`,
  },
];

export const GUIDE_SLUGS = GUIDE_DEFS.map((g) => g.slug);

// ── builders ──────────────────────────────────────────────────────────────

function teaserFor(def: GuideDef, minutes: number): GuideTeaser {
  return {
    slug: def.slug,
    title: def.title,
    dek: def.dek,
    category: def.category,
    categoryLabel: def.categoryLabel,
    readMinutes: minutes,
    updated: GUIDES_UPDATED,
  };
}

const money = (n: number | null): string | null => (n === null ? null : formatMoney(n));

// ── G1 · what each neighbourhood costs ────────────────────────────────────

async function buildNeighbourhoodCosts(def: GuideDef): Promise<BuiltGuide> {
  const { data, bundle } = await getSoldFigures();
  const o = data.overall;
  const priced = data.byNeighbourhood.filter((n) => n.typicalPrice !== null);
  const suppressed = data.byNeighbourhood.filter((n) => n.typicalPrice === null);
  const forms = data.byType.filter((t) => t.medianPrice !== null);

  const sections: GuideSection[] = [
    {
      heading: "The town-wide figure first",
      paragraphs: paras(
        para(
          sentence(o.count, `${CITY} recorded ${o.count} sales over the trailing 12 months.`),
          sentence(o.medianPrice, `The typical sold price across all of them was ${money(o.medianPrice)}.`),
          sentence(
            o.bandLow !== null && o.bandHigh !== null ? true : null,
            `The middle half of those sales landed between ${money(o.bandLow)} and ${money(o.bandHigh)}, which is a more useful shape than a single number because it shows how wide the market actually is.`,
          ),
        ),
        para(
          `A town-wide figure is the wrong tool for a specific question. ${CITY} covers everything from a condo apartment to a rural acreage, and one typical price averages across all of it.`,
          `The neighbourhood table below is the level most buyers actually shop at.`,
        ),
      ),
      tip: `Every figure on this page covers completed sales over the trailing 12 months, and stops at today. Listings currently for sale are a different question and live on the listings pages.`,
    },
    {
      heading: "By neighbourhood",
      paragraphs: paras(
        para(
          sentence(priced.length, `${priced.length} ${CITY} neighbourhoods have enough recorded sales over the last year to publish a typical price.`),
          sentence(
            suppressed.length ? true : null,
            `${suppressed.length} do not, and are listed with their sale count only.`,
          ),
          `A figure withheld is withheld because too few homes sold there for a price to describe a market rather than a handful of houses.`,
        ),
        para(
          `Each neighbourhood name links to its own page, where the same figure is computed the same way. The two will not disagree.`,
        ),
      ),
      tip: null,
    },
    {
      heading: "By housing form",
      paragraphs: paras(
        para(
          sentence(forms.length, `Across ${CITY}, ${forms.length} of the four housing forms have enough sales over the year to carry a typical price.`),
          ...forms.map((t) => `${t.label}: ${money(t.medianPrice)} across ${t.count} sales.`),
        ),
        para(
          `Form explains more of the spread than neighbourhood does. A detached house and a condo apartment in the same postal code are not competing for the same buyer, and averaging them together produces a number that describes neither.`,
        ),
      ),
      tip: null,
    },
  ];

  const faqs: GuideFaq[] = [
    {
      question: `Which ${CITY} neighbourhood is cheapest?`,
      answer: priced.length
        ? `Over the trailing 12 months the lowest published typical price belongs to ${
            [...priced].sort((a, b) => (a.typicalPrice as number) - (b.typicalPrice as number))[0].name
          }, at ${money([...priced].sort((a, b) => (a.typicalPrice as number) - (b.typicalPrice as number))[0].typicalPrice)}. That reflects the mix of homes that happened to sell there, not a judgement about the area.`
        : `Not enough neighbourhoods have published figures over the trailing 12 months to answer that.`,
    },
    {
      question: "Why does a neighbourhood show a sale count but no price?",
      answer: `Because fewer than five homes sold there in the window. A typical price computed on one, two or three sales describes those specific houses rather than a market, so it is withheld. The count is shown because a count on its own identifies nobody.`,
    },
    {
      question: "Is this the asking price or the sold price?",
      answer: `Sold. Every figure here comes from completed transactions. Asking prices are on the listings pages and are a different measure entirely.`,
    },
  ];

  const minutes = readMinutes(sections, faqs);
  return {
    data: {
      slug: def.slug,
      title: def.title,
      dek: def.dek,
      category: { key: def.category, label: def.categoryLabel },
      readMinutes: minutes,
      updated: GUIDES_UPDATED,
      takeaways: paras(
        sentence(o.medianPrice, `The typical ${CITY} sold price over the trailing 12 months is ${money(o.medianPrice)}.`),
        sentence(priced.length, `${priced.length} neighbourhoods have enough sales to publish a typical price.`),
        `Form explains more of the price spread than neighbourhood does.`,
        `A withheld figure means too few sales, never zero sales.`,
      ),
      sections,
      faqs,
      related: [],
      ctaBuyer: CTA_BUYER,
      ctaSeller: CTA_SELLER,
    },
    figures: bundle,
  };
}

// ── G2 · how to read a sold price ─────────────────────────────────────────

async function buildReadSoldPrice(def: GuideDef): Promise<BuiltGuide> {
  const { data, bundle } = await getSoldFigures();
  const o = data.overall;
  const gap =
    o.medianPrice !== null && o.meanPrice !== null ? Math.abs(o.meanPrice - o.medianPrice) : null;

  const sections: GuideSection[] = [
    {
      heading: "Typical is not average",
      paragraphs: paras(
        para(
          `Two different numbers get called "the price". The typical price is the midpoint: half of all sales landed above it, half below. The average adds every sale together and divides by the count.`,
          sentence(o.medianPrice, `Across ${CITY} over the trailing 12 months the typical sold price is ${money(o.medianPrice)}.`),
          sentence(o.meanPrice, `The average over the same sales is ${money(o.meanPrice)}.`),
          sentence(gap, `The two sit ${money(gap)} apart.`),
        ),
        para(
          `The gap is not an error. A handful of large rural or luxury sales pull an average upward and leave the midpoint where it is. When you see a price quoted with no label, it is worth knowing which of the two you are looking at.`,
        ),
      ),
      tip: `This site uses the midpoint for town-wide figures and the average for each neighbourhood row, matching whichever figure the page you click through to already shows. The two are never mixed inside one comparison.`,
    },
    {
      heading: "A band says more than a midpoint",
      paragraphs: paras(
        para(
          sentence(
            o.bandLow !== null && o.bandHigh !== null ? true : null,
            `The middle half of ${CITY} sales over the year landed between ${money(o.bandLow)} and ${money(o.bandHigh)}.`,
          ),
          `That band is built by trimming the cheapest quarter and the dearest quarter of all sales and reporting what is left. It survives one unusual transaction in a way that a lowest-to-highest range does not.`,
        ),
        para(
          `A band also needs more sales behind it than a midpoint. A midpoint is published at five sales; a band is not published below ten. A range leaks its own endpoints, and an endpoint is a real house.`,
        ),
      ),
      tip: null,
    },
    {
      heading: "Days on market and sold-to-ask",
      paragraphs: paras(
        para(
          sentence(o.avgDom, `Homes that sold in ${CITY} over the trailing 12 months took ${o.avgDom} days on average.`),
          sentence(o.soldToAskPct, `They closed at ${o.soldToAskPct}% of asking.`),
          `Those two figures answer questions a price cannot. Days on market describes pace. Sold-to-ask describes negotiating room, and whether asking prices are set close to what the market will pay.`,
        ),
        para(
          `Neither figure is published where fewer than five homes sold, for the same reason a price is not.`,
        ),
      ),
      tip: null,
    },
    {
      heading: "Why some figures are missing",
      paragraphs: paras(
        para(
          `A blank on this site never means zero. It means the number of sales behind the figure was too small to publish one without describing a particular household.`,
          `A price computed on two sales is not a market statistic. It is a pair of transactions with a division sign between them.`,
        ),
        para(
          `Individual sold prices are not shown at all without signing in, and never for a single address. One address is a population of one, and no sample size makes that safe.`,
        ),
      ),
      tip: null,
    },
  ];

  const faqs: GuideFaq[] = [
    {
      question: `Where do these ${CITY} figures come from?`,
      answer: `Completed sales recorded on the board, filtered to those that may be displayed publicly, over the trailing 12 months ending today. The same records feed the sold pages, the neighbourhood pages and the street pages.`,
    },
    {
      question: "Why is a figure blank instead of zero?",
      answer: `Because zero is a claim and a blank is not. Zero would say no homes sold. A blank says too few sold to publish the figure safely. Those are different facts and they are not interchangeable.`,
    },
    {
      question: "Can I see what a specific house sold for?",
      answer: `Not on a public page. Individual sold prices sit behind a sign-in, and a single address is never shown as an aggregate at any sample size.`,
    },
  ];

  const minutes = readMinutes(sections, faqs);
  return {
    data: {
      slug: def.slug,
      title: def.title,
      dek: def.dek,
      category: { key: def.category, label: def.categoryLabel },
      readMinutes: minutes,
      updated: GUIDES_UPDATED,
      takeaways: paras(
        `The typical price is the midpoint. The average is not the same number and is pulled by large sales.`,
        sentence(o.bandLow, `A middle-half band needs ten sales behind it; a midpoint needs five.`),
        `A blank figure means too few sales, never zero sales.`,
        `A single address is never published as an aggregate.`,
      ),
      sections,
      faqs,
      related: [],
      ctaBuyer: CTA_BUYER,
      ctaSeller: CTA_SELLER,
    },
    figures: bundle,
  };
}

// ── G3 · is it a good time to sell ────────────────────────────────────────

async function buildGoodTimeToSell(def: GuideDef): Promise<BuiltGuide> {
  const { data, bundle } = await getSoldFigures();
  const supply = await getActiveSupply();
  const o = data.overall;
  const quarters = data.quarterly.filter((q) => q.medianPrice !== null);

  const bundleWithSupply: GroundedFigures = {
    figures: [
      ...bundle.figures,
      fig("supply.active", supply.total, `homes for sale right now`, "count", "getActiveSupply"),
    ],
    entities: bundle.entities,
  };

  const sections: GuideSection[] = [
    {
      heading: "What this page will not do",
      paragraphs: paras(
        para(
          `It will not tell you where prices go next. Nobody publishing a figure on this site knows that, and a page that implied otherwise would be selling something rather than informing you.`,
          `What follows is a record of what has already happened, with the sample size behind each figure.`,
        ),
      ),
      tip: null,
    },
    {
      heading: "The last four quarters",
      paragraphs: paras(
        para(
          sentence(quarters.length, `${quarters.length} recent quarters have enough recorded sales to publish a typical price.`),
          ...quarters.map((q) => `${q.label}: ${money(q.medianPrice)} across ${q.count} sales.`),
        ),
        para(
          `Read those as a sequence, not as a trend line with a direction. Quarter-to-quarter movement in a town of this size reflects which homes happened to sell as much as it reflects what buyers were willing to pay.`,
        ),
      ),
      tip: `Each quarter is gated on its own sale count. A quarter with fewer than five recorded sales carries a count and no price.`,
    },
    {
      heading: "Pace and negotiating room",
      paragraphs: paras(
        para(
          sentence(o.avgDom, `Over the trailing 12 months a ${CITY} home took ${o.avgDom} days to sell on average.`),
          sentence(o.soldToAskPct, `Sales closed at ${o.soldToAskPct}% of asking.`),
          `Those two together describe the conditions a seller met. A short time on market with a sold-to-ask figure close to 100 describes a market clearing at asking. A longer one describes a market that negotiated.`,
        ),
      ),
      tip: null,
    },
    {
      heading: "What you would be competing with",
      paragraphs: paras(
        para(
          sentence(supply.total, `There are ${supply.total} homes for sale in ${CITY} right now.`),
          `Supply is the half of the question a sold figure cannot answer. It is what a buyer sees when your home reaches the market, and it is the only number on this page that describes today rather than the past year.`,
        ),
        para(
          `The honest version of the question is not whether it is a good time in general. It is what your own home is worth against that supply, which is a valuation rather than a statistic.`,
        ),
      ),
      tip: null,
    },
  ];

  const faqs: GuideFaq[] = [
    {
      question: `Are ${CITY} prices going up or down?`,
      answer: `This page shows the trailing quarters and stops there. A direction stated for the next quarter would be a forecast, and no figure on this site supports one.`,
    },
    {
      question: "How long will it take to sell?",
      answer: o.avgDom !== null
        ? `Over the trailing 12 months the average was ${o.avgDom} days across all of ${CITY}. Your own answer depends on form, condition, price and neighbourhood, none of which an average captures.`
        : `Not enough sales are recorded over the trailing 12 months to publish an average.`,
    },
    {
      question: "What is my home worth?",
      answer: `That is a valuation rather than a statistic, and it needs your address, your home's form and its condition. The valuation form is linked at the foot of this page.`,
    },
  ];

  const minutes = readMinutes(sections, faqs);
  return {
    data: {
      slug: def.slug,
      title: def.title,
      dek: def.dek,
      category: { key: def.category, label: def.categoryLabel },
      readMinutes: minutes,
      updated: GUIDES_UPDATED,
      takeaways: paras(
        `This page records what has happened. It does not forecast.`,
        sentence(o.avgDom, `A ${CITY} home took ${o.avgDom} days to sell on average over the trailing 12 months.`),
        sentence(o.soldToAskPct, `Sales closed at ${o.soldToAskPct}% of asking.`),
        sentence(supply.total, `${supply.total} homes are for sale right now.`),
      ),
      sections,
      faqs,
      related: [],
      ctaBuyer: CTA_BUYER,
      ctaSeller: CTA_SELLER,
    },
    figures: bundleWithSupply,
  };
}

// ── G4 · condo fees, parking and lockers ──────────────────────────────────

function feeRowSentence(r: CondoFeeRow): string {
  const bits = [`${r.bedrooms} bed`, `${r.parking} parking`];
  if (r.locker && r.locker.toLowerCase() !== "none") bits.push(`${r.locker.toLowerCase()} locker`);
  // The neighbourhood clause is dropped when the registry does not own the
  // raw string, rather than falling back to it. The fallback is what printed
  // "in 1032 - FO Ford" on the first preview.
  const where = r.neighbourhood ? `, in ${r.neighbourhood}` : "";
  return `${formatMoney(r.monthlyFee)} a month, ${bits.join(", ")}${where}.`;
}

async function buildCondoFees(def: GuideDef): Promise<BuiltGuide> {
  const rows = await getActiveCondoFees();
  const hasRows = rows.length > 0;

  const figures: GroundedFigures = {
    figures: [
      fig("condo.activeWithFee", rows.length, "condos for sale stating a monthly fee", "count", "getActiveCondoFees"),
      ...rows.map((r) =>
        fig(`condo.${r.mlsNumber}.fee`, r.monthlyFee, `monthly fee on listing ${r.mlsNumber}`, "dollar", "getActiveCondoFees"),
      ),
    ],
    entities: [CITY, ...Array.from(new Set(rows.map((r) => r.neighbourhood).filter((n): n is string => Boolean(n))))],
  };

  const sections: GuideSection[] = [
    {
      heading: "What a condo fee actually covers",
      paragraphs: paras(
        para(
          `A monthly maintenance fee pays for the parts of the building nobody owns alone: the roof, the elevators, the corridors, the grounds, the building insurance, and the reserve fund that pays for the next major repair.`,
          `It is not a tax and it is not optional. It is the running cost of the shared half of what you bought.`,
        ),
        para(
          `What a fee includes varies by building, and two identical monthly figures can cover very different things. Heat, water, hydro and parking are sometimes inside the fee and sometimes billed separately, which is why comparing two fees without reading what each covers tells you almost nothing.`,
        ),
      ),
      tip: `Every fee on this page is the figure stated on a listing that is for sale right now. No fee here is averaged, estimated or carried over from a past listing.`,
    },
    {
      heading: hasRows ? "Fees stated on condos for sale now" : "Nothing is for sale right now",
      paragraphs: hasRows
        ? paras(
            para(
              `${rows.length} ${CITY} condo listings currently for sale state a monthly fee. Each line below is one listing, and each links to the listing where the fee is stated.`,
            ),
            para(
              `They are ordered by fee, lowest first. A low fee is not automatically the better deal: a building that underfunds its reserve today bills its owners for it later, and a special assessment is not visible in a monthly figure.`,
            ),
            para(...rows.map(feeRowSentence)),
          )
        : paras(
            para(
              `No ${CITY} condo currently for sale states a monthly maintenance fee, so this page has nothing to show you.`,
              `Fees from past listings are deliberately not carried over. A fee changes with the building's budget, and a stale figure presented as current is worse than no figure.`,
            ),
          ),
      tip: null,
    },
    {
      heading: "Parking and lockers are not a given",
      paragraphs: paras(
        para(
          `Parking and a locker are separate from the unit and are not standard. Some units carry an owned space, some an exclusive-use space, some none at all, and the difference matters both to what you can sell later and to what you pay monthly.`,
          `The listing is the authority on which of those applies. Each line above states what that listing states.`,
        ),
        para(
          `A locker marked shared is not the same as an owned locker, and an owned locker is a separate title with its own value.`,
        ),
      ),
      tip: null,
    },
    {
      heading: "Before you commit",
      paragraphs: paras(
        para(
          `The status certificate is the document that answers everything a listing cannot. It carries the reserve fund study, any planned special assessment, the building's rules, and whether the corporation is in litigation.`,
          `It is the single most useful thing you will read about a condo, and it is worth having reviewed before the conditional period closes.`,
        ),
      ),
      tip: null,
    },
  ];

  const faqs: GuideFaq[] = [
    {
      question: `What is a typical condo fee in ${CITY}?`,
      answer: `This page does not publish one. A typical fee across buildings averages together very different things, since what a fee includes changes building by building. The fees listed here are the ones stated on listings currently for sale, each linked to its source.`,
    },
    {
      question: "Do condo fees go up?",
      answer: `They generally do, because the costs they cover do. The reserve fund study in the status certificate is where you find out how much and how soon.`,
    },
    {
      question: "Is parking included in the fee?",
      answer: `Sometimes. It varies by building and by unit, and the listing states what applies to that unit. There is no town-wide answer.`,
    },
  ];

  const minutes = readMinutes(sections, faqs);
  return {
    data: {
      slug: def.slug,
      title: def.title,
      dek: def.dek,
      category: { key: def.category, label: def.categoryLabel },
      readMinutes: minutes,
      updated: GUIDES_UPDATED,
      takeaways: paras(
        `A fee covers the shared parts of the building and the reserve fund.`,
        hasRows ? `${rows.length} condos for sale right now state a monthly fee.` : null,
        `What a fee includes changes building by building, so two equal fees are not comparable on their own.`,
        `The status certificate answers what a listing cannot.`,
      ),
      sections,
      faqs,
      related: [],
      ctaBuyer: { ...CTA_BUYER, heading: `See condos for sale in ${CITY}`, href: "/condos" },
      ctaSeller: CTA_SELLER,
    },
    figures,
  };
}

// ── G5 · first home ───────────────────────────────────────────────────────

async function buildFirstHome(def: GuideDef): Promise<BuiltGuide> {
  const { data, bundle } = await getSoldFigures();
  const anchor =
    data.byType.find((t) => t.slug === "townhouse" && t.medianPrice !== null) ??
    data.byType.find((t) => t.slug === "condo" && t.medianPrice !== null) ??
    null;
  const price = anchor?.medianPrice ?? null;

  const rate = BOC_POLICY_RATE.ratePct;
  const stress = stressTestRate(rate);
  const down = price !== null ? Math.round(minimumDownPayment(price)) : null;
  const downPct = price !== null && down !== null ? (down / price) * 100 : null;
  const ltt = price !== null ? ontarioLTT(price) : null;
  const rebate = ltt !== null ? Math.min(ltt, 4000) : null;
  const lttNet = ltt !== null && rebate !== null ? ltt - rebate : null;
  const cmhc = price !== null && downPct !== null ? cmhcPremium(price, downPct) : null;
  const loan = price !== null && down !== null && cmhc !== null ? price - down + cmhc : null;
  const payAtPolicy = loan !== null ? Math.round(monthlyPayment(loan, rate, 25)) : null;
  const payAtStress = loan !== null ? Math.round(monthlyPayment(loan, stress, 25)) : null;

  const figures: GroundedFigures = {
    figures: [
      ...bundle.figures,
      fig("boc.policyRate", rate, `Bank of Canada policy rate, ${BOC_POLICY_RATE.observedOn}`, "percent", "BOC_POLICY_RATE"),
      fig("calc.stressRate", stress, "stress-test rate", "percent", "stressTestRate"),
      fig("calc.down", down, "minimum down payment", "dollar", "minimumDownPayment"),
      fig("calc.ltt", lttNet, "Ontario land transfer tax after the first-time rebate", "dollar", "ontarioLTT"),
      fig("calc.cmhc", cmhc, "mortgage insurance premium", "dollar", "cmhcPremium"),
      fig("calc.payment", payAtPolicy, "monthly payment at the policy rate", "dollar", "monthlyPayment"),
      fig("calc.paymentStress", payAtStress, "monthly payment at the stress-test rate", "dollar", "monthlyPayment"),
    ],
    entities: bundle.entities,
  };

  const anchorLabel = anchor ? anchor.label.toLowerCase() : null;

  const sections: GuideSection[] = [
    {
      heading: "The rate this page uses, and what it is not",
      paragraphs: paras(
        para(
          `Every figure below is worked at the Bank of Canada policy rate, ${policyRateLabel()}.`,
          `That is the only rate published in this codebase, and it is deliberately not a mortgage rate.`,
        ),
        para(
          `A policy rate is the overnight target the Bank sets for the financial system. What a lender offers you is a different number, set by that lender, and it will not match the figure used here.`,
          `Treat the arithmetic below as the shape of the cost rather than a quote. Your own numbers come from a lender.`,
        ),
      ),
      tip: `The rate is stamped with the date it was read. If that date is old, the arithmetic below is old with it.`,
    },
    {
      heading: "The down payment is a sliding rule, not a percentage",
      paragraphs: paras(
        para(
          `Canada sets a minimum down payment in bands. Five per cent applies to the first $500,000 of the price. Ten per cent applies to the portion between $500,000 and $1,500,000. At $1,500,000 and above the minimum is twenty per cent and mortgage insurance is not available at all.`,
        ),
        para(
          sentence(
            price !== null && anchorLabel ? true : null,
            `Worked against a typical ${CITY} ${anchorLabel} at ${money(price)}, the minimum down payment is ${money(down)}.`,
          ),
          sentence(
            price !== null ? true : null,
            `That is the floor, not a recommendation. Putting down less than twenty per cent triggers mortgage insurance, which is the next item.`,
          ),
        ),
      ),
      tip: null,
    },
    {
      heading: "Mortgage insurance and land transfer tax",
      paragraphs: paras(
        para(
          `Below twenty per cent down, mortgage default insurance is mandatory. The premium is a percentage of the loan and is normally added to the mortgage rather than paid at closing, so it quietly increases what you borrow.`,
          sentence(cmhc, `On the worked example the premium is ${money(cmhc)}.`),
        ),
        para(
          `Ontario land transfer tax is paid at closing, in cash, and cannot be added to the mortgage.`,
          sentence(ltt, `On the worked example it is ${money(ltt)} before any rebate.`),
          sentence(
            rebate,
            `A first-time buyer in Ontario can claim a rebate of up to $4,000, which brings it to ${money(lttNet)}.`,
          ),
          `${CITY} is not Toronto, so there is no second municipal land transfer tax on top. That charge applies inside the City of Toronto only.`,
        ),
      ),
      tip: `Land transfer tax and legal costs are due on closing day in cash. They are the part most first-time buyers under-budget for, because unlike the premium they cannot be rolled into the loan.`,
    },
    {
      heading: "The stress test decides what you qualify for",
      paragraphs: paras(
        para(
          `A lender does not qualify you at the rate you will pay. It qualifies you at the higher of your rate plus two points, or 5.25 per cent.`,
          sentence(stress, `Against the policy rate used here that test rate is ${stress}%.`),
        ),
        para(
          sentence(
            payAtPolicy !== null && payAtStress !== null ? true : null,
            `On the worked example the monthly payment over 25 years is ${money(payAtPolicy)} at the policy rate and ${money(payAtStress)} at the test rate.`,
          ),
          sentence(
            payAtStress,
            `The second figure is the one that decides whether you qualify. The first is closer to what you would actually pay if a lender offered you the policy rate, which no lender will.`,
          ),
        ),
      ),
      tip: null,
    },
  ];

  const faqs: GuideFaq[] = [
    {
      question: `How much do I need to buy in ${CITY}?`,
      answer:
        price !== null && down !== null && lttNet !== null
          ? `Against a typical ${anchorLabel} at ${money(price)}, the minimum down payment is ${money(down)} and land transfer tax after the first-time rebate is ${money(lttNet)}. Legal fees, title insurance, an inspection and moving costs sit on top and are not modelled here.`
          : `Not enough sales are recorded over the trailing 12 months to publish a typical price to work against.`,
    },
    {
      question: "Is the rate on this page the rate I will get?",
      answer: `No. It is the Bank of Canada policy rate, stamped with the date it was read. A lender's offer to you is a different number and this page does not have it.`,
    },
    {
      question: "Does Milton charge a municipal land transfer tax?",
      answer: `No. The second land transfer tax applies inside the City of Toronto only. In ${CITY} you pay the Ontario tax alone, less the first-time buyer rebate if you qualify.`,
    },
  ];

  const minutes = readMinutes(sections, faqs);
  return {
    data: {
      slug: def.slug,
      title: def.title,
      dek: def.dek,
      category: { key: def.category, label: def.categoryLabel },
      readMinutes: minutes,
      updated: GUIDES_UPDATED,
      takeaways: paras(
        `The rate used here is the Bank of Canada policy rate, not a mortgage rate.`,
        `The minimum down payment is a sliding rule, not a flat percentage.`,
        sentence(lttNet, `Land transfer tax is due in cash at closing and cannot be added to the mortgage.`),
        sentence(stress, `You qualify at ${stress}%, not at the rate you pay.`),
      ),
      sections,
      faqs,
      related: [],
      ctaBuyer: CTA_BUYER,
      ctaSeller: CTA_SELLER,
    },
    figures,
  };
}

// ── G6 · schools ──────────────────────────────────────────────────────────

function schoolLine(s: SchoolRow): string {
  return `${s.name}, ${s.boardName}, grades ${s.grades}.`;
}

async function buildSchools(def: GuideDef): Promise<BuiltGuide> {
  const rows = getSchoolRows();
  const elementary = rows.filter((r) => r.level === "elementary");
  const secondary = rows.filter((r) => r.level === "secondary");
  const boards = Array.from(new Set(rows.map((r) => r.boardName)));

  const figures: GroundedFigures = {
    figures: [
      fig("schools.total", rows.length, `schools listed on this site`, "count", "getSchoolRows"),
      fig("schools.elementary", elementary.length, "elementary schools listed", "count", "getSchoolRows"),
      fig("schools.secondary", secondary.length, "secondary schools listed", "count", "getSchoolRows"),
    ],
    entities: [CITY, ...boards, ...rows.map((r) => r.name)],
  };

  const sections: GuideSection[] = [
    {
      heading: "What this page can tell you",
      paragraphs: paras(
        para(
          `${rows.length} ${CITY} schools are listed on this site, ${elementary.length} elementary and ${secondary.length} secondary, across ${boards.length} boards.`,
          `For each one this page carries the board that runs it, the level and the grade range, and links to its own page.`,
        ),
      ),
      tip: null,
    },
    {
      heading: "What it cannot, and why that matters",
      paragraphs: paras(
        para(
          `This page cannot tell you which school a given address is placed with. Placement is set by the school boards, changes with enrolment, and is published by the boards themselves.`,
          `The boundary data behind those decisions is not held on this site, so any statement here about which homes go with which school would be a guess presented as a fact.`,
        ),
        para(
          `Two other things are absent and worth naming rather than glossing. There is no street address for any school in this data, and there is no distance from a home to a school. The coordinates this site holds for some schools are neighbourhood-level approximations, and a distance computed from an approximation is not a distance.`,
        ),
        para(
          `Confirm placement with the board directly before it factors into a purchase. It is the one school question that actually affects which house you buy, and it is the one this page will not answer.`,
        ),
      ),
      tip: `A listing, an agent and a website are all the wrong source for school placement. The board is the only one that decides it.`,
    },
    {
      heading: "Elementary",
      paragraphs: paras(para(...elementary.map(schoolLine))),
      tip: null,
    },
    {
      heading: "Secondary",
      paragraphs: paras(para(...secondary.map(schoolLine))),
      tip: null,
    },
  ];

  const faqs: GuideFaq[] = [
    {
      question: `Which school will my child go to in ${CITY}?`,
      answer: `The school boards decide that, and this site does not hold the boundary data behind the decision. Contact the board directly. It is the only source that can answer it, and the answer can change with enrolment.`,
    },
    {
      question: `How many schools are there in ${CITY}?`,
      answer: `${rows.length} are listed here, ${elementary.length} elementary and ${secondary.length} secondary. That is what this site holds rather than a complete count of every school in the town.`,
    },
    {
      question: "Why is there no school address or distance?",
      answer: `Because neither is in this data. Rather than approximate one, this page states what it has: the board, the level and the grade range.`,
    },
  ];

  const minutes = readMinutes(sections, faqs);
  return {
    data: {
      slug: def.slug,
      title: def.title,
      dek: def.dek,
      category: { key: def.category, label: def.categoryLabel },
      readMinutes: minutes,
      updated: GUIDES_UPDATED,
      takeaways: paras(
        `${rows.length} ${CITY} schools are listed, with board, level and grades.`,
        `Placement is set by the boards and is not published here.`,
        `No school address or distance is held in this data, and neither is approximated.`,
      ),
      sections,
      faqs,
      related: [],
      ctaBuyer: CTA_BUYER,
      ctaSeller: CTA_SELLER,
    },
    figures,
  };
}

// ── dispatch ──────────────────────────────────────────────────────────────

const BUILDERS: Record<string, (def: GuideDef) => Promise<BuiltGuide>> = {
  "what-milton-neighbourhoods-cost": buildNeighbourhoodCosts,
  "how-to-read-a-milton-sold-price": buildReadSoldPrice,
  "is-it-a-good-time-to-sell-in-milton": buildGoodTimeToSell,
  "milton-condo-fees-parking-and-lockers": buildCondoFees,
  "what-it-costs-to-buy-your-first-home-in-milton": buildFirstHome,
  "milton-schools-what-the-data-shows": buildSchools,
  "parking-in-milton": buildParking,
  "milton-go-train-to-toronto": buildGoTrain,
};

export async function buildGuide(slug: string): Promise<BuiltGuide | null> {
  const def = GUIDE_DEFS.find((d) => d.slug === slug);
  if (!def) return null;
  const builder = BUILDERS[slug];
  if (!builder) return null;
  return builder(def);
}

export { teaserFor };
export type { CondoFeeRow, SchoolRow };
export { getActiveCondoFees };
