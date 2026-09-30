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
// PUBLIC ROWS ONLY (MC-046 Stage 1, R8; PropTx VOW Best Practices item 40). The `MegaLive`
// this module builds is serialized into the client SiteNav on every page and server-rendered
// in hidden panels, so anything in it reaches a signed-out reader. It carries links, listing
// cards and counts of ACTIVE listings, and nothing derived from a sold, leased, expired or
// terminated record, or from price history. Stage 1 removed, and this module no longer reads:
//   Sell      the Board's typical, days to sell and sold to ask, their samples and basis
//   Sold this month, its count and typical (the rail item is gone)
//   Market watch, its weekly sold count and summary (out of the menu entirely, R6)
//   Rent      typical rent by home type from closed leases (the rail item is gone), and the
//             landlord panel's leased count, days to lease and leased to ask
//   Buy       the price-change counts (price history)
//   strips    "N sold", "Most sales", "Busiest streets" (R9: a rank by sales is a disclosure)
//
// THE LEFT RAIL DRIVES THE RIGHT PANEL. Each menu is a rail of items and each item selects
// its own panel: Buy has new today, price changes, condos, freehold and alerts; Rent (MH-007)
// has available now, by neighbourhood, new this week and landlords; Streets has address
// search, by neighbourhood, with video and A to Z; Sell has what it's worth. Every item's
// content is one `MegaItemContent`, composed here from a live query and rendered by one
// component. No item may lead to an empty panel: each carries at least one live block and its
// CTA, and the battery asserts it.
//
// OPEN HOUSES ARE NOT HERE. The brief listed them. The feed carries no open-house field on
// any row, so a panel of them could only be invented, and a page that cannot meet the rules
// is not built. Recorded in HANDOFF-home.md.
//
// ONE COMPOSER. `composeMegaLive()` is pure and is the only place a menu string is built.
// The homepage feeds it from `getHomepageData()` for the inputs it already fetched (no
// duplicate query on the page that ran them) plus `getMegaExtras()` for the rest; every other
// page feeds it from `getMegaLive()`. Two callers, one formatter.
//
// THE STRIPS ARE FOUR DIFFERENT QUESTIONS, from four public counts, ties alphabetical:
//   Buy      which streets have the most homes for sale right now   (active Listing rows)
//   Rent     which streets have the most homes for rent right now   (available lease rows)
//   Streets  which streets are searched for most                     (GSC impressions, when
//            the sense run has enough of them; otherwise no global strip)
//   Sell     which streets had the most homes newly listed in the last 30 days, still active
// Every strip link is a PUBLISHED PAGE: the candidate set is intersected with
// publishedStreetPageSlugs(), the sitemap's own set, so the menu cannot link a 404.
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { publishedStreetPageSlugs } from "@/lib/streetSurface";
import { getNeighbourhoodCards, getRawStringHubMap } from "@/lib/neighbourhoodCards";
import { getNewThisWeekCount, getOnMarketCount, getStreetsWithVideo, getStreetVideoCount, type StreetVideoCard } from "@/lib/homeSignals";
import { getNewestListingCards, getListingCards } from "@/lib/listingsV2Data";
import { getRentalsAvailableCount } from "@/lib/rentalsAvailable";
import { resolveStreetName } from "@/lib/streetName";
import { formatCount, formatMoneyWhole, NULL_GLYPH } from "@/lib/figureFormat";
import { getContextStrips } from "@/lib/megaContext";
import type { ListingCardData } from "@/components/listings/v2/types";
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

/** The Rent menu's inputs (MH-007): DB1's available leases, and nothing from a closed one. */
export interface MegaRent {
  /** available now, Milton-wide: the figure /rentals publishes */
  available: number;
  /** available now per PUBLISHED hub, by slug; a hub with none is present at 0 */
  byHub: Map<string, number>;
  /** the newest four available */
  cards: ListingCardData[];
  /** listed for lease in the last 7 days */
  week: { count: number; cards: ListingCardData[] };
}

/** Everything the menu needs that the homepage does not already fetch for itself. */
export interface MegaExtras {
  strips: MegaStrips;
  newLast24h: number;
  condos: { count: number; cards: ListingCardData[] };
  freehold: { count: number; cards: ListingCardData[] };
  rent: MegaRent;
  /** filmed streets, newest capture first */
  videos: StreetVideoCard[];
  letters: MegaLetter[];
}

/** A published hub as the menu states it: its name and its active count, nothing else. */
export interface MegaHubInput {
  slug: string;
  name: string;
  activeCount: number;
}

export interface MegaInputs {
  onMarket: number;
  newThisWeek: number;
  listings: ListingCardData[];
  hubByRaw: Map<string, { slug: string; name: string }>;
  streetPageCount: number;
  videoCount: number;
  hubs: MegaHubInput[];
  extras: MegaExtras;
  /** the page's subject, when it has one: the Rent menu scopes "available now" to its hub */
  context?: NavContext;
}

const STRIP_SIZE = 8;
/** Below this many streets with search impressions, the Streets menu has no global strip. */
const GSC_STRIP_FLOOR = 6;
const CARDS = 4;
const POSTERS = 8;
const DAY_MS = 24 * 60 * 60 * 1000;
/** The Sell strip's window: homes newly listed in it and still for sale. */
const NEW_LISTED_DAYS = 30;

// ── formatting helpers, all through figureFormat ─────────────────────────────────────────

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
  const active = formatCount(i.onMarket);
  const newWeek = formatCount(i.newThisWeek);
  const pages = formatCount(i.streetPageCount);
  const filmed = formatCount(i.videoCount);

  // ── BUY ─────────────────────────────────────────────────────────────────
  // THE RAIL READS AT A GLANCE (MA-004 change 10). Every item carries one fact under its name
  // and its CTA carries the count it leads to; a rail of six bare words made the visitor open
  // each one to learn what it held.
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
      // NO COUNT (MC-046 R8). How many asking prices moved is price history across the market,
      // as much as which listing moved and from what (MC-029). The item links the unfiltered
      // grid, and each listing page shows its own history to a signed-in reader.
      sub: "Every home for sale, newest first",
      cta: `See all ${active} for sale`,
      // The newest homes, not the changed ones: naming a listing under this heading would say
      // its price moved, which is its price history (MC-029).
      cards: cards(i.listings),
      strip: x.strips.buy,
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
      lead: [fig("menu-buy-new", newWeek), t(` new ${plural(i.newThisWeek, "listing", "listings")} this week.`)],
      note: "One email each weekday morning with what listed and what changed. Nothing else, and no newsletter.",
    },
  };

  // ── RENT (MH-007) ───────────────────────────────────────────────────────
  // A RENTER FINDS THEIR NEIGHBOURHOOD IN TWO CLICKS: the hub list links the scoped /rentals,
  // and on a hub or a street page "available now" is already that hub's count and its CTA
  // already that hub's page. A landlord gets the form to list; what leased, how fast and at
  // what share of asking left with MC-046 (closed leases are VOW records).
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
      // "Every one states what homes there actually sold for" left this sentence (MA-004 defect
      // 15), and "its own sales record" left it with MC-046: a signed-out reader sees none.
      lead: [fig("menu-streets-pages", pages), t(" street pages, A to Z, each with the neighbourhood around it.")],
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
  // ONE ITEM (MC-046 R8). The Board's typical, days to sell and sold to ask, Sold this month
  // and Market watch were all sold statistics and left the menu. What's it worth keeps its
  // valuation CTA, its strip and, in SiteNav, the one neutral line where the figures were.
  const sell: Record<string, MegaItemContent> = {
    worth: { sub: "A written valuation", strip: x.strips.sell, note: VALUATION_NOTE },
  };

  return { buy, rent, streets, sell };
}

/** The Rent menu, its own function because it has its own inputs. Every figure is a display
 *  string from figureFormat, and every one counts available leases. */
function composeRent(i: MegaInputs): Record<string, MegaItemContent> {
  const x = i.extras;
  const r = x.rent;
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
      // NO LEASE FIGURES (MC-046 R8). The leased count, days to lease and leased to ask were
      // closed-lease statistics. The panel is the item's blurb, this note and the form.
      note: "An MLS listing is on every brokerage's site and every portal the same day, with a screened tenant (credit, references, employment) on the Ontario standard lease. A Facebook post reaches whoever scrolls past it.",
    },
  };
}

// ── the homepage's caller ────────────────────────────────────────────────────────────────

/** The homepage's composer input, from data the page has already fetched plus the extras. */
export function buildMegaLive(data: HomepageData, extras: MegaExtras): MegaLive {
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

/** The four strips. Each is one query over a public count, filtered to published pages, most
 *  first and ties by slug, which is the street's name lower-cased (A to Z). */
export async function getMegaStrips(published: Set<string>): Promise<MegaStrips> {
  const slugs = Array.from(published);
  const [activeByStreet, rentByStreet, gscRows, newByStreet] = await Promise.all([
    prisma.listing.groupBy({
      by: ["streetSlug"],
      _count: { _all: true },
      where: { ...SALE_ACTIVE, ...SHOWN, streetSlug: { in: slugs } },
      orderBy: [{ _count: { streetSlug: "desc" } }, { streetSlug: "asc" }],
      take: STRIP_SIZE,
    }),
    prisma.listing.groupBy({
      by: ["streetSlug"],
      _count: { _all: true },
      where: { ...LEASE_AVAILABLE, ...SHOWN, streetSlug: { in: slugs } },
      orderBy: [{ _count: { streetSlug: "desc" } }, { streetSlug: "asc" }],
      take: STRIP_SIZE,
    }),
    prisma.seoOpportunity.findMany({
      where: { targetPage: { startsWith: "/streets/" } },
      select: { query: true, targetPage: true, impressions: true },
    }),
    prisma.listing.groupBy({
      by: ["streetSlug"],
      _count: { _all: true },
      where: { ...SALE_ACTIVE, ...SHOWN, streetSlug: { in: slugs }, listedAt: { gte: new Date(Date.now() - NEW_LISTED_DAYS * DAY_MS) } },
      orderBy: [{ _count: { streetSlug: "desc" } }, { streetSlug: "asc" }],
      take: STRIP_SIZE,
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
    .sort((a, b) => b.imp - a.imp || a.slug.localeCompare(b.slug))
    .slice(0, STRIP_SIZE);

  const names = await namesFor([
    ...activeByStreet.map((r) => r.streetSlug),
    ...rentByStreet.map((r) => r.streetSlug),
    ...searched.map((s) => s.slug),
    ...newByStreet.map((r) => r.streetSlug),
  ]);
  const name = (slug: string) => names.get(slug) ?? resolveStreetName(slug, null).name;

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

  // THE SELL STRIP (MC-046 R9). It was "Most sales, last 12 months", each link carrying "N
  // sold". A seller's question the public feed can answer is what they would be listing
  // against: the streets with the most homes newly listed in the last 30 days, still for sale.
  const sell: MegaStrip | undefined = newByStreet.length
    ? {
        label: `Newly listed, last ${NEW_LISTED_DAYS} days`,
        items: newByStreet.map((r) => ({ slug: r.streetSlug, name: name(r.streetSlug), note: `${r._count._all} new` })),
      }
    : undefined;

  // Search Console when it has enough to rank on. The fallback was the 12-month sales count
  // ("Busiest streets"); with that gone there is no global Streets strip below the floor, and
  // a street or hub page still gets its own from getContextStrips().
  const streets: MegaStrip | undefined =
    searched.length >= GSC_STRIP_FLOOR
      ? { label: "Most searched on Google", items: searched.map((s) => ({ slug: s.slug, name: name(s.slug), note: `${s.imp} searches` })) }
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

  const week = { ...LEASE_AVAILABLE, listedAt: { gte: new Date(now - 7 * DAY_MS) } };
  const [strips, newLast24h, condoCount, condoCards, freeholdCount, freeholdCards, rentalCount, rentalCards, leaseWeek, leaseWeekCards, leaseByRaw, hubByRaw, videos] =
    await Promise.all([
      getMegaStrips(published),
      prisma.listing.count({ where: { ...SALE_ACTIVE, ...SHOWN, listedAt: { gte: new Date(now - DAY_MS) } } }),
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
      getStreetsWithVideo(POSTERS),
    ]);

  const byHub = new Map<string, number>();
  for (const row of leaseByRaw) {
    const hub = hubByRaw.get(row.neighbourhood);
    if (hub) byHub.set(hub.slug, (byHub.get(hub.slug) ?? 0) + row._count._all);
  }

  return {
    strips,
    newLast24h,
    condos: { count: condoCount, cards: condoCards },
    freehold: { count: freeholdCount, cards: freeholdCards },
    rent: { available: rentalCount, byHub, cards: rentalCards, week: { count: leaseWeek, cards: leaseWeekCards } },
    videos,
    letters: lettersOf(published),
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
  const [onMarket, newThisWeek, listings, hubByRaw, published, videoCount, hubCards, extras] = await Promise.all([
    getOnMarketCount(),
    getNewThisWeekCount(),
    getNewestListingCards(CARDS),
    getRawStringHubMap(),
    publishedStreetPageSlugs(),
    getStreetVideoCount(),
    getNeighbourhoodCards(),
    getMegaExtras(),
  ]);
  return {
    onMarket,
    newThisWeek,
    listings,
    hubByRaw,
    streetPageCount: published.length,
    videoCount,
    // The three keys the menu states, and nothing else a hub card may carry.
    hubs: hubCards.map((h) => ({ slug: h.slug, name: h.name, activeCount: h.activeCount })),
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
