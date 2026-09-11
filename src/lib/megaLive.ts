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
// its own panel: Buy has new today, price changes, condos, freehold, rentals and alerts;
// Streets has by neighbourhood, with video, A to Z and address search; Sell has what it's
// worth, sold this month and market watch. Every item's content is one `MegaItemContent`,
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
// THE STRIPS ARE THREE DIFFERENT QUESTIONS, from three real counts:
//   Buy      which streets have the most homes for sale right now   (live Listing rows)
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
import { getBoardData } from "@/lib/board/boardData";
import { resolveStreetName } from "@/lib/streetName";
import { formatCount, formatDays, formatMoney1k, formatMoneyWhole, formatPct1, NULL_GLYPH } from "@/lib/figureFormat";
import type { ListingCardData } from "@/components/listings/v2/types";
import type { BoardTab } from "@/lib/board/computeBoard";
import type { EditionSections } from "@/lib/marketWatch/edition";
import type { HomepageData } from "@/components/home/types";
import type {
  LeadSegment,
  MegaItemContent,
  MegaLetter,
  MegaListing,
  MegaLive,
  MegaStrip,
} from "@/components/nav/megaTypes";

// ── the inputs ───────────────────────────────────────────────────────────────────────────

export interface MegaStrips {
  buy?: MegaStrip;
  streets?: MegaStrip;
  sell?: MegaStrip;
}

/** Everything the menu needs that the homepage does not already fetch for itself. */
export interface MegaExtras {
  strips: MegaStrips;
  newLast24h: number;
  /** listings whose price changed in the window, newest change first */
  priceChanges: { windowDays: number; count: number; cards: ListingCardData[] };
  condos: { count: number; cards: ListingCardData[] };
  freehold: { count: number; cards: ListingCardData[] };
  rentals: { count: number; cards: ListingCardData[] };
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
}

const STRIP_SIZE = 8;
/** Below this many streets with search impressions, the Streets strip falls back to sales. */
const GSC_STRIP_FLOOR = 6;
const CARDS = 4;
const POSTERS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;

// ── formatting helpers, all through figureFormat ─────────────────────────────────────────

const sales = (n: number) => `${formatCount(n)} ${n === 1 ? "sale" : "sales"}`;
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
    dom: l.daysOnMarket === null ? null : formatDays(l.daysOnMarket),
    hub: hubByRaw.get(l.neighbourhood)?.name ?? null,
  };
  // DEC-PRICE-HISTORY: a prior price is stated only when one was observed. A change with no
  // prior on record is a change, not a drop, and says nothing about direction.
  if (l.priorPrice != null && l.priorPrice > 0 && l.priorPrice !== l.price) {
    out.priorPrice = formatMoneyWhole(l.priorPrice);
    const d = l.price - l.priorPrice;
    out.change = `${d < 0 ? "down" : "up"} ${formatMoneyWhole(Math.abs(d))}`;
  }
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
  const buy: Record<string, MegaItemContent> = {
    new: {
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
      lead:
        x.priceChanges.count > 0
          ? [
              fig("menu-buy-changes", formatCount(x.priceChanges.count)),
              t(` price ${plural(x.priceChanges.count, "change", "changes")} in ${changesWindow}.`),
            ]
          : [t(`No price changes recorded in ${changesWindow}.`)],
      cards: cards(x.priceChanges.cards),
      strip: x.strips.buy,
      note: "A prior price is stated only where the change was observed on this site. The feed records that a price moved, not what it moved from.",
    },
    condos: {
      lead: [fig("menu-buy-condos", formatCount(x.condos.count)), t(` ${plural(x.condos.count, "condo", "condos")} for sale in Milton.`)],
      cards: cards(x.condos.cards),
      note: "Condo apartments and condo townhouses, by the feed's own ownership type.",
    },
    freehold: {
      lead: [fig("menu-buy-freehold", formatCount(x.freehold.count)), t(` freehold ${plural(x.freehold.count, "home", "homes")} for sale in Milton.`)],
      cards: cards(x.freehold.cards),
      note: "Detached, semi-detached, freehold townhomes and duplexes. No condo corporation, no fee.",
    },
    rentals: {
      lead: [fig("menu-buy-rentals", formatCount(x.rentals.count)), t(` ${plural(x.rentals.count, "home", "homes")} for rent in Milton, available now.`)],
      cards: cards(x.rentals.cards),
    },
    alerts: {
      lead: [
        fig("menu-buy-new", newWeek),
        t(" new listings this week and "),
        fig("menu-buy-changes", formatCount(x.priceChanges.count)),
        t(` price changes in ${changesWindow}.`),
      ],
      note: "One email each weekday morning with what listed, what sold and what moved on price. Nothing else, and no newsletter.",
    },
  };

  // ── STREETS ─────────────────────────────────────────────────────────────
  const streets: Record<string, MegaItemContent> = {
    hoods: {
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
      lead: [fig("menu-streets-filmed", filmed), t(` ${plural(i.videoCount, "street", "streets")} filmed end to end, by day and overnight.`)],
      videos: x.videos.slice(0, POSTERS).map((v) => ({ slug: v.slug, name: v.name, poster: v.poster, variant: v.variant })),
    },
    az: {
      lead: [fig("menu-streets-pages", pages), t(" street pages, A to Z. Every one states what homes there actually sold for.")],
      letters: x.letters,
    },
    search: {
      lead: [t("Type a street, an address or a neighbourhood and land on its page. "), fig("menu-streets-pages", pages), t(" streets have one.")],
      strip: x.strips.streets,
    },
  };

  // ── SELL ────────────────────────────────────────────────────────────────
  const sell: Record<string, MegaItemContent> = {
    worth: overall
      ? {
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
          strip: x.strips.sell,
          note: VALUATION_NOTE,
        }
      : { strip: x.strips.sell, note: VALUATION_NOTE },
    soldmtd: {
      // "So far": the month is still filling in. The typical is k-gated and absent below k.
      lead: [
        fig("menu-sold-mtd", formatCount(x.soldMtd.count)),
        t(` ${plural(x.soldMtd.count, "home", "homes")} sold in Milton so far this month`),
        ...(x.soldMtd.typicalPrice !== null ? [t(", typically "), fig("menu-sold-mtd-typical", formatMoney1k(x.soldMtd.typicalPrice)), t(".")] : [t(".")]),
      ],
      strip: x.strips.sell,
      note: `Closed sales through ${x.soldMtd.through}. Individual sold prices are on the street pages, for signed-in readers.`,
    },
    watch: x.edition
      ? {
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

  return { buy, streets, sell };
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

/** slug -> display name, through the one street-name resolver. */
async function namesFor(slugs: string[]): Promise<Map<string, string>> {
  if (slugs.length === 0) return new Map();
  const rows = await prisma.residentialStreet.findMany({ where: { slug: { in: slugs } }, select: { slug: true, name: true } });
  return new Map(rows.map((r) => [r.slug, resolveStreetName(r.slug, r.name).name]));
}

/** The three strips. Each is one query over a real count, filtered to published pages. */
export async function getMegaStrips(published: Set<string>): Promise<MegaStrips> {
  const [activeByStreet, gscRows, soldRows] = await Promise.all([
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

  return { buy, streets, sell };
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
const SALE_ACTIVE = { status: "active", transactionType: { not: "For Lease" } } as const;
/** A lease is `status='rented'` for life; `leaseStatus` carries the lifecycle. See rentalsAvailable.ts. */
const LEASE_AVAILABLE = { transactionType: "For Lease", leaseStatus: "active" } as const;
const SHOWN = { permAdvertise: true, city: config.PRISMA_CITY_VALUE } as const;

/** Everything the menu needs beyond what the homepage already fetches. */
export async function getMegaExtras(): Promise<MegaExtras> {
  const published = new Set(await publishedStreetPageSlugs());
  const now = Date.now();
  const changed7 = { ...SALE_ACTIVE, lastPriceChangeAt: { gte: new Date(now - 7 * DAY_MS) } };

  const [strips, newLast24h, changes7, condoCount, condoCards, freeholdCount, freeholdCards, rentalCount, rentalCards, videos, soldMtd, edition] =
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
    priceChanges = { windowDays: 7, count: changes7, cards: await getListingCards({ where: changed7, orderBy: { lastPriceChangeAt: "desc" }, take: CARDS }) };
  } else {
    const changed30 = { ...SALE_ACTIVE, lastPriceChangeAt: { gte: new Date(now - 30 * DAY_MS) } };
    const [count, cards] = await Promise.all([
      prisma.listing.count({ where: { ...changed30, ...SHOWN } }),
      getListingCards({ where: changed30, orderBy: { lastPriceChangeAt: "desc" }, take: CARDS }),
    ]);
    priceChanges = { windowDays: 30, count, cards };
  }

  return {
    strips,
    newLast24h,
    priceChanges,
    condos: { count: condoCount, cards: condoCards },
    freehold: { count: freeholdCount, cards: freeholdCards },
    rentals: { count: rentalCount, cards: rentalCards },
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
let _cache: Promise<MegaLive> | null = null;
let _cachedAt = 0;

export function resetMegaLiveCache(): void {
  _cache = null;
  _cachedAt = 0;
}

async function computeMegaLive(): Promise<MegaLive> {
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
  return composeMegaLive({
    onMarket: mw.activeListingsCount,
    newThisWeek,
    listings,
    hubByRaw,
    streetPageCount: published.length,
    videoCount,
    hubs,
    board,
    extras,
  });
}

/** The menu's live content for any page that is not the homepage. */
export function getMegaLive(): Promise<MegaLive> {
  if (_cache && Date.now() - _cachedAt < MEGA_TTL_MS) return _cache;
  const p = computeMegaLive();
  _cache = p;
  _cachedAt = Date.now();
  p.catch(() => {
    if (_cache === p) resetMegaLiveCache();
  });
  return p;
}
