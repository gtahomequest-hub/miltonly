// src/lib/homepageData.ts
// THE SEAM (read side). One function assembles everything the homepage and its nav
// render, so there is exactly one place a homepage figure can come from.
//
//   stats        Milton right now: on the market, new this week, sold so far this
//                month (k-gated), and the all-Milton typical, plus the 12-month
//                rollup the page already published
//   neighbourhoods  the 22 published hubs, priced by THEIR OWN PAGE's aggregate
//                (see neighbourhoodCards.ts — this is not a list-price average)
//   videoStreets    published streets carrying a clip, poster-gated
//   newestListings  through the listings grid's own mapper, so the RECO/IDX display
//                gate is applied server-side exactly once
//   inDemandStreets VIP streets by rank, surfaced only
//   footer       the live link graph: every hub, the in-demand streets, the counts
//   trust        real business facts (user-confirmed), hardcoded
//   hero         STATIC editorial carried from mockData (no live source)
//
// NEIGHBOURHOOD_CHARACTER below is retained because hubData.ts imports it.
import { prisma } from "@/lib/prisma";
import { surfacedStreetWhere, publishedStreetPageCount } from "@/lib/streetSurface";
import { getSoldDb } from "@/lib/db";
import { buildMiltonWideContext } from "@/lib/ai/buildHubInput";
import { mockHomepageData } from "@/components/home/mockData";
import type { HomepageData } from "@/components/home/types";
import type { MegaLive } from "@/components/nav/megaTypes";
import type { BoardTab } from "@/lib/board/computeBoard";
import { resolveStreetName } from "@/lib/streetName";
import { getNeighbourhoodCards, getRawStringHubMap } from "@/lib/neighbourhoodCards";
import { getNewThisWeekCount, getSoldThisMonth, getStreetsWithVideo, getStreetVideoCount } from "@/lib/homeSignals";
import { getNewestListingCards } from "@/lib/listingsV2Data";
import { getMiltonSoldOverall } from "@/lib/soldAggregates";
import { getRentalsAvailableCount } from "@/lib/rentalsAvailable";

const round5k = (n: number) => Math.round(n / 5000) * 5000;

// STATIC editorial character lines (no DB source). Carried from mockData where
// present; the rest authored factually. FLAGGED static — copy is Aamir's to refine.
export const NEIGHBOURHOOD_CHARACTER: Record<string, string> = {
  // urban
  beaty: "Family enclave near schools and parks.",
  bowes: "Newer west-end growth, townhome-heavy.",
  clarke: "Townhome-rich and well-connected to transit.",
  coates: "Newer detached and towns, central-west.",
  cobban: "One of Milton's newest communities, modern build.",
  dempsey: "Established central pocket, detached-led, walkable to the core.",
  "dorset-park": "Mature and central, mixed housing stock.",
  ford: "Newer-growth east end, family-oriented.",
  harrison: "Popular family community of towns and detached.",
  "old-milton": "The historic core — character homes near Main Street.",
  scott: "Newer detached on quiet crescents.",
  timberlea: "Mature, mixed stock, generous tree cover.",
  walker: "Established south end, close to the escarpment.",
  willmott: "Newer-growth, family-oriented, strong townhome supply.",
  // rural
  "bronte-meadows": "Smaller established pocket, quieter pace.",
  "brookville-haltonville": "Rural hamlets, large lots, thin resale.",
  campbellville: "Hamlet character, escarpment-edge.",
  "milton-north": "North-end rural fringe, large parcels.",
  moffat: "Open countryside, acreage, quiet.",
  nassagaweya: "Agricultural, large lots, established.",
  "rural-milton": "Country properties and acreage across rural Milton.",
  "rural-milton-west": "Western rural Milton — large lots, quiet roads.",
  "rural-trafalgar": "Rural Trafalgar corridor, large parcels.",
};

export async function getHomepageData(): Promise<HomepageData> {
  // The Milton-wide rollup is memoised and shared; the all-Milton typical is a
  // dedicated midpoint query so the hero reads the same KIND of figure the Board
  // publishes rather than a right-tail-inflated mean.
  const mw = await buildMiltonWideContext();
  const soldDb = getSoldDb();
  let typicalAll: number | null = null;
  if (soldDb) {
    const r = (await soldDb`SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY sold_price) AS med
      FROM sold.sold_records
      WHERE transaction_type = 'For Sale' AND perm_advertise = TRUE
        AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()`) as Array<{ med: unknown }>;
    const m = r[0]?.med;
    typicalAll = m != null && Number.isFinite(Number(m)) ? Number(m) : null;
  }
  const typicalSource = typicalAll ?? mw.aggregates.typicalPrice;

  const [newThisWeek, soldMtd, neighbourhoods, videoStreets, videoCount, listingRows, hubByRaw, vipRows, streetPageCount, surfacedStreetCount, totalNbhd, soldOverall, rentalsAvailable] =
    await Promise.all([
      getNewThisWeekCount(),
      getSoldThisMonth(),
      getNeighbourhoodCards(),
      getStreetsWithVideo(10),
      getStreetVideoCount(),
      getNewestListingCards(8),
      getRawStringHubMap(),
      prisma.residentialStreet.findMany({
        where: { isVip: true, ...(await surfacedStreetWhere()) },
        orderBy: [{ recencyWeightedSold: "desc" }],
        take: 8,
        select: { name: true, slug: true },
      }),
      // PAGES, from the set the sitemap emits. Not the surfaced-entity count: that is the
      // set that may APPEAR in search and in a hub ladder (738 today), and it was being
      // published as "streets with their own page", which it has never been.
      publishedStreetPageCount(),
      // Entities we can say something about. Kept, and labelled as what it is.
      prisma.residentialStreet.count({ where: await surfacedStreetWhere() }),
      prisma.neighbourhood.count(),
      // The /sold aggregate: all-Milton, 12 months, k-gated. The sold-to-ask proof point
      // reads THIS, not the Board's urban 13-week ratio, so the homepage and the market
      // page publish one figure. Board.soldToAsk.value is a RATIO (0.9809) that TheBoard
      // multiplies at render; soldToAskPct is already a percent (98.1).
      getMiltonSoldOverall(),
      // The rent side. The hero's other four figures are sale-side; this one is not, and
      // its label says so rather than being folded into "on the market".
      getRentalsAvailableCount(),
    ]);

  // Resolve each listing's raw TREB neighbourhood to a PUBLISHED hub. A raw string with
  // no published hub gets no link — /neighbourhoods refuses the same guess for the same
  // reason: a slugified raw string is a 404 dressed as a link.
  const newestListings = listingRows.map((l) => {
    const hub = hubByRaw.get(l.neighbourhood) ?? null;
    return { ...l, hubSlug: hub?.slug ?? null, hubName: hub?.name ?? null };
  });

  const inDemandStreets = vipRows.map((s) => ({
    name: resolveStreetName(s.slug, s.name).name,
    slug: s.slug,
  }));

  return {
    stats: {
      typicalPrice: typicalSource != null ? round5k(typicalSource) : 0,
      sold12mo: mw.aggregates.salesCount,
      onMarket: mw.activeListingsCount,
      dom: mw.aggregates.daysOnMarket ?? 0,
      newThisWeek,
      soldMonthToDate: soldMtd.count,
      soldMonthTypical: soldMtd.typicalPrice,
      rentalsAvailable,
    },
    hero: mockHomepageData.hero, // STATIC copy (no live source) — FLAG
    trust: {
      rating: 5.0,
      reviewCount: 235,
      credentials: ["RE/MAX Hall of Fame", "MLS-grounded data", "Updated daily"],
      idx: "1809031",
      vow: "1848370",
    },
    neighbourhoods,
    streetPageCount,
    soldToAskPct: soldOverall.soldToAskPct,
    videoStreets,
    videoCount,
    newestListings,
    inDemandStreets,
    footer: {
      // EVERY published hub, not the first three. The footer is the homepage's link
      // graph and a truncated one was costing 19 crawlable links for no reader benefit.
      neighbourhoods: neighbourhoods.map((n) => ({ name: n.name, slug: n.slug })),
      topStreets: inDemandStreets,
      neighbourhoodCount: totalNbhd,
      streetCount: surfacedStreetCount,
      streetPageCount,
    },
  };
}

/**
 * The nav's live panels, composed from data the page has already fetched.
 *
 * The Board row is the SELL panel's only source, so the menu cannot state a market
 * figure that the Board rendered below it contradicts: same row, same window label,
 * same suppression. A null stays null and its row does not render.
 */
export function buildMegaLive(data: HomepageData, board: BoardTab[] | null): MegaLive {
  const overall = board?.find((t) => t.tab === "overall") ?? null;
  return {
    buy: {
      activeCount: data.stats.onMarket,
      newThisWeek: data.stats.newThisWeek,
      listings: data.newestListings.slice(0, 4).map((l) => ({
        mlsNumber: l.mlsNumber,
        address: l.address, // already through the display gate in listingsV2Data
        price: l.price,
      })),
    },
    streets: {
      videoCount: data.videoCount,
      videos: data.videoStreets.slice(0, 4).map((v) => ({
        slug: v.slug,
        name: v.name,
        poster: v.poster,
        variant: v.variant,
      })),
    },
    // FORMATTED HERE, by the SAME helpers TheBoard uses on the same page, so the menu and
    // the section below it cannot render one figure two ways. money1k and pct1 are re-derived
    // rather than imported because TheBoard is a client component; the battery asserts the two
    // surfaces agree, which is the property that matters and the one that broke.
    sell: overall
      ? {
          figures: [
            {
              key: "typical",
              label: "Typical price",
              value: overall.typical.value === null ? "—" : `$${(Math.round(overall.typical.value / 1000) * 1000).toLocaleString("en-CA")}`,
              window: overall.typical.window,
            },
            {
              key: "days",
              label: "Days to sell",
              value: overall.daysToSell.value === null ? "—" : `${Math.round(overall.daysToSell.value)} days`,
              window: overall.daysToSell.window,
            },
            {
              key: "sta",
              label: "Sold to ask",
              // A RATIO, not a percent. This is the field that shipped as
              // "0.980868783307145%" — the unit lives in the name of the renderer, never in
              // the value, so the value is converted exactly where TheBoard converts it.
              value: overall.soldToAsk.value === null ? "—" : `${(overall.soldToAsk.value * 100).toFixed(1)}%`,
              window: overall.soldToAsk.window,
            },
          ],
        }
      : undefined,
    inDemandStreets: data.inDemandStreets,
  };
}
