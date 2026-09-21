// src/lib/megaLive.ts
// THE MENU'S LIVE CONTENT, on every page of the site, one block of it per rail item.
//
// The mega menu used to be alive on the homepage only: page.tsx composed it from data the
// homepage had already fetched, and every other page rendered the rails and nothing else.
// Phone and desktop visitors land on a street page or a hub far more often than on "/", so
// the one element present on every page carried its product on the one page people reach
// least. `getMegaLive()` gathers the same inputs from the same sources, memoised for five
// minutes per server instance, so a street page's menu states the same figures the
// homepage's does without a second code path formatting them.
//
// THE LEFT RAIL DRIVES THE RIGHT PANEL. Each menu is a rail of items and each item selects
// its own panel: Buy has new today, price changes, condos, freehold and alerts; Rent (MH-007)
// has available now, by neighbourhood, typical rent, new this week and landlords; Streets has
// by neighbourhood, with video, A to Z and address search; Sell has what it's worth, sold
// this month and market watch. Every item's content is one `MegaItemContent`,
// composed here from a live query and rendered by one component. No item may lead to an
// empty panel: each carries at least one live block and its CTA, and the battery asserts it.
//
// OPEN HOUSES ARE NOT HERE. The brief listed them. The feed carries no open-house field on
// any row, so a panel of them could only be invented, and a page that cannot meet the rules
// is not built. Recorded in HANDOFF-home.md.
//
// ONE COMPOSER. `composeMegaLive()` is pure and is the only place a menu string is built.
// The homepage feeds it from `getHomepageData()` for the inputs it already fetched (no
// duplicate query on the page that ran them, and the Sell panel reads the SAME Board row the
// Board renders below it) plus `getMegaExtras()` for the rest; every other page feeds it
// from `getMegaLive()`. Two callers, one formatter.
//
// THE STRIPS ARE FOUR DIFFERENT QUESTIONS, from four real counts:
//   Buy      which streets have the most homes for sale right now   (live Listing rows)
//   Rent     which streets have the most homes for rent right now   (live lease rows)
//   Streets  which streets are searched for most                     (GSC impressions,
//            when the sense run has enough of them; else 12-month sales)
//   Sell     which streets sold the most in the last 12 months       (ResidentialStreet)
// Every strip link is a PUBLISHED PAGE: the candidate set is intersected with
// publishedStreetPageSlugs(), the sitemap's own set, so the menu cannot link a 404.
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { publishedStreetPageSlugs } from "@/lib/streetSurface";
import { buildMiltonWideContext } from "@/lib/ai/buildHubInput";
import { getNeighbourhoodCards, getRawStringHubMap, type NeighbourhoodCard } from "@/lib/neighbourhoodCards";
import { getNewThisWeekCount, getSoldThisMonth, getStreetsWithVideo, getStreetVideoCount, type SoldThisMonth, type StreetVideoCard } from "@/lib/homeSignals";
import { getNewestListingCards, getListingCards } from "@/lib/listingsV2Data";
import { getRentalsAvailableCount } from "@/lib/rentalsAvailable";
import { getLeaseMarket, RENT_TYPE_LABEL, type LeaseMarket } from "@/lib/rentSignals";
import { K_ANON_PRICE } from "@/lib/kAnon";
import { getBoardData } from "@/lib/board/boardData";
import { resolveStreetName } from "@/lib/streetName";
import { formatCount, formatDateProse, formatDays, formatMoney1k, formatMoneyWhole, formatPct1, formatRent, NULL_GLYPH } from "@/lib/figureFormat";
import { getContextStrips } from "@/lib/megaContext";
import type { ListingCardData } from "@/components/listings/v2/types";
import type { BoardTab } from "@/lib/board/computeBoard";
import type { EditionSections } from "@/lib/marketWatch/edition";
import type { HomepageData } from "@/components/home/types";
import type {
  LeadSegment,
  MegaHub,
  MegaItemContent,
  MegaLetter,
  MegaListing,
  MegaLive,
  MegaStrip,
  NavContext,
} from "@/components/nav/megaTypes";

// ── the inputs ───────────────────────────────────────────────────────────────────────────

export interface MegaStrips {
  buy?: MegaStrip;
  rent?: MegaStrip;
  streets?: MegaStrip;
  sell?: MegaStrip;
}

/** The Rent menu's inputs (MH-007). The live side is DB1's available leases; the closed
 *  side is DB2's, k-gated in rentSignals.ts. */
export interface MegaRent {
  /** available now, Milton-wide: the figure /rentals publishes */
  available: number;
  /** available now per PUBLISHED hub, by slug; a hub with none is present at 0 */
  byHub: Map<string, number>;
  /** the newest four available */
  cards: ListingCardData[];
  /** listed for lease in the last 7 days */
  week: { count: number; cards: ListingCardData[] };
  market: LeaseMarket;
}

/** Everything the menu needs that the homepage does not already fetch for itself. */
export interface MegaExtras {
  strips: MegaStrips;
  newLast24h: number;
  /** listings whose price changed in the window, newest change first */
  /** THE COUNT ONLY (MC-029). The panel used to list the listings whose price moved, with the
   *  prior price and the direction on each card. Which listing changed price, and from what,
   *  is price history, a VOW-only fact per listing; the count across the market is not. */
  priceChanges: { windowDays: number; count: number };
  condos: { count: number; cards: ListingCardData[] };
  freehold: { count: number; cards: ListingCardData[] };
  rent: MegaRent;
  /** filmed streets, newest capture first */
  videos: StreetVideoCard[];
  letters: MegaLetter[];
  soldMtd: SoldThisMonth;
  edition: { weekOf: string; sections: EditionSections; summary: string } | null;
}

export interface MegaInputs {
  onMarket: number;
  newThisWeek: number;
  listings: ListingCardData[];
  hubByRaw: Map<string, { slug: string; name: string }>;
  streetPageCount: number;
  videoCount: number;
  hubs: NeighbourhoodCard[];
  board: BoardTab[] | null;
  extras: MegaExtras;
  /** the page's subject, when it has one: the Rent menu scopes "available now" to its hub */
  context?: NavContext;
}

const STRIP_SIZE = 8;
/** Below this many streets with search impressions, the Streets strip falls back to sales. */
const GSC_STRIP_FLOOR = 6;
const CARDS = 4;
const POSTERS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

// ── formatting helpers, all through figureFormat ─────────────────────────────────────────

const sales = (n: number) => `${formatCount(n)} ${n === 1 ? "sale" : "sales"}`;
const leases = (n: number) => `${formatCount(n)} ${n === 1 ? "lease" : "leases"}`;
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** A listing's display address, minus the city suffix the feed appends. The card sits under
 *  a heading that already says Milton; "1225 Manitou Way, Milton, Ontario" in a 200px card
 *  is an ellipsis where the street name should be. The redacted placeholder passes through. */
const shortAddress = (a: string) => a.replace(/,\s*Milton\b.*$/i, "");

function card(l: ListingCardData, hubByRaw: Map<string, { slug: string; name: string }>): MegaListing {
  const rent = l.transactionType === "For Lease";
  const out: MegaListing = {
    mlsNumber: l.mlsNumber,
    address: shortAddress(l.address), // already through the display gate in listingsV2Data
    price: rent ? `${formatMoneyWhole(l.price)}/mo` : formatMoneyWhole(l.price),
    photo: l.photos[0] ?? null,
    beds: l.bedrooms,
    baths: l.bathrooms,
    listOfficeName: l.listOfficeName,
    hub: hubByRaw.get(l.neighbourhood)?.name ?? null,
  };
  return out;
}

const fig = (key: string, text: string): LeadSegment => ({ fig: key, text });
const t = (text: string): LeadSegment => ({ text });

const VALUATION_NOTE = "A grounded valuation reads the comparable sales on your street and in your neighbourhood, not an algorithm's guess.";

// ── the pure composer ────────────────────────────────────────────────────────────────────

/** Every string the menu renders is built here and nowhere else. */
export function composeMegaLive(i: MegaInputs): MegaLive {
  const x = i.extras;
  const cards = (rows: ListingCardData[]) => rows.slice(0, CARDS).map((l) => card(l, i.hubByRaw));
  const overall = i.board?.find((tab) => tab.tab === "overall") ?? null;
  const active = formatCount(i.onMarket);
  const newWeek = formatCount(i.newThisWeek);
  const pages = formatCount(i.streetPageCount);
  const filmed = formatCount(i.videoCount);
  const changesWindow = x.priceChanges.windowDays === 7 ? "the last week" : `the last ${x.priceChanges.windowDays} days`;

  // ── BUY ─────────────────────────────────────────────────────────────────
  // THE RAIL READS AT A GLANCE (MA-004 change 10). Every item carries one live fact under its
  // name and its CTA carries the count it leads to, the way Homesly's rail does; a rail of six
  // bare words made the visitor open each one to learn what it held.
  const buy: Record<string, MegaItemContent> = {
    new: {
      sub: `${newWeek} this week`,
      cta: `See all ${active} for sale`,
      lead: [
        fig("menu-buy-new24", formatCount(x.newLast24h)),
        t(` ${plural(x.newLast24h, "home", "homes")} listed in the last 24 hours, `),
        fig("menu-buy-new", newWeek),
        t(" this week, "),
        fig("menu-buy-active", active),
        t(" for sale."),
      ],
      // The newest four, whatever the day: a quiet Tuesday must not empty the panel.
      cards: cards(i.listings),
      strip: x.strips.buy,
      note: x.newLast24h < CARDS ? "The newest homes on the market, most recent first." : undefined,
    },
    changes: {
      sub: `${formatCount(x.priceChanges.count)} in ${changesWindow}`,
      cta: `See all ${active} for sale`,
      lead:
        x.priceChanges.count > 0
          ? [
              fig("menu-buy-changes", formatCount(x.priceChanges.count)),
              t(` price ${plural(x.priceChanges.count, "change", "changes")} in ${changesWindow}.`),
            ]
          : [t(`No price changes recorded in ${changesWindow}.`)],
      // The newest homes, not the changed ones: naming a listing under this heading would say
      // its price moved, which is its price history (MC-029).
      cards: cards(i.listings),
      strip: x.strips.buy,
      note: "Which homes moved, and from what, is price history: sign in free on any listing page to see it.",
    },
    condos: {
      sub: `${formatCount(x.condos.count)} for sale`,
      cta: `Every condo building`,
      lead: [fig("menu-buy-condos", formatCount(x.condos.count)), t(` ${plural(x.condos.count, "condo", "condos")} for sale in Milton.`)],
      cards: cards(x.condos.cards),
      note: "Condo apartments and condo townhouses, by the feed's own ownership type.",
    },
    freehold: {
      sub: `${formatCount(x.freehold.count)} for sale`,
      lead: [fig("menu-buy-freehold", formatCount(x.freehold.count)), t(` freehold ${plural(x.freehold.count, "home", "homes")} for sale in Milton.`)],
      cards: cards(x.freehold.cards),
      note: "Detached, semi-detached, freehold townhomes and duplexes. No condo corporation, no fee.",
    },
    alerts: {
      sub: "One email, each weekday",
      lead: [
        fig("menu-buy-new", newWeek),
        t(" new listings this week and "),
        fig("menu-buy-changes", formatCount(x.priceChanges.count)),
        t(` price changes in ${changesWindow}.`),
      ],
      note: "One email each weekday morning with what listed, what sold and what moved on price. Nothing else, and no newsletter.",
    },
  };

  // ── RENT (MH-007) ───────────────────────────────────────────────────────
  // A RENTER FINDS THEIR NEIGHBOURHOOD IN TWO CLICKS: the hub list links the scoped /rentals,
  // and on a hub or a street page "available now" is already that hub's count and its CTA
  // already that hub's page. A LANDLORD SEES THE MARKET THEY ARE LISTING INTO: what leased,
  // how fast and at what share of asking, from the Board's closed leases, and the form to
  // list is the panel's CTA.
  const rent = composeRent(i);

  // ── STREETS ─────────────────────────────────────────────────────────────
  const streets: Record<string, MegaItemContent> = {
    hoods: {
      sub: `${formatCount(i.hubs.length)} with a page`,
      cta: `All ${formatCount(i.hubs.length)} neighbourhoods`,
      lead: [
        fig("menu-streets-pages", pages),
        t(" Milton streets with their own page, across "),
        fig("menu-streets-hubs", formatCount(i.hubs.length)),
        t(" neighbourhoods."),
      ],
      // Alphabetical: a visitor scans this column for a name they already know.
      hubs: [...i.hubs].sort((a, b) => a.name.localeCompare(b.name)).map((h) => ({ slug: h.slug, name: h.name, active: formatCount(h.activeCount) })),
    },
    video: {
      sub: `${filmed} filmed`,
      cta: `All ${pages} street pages`,
      lead: [fig("menu-streets-filmed", filmed), t(` ${plural(i.videoCount, "street", "streets")} filmed end to end, by day and overnight.`)],
      videos: x.videos.slice(0, POSTERS).map((v) => ({ slug: v.slug, name: v.name, poster: v.poster, variant: v.variant })),
    },
    az: {
      sub: `${pages} pages`,
      cta: `All ${pages} street pages`,
      // "Every one states what homes there actually sold for" left this sentence: the minimal
      // template shows no price and individual sold prices are gated (MA-004 defect 15).
      lead: [fig("menu-streets-pages", pages), t(" street pages, A to Z, each with its own sales record and the neighbourhood around it.")],
      letters: x.letters,
    },
    search: {
      sub: "Street, address or neighbourhood",
      cta: `All ${pages} street pages`,
      lead: [t("Type a street, an address or a neighbourhood and land on its page. "), fig("menu-streets-pages", pages), t(" streets have one.")],
      strip: x.strips.streets,
    },
  };

  // ── SELL ────────────────────────────────────────────────────────────────
  // TWO BASES SHARE THE SELL PANEL, AND THE PANEL SAYS SO (MA-004 defect 8). The typical price
  // is the Board's mix-adjusted basket: each street-and-type cell's typical, weighted by that
  // cell's share of the last 12 months' sales, over the cells that reached the floor of five.
  // Days to sell and sold to ask are every urban sale in the Board's shorter window. /sold reads
  // every Milton sale over 12 months. Three honest samples, and the reader is told which is which.
  const basis = overall
    ? `Typical price is mix-adjusted: each street and home type's typical, weighted by its share of the last 12 months' sales, over the ${sales(overall.typical.sample)} that reached the floor of five. Days to sell and sold to ask are every urban Milton sale in the last ${overall.daysToSell.window}. Sold data and trends reads every Milton sale over 12 months, a wider sample.`
    : undefined;
  const sell: Record<string, MegaItemContent> = {
    worth: overall
      ? {
          sub: overall.typical.value !== null ? `Typically ${formatMoney1k(overall.typical.value)}` : undefined,
          // The sentence states two figures; if either is suppressed there is no sentence. The
          // Board's rows are urban Milton, and the sentence says so.
          lead:
            overall.soldToAsk.value !== null && overall.daysToSell.value !== null
              ? [
                  t(`Over the last ${overall.soldToAsk.window}, urban Milton homes sold for `),
                  fig("menu-sell-sta-lead", formatPct1(overall.soldToAsk.value)),
                  t(" of asking, in "),
                  fig("menu-sell-days-lead", formatDays(overall.daysToSell.value)),
                  t("."),
                ]
              : undefined,
          figures: [
            { key: "typical", label: "Typical price", value: formatMoney1k(overall.typical.value), window: overall.typical.window, sample: sales(overall.typical.sample) },
            { key: "days", label: "Days to sell", value: formatDays(overall.daysToSell.value), window: overall.daysToSell.window, sample: sales(overall.daysToSell.sample) },
            // A RATIO. The unit conversion lives in formatPct1, the same function the Board
            // calls on the same row, so the two surfaces cannot disagree.
            { key: "sta", label: "Sold to ask", value: formatPct1(overall.soldToAsk.value), window: overall.soldToAsk.window, sample: sales(overall.soldToAsk.sample) },
          ],
          basis,
          strip: x.strips.sell,
          note: VALUATION_NOTE,
        }
      : { strip: x.strips.sell, note: VALUATION_NOTE },
    soldmtd: {
      sub: `${formatCount(x.soldMtd.count)} so far`,
      // "So far": the month is still filling in. The typical is k-gated and absent below k.
      lead: [
        fig("menu-sold-mtd", formatCount(x.soldMtd.count)),
        t(` ${plural(x.soldMtd.count, "home", "homes")} sold in Milton so far this month`),
        ...(x.soldMtd.typicalPrice !== null ? [t(", typically "), fig("menu-sold-mtd-typical", formatMoney1k(x.soldMtd.typicalPrice)), t(".")] : [t(".")]),
      ],
      strip: x.strips.sell,
      note: `Closed sales through ${formatDateProse(x.soldMtd.through)}. Individual sold prices are on the street pages, for signed-in readers.`,
    },
    watch: x.edition
      ? {
          sub: x.edition.sections.weekLabel,
          lead: [
            fig("menu-mw-sales", formatCount(x.edition.sections.sales.count)),
            t(` ${plural(x.edition.sections.sales.count, "home", "homes")} sold in the ${x.edition.sections.weekLabel}, `),
            fig("menu-mw-new", formatCount(x.edition.sections.newListings)),
            t(" new listings."),
          ],
          edition: {
            weekOf: x.edition.weekOf,
            label: x.edition.sections.weekLabel,
            summary: x.edition.summary,
            href: `/market-watch/${x.edition.weekOf}`,
          },
        }
      : { note: "The weekly edition covers the most recent complete Monday to Sunday week. None has been published yet." },
  };

  return { buy, rent, streets, sell };
}

/** The Rent menu, its own function because it has its own inputs. Every figure is a display
 *  string from figureFormat; every closed-lease figure arrives already gated. */
function composeRent(i: MegaInputs): Record<string, MegaItemContent> {
  const x = i.extras;
  const r = x.rent;
  const m = r.market;
  const cards = (rows: ListingCardData[]) => rows.slice(0, CARDS).map((l) => card(l, i.hubByRaw));
  const available = formatCount(r.available);
  const seeAll = `See all ${available} for rent`;

  // The page's hub: a hub page's own, or a street page's (a street passes both). A hub with
  // nothing for rent is scoped at 0, which is true, rather than falling back to Milton.
  const hub = i.context?.hub;
  const scoped = hub ? { name: hub.name, slug: hub.slug, count: r.byHub.get(hub.slug) ?? 0 } : null;

  // Alphabetical, like the Streets menu's hub list: a visitor scans for a name they know.
  // Every published hub is listed, at 0 where nothing is for rent, because a count of what is
  // advertised is a count, not a suppressed figure; and each links the scoped /rentals.
  const hubs: MegaHub[] = [...i.hubs]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((h) => ({ slug: h.slug, name: h.name, active: formatCount(r.byHub.get(h.slug) ?? 0), href: `/rentals?neighbourhood=${h.slug}` }));

  // WHOLE HOME AND BASEMENT UNIT ARE TWO FIGURES (MH-007 addendum). A house type's leases mix
  // whole homes, basement units and upper-floors-only, at rents a blended midpoint describes
  // for none of them; each figure states the sample it is over and the basis says what is out.
  const split = m.byType.some((f) => f.basementCount > 0 || f.upperCount > 0);
  const basis = m.count > 0
    ? `Typical rent is the midpoint of the leases the Board recorded as closed in the ${m.window}, by home type, where at least five closed; a type with fewer is not stated.${
        split
          ? " For a house, whole home leaves out leases of a basement unit or of the upper floors only, read from the feed's unit field and remarks; a basement unit is stated where at least five leased."
          : ""
      } Asking rents on the cards are the feed's own.`
    : undefined;
  const typicalFigures = m.byType.flatMap((f) => {
    const label = RENT_TYPE_LABEL[f.type];
    const classed = f.basementCount > 0 || f.upperCount > 0;
    const whole = {
      key: classed ? `${f.type}-whole` : f.type,
      label: classed ? `${label}, whole home` : label,
      value: f.typical !== null ? formatRent(f.typical) : "Sample too small",
      window: m.window,
      sample: leases(classed ? f.wholeCount : f.count),
    };
    // A basement figure is shown only where it clears the floor: below it, the whole-home
    // figure stands alone and the basement leases are in the type's count, not in a figure.
    return f.basementCount >= K_ANON_PRICE && f.basementTypical !== null
      ? [whole, { key: `${f.type}-basement`, label: `${label}, basement unit`, value: formatRent(f.basementTypical), window: m.window, sample: leases(f.basementCount) }]
      : [whole];
  });

  return {
    now: {
      sub: `${available} available`,
      cta: scoped ? `See all ${formatCount(scoped.count)} in ${scoped.name}` : seeAll,
      lead: scoped
        ? [
            fig("menu-rent-now-hub", formatCount(scoped.count)),
            t(` ${plural(scoped.count, "home", "homes")} for rent in ${scoped.name}, available now, `),
            fig("menu-rent-now", available),
            t(" across Milton."),
          ]
        : [fig("menu-rent-now", available), t(` ${plural(r.available, "home", "homes")} for rent in Milton, available now.`)],
      cards: cards(r.cards),
      strip: x.strips.rent,
      note: "Homes advertised for lease on the MLS, newest first. Asking rents, as the feed states them.",
    },
    hoods: {
      sub: `${formatCount(i.hubs.length)} neighbourhoods`,
      cta: seeAll,
      lead: [
        fig("menu-rent-now", available),
        t(" homes for rent across "),
        fig("menu-rent-hubs", formatCount(i.hubs.length)),
        t(" Milton neighbourhoods. Pick yours to see only what is available there."),
      ],
      hubs,
      hubsLabel: "Neighbourhoods, with homes for rent now",
      hubsFig: "menu-rent-hub",
    },
    typical: {
      // No blended Milton-wide typical: one number over houses, basements and condo suites
      // together describes none of them. The figures below are the statement.
      sub: `By home type, ${m.window}`,
      cta: seeAll,
      lead:
        m.count > 0
          ? [
              fig("menu-rent-leased", formatCount(m.count)),
              t(` ${plural(m.count, "home", "homes")} leased in Milton in the ${m.window}. What each kind of home went for, from the Board's closed leases:`),
            ]
          : [t(`No closed leases on record for the ${m.window}.`)],
      // ONE FIGURE PER HOME TYPE AND UNIT CLASS, EACH GATED ON ITS OWN SAMPLE. Below the floor
      // the value says so in words; the sample beside it says how far below.
      figures: typicalFigures,
      basis,
      note: m.through ? `Closed leases through ${formatDateProse(m.through)}.` : undefined,
    },
    new: {
      sub: `${formatCount(r.week.count)} this week`,
      cta: seeAll,
      lead: [
        fig("menu-rent-week", formatCount(r.week.count)),
        t(` ${plural(r.week.count, "home", "homes")} listed for rent in the last 7 days, `),
        fig("menu-rent-now", available),
        t(" available in all."),
      ],
      // The newest four regardless: a quiet week must not empty the panel.
      cards: cards(r.week.count >= CARDS ? r.week.cards : r.cards),
      strip: x.strips.rent,
      note: r.week.count < CARDS ? "The newest homes for rent, most recent first." : undefined,
    },
    landlord: {
      sub: "List with Aamir",
      cta: "List your rental with Aamir",
      // ONE TRUE SENTENCE FROM LIVE FIGURES. Three figures, each gated on the same pool; if
      // the pool is under the floor, the sentence is the count alone.
      lead:
        m.count > 0
          ? m.days !== null && m.leasedToAsk !== null
            ? [
                fig("menu-rent-leased", formatCount(m.count)),
                t(` Milton ${plural(m.count, "home", "homes")} leased through the MLS in the ${m.window}, in `),
                fig("menu-rent-days", formatDays(m.days)),
                t(" on the market and at "),
                fig("menu-rent-lta", formatPct1(m.leasedToAsk)),
                t(" of asking."),
              ]
            : [fig("menu-rent-leased", formatCount(m.count)), t(` Milton ${plural(m.count, "home", "homes")} leased through the MLS in the ${m.window}.`)]
          : [t(`No closed leases on record for the ${m.window}.`)],
      // THREE PROOF POINTS, each a figure with its window and its sample.
      figures: [
        { key: "leased", label: "Leased in 12 months", value: formatCount(m.count), window: m.window, sample: "the Board's record" },
        { key: "days", label: "Days to lease", value: formatDays(m.days), window: m.window, sample: leases(m.count) },
        { key: "lta", label: "Leased to ask", value: formatPct1(m.leasedToAsk), window: m.window, sample: leases(m.count) },
      ],
      note: "An MLS listing is on every brokerage's site and every portal the same day, with a screened tenant (credit, references, employment) on the Ontario standard lease. A Facebook post reaches whoever scrolls past it.",
    },
  };
}

// ── the homepage's caller ────────────────────────────────────────────────────────────────

/**
 * The homepage's composer input, from data the page has already fetched plus the extras. No
 * second query on the page that already ran them, and the Sell panel reads the SAME Board
 * row the Board renders below it, so the menu cannot state a market figure the section under
 * it contradicts.
 */
export function buildMegaLive(data: HomepageData, board: BoardTab[] | null, extras: MegaExtras): MegaLive {
  const hubByRaw = new Map<string, { slug: string; name: string }>();
  for (const l of data.newestListings) if (l.hubSlug && l.hubName) hubByRaw.set(l.neighbourhood, { slug: l.hubSlug, name: l.hubName });
  return composeMegaLive({
    onMarket: data.stats.onMarket,
    newThisWeek: data.stats.newThisWeek,
    listings: data.newestListings,
    hubByRaw,
    streetPageCount: data.streetPageCount,
    videoCount: data.videoCount,
    hubs: data.neighbourhoods,
    board,
    extras,
  });
}

// ── the queries ──────────────────────────────────────────────────────────────────────────

const SALE_ACTIVE = { status: "active", transactionType: { not: "For Lease" } } as const;
/** A lease is `status='rented'` for life; `leaseStatus` carries the lifecycle. See rentalsAvailable.ts. */
const LEASE_AVAILABLE = { transactionType: "For Lease", leaseStatus: "active" } as const;
const SHOWN = { permAdvertise: true, city: config.PRISMA_CITY_VALUE } as const;

/** slug -> display name, through the one street-name resolver. */
async function namesFor(slugs: string[]): Promise<Map<string, string>> {
  if (slugs.length === 0) return new Map();
  const rows = await prisma.residentialStreet.findMany({ where: { slug: { in: slugs } }, select: { slug: true, name: true } });
  return new Map(rows.map((r) => [r.slug, resolveStreetName(r.slug, r.name).name]));
}

/** The three strips. Each is one query over a real count, filtered to published pages. */
export async function getMegaStrips(published: Set<string>): Promise<MegaStrips> {
  const [activeByStreet, rentByStreet, gscRows, soldRows] = await Promise.all([
    prisma.listing.groupBy({
      by: ["streetSlug"],
      _count: { _all: true },
      where: {
        status: "active",
        permAdvertise: true,
        city: config.PRISMA_CITY_VALUE,
        transactionType: { not: "For Lease" },
        streetSlug: { in: Array.from(published) },
      },
      orderBy: { _count: { streetSlug: "desc" } },
      take: STRIP_SIZE,
    }),
    prisma.listing.groupBy({
      by: ["streetSlug"],
      _count: { _all: true },
      where: { ...LEASE_AVAILABLE, ...SHOWN, streetSlug: { in: Array.from(published) } },
      orderBy: { _count: { streetSlug: "desc" } },
      take: STRIP_SIZE,
    }),
    prisma.seoOpportunity.findMany({
      where: { targetPage: { startsWith: "/streets/" } },
      select: { query: true, targetPage: true, impressions: true },
    }),
    prisma.residentialStreet.findMany({
      where: { slug: { in: Array.from(published) }, soldCount12mo: { gt: 0 } },
      orderBy: { soldCount12mo: "desc" },
      take: STRIP_SIZE,
      select: { slug: true, name: true, soldCount12mo: true },
    }),
  ]);

  // GSC: one impression count per query (a query can sit in two classes), summed per page.
  const byQuery = new Map<string, { page: string; imp: number }>();
  for (const r of gscRows) {
    const page = r.targetPage ?? "";
    const cur = byQuery.get(r.query);
    if (!cur || r.impressions > cur.imp) byQuery.set(r.query, { page, imp: r.impressions });
  }
  const byPage = new Map<string, number>();
  for (const { page, imp } of Array.from(byQuery.values())) byPage.set(page, (byPage.get(page) ?? 0) + imp);
  const searched = Array.from(byPage.entries())
    .map(([page, imp]) => ({ slug: page.replace(/^\/streets\//, "").replace(/\/$/, ""), imp }))
    .filter((s) => published.has(s.slug) && s.imp > 0)
    .sort((a, b) => b.imp - a.imp)
    .slice(0, STRIP_SIZE);

  const names = await namesFor([
    ...activeByStreet.map((r) => r.streetSlug),
    ...rentByStreet.map((r) => r.streetSlug),
    ...searched.map((s) => s.slug),
    ...soldRows.map((r) => r.slug),
  ]);
  const name = (slug: string, fallback?: string | null) => names.get(slug) ?? resolveStreetName(slug, fallback).name;

  const buy: MegaStrip | undefined = activeByStreet.length
    ? {
        label: "Most for sale right now",
        items: activeByStreet.map((r) => ({ slug: r.streetSlug, name: name(r.streetSlug), note: `${r._count._all} for sale` })),
      }
    : undefined;

  const rent: MegaStrip | undefined = rentByStreet.length
    ? {
        label: "Most for rent right now",
        items: rentByStreet.map((r) => ({ slug: r.streetSlug, name: name(r.streetSlug), note: `${r._count._all} for rent` })),
      }
    : undefined;

  const sellItems = soldRows.map((r) => ({ slug: r.slug, name: name(r.slug, r.name), note: `${r.soldCount12mo} sold` }));
  const sell: MegaStrip | undefined = sellItems.length ? { label: "Most sales, last 12 months", items: sellItems } : undefined;

  // Search Console when it has enough to rank on; the 12-month sales count otherwise. The
  // label says which, so the strip never claims a source it is not using.
  const streets: MegaStrip | undefined =
    searched.length >= GSC_STRIP_FLOOR
      ? { label: "Most searched on Google", items: searched.map((s) => ({ slug: s.slug, name: name(s.slug), note: `${s.imp} searches` })) }
      : sell
        ? { label: "Busiest streets, last 12 months", items: sellItems }
        : undefined;

  return { buy, rent, streets, sell };
}

/** The A to Z index: published street pages per first letter. Letters with none are not links.
 *  The slug's first character stands in for the name's: a slug is the name, lower-cased. */
function lettersOf(published: Set<string>): MegaLetter[] {
  const counts = new Map<string, number>();
  for (const slug of Array.from(published)) {
    const c = slug.charAt(0).toUpperCase();
    if (c >= "A" && c <= "Z") counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return Array.from({ length: 26 }, (_, k) => {
    const letter = String.fromCharCode(65 + k);
    const n = counts.get(letter) ?? 0;
    return { letter, count: n === 0 ? NULL_GLYPH : formatCount(n), href: n === 0 ? null : `/streets?letter=${letter}` };
  });
}

/** Ownership-type predicates, the tenure hubs' own sets (tenureHubData.ts). PropTx ships some
 *  sub-types with a trailing space ("Semi-Detached "), so each is matched both ways. */
const SUBTYPES = {
  condo: ["Condo Apartment", "Condo Townhouse"],
  freehold: ["Detached", "Semi-Detached", "Att/Row/Townhouse", "Duplex"],
};
const subtypeIn = (set: string[]) => ({ in: set.flatMap((s) => [s, `${s} `]) });

/** Everything the menu needs beyond what the homepage already fetches. */
export async function getMegaExtras(): Promise<MegaExtras> {
  const published = new Set(await publishedStreetPageSlugs());
  const now = Date.now();
  const changed7 = { ...SALE_ACTIVE, lastPriceChangeAt: { gte: new Date(now - 7 * DAY_MS) } };

  const week = { ...LEASE_AVAILABLE, listedAt: { gte: new Date(now - 7 * DAY_MS) } };
  const [strips, newLast24h, changes7, condoCount, condoCards, freeholdCount, freeholdCards, rentalCount, rentalCards, leaseWeek, leaseWeekCards, leaseByRaw, hubByRaw, market, videos, soldMtd, edition] =
    await Promise.all([
      getMegaStrips(published),
      prisma.listing.count({ where: { ...SALE_ACTIVE, ...SHOWN, listedAt: { gte: new Date(now - DAY_MS) } } }),
      prisma.listing.count({ where: { ...changed7, ...SHOWN } }),
      prisma.listing.count({ where: { ...SALE_ACTIVE, ...SHOWN, propertySubType: subtypeIn(SUBTYPES.condo) } }),
      getListingCards({ where: { ...SALE_ACTIVE, propertySubType: subtypeIn(SUBTYPES.condo) }, take: CARDS }),
      prisma.listing.count({ where: { ...SALE_ACTIVE, ...SHOWN, propertySubType: subtypeIn(SUBTYPES.freehold) } }),
      getListingCards({ where: { ...SALE_ACTIVE, propertySubType: subtypeIn(SUBTYPES.freehold) }, take: CARDS }),
      getRentalsAvailableCount(),
      getListingCards({ where: LEASE_AVAILABLE, take: CARDS }),
      prisma.listing.count({ where: { ...week, ...SHOWN } }),
      getListingCards({ where: week, take: CARDS }),
      // Available leases per raw TREB string, folded onto PUBLISHED hubs below through the
      // same map every listing-to-hub link uses; a raw string with no published hub counts
      // for nothing rather than for a guessed page.
      prisma.listing.groupBy({ by: ["neighbourhood"], _count: { _all: true }, where: { ...LEASE_AVAILABLE, ...SHOWN } }),
      getRawStringHubMap(),
      getLeaseMarket(),
      getStreetsWithVideo(POSTERS),
      getSoldThisMonth(),
      prisma.marketEdition.findFirst({
        where: { status: "published" },
        orderBy: { weekOf: "desc" },
        select: { weekOf: true, sectionsJson: true, summarySentence: true },
      }),
    ]);

  // Price changes: seven days, widened to thirty when the week has none, and the window is
  // stated on the panel either way.
  let priceChanges: MegaExtras["priceChanges"];
  if (changes7 > 0) {
    priceChanges = { windowDays: 7, count: changes7 };
  } else {
    const changed30 = { ...SALE_ACTIVE, lastPriceChangeAt: { gte: new Date(now - 30 * DAY_MS) } };
    priceChanges = { windowDays: 30, count: await prisma.listing.count({ where: { ...changed30, ...SHOWN } }) };
  }

  const byHub = new Map<string, number>();
  for (const row of leaseByRaw) {
    const hub = hubByRaw.get(row.neighbourhood);
    if (hub) byHub.set(hub.slug, (byHub.get(hub.slug) ?? 0) + row._count._all);
  }

  return {
    strips,
    newLast24h,
    priceChanges,
    condos: { count: condoCount, cards: condoCards },
    freehold: { count: freeholdCount, cards: freeholdCards },
    rent: { available: rentalCount, byHub, cards: rentalCards, week: { count: leaseWeek, cards: leaseWeekCards }, market },
    videos,
    letters: lettersOf(published),
    soldMtd,
    edition: edition ? { weekOf: edition.weekOf, sections: edition.sectionsJson as unknown as EditionSections, summary: edition.summarySentence } : null,
  };
}

// ── the site-wide read, memoised ─────────────────────────────────────────────────────────
// Five minutes, the same TTL and the same shape as buildMiltonWideContext's memo, for the
// same reason: the nav renders on every page, and a page render must not pay for twenty
// queries. A rejected promise is dropped rather than cached, so one database blip cannot
// poison every menu on the site for the length of the TTL.
const MEGA_TTL_MS = 5 * 60 * 1000;
let _cache: Promise<MegaInputs> | null = null;
let _cachedAt = 0;

export function resetMegaLiveCache(): void {
  _cache = null;
  _cachedAt = 0;
}

async function computeMegaInputs(): Promise<MegaInputs> {
  const [mw, newThisWeek, listings, hubByRaw, published, videoCount, hubs, board, extras] = await Promise.all([
    buildMiltonWideContext(),
    getNewThisWeekCount(),
    getNewestListingCards(CARDS),
    getRawStringHubMap(),
    publishedStreetPageSlugs(),
    getStreetVideoCount(),
    getNeighbourhoodCards(),
    getBoardData(),
    getMegaExtras(),
  ]);
  return {
    onMarket: mw.activeListingsCount,
    newThisWeek,
    listings,
    hubByRaw,
    streetPageCount: published.length,
    videoCount,
    hubs,
    board,
    extras,
  };
}

function getMegaInputs(): Promise<MegaInputs> {
  if (_cache && Date.now() - _cachedAt < MEGA_TTL_MS) return _cache;
  const p = computeMegaInputs();
  _cache = p;
  _cachedAt = Date.now();
  p.catch(() => {
    if (_cache === p) resetMegaLiveCache();
  });
  return p;
}

/** The menu's live content for any page that is not the homepage. The INPUTS are memoised;
 *  the composition runs per page, because a hub or a street page swaps in its own strips
 *  (getContextStrips) and the composer is pure and cheap. */
export async function getMegaLive(context?: NavContext): Promise<MegaLive> {
  const [inputs, strips] = await Promise.all([getMegaInputs(), getContextStrips(context)]);
  if (!Object.keys(strips).length) return composeMegaLive({ ...inputs, context });
  return composeMegaLive({ ...inputs, context, extras: { ...inputs.extras, strips: { ...inputs.extras.strips, ...strips } } });
}
