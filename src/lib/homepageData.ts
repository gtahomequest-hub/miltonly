// src/lib/homepageData.ts
// THE SEAM (read side). getHomepageData() returns the HomepageData shape the
// home-v2 layout consumes, wiring REAL data where a live source exists:
//   - stats        : buildMiltonWideContext() — the SAME Milton-wide rollup the urban hubs use
//   - neighbourhoods: Neighbourhood table + a per-neighbourhood DB2 sale aggregate
//                     (k-anon: typicalPriceRounded null when <5 sales -> silent card)
//   - vipStreets   : ResidentialStreet VIP classification
//   - commentary   : TEMPLATED from the real stats (no LLM Milton-wide commentary exists)
//   - footer/counts: live entity counts
//   - trust        : real business facts (user-confirmed), hardcoded
//   - hero / mls   : STATIC editorial carried from mockData (no live source) — see FLAGS in the report
//   - character    : STATIC editorial map below (the Neighbourhood table has no character field)
import { prisma } from "@/lib/prisma";
import { getSoldDb } from "@/lib/db";
import { buildMiltonWideContext } from "@/lib/ai/buildHubInput";
import { expandStreetName } from "@/lib/street-data";
import { fullPrice } from "@/components/home/format";
import { mockHomepageData } from "@/components/home/mockData";
import type { HomepageData, NeighbourhoodCard } from "@/components/home/types";

const K_ANON_PRICE = 5;
const round5k = (n: number) => Math.round(n / 5000) * 5000;

// STATIC editorial character lines (no DB source). Carried from mockData where
// present; the rest authored factually. FLAGGED static — copy is Aamir's to refine.
const CHARACTER: Record<string, string> = {
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
  // ── stats: the hubs' Milton-wide rollup (single source of truth) ──
  const mw = await buildMiltonWideContext();
  const stats = {
    typicalPrice: mw.aggregates.typicalPrice != null ? round5k(mw.aggregates.typicalPrice) : 0,
    sold12mo: mw.aggregates.salesCount,
    onMarket: mw.activeListingsCount,
    dom: mw.aggregates.daysOnMarket ?? 0,
  };

  // ── neighbourhoods: table + per-neighbourhood DB2 sale aggregate (k-anon) ──
  const [nbRows, totalNbhd, sold] = await Promise.all([
    prisma.neighbourhood.findMany({ select: { slug: true, name: true, rawStrings: true, profile: true } }),
    prisma.neighbourhood.count(),
    Promise.resolve(getSoldDb()),
  ]);
  type SoldAgg = { neighbourhood: string; n: number; total: number };
  const soldRows: SoldAgg[] = sold
    ? ((await sold`SELECT neighbourhood, COUNT(*)::int AS n, COALESCE(SUM(sold_price),0)::float AS total
         FROM sold.sold_records
         WHERE perm_advertise = TRUE AND transaction_type = 'For Sale'
           AND sold_date >= NOW() - INTERVAL '12 months'
         GROUP BY neighbourhood`) as SoldAgg[])
    : [];
  const aggByRaw = new Map(soldRows.map((r) => [r.neighbourhood, r]));

  const neighbourhoods: NeighbourhoodCard[] = nbRows
    .filter((nb) => nb.profile !== "standard_no_hub") // industrial/no-hub (Derry Green) is not a featured card
    .map((nb) => {
      let n = 0;
      let total = 0;
      for (const raw of nb.rawStrings) {
        const r = aggByRaw.get(raw);
        if (r) { n += r.n; total += r.total; }
      }
      const typicalPriceRounded = n >= K_ANON_PRICE && total > 0 ? round5k(total / n) : null;
      const group: NeighbourhoodCard["group"] = nb.profile === "urban_hub" ? "urban" : "rural";
      const card: NeighbourhoodCard = {
        name: nb.name,
        character: CHARACTER[nb.slug] ?? (group === "rural" ? "Rural Milton — large lots, thinner resale activity." : "Established Milton neighbourhood."),
        typicalPriceRounded,
        slug: nb.slug,
        group,
      };
      if (typicalPriceRounded === null) card.silentNote = "typical price not stated — thin activity; see road pages";
      return card;
    })
    // urban first (price desc), then rural (price desc, silent last)
    .sort((a, b) =>
      a.group !== b.group
        ? a.group === "urban" ? -1 : 1
        : (b.typicalPriceRounded ?? -1) - (a.typicalPriceRounded ?? -1),
    );

  // ── VIP streets + street count ──
  const [vipRows, streetCount] = await Promise.all([
    prisma.residentialStreet.findMany({
      where: { isVip: true },
      orderBy: { soldCount12mo: "desc" },
      take: 6,
      select: { name: true, slug: true, soldCount12mo: true },
    }),
    prisma.residentialStreet.count(),
  ]);
  // expandStreetName leaves a stray abbreviation period on a few raw names
  // ("Farmstead. Dr" -> "Farmstead. Drive"); collapse "<word>. " to "<word> ".
  const cleanName = (n: string) => expandStreetName(n).replace(/\.\s/g, " ").replace(/\s+/g, " ").trim();
  const vipStreets = vipRows.map((s) => ({ name: cleanName(s.name), soldCount: s.soldCount12mo, slug: s.slug }));

  // ── commentary: TEMPLATED from the real stats (no Milton-wide LLM commentary exists) ──
  const commentary = {
    paragraphs: [
      `The typical Milton home has traded near ${fullPrice(stats.typicalPrice)} over the trailing twelve months, drawn from ${stats.sold12mo.toLocaleString("en-CA")} recorded sales across the town's ${totalNbhd} neighbourhoods.`,
      `Homes are taking about ${stats.dom} days to sell, with ${stats.onMarket.toLocaleString("en-CA")} listings active right now. The read below moves by neighbourhood, where the real differences live.`,
    ],
    source: "Grounded in trailing-12-month TREB sold data · updated continuously",
  };

  // ── footer ──
  const footer = {
    topNeighbourhoods: neighbourhoods.slice(0, 3).map((n) => ({ name: n.name, slug: n.slug })),
    topStreets: vipStreets.slice(0, 2).map((s) => ({ name: s.name, slug: s.slug })),
    neighbourhoodCount: totalNbhd,
    streetCount,
  };

  return {
    stats,
    hero: mockHomepageData.hero,           // STATIC copy (no live source) — FLAG
    trust: {                                // real business facts (user-confirmed), hardcoded
      rating: 4.9,
      reviewCount: 600,
      credentials: ["RE/MAX Hall of Fame", "MLS-grounded data", "Updated daily"],
      idx: "1809031",
      vow: "1848370",
    },
    commentary,
    neighbourhoods,
    neighbourhoodCount: totalNbhd,
    vipStreets,
    streetCount,
    mls: mockHomepageData.mls,              // STATIC lens copy/listings (no live source) — FLAG
    footer,
  };
}
