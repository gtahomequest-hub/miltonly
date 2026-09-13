// src/lib/hubData.ts
// THE SEAM (read side). getHubData(slug) reads the SAME vetted hub data the live
// route already used (HubContent + HubGeneration.sectionsJson + buildHubInput /
// buildRuralHubInput aggregates) and maps it into the new HubData design contract.
// Sub-k discipline preserved: aggregates.typicalPrice === null (thin pools — the 4
// sub-k rurals) -> stats.typicalPrice null -> silent state, NEVER a fabricated price.
// profile 'rural' drives the reduced layout; empty arrays hide sections. Mirrors
// getCondoData / getHomepageData null-tolerance.
import { condoDisplayName } from "@/lib/condoName";
import { prisma } from "@/lib/prisma";
import { getSoldDb } from "@/lib/db";
import { HUB_STREET_LADDER_CAP } from "@/lib/streetSurface";
import { buildMiltonWideContext } from "@/lib/ai/buildHubInput";
import { getHubInputCached, getHubMetaLive } from "@/lib/hubLive";
import { nearestHubs } from "@/lib/hubNearby";
import { fullPrice, compactPrice } from "@/components/hub/format";
import type {
  HubData, HubProfile, HubStats, HubAtAGlance, HubMarketCommentary, HubMarketCompare,
  HubStreetCard, HubVipStreet, HubCondoBuilding, HubFaq, HubSibling, HubIntentSquare,
} from "@/components/hub/types";
import type { HubSection, HubGeneratorInput, HubTypeBucket } from "@/types/hub-generator";

import { K_ANON_PRICE } from "@/lib/kAnon";
// ONE rounding for every hub display price — the same function the SERP meta
// hook passes through (lib/ai/hub/hubMeta.ts). Before this, the hero stat tile
// compacted the RAW average while the meta rounded to 5k, so even Timberlea,
// the one hub already reading live, published $955,000 to Google and $953K to
// the reader. Rounding once, here, is what makes those the same number.
import { round5k, hubDisplayTypical } from "@/lib/ai/hub/hubMeta";

function firstSentence(s: string): string {
  const m = s.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : s).trim();
}
function deltaPct(nbhd: number, milton: number): string {
  const pct = Math.round(((nbhd - milton) / milton) * 100);
  return pct === 0 ? "in line with Milton" : `${pct > 0 ? "+" : ""}${pct}% vs Milton`;
}

async function condosFor(neighbourhoodId: string | null): Promise<HubCondoBuilding[]> {
  if (!neighbourhoodId) return [];
  const cbs = await prisma.condoBuilding.findMany({
    where: { neighbourhoodId },
    select: { slug: true, displayName: true, buildingAddress: true, streetNumber: true, streetSlug: true },
  });
  if (!cbs.length) return [];
  const pub = new Set(
    (await prisma.condoContent.findMany({
      where: { buildingSlug: { in: cbs.map((c) => c.slug) }, status: "published" },
      select: { buildingSlug: true },
    })).map((c) => c.buildingSlug),
  );
  // DEC-CONDO-NAME: the hub's condo list names a building the way its page does.
  return cbs.filter((c) => pub.has(c.slug)).slice(0, 6).map((c) => ({
    name: condoDisplayName({ slug: c.slug, streetNumber: c.streetNumber, streetSlug: c.streetSlug, buildingAddress: c.buildingAddress ?? c.displayName }),
    slug: c.slug,
  }));
}

/**
 * NEARBY, BY POSITION, WITH NOTHING STATIC ON THE CARD.
 *
 * Each card used to carry a one-line character ("Family enclave near schools and parks.")
 * from a hand-written table, beside a live price. The line is gone. What a card says now is
 * derived: how far the hub is (boundary centre to boundary centre, from the Town's polygons),
 * its k-gated typical, the sale count behind it, and how many street guides it has. The four
 * shown are the four nearest of every published hub, urban or rural; a hub the Town has no
 * polygon for gets the other rural hubs instead, and the section heading says so.
 */
async function siblingsFor(slug: string, profile: HubProfile): Promise<{ siblings: HubSibling[]; byDistance: boolean }> {
  const published = (
    await prisma.hubContent.findMany({ where: { status: "published", neighbourhoodSlug: { not: slug } }, select: { neighbourhoodSlug: true } })
  ).map((h) => h.neighbourhoodSlug);
  const hoods = await prisma.neighbourhood.findMany({
    where: { slug: { in: published } },
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true, profile: true, rawStrings: true },
  });
  if (!hoods.length) return { siblings: [], byDistance: false };
  const sameTier = hoods.filter((h) => (h.profile === "urban_hub" ? "urban" : "rural") === profile).map((h) => h.slug);
  const { hubs, byDistance } = nearestHubs(slug, hoods.map((h) => h.slug), 4);
  const chosen = byDistance ? hubs : nearestHubs(slug, sameTier, 4).hubs;
  const bySlug = new Map(hoods.map((h) => [h.slug, h]));
  const picked = chosen.map((c) => ({ ...c, hood: bySlug.get(c.slug)! })).filter((c) => c.hood);
  if (!picked.length) return { siblings: [], byDistance };

  // per-sibling typical via one grouped DB2 query (k-anon: null when <5 sales)
  const sold = getSoldDb();
  const rows: Array<{ neighbourhood: string; n: number; total: number }> = sold
    ? ((await sold`SELECT neighbourhood, COUNT(*)::int AS n, COALESCE(SUM(sold_price),0)::float AS total
         FROM sold.sold_records
         WHERE perm_advertise = TRUE AND transaction_type = 'For Sale' AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()
         GROUP BY neighbourhood`) as Array<{ neighbourhood: string; n: number; total: number }>)
    : [];
  const byRaw = new Map(rows.map((r) => [r.neighbourhood, r]));
  // published street guides per sibling, one grouped query
  const streetRows = await prisma.residentialStreet.findMany({
    where: { neighbourhoodId: { in: picked.map((p) => p.hood.id) } },
    select: { slug: true, neighbourhoodId: true },
  });
  const pubStreets = new Set(
    (await prisma.streetContent.findMany({
      where: { status: "published", streetSlug: { in: streetRows.map((r) => r.slug) } },
      select: { streetSlug: true },
    })).map((r) => r.streetSlug),
  );
  const pagesByHood = new Map<string, number>();
  for (const r of streetRows) if (pubStreets.has(r.slug) && r.neighbourhoodId) pagesByHood.set(r.neighbourhoodId, (pagesByHood.get(r.neighbourhoodId) ?? 0) + 1);

  return {
    byDistance,
    siblings: picked.map(({ hood, distanceKm }) => {
      let n = 0, t = 0;
      for (const raw of hood.rawStrings) { const r = byRaw.get(raw); if (r) { n += r.n; t += r.total; } }
      return {
        name: hood.name,
        slug: hood.slug,
        typicalPriceRounded: n >= K_ANON_PRICE && t > 0 ? round5k(t / n) : null,
        salesCount: n,
        streetPages: pagesByHood.get(hood.id) ?? 0,
        distanceKm,
      };
    }),
  };
}

// ── the derived-fact glance, the real ladder, and the video rung ─────────────────────────────
import { buildLadder } from "@/lib/hubStreetLadder";
import { schoolsInHub } from "@/lib/hubSchools";
import { getVideoStreetSlugs, getStreetsWithVideoForSlugs } from "@/lib/homeSignals";
import type { HubFact } from "@/components/hub/types";

/** The mandatory window+sample disclosure for the hub's own typical. */
function hubTypicalBasis(count: number | null): string | null {
  if (count === null || count <= 0) return null;
  return `across ${count} ${count === 1 ? "sale" : "sales"} in the last 12 months`;
}

/**
 * The token `/listings?neighbourhood=` filters on. The listings page matches the feed's raw
 * neighbourhood string with a case-insensitive `contains`, and the raw strings carry a TREB
 * prefix ("1037 - TM Timberlea") that a reader's URL should not. The shortest prefix-stripped
 * form that every raw string of the hub contains is the token; for a hub with one raw string
 * that is the string itself minus its prefix.
 */
export function listingsFilterToken(rawStrings: string[]): string | null {
  const stripped = rawStrings.map((r) => r.replace(/^\d+\s*-\s*(?:[A-Z]{2}\s+)?/, "").trim()).filter(Boolean);
  if (!stripped.length) return null;
  const lower = rawStrings.map((r) => r.toLowerCase());
  const shared = stripped
    .filter((t) => lower.every((r) => r.includes(t.toLowerCase())))
    .sort((a, b) => a.length - b.length);
  return shared[0] ?? stripped[0];
}

/**
 * THE FOUR INTENT SQUARES, each landing on a page scoped to THIS neighbourhood where one
 * exists, and saying what the reader will find there.
 *
 *   buying     /listings?neighbourhood=<token>   the feed, filtered to this hood, with the count
 *   selling    /value/<slug>                     the hood's own valuation landing
 *   renting    /rentals?neighbourhood=<slug>     the rentals page scoped to this hood (MC-012)
 *   investing  /sold?nbhd=<slug>                 the hood's sold record, VOW-gated on the page
 *
 * The previous squares sent "buying" to a fragment on the same page and "investing" to the
 * Milton-wide listings grid. A square that lands where a Milton-wide menu item lands is a
 * decoration; these are destinations. hub-page.mjs resolves every one of them.
 */
function intentsFor(input: {
  slug: string;
  name: string;
  listingsToken: string | null;
  activeCount: number | null;
  salesCount: number | null;
}): HubIntentSquare[] {
  const { slug, name, listingsToken, activeCount, salesCount } = input;
  const buyHref = listingsToken ? `/listings?neighbourhood=${encodeURIComponent(listingsToken)}` : "/listings";
  const buySub =
    activeCount !== null && activeCount > 0
      ? `${activeCount} ${activeCount === 1 ? "home" : "homes"} for sale here today`
      : `Homes for sale in ${name}`;
  const investSub =
    salesCount !== null && salesCount > 0
      ? `${salesCount} ${salesCount === 1 ? "sale" : "sales"} here in 12 months`
      : `The sold record for ${name}`;
  return [
    { key: "buy", label: "I'm buying", sub: buySub, href: buyHref },
    { key: "sell", label: "I'm selling", sub: `What a ${name} home is worth`, href: `/value/${slug}` },
    { key: "rent", label: "I'm renting", sub: `Leases in ${name}`, href: `/rentals?neighbourhood=${slug}` },
    { key: "invest", label: "I'm investing", sub: investSub, href: `/sold?nbhd=${encodeURIComponent(slug)}` },
  ];
}

/**
 * THE GLANCE PANEL, DERIVED.
 *
 * Every entry is computed from data and carries the basis it was computed over. A fact whose
 * source is empty is DROPPED, never softened into a sentence: a hub with no school inside its
 * boundary says nothing about schools rather than saying "options nearby", which was true of
 * all of Milton and therefore told a reader nothing about anywhere.
 *
 * Every href here lands on the section of THIS page that lists what the figure counts, or on
 * the filtered feed for the active count. A reader who wants to check a number is one click
 * from the rows behind it.
 */
function buildFacts(input: {
  typical: number | null;
  typicalBasis: string | null;
  salesCount: number | null;
  publishedStreets: number;
  filmedStreets: number;
  schoolCount: number;
  stockShare: { label: string; pct: number; sales: number } | null;
  activeCount: number | null;
  listingsToken: string | null;
}): HubFact[] {
  const f: HubFact[] = [];
  if (input.typical !== null && input.typicalBasis) {
    f.push({ key: "typical", value: `$${compactPrice(input.typical)}`, label: "typical sale price", basis: input.typicalBasis, href: "#market" });
  } else if (input.salesCount !== null) {
    // Suppression is itself a fact about the market, and a more interesting one than a price.
    f.push({
      key: "typical",
      value: String(input.salesCount),
      label: input.salesCount === 1 ? "sale in 12 months" : "sales in 12 months",
      basis: "below the publication floor of five, so no price is stated",
      href: "#market",
    });
  }
  if (input.publishedStreets > 0) {
    f.push({
      key: "pages",
      value: String(input.publishedStreets),
      label: input.publishedStreets === 1 ? "street with a page" : "streets with a page",
      basis: "published street guides in this neighbourhood, every one listed below",
      href: "#streets",
    });
  }
  if (input.filmedStreets > 0) {
    f.push({
      key: "video",
      value: String(input.filmedStreets),
      label: input.filmedStreets === 1 ? "street filmed" : "streets filmed",
      basis: "driven end to end, day or overnight, with the clip on the street's page",
      href: "#film",
    });
  }
  if (input.schoolCount > 0) {
    f.push({
      key: "schools",
      value: String(input.schoolCount),
      label: input.schoolCount === 1 ? "school inside the boundary" : "schools inside the boundary",
      basis: "school position against the Town of Milton boundary for this neighbourhood",
      href: "#schools",
    });
  }
  if (input.activeCount !== null && input.activeCount > 0) {
    f.push({
      key: "active",
      value: String(input.activeCount),
      label: input.activeCount === 1 ? "home for sale today" : "homes for sale today",
      basis: "advertised active listings in this neighbourhood, refreshed with the feed",
      href: input.listingsToken ? `/listings?neighbourhood=${encodeURIComponent(input.listingsToken)}` : "/listings",
    });
  }
  if (input.stockShare) {
    f.push({
      key: "stock",
      value: `${input.stockShare.pct}%`,
      label: `of sales were ${input.stockShare.label}`,
      basis: `share of ${input.stockShare.sales} sales in the last 12 months`,
      href: "#market",
    });
  }
  return f;
}

/**
 * The dominant housing form as a SHARE, not a pair of type names. "Detached & Townhomes" said
 * the same thing about most of Milton; "71% of sales were detached" says something about this
 * neighbourhood. Suppressed below the k floor, the same floor the price sits behind, because a
 * share of three sales is a description of three houses.
 */
const STOCK_LABEL: Record<string, string> = { detached: "detached", semi: "semis", townhouse: "townhomes", condo: "condos" };
function stockShareFrom(byType: Record<string, HubTypeBucket>): { label: string; pct: number; sales: number } | null {
  const ranked = Object.entries(byType).filter(([, b]) => b.count > 0).sort((a, b) => b[1].count - a[1].count);
  const total = ranked.reduce((n, [, b]) => n + b.count, 0);
  if (!ranked.length || total < K_ANON_PRICE) return null;
  const [type, top] = ranked[0];
  const label = STOCK_LABEL[type];
  if (!label) return null; // "other" and unmapped types are not a housing form a reader can picture
  return { label, pct: Math.round((top.count / total) * 100), sales: total };
}

export async function getHubData(slug: string): Promise<HubData | null> {
  const content = await prisma.hubContent.findUnique({ where: { neighbourhoodSlug: slug } });
  if (!content || content.status !== "published") return null;
  const nbhd = await prisma.neighbourhood.findUnique({ where: { slug } });
  if (!nbhd) return null;
  const profile: HubProfile = nbhd.profile === "urban_hub" ? "urban" : "rural";

  // Published-street count for this neighbourhood: streets whose StreetContent.status="published"
  // AND that have a canonical ResidentialStreet row here.
  const nbhdStreetSlugs = (
    await prisma.residentialStreet.findMany({ where: { neighbourhoodId: nbhd.id }, select: { slug: true } })
  ).map((r) => r.slug);
  // PUBLISHED-ONLY gate for the ladder. The ladder used SURFACED_STREET_WHERE (rws>0 OR
  // hasPublishedPage), which let ~101 unpublished streets fill ladder slots across the 22 hubs:
  // internal links to pages that carry no published guide (and that DEC-SEO-1 will 404).
  const publishedStreetSlugs = new Set(
    nbhdStreetSlugs.length
      ? (
          await prisma.streetContent.findMany({
            where: { status: "published", streetSlug: { in: nbhdStreetSlugs } },
            select: { streetSlug: true },
          })
        ).map((r) => r.streetSlug)
      : [],
  );
  const publishedStreetCount = publishedStreetSlugs.size;
  const hasStreetOverflow = publishedStreetCount > HUB_STREET_LADDER_CAP;

  const generation = await prisma.hubGeneration.findUnique({ where: { neighbourhoodSlug: slug } });
  const sections: HubSection[] =
    generation && generation.status === "succeeded" ? ((generation.sectionsJson as unknown as HubSection[]) ?? []) : [];

  // Hub input (stats / streets) is request-cached, so the body, the meta description and the
  // JSON-LD all read ONE computation of ONE aggregate.
  const input: HubGeneratorInput | null = await getHubInputCached(slug);
  const agg = input?.aggregates;

  // The hub's typical, k-gated then rounded ONCE. Every surface below uses this value, never
  // agg.typicalPrice directly. That is the whole fix.
  const typicalDisplay = hubDisplayTypical(agg?.typicalPrice);

  const stats: HubStats = {
    typicalPrice: typicalDisplay,                       // null = k-anon silent (sub-k pools)
    sold12mo: agg ? agg.salesCount : null,
    onMarket: input?.activeListingsCount ?? null,
    dom: agg?.daysOnMarket ?? null,
  };

  const para = (ids: string[]) => sections.filter((s) => ids.includes(s.id)).flatMap((s) => s.paragraphs).filter(Boolean);
  const overview = para(["openingIdentity", "amenities", "bestFitFor", "inventorySnapshot"]);
  const marketParas = para(["liveMarket", "comparedToMilton"]);
  const commentary: HubMarketCommentary = {
    paragraphs: marketParas.length
      ? marketParas
      : stats.typicalPrice === null
        ? ["Resale activity here is thin, so prices are held back. The street pages show what has actually traded."]
        : [`Homes here have traded near ${fullPrice(stats.typicalPrice)} over the trailing twelve months.`],
    source: "Grounded in trailing 12-month TREB sold data, recomputed on every request",
  };

  let faqs: HubFaq[] = [];
  try {
    faqs = (JSON.parse(content.faqJson || "[]") as Array<{ question: string; answer: string }>).map((f) => ({ question: f.question, answer: f.answer }));
  } catch {
    faqs = [];
  }

  // THE LADDER IS EVERY PUBLISHED STREET IN THE HUB. It used to stop at HUB_STREET_LADDER_CAP
  // and hand the rest to the overflow page; a hub that says "48 streets with a page" and lists
  // twelve is making the reader hunt for the other thirty-six. The cap still governs whether
  // the A-to-Z overflow page exists (rung three); it no longer governs what the hub shows.
  const ps = (input?.projectedStreets ?? []).filter((s) => publishedStreetSlugs.has(s.slug));

  // RUNG ONE and RUNG TWO share one video read. The strip shows the hood's filmed streets; the
  // ladder marks them, so the two sections cannot disagree about which streets are filmed.
  const videoSlugs = await getVideoStreetSlugs();
  const hoodFilmed = Array.from(publishedStreetSlugs).filter((sl) => videoSlugs.has(sl));
  const videoStreets = await getStreetsWithVideoForSlugs(hoodFilmed, hoodFilmed.length);

  // THE LADDER CARRIES THE STREET PAGE'S OWN NUMBERS (ruling, 2026-09-10). It used to publish
  // a sold count and a hardcoded null price, so the hub and the street page could not disagree
  // only because one of them said nothing. Ranked by the pooled 12-month count the row prints,
  // not by DB1's per-slug count, so the order and the bar agree with the number beside them.
  const ladder = await buildLadder(
    ps.map((s) => ({ slug: s.slug, name: s.displayName, soldCount12mo: s.soldCount12mo, isVip: s.isVip })),
    videoSlugs,
  );
  ladder.sort((a, b) => b.soldCount12mo - a.soldCount12mo || a.name.localeCompare(b.name));
  const streets: HubStreetCard[] = ladder.map((l) => ({
    name: l.name,
    slug: l.slug,
    soldCount: l.soldCount12mo,
    typicalPriceRounded: l.typical,
    basis: l.basis,
    hasVideo: l.hasVideo,
    signal: l.isVip ? "VIP street" : undefined,
  }));
  // The VIP strip is retired from the template (the ladder marks VIP streets inline); the field
  // is kept for the JSON-LD projector and the tenure hubs, which still read it.
  const vipStreets: HubVipStreet[] =
    profile === "urban"
      ? ladder.filter((s) => s.isVip).slice(0, 6).map((s) => ({ name: s.name, slug: s.slug, soldCount: s.soldCount12mo }))
      : [];

  // NOTHING STATIC (ruling). `suits`, `commute` and `schools` were per-profile constants
  // dressed as neighbourhood facts; every one is now derived or absent.
  const hubSchools = schoolsInHub(slug);
  const listingsToken = listingsFilterToken(nbhd.rawStrings);
  const typicalBasis = hubTypicalBasis(stats.typicalPrice !== null ? stats.sold12mo : null);
  const atAGlance: HubAtAGlance = {
    facts: buildFacts({
      typical: stats.typicalPrice,
      typicalBasis,
      salesCount: stats.sold12mo,
      publishedStreets: publishedStreetCount,
      filmedStreets: hoodFilmed.length,
      schoolCount: hubSchools.length,
      stockShare: input ? stockShareFrom(input.byType) : null,
      activeCount: stats.onMarket,
      listingsToken,
    }),
  };

  const milton = await buildMiltonWideContext().catch(() => null);
  // Both sides rounded through round5k BEFORE display and before the delta, so the percentage
  // a reader sees is derivable from the two figures beside it, and the neighbourhood figure
  // here is the same one the glance and the meta description publish.
  const miltonDisplay = hubDisplayTypical(milton?.aggregates.typicalPrice);
  const marketCompare: HubMarketCompare[] =
    typicalDisplay && miltonDisplay
      ? [{ metricLabel: "Typical sale price", neighbourhoodValue: `$${compactPrice(typicalDisplay)}`, miltonValue: `$${compactPrice(miltonDisplay)}`, delta: deltaPct(typicalDisplay, miltonDisplay) }]
      : [];
  const miltonBasis =
    milton && miltonDisplay && milton.aggregates.salesCount > 0
      ? `across ${milton.aggregates.salesCount.toLocaleString("en-CA")} sales in the last 12 months`
      : null;

  const [condos, { siblings, byDistance: nearbyByDistance }] = await Promise.all([condosFor(nbhd.id), siblingsFor(slug, profile)]);

  const name = content.neighbourhoodName ?? nbhd.name;
  // Fallback character line reads the LIVE description, not the stored one. This was the last
  // path by which a frozen figure could reach the rendered body: a hub whose generation produced
  // no overview paragraphs would print its generation-time meta sentence, price, sale count and
  // all, into the hero.
  const character = overview.length
    ? firstSentence(overview[0])
    : firstSentence((await getHubMetaLive(slug))?.description ?? "");

  return {
    slug,
    name,
    profile,
    character,
    intents: intentsFor({ slug, name, listingsToken, activeCount: stats.onMarket, salesCount: stats.sold12mo }),
    stats,
    atAGlance,
    overview,
    marketCompare,
    miltonBasis,
    commentary,
    streets,
    videoStreets,
    schools: hubSchools,
    typicalBasis,
    streetCount: publishedStreetCount, // published guides in this hub; the ladder lists every one
    hasStreetOverflow,
    vipStreets,
    condos,
    faqs,
    siblings,
    nearbyByDistance,
    ctaBuyer: {
      heading: `Thinking of buying in ${name}?`,
      body: `The street-by-street read above, and every live listing in ${name} on one page.`,
      buttonLabel: `Listings in ${name}`,
      href: listingsToken ? `/listings?neighbourhood=${encodeURIComponent(listingsToken)}` : "/listings",
    },
    ctaSeller: {
      heading: `Own a home in ${name}?`,
      body: `A grounded valuation built on real ${name} comparables: the number, then the strategy.`,
      buttonLabel: "Value my home",
      href: `/value/${slug}`,
    },
  };
}
