// src/lib/homepageData.ts
// THE SEAM (read side). One function assembles everything the homepage and its nav
// render, so there is exactly one place a homepage figure can come from.
//
//   stats        Milton right now, public rows only: on the market, new this week and
//                available to rent
//   neighbourhoods  the published hubs, most active listings first, ties alphabetical
//   videoStreets    published streets carrying a clip, poster-gated
//   newestListings  through the listings grid's own mapper, so the RECO/IDX display
//                gate is applied server-side exactly once
//   footer       the live link graph: every hub, the streets with the most for sale, the counts
//   trust        real business facts (user-confirmed), hardcoded
//   hero         STATIC editorial carried from mockData (no live source)
//
// NO VOW-DERIVED VALUE (MC-046 Stage 1, PropTx VOW Best Practices item 40). The all-Milton
// typical, the 12-month sales count, days on market, sold so far this month, sold-to-ask and
// each hub's typical and sales count left the homepage. This object crosses to a 'use client'
// component, so the RSC payload carries whatever it holds: the fields are gone from the type
// and their readers are not called, rather than computed and left unrendered.
//
// NEIGHBOURHOOD_CHARACTER below is retained because hubData.ts imports it.
import { prisma } from "@/lib/prisma";
import { surfacedStreetWhere, publishedStreetPageCount } from "@/lib/streetSurface";
import { mockHomepageData } from "@/components/home/mockData";
import type { HomepageData, HubCard } from "@/components/home/types";
import { getNeighbourhoodCards, getRawStringHubMap } from "@/lib/neighbourhoodCards";
import { getNewThisWeekCount, getOnMarketCount, getStreetsWithVideo, getStreetVideoCount } from "@/lib/homeSignals";
import { getNewestListingCards } from "@/lib/listingsV2Data";
import { getRentalsAvailableCount } from "@/lib/rentalsAvailable";
import { getFooterMap, getMostForSaleStreets } from "@/lib/hubFooter";

/** The published hubs as the homepage states them: name, slug and active count, and nothing
 *  else, most active first and ties alphabetical (MC-046 R7, R9). */
export function toHomeHubs(cards: { slug: string; name: string; activeCount: number }[]): HubCard[] {
  return cards
    .map((c) => ({ slug: c.slug, name: c.name, activeCount: c.activeCount }))
    .sort((a, b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name));
}

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
  "brookville-haltonville": "Rural hamlets and large lots.",
  campbellville: "Hamlet character, escarpment-edge.",
  "milton-north": "North-end rural fringe, large parcels.",
  moffat: "Open countryside, acreage, quiet.",
  nassagaweya: "Agricultural, large lots, established.",
  "rural-milton": "Country properties and acreage across rural Milton.",
  "rural-milton-west": "Western rural Milton — large lots, quiet roads.",
  "rural-trafalgar": "Rural Trafalgar corridor, large parcels.",
};

export async function getHomepageData(): Promise<HomepageData> {
  const [onMarket, newThisWeek, hubCards, videoStreets, videoCount, listingRows, hubByRaw, topStreets, streetPageCount, surfacedStreetCount, totalNbhd, rentalsAvailable, footerMap] =
    await Promise.all([
      getOnMarketCount(),
      getNewThisWeekCount(),
      getNeighbourhoodCards(),
      getStreetsWithVideo(10),
      getStreetVideoCount(),
      getNewestListingCards(8),
      getRawStringHubMap(),
      getMostForSaleStreets(8),
      // PAGES, from the set the sitemap emits. Not the surfaced-entity count: that is the
      // set that may APPEAR in search and in a hub ladder (738 today), and it was being
      // published as "streets with their own page", which it has never been.
      publishedStreetPageCount(),
      // Entities we can say something about. Kept, and labelled as what it is.
      prisma.residentialStreet.count({ where: await surfacedStreetWhere() }),
      prisma.neighbourhood.count(),
      // The rent side. The hero's other figures are sale-side; this one is not, and its
      // label says so rather than being folded into "on the market".
      getRentalsAvailableCount(),
      getFooterMap(),
    ]);
  const neighbourhoods = toHomeHubs(hubCards);

  // Resolve each listing's raw TREB neighbourhood to a PUBLISHED hub. A raw string with
  // no published hub gets no link — /neighbourhoods refuses the same guess for the same
  // reason: a slugified raw string is a 404 dressed as a link.
  const newestListings = listingRows.map((l) => {
    const hub = hubByRaw.get(l.neighbourhood) ?? null;
    return { ...l, hubSlug: hub?.slug ?? null, hubName: hub?.name ?? null };
  });

  return {
    stats: { onMarket, newThisWeek, rentalsAvailable },
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
    videoStreets,
    videoCount,
    newestListings,
    footer: {
      // The map's fixed destinations, the same read every other page's footer uses.
      ...footerMap,
      // EVERY published hub, not the first three. The footer is the homepage's link
      // graph and a truncated one was costing 19 crawlable links for no reader benefit.
      neighbourhoods: [...neighbourhoods].sort((a, b) => a.name.localeCompare(b.name)).map((n) => ({ name: n.name, slug: n.slug })),
      topStreets,
      neighbourhoodCount: totalNbhd,
      streetCount: surfacedStreetCount,
      streetPageCount,
    },
  };
}
