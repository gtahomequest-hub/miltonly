// src/lib/homepageData.ts
// THE SEAM (read side). getHomepageData() returns the HomepageData the streamlined
// home-v2 layout consumes (Nav → Hero → Board → TrustBand → Footer):
//   - stats.typicalPrice : ALL-MILTON MEDIAN (dedicated query) — matches the Board's
//                          median kind; sold12mo/onMarket/dom from buildMiltonWideContext()
//   - footer/counts      : light live queries (top-3 neighbourhoods, top-2 VIP streets, counts)
//   - trust              : real business facts (user-confirmed), hardcoded
//   - hero               : STATIC editorial carried from mockData (no live source)
// Perf trim: the per-neighbourhood sold aggregate, the neighbourhood-card array, the
// VIP strip, the templated commentary, and the mls config are NO LONGER computed —
// their homepage sections were removed. NEIGHBOURHOOD_CHARACTER below is retained
// because hubData.ts imports it.
import { prisma } from "@/lib/prisma";
import { SURFACED_STREET_WHERE } from "@/lib/streetSurface";
import { getSoldDb } from "@/lib/db";
import { buildMiltonWideContext } from "@/lib/ai/buildHubInput";
import { expandStreetName } from "@/lib/street-data";
import { mockHomepageData } from "@/components/home/mockData";
import type { HomepageData } from "@/components/home/types";

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
  // ── stats ──
  // sold12mo / onMarket / dom come from the shared Milton-wide rollup (unchanged).
  // typicalPrice is the ALL-MILTON MEDIAN (FIX 1): a dedicated median query so the
  // hero's "typical" reads the same kind of figure as the Board (median, not the
  // right-tail-inflated mean). All-Milton scope; no coupling to board_stats. Falls
  // back to the rollup mean if the sold DB is unavailable.
  const mw = await buildMiltonWideContext();
  const soldDb = getSoldDb();
  let medianAll: number | null = null;
  if (soldDb) {
    const r = (await soldDb`SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY sold_price) AS med
      FROM sold.sold_records
      WHERE transaction_type = 'For Sale' AND perm_advertise = TRUE
        AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()`) as Array<{ med: unknown }>;
    const m = r[0]?.med;
    medianAll = m != null && Number.isFinite(Number(m)) ? Number(m) : null;
  }
  const typicalSource = medianAll ?? mw.aggregates.typicalPrice;
  const stats = {
    typicalPrice: typicalSource != null ? round5k(typicalSource) : 0,
    sold12mo: mw.aggregates.salesCount,
    onMarket: mw.activeListingsCount,
    dom: mw.aggregates.daysOnMarket ?? 0,
  };

  // ── footer only (perf trim) ──
  // The homepage now renders just the Board as its market read, so the heavy
  // per-neighbourhood sold aggregate, the neighbourhood-card array, the VIP-street
  // strip, and the templated commentary are no longer computed. The footer needs
  // only top-3 neighbourhoods + top-2 VIP streets + counts — all light queries.
  const cleanName = (n: string) => expandStreetName(n).replace(/\.\s/g, " ").replace(/\s+/g, " ").trim();
  const [nbTop, totalNbhd, vipRows, streetCount, publishedHubs] = await Promise.all([
    prisma.neighbourhood.findMany({
      where: { profile: { not: "standard_no_hub" } },
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    }),
    prisma.neighbourhood.count(),
    prisma.residentialStreet.findMany({
      where: { isVip: true },
      orderBy: { soldCount12mo: "desc" },
      take: 2,
      select: { name: true, slug: true },
    }),
    prisma.residentialStreet.count({ where: SURFACED_STREET_WHERE }), // surfaced only — dormant/pageless entities don't count toward the public "streets" figure
    prisma.hubContent.findMany({ where: { status: "published" }, select: { neighbourhoodSlug: true } }),
  ]);
  const publishedSlugs = new Set(publishedHubs.map((h) => h.neighbourhoodSlug));
  const footer = {
    topNeighbourhoods: nbTop.filter((n) => publishedSlugs.has(n.slug)).slice(0, 3).map((n) => ({ name: n.name, slug: n.slug })),
    topStreets: vipRows.map((s) => ({ name: cleanName(s.name), slug: s.slug })),
    neighbourhoodCount: totalNbhd,
    streetCount,
  };

  return {
    stats,
    hero: mockHomepageData.hero, // STATIC copy (no live source) — FLAG
    trust: {
      rating: 5.0,
      reviewCount: 235,
      credentials: ["RE/MAX Hall of Fame", "MLS-grounded data", "Updated daily"],
      idx: "1809031",
      vow: "1848370",
    },
    footer,
  };
}
