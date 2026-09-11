// src/lib/megaLive.ts
// THE MENU'S LIVE CONTENT, on every page of the site.
//
// The mega menu used to be alive on the homepage only: page.tsx composed it from data the
// homepage had already fetched, and every other page rendered the rails and nothing else.
// Phone and desktop visitors land on a street page or a hub far more often than on "/", so
// the one element present on every page carried its product on the one page people reach
// least. This module is the other half: `getMegaLive()` gathers the same inputs from the
// same sources, memoised for five minutes per server instance, so a street page's menu
// states the same figures the homepage's does without a second code path formatting them.
//
// ONE COMPOSER. `composeMegaLive()` is pure and is the only place a menu string is built.
// The homepage feeds it from `getHomepageData()` (no duplicate queries on the page that
// already ran them, and the Sell panel reads the SAME Board row the Board renders below it);
// every other page feeds it from `getMegaLive()`. Two callers, one formatter.
//
// THE STRIPS ARE THREE DIFFERENT QUESTIONS. The old in-demand strip was one list of eight
// VIP streets repeated in all three panels. Each panel now answers the question its visitor
// is asking, from a real count:
//   Buy      which streets have the most homes for sale right now   (live Listing rows)
//   Streets  which streets are searched for most                     (GSC impressions,
//            when the sense run has enough of them; else 12-month sales)
//   Sell     which streets sold the most in the last 12 months       (ResidentialStreet)
// Every strip link is a PUBLISHED PAGE: the candidate set is intersected with
// publishedStreetPageSlugs(), the sitemap's own set, so the menu cannot link a 404.
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { publishedStreetPageSlugs, publishedStreetPageCount } from "@/lib/streetSurface";
import { buildMiltonWideContext } from "@/lib/ai/buildHubInput";
import { getNeighbourhoodCards, getRawStringHubMap, type NeighbourhoodCard } from "@/lib/neighbourhoodCards";
import { getNewThisWeekCount, getStreetsWithVideo, getStreetVideoCount, type StreetVideoCard } from "@/lib/homeSignals";
import { getNewestListingCards } from "@/lib/listingsV2Data";
import { getBoardData } from "@/lib/board/boardData";
import { resolveStreetName } from "@/lib/streetName";
import { formatCount, formatDays, formatMoney1k, formatMoneyWhole, formatPct1 } from "@/lib/figureFormat";
import type { ListingCardData } from "@/components/listings/v2/types";
import type { BoardTab } from "@/lib/board/computeBoard";
import type { MegaLive, MegaStrip } from "@/components/nav/megaTypes";
import type { HomepageData } from "@/components/home/types";

export interface MegaStrips {
  buy?: MegaStrip;
  streets?: MegaStrip;
  sell?: MegaStrip;
}

export interface MegaInputs {
  onMarket: number;
  newThisWeek: number;
  listings: ListingCardData[];
  hubByRaw: Map<string, { slug: string; name: string }>;
  streetPageCount: number;
  videoCount: number;
  videos: StreetVideoCard[];
  hubs: NeighbourhoodCard[];
  board: BoardTab[] | null;
  strips: MegaStrips;
}

const STRIP_SIZE = 8;
/** Below this many streets with search impressions, the Streets strip falls back to sales. */
const GSC_STRIP_FLOOR = 6;

const sales = (n: number) => `${formatCount(n)} ${n === 1 ? "sale" : "sales"}`;

/** A listing's display address, minus the city suffix the feed appends. The card sits under
 *  a heading that already says Milton; "1225 Manitou Way, Milton, Ontario" in a 200px card
 *  is an ellipsis where the street name should be. The redacted placeholder passes through. */
const shortAddress = (a: string) => a.replace(/,\s*Milton\b.*$/i, "");

/** The pure composer. Every string the menu renders is built here and nowhere else. */
export function composeMegaLive(i: MegaInputs): MegaLive {
  const overall = i.board?.find((t) => t.tab === "overall") ?? null;

  const active = formatCount(i.onMarket);
  const newWeek = formatCount(i.newThisWeek);
  const pages = formatCount(i.streetPageCount);
  const filmed = formatCount(i.videoCount);

  const sell = overall
    ? {
        figures: [
          { key: "typical", label: "Typical price", value: formatMoney1k(overall.typical.value), window: overall.typical.window, sample: sales(overall.typical.sample) },
          { key: "days", label: "Days to sell", value: formatDays(overall.daysToSell.value), window: overall.daysToSell.window, sample: sales(overall.daysToSell.sample) },
          // A RATIO. The unit conversion lives in formatPct1, which is the same function the
          // Board calls on the same row, so the two surfaces cannot disagree.
          { key: "sta", label: "Sold to ask", value: formatPct1(overall.soldToAsk.value), window: overall.soldToAsk.window, sample: sales(overall.soldToAsk.sample) },
        ],
        // The sentence states two figures; if either is suppressed there is no sentence. The
        // Board's rows are urban Milton, and the sentence says so.
        lead:
          overall.soldToAsk.value !== null && overall.daysToSell.value !== null
            ? `Over the last ${overall.soldToAsk.window}, urban Milton homes sold for ${formatPct1(overall.soldToAsk.value)} of asking, in ${formatDays(overall.daysToSell.value)}.`
            : null,
        strip: i.strips.sell,
      }
    : undefined;

  return {
    buy: {
      lead: `${active} homes for sale in Milton, ${newWeek} new this week.`,
      active,
      newThisWeek: newWeek,
      listings: i.listings.slice(0, 4).map((l) => {
        const hub = i.hubByRaw.get(l.neighbourhood) ?? null;
        return {
          mlsNumber: l.mlsNumber,
          address: shortAddress(l.address), // already through the display gate in listingsV2Data
          price: formatMoneyWhole(l.price),
          photo: l.photos[0] ?? null,
          beds: l.bedrooms,
          baths: l.bathrooms,
          dom: l.daysOnMarket === null ? null : formatDays(l.daysOnMarket),
          hub: hub?.name ?? null,
        };
      }),
      strip: i.strips.buy,
    },
    streets: {
      lead: `${pages} Milton streets with their own page, ${filmed} filmed end to end.`,
      pages,
      filmed,
      // Alphabetical: a visitor scans this column for a name they already know.
      hubs: [...i.hubs].sort((a, b) => a.name.localeCompare(b.name)).map((h) => ({ slug: h.slug, name: h.name, active: formatCount(h.activeCount) })),
      videos: i.videos.slice(0, 4).map((v) => ({ slug: v.slug, name: v.name, poster: v.poster, variant: v.variant })),
      strip: i.strips.streets,
    },
    sell,
  };
}

/**
 * The homepage's composer input, from data the page has already fetched. No second query on
 * the page that already ran them, and the Sell panel reads the SAME Board row the Board renders
 * below it, so the menu cannot state a market figure the section under it contradicts.
 */
export function buildMegaLive(data: HomepageData, board: BoardTab[] | null, strips: MegaStrips): MegaLive {
  const hubByRaw = new Map<string, { slug: string; name: string }>();
  for (const l of data.newestListings) if (l.hubSlug && l.hubName) hubByRaw.set(l.neighbourhood, { slug: l.hubSlug, name: l.hubName });
  return composeMegaLive({
    onMarket: data.stats.onMarket,
    newThisWeek: data.stats.newThisWeek,
    listings: data.newestListings,
    hubByRaw,
    streetPageCount: data.streetPageCount,
    videoCount: data.videoCount,
    videos: data.videoStreets,
    hubs: data.neighbourhoods,
    board,
    strips,
  });
}

/** slug -> display name, through the one street-name resolver. */
async function namesFor(slugs: string[]): Promise<Map<string, string>> {
  if (slugs.length === 0) return new Map();
  const rows = await prisma.residentialStreet.findMany({ where: { slug: { in: slugs } }, select: { slug: true, name: true } });
  return new Map(rows.map((r) => [r.slug, resolveStreetName(r.slug, r.name).name]));
}

/** The three strips. Each is one query over a real count, filtered to published pages. */
export async function getMegaStrips(): Promise<MegaStrips> {
  const published = new Set(await publishedStreetPageSlugs());

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

// ── the site-wide read, memoised ─────────────────────────────────────────────────────────
// Five minutes, the same TTL and the same shape as buildMiltonWideContext's memo, for the
// same reason: the nav renders on every page, and a page render must not pay for eleven
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
  const [mw, newThisWeek, listings, hubByRaw, streetPageCount, videoCount, videos, hubs, board, strips] = await Promise.all([
    buildMiltonWideContext(),
    getNewThisWeekCount(),
    getNewestListingCards(4),
    getRawStringHubMap(),
    publishedStreetPageCount(),
    getStreetVideoCount(),
    getStreetsWithVideo(4),
    getNeighbourhoodCards(),
    getBoardData(),
    getMegaStrips(),
  ]);
  return composeMegaLive({
    onMarket: mw.activeListingsCount,
    newThisWeek,
    listings,
    hubByRaw,
    streetPageCount,
    videoCount,
    videos,
    hubs,
    board,
    strips,
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
