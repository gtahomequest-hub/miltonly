// src/lib/hubData.ts
// THE SEAM (read side). getHubData(slug) reads the SAME vetted hub data the live
// route already used (HubContent + HubGeneration.sectionsJson + buildHubInput /
// buildRuralHubInput aggregates) and maps it into the new HubData design contract.
// Sub-k discipline preserved: aggregates.typicalPrice === null (thin pools — the 4
// sub-k rurals) -> stats.typicalPrice null -> silent state, NEVER a fabricated price.
// profile 'rural' drives the reduced layout; empty arrays hide sections. Mirrors
// getCondoData / getHomepageData null-tolerance.
import { prisma } from "@/lib/prisma";
import { getSoldDb } from "@/lib/db";
import { HUB_STREET_LADDER_CAP } from "@/lib/streetSurface";
import { buildMiltonWideContext } from "@/lib/ai/buildHubInput";
import { getHubInputCached, getHubMetaLive } from "@/lib/hubLive";
import { NEIGHBOURHOOD_CHARACTER } from "@/lib/homepageData";
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
const TYPE_LABEL: Record<string, string> = { detached: "Detached", semi: "Semis", townhouse: "Townhomes", condo: "Condos", other: "Other homes" };
function dominantTypeFrom(byType: Record<string, HubTypeBucket>): string {
  const ranked = Object.entries(byType).filter(([, b]) => b.count > 0).sort((a, b) => b[1].count - a[1].count);
  if (!ranked.length) return "Detached & townhomes";
  return ranked.slice(0, 2).map(([t]) => TYPE_LABEL[t] ?? t).join(" & ");
}
function deltaPct(nbhd: number, milton: number): string {
  const pct = Math.round(((nbhd - milton) / milton) * 100);
  return pct === 0 ? "in line with Milton" : `${pct > 0 ? "+" : ""}${pct}% vs Milton`;
}
function intentsFor(slug: string): HubIntentSquare[] {
  return [
    { key: "buy", label: "I'm buying", sub: "Streets & listings here", href: `/neighbourhoods/${slug}#streets` },
    { key: "sell", label: "I'm selling", sub: "What my home is worth", href: "/sell" },
    { key: "rent", label: "I'm renting", sub: "Lease in this area", href: "/rentals" },
    { key: "invest", label: "I'm investing", sub: "Yield & rental rules", href: "/#mls" },
  ];
}

async function condosFor(neighbourhoodId: string | null): Promise<HubCondoBuilding[]> {
  if (!neighbourhoodId) return [];
  const cbs = await prisma.condoBuilding.findMany({
    where: { neighbourhoodId },
    select: { slug: true, displayName: true, buildingAddress: true },
  });
  if (!cbs.length) return [];
  const pub = new Set(
    (await prisma.condoContent.findMany({
      where: { buildingSlug: { in: cbs.map((c) => c.slug) }, status: "published" },
      select: { buildingSlug: true },
    })).map((c) => c.buildingSlug),
  );
  return cbs.filter((c) => pub.has(c.slug)).slice(0, 6).map((c) => ({ name: c.displayName ?? c.buildingAddress ?? c.slug, slug: c.slug }));
}

async function siblingsFor(slug: string, profile: HubProfile): Promise<HubSibling[]> {
  const sibs = await prisma.neighbourhood.findMany({
    where: { slug: { not: slug }, profile: profile === "urban" ? "urban_hub" : "rural_hub" },
    select: { slug: true, name: true, rawStrings: true },
  });
  if (!sibs.length) return [];
  const pub = new Set(
    (await prisma.hubContent.findMany({
      where: { neighbourhoodSlug: { in: sibs.map((s) => s.slug) }, status: "published" },
      select: { neighbourhoodSlug: true },
    })).map((h) => h.neighbourhoodSlug),
  );
  const pubSibs = sibs.filter((s) => pub.has(s.slug)).slice(0, 4);
  if (!pubSibs.length) return [];
  // per-sibling typical via one grouped DB2 query (k-anon: null when <5 sales)
  const sold = getSoldDb();
  const rows: Array<{ neighbourhood: string; n: number; total: number }> = sold
    ? ((await sold`SELECT neighbourhood, COUNT(*)::int AS n, COALESCE(SUM(sold_price),0)::float AS total
         FROM sold.sold_records
         WHERE perm_advertise = TRUE AND transaction_type = 'For Sale' AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()
         GROUP BY neighbourhood`) as Array<{ neighbourhood: string; n: number; total: number }>)
    : [];
  const byRaw = new Map(rows.map((r) => [r.neighbourhood, r]));
  return pubSibs.map((s) => {
    let n = 0, t = 0;
    for (const raw of s.rawStrings) { const r = byRaw.get(raw); if (r) { n += r.n; t += r.total; } }
    return {
      name: s.name,
      slug: s.slug,
      character: NEIGHBOURHOOD_CHARACTER[s.slug] ?? (profile === "rural" ? "Rural Milton — large lots." : "Established Milton neighbourhood."),
      typicalPriceRounded: n >= K_ANON_PRICE && t > 0 ? round5k(t / n) : null,
    };
  });
}

export async function getHubData(slug: string): Promise<HubData | null> {
  const content = await prisma.hubContent.findUnique({ where: { neighbourhoodSlug: slug } });
  if (!content || content.status !== "published") return null;
  const nbhd = await prisma.neighbourhood.findUnique({ where: { slug } });
  if (!nbhd) return null;
  const profile: HubProfile = nbhd.profile === "urban_hub" ? "urban" : "rural";

  // Published-street count for this neighbourhood (drives the overflow gate): streets whose
  // StreetContent.status="published" AND that have a canonical ResidentialStreet row here.
  const nbhdStreetSlugs = (
    await prisma.residentialStreet.findMany({ where: { neighbourhoodId: nbhd.id }, select: { slug: true } })
  ).map((r) => r.slug);
  // PUBLISHED-ONLY gate for the ladder + VIP strip + overflow. The ladder used SURFACED_STREET_WHERE
  // (rws>0 OR hasPublishedPage), which let ~101 unpublished streets fill ladder/VIP slots across the
  // 22 hubs — internal links to pages that carry no published guide (and that DEC-SEO-1 will 404).
  // The set below is this neighbourhood's streets that DO carry a published StreetContent page.
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

  // Hub input (stats / streets / VIP) — request-cached, so the body, the meta
  // description and the JSON-LD all read ONE computation of ONE aggregate.
  const input: HubGeneratorInput | null = await getHubInputCached(slug);
  const agg = input?.aggregates;

  // The hub's typical, k-gated then rounded ONCE. Every surface below uses this
  // value, never agg.typicalPrice directly — that is the whole fix.
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
        ? ["Resale activity here is thin, so prices are held back. The road pages show what has actually traded."]
        : [`Homes here have traded near ${fullPrice(stats.typicalPrice)} over the trailing twelve months.`],
    source: "Grounded in trailing-12-month TREB sold data · updated continuously",
  };

  let faqs: HubFaq[] = [];
  try {
    faqs = (JSON.parse(content.faqJson || "[]") as Array<{ question: string; answer: string }>).map((f) => ({ question: f.question, answer: f.answer }));
  } catch {
    faqs = [];
  }

  // Ladder + VIP source: PUBLISHED-ONLY. Filter the surfaced projection to streets that carry a
  // published page (was: the raw surfaced projection, rws>0 OR hasPublishedPage). No cap change and
  // no top-up with surfaced-unpublished — ladders SHRINK where published inventory < 12 slots. That
  // is the honest null-not-zero outcome; short states are framed deliberately in the HubStreets view.
  const ps = (input?.projectedStreets ?? []).filter((s) => publishedStreetSlugs.has(s.slug));
  const streets: HubStreetCard[] = [...ps]
    .sort((a, b) => (b.isVip ? 1 : 0) - (a.isVip ? 1 : 0) || b.soldCount12mo - a.soldCount12mo)
    .slice(0, HUB_STREET_LADDER_CAP)
    .map((s) => ({ name: s.displayName, slug: s.slug, soldCount: s.soldCount12mo, typicalPriceRounded: null, signal: s.isVip ? "VIP street" : undefined }));
  const vipStreets: HubVipStreet[] =
    profile === "urban"
      ? ps.filter((s) => s.isVip).sort((a, b) => b.soldCount12mo - a.soldCount12mo).slice(0, 6).map((s) => ({ name: s.displayName, slug: s.slug, soldCount: s.soldCount12mo }))
      : [];

  const priceRange = agg?.priceRange ? `$${compactPrice(agg.priceRange.low)} – $${compactPrice(agg.priceRange.high)}` : null;
  const atAGlance: HubAtAGlance = {
    priceRange,
    dominantType: input ? dominantTypeFrom(input.byType) : profile === "rural" ? "Detached & rural" : "Detached & townhomes",
    // STATIC descriptive copy (no live source) — honest, Milton-wide, not fabricated figures.
    suits: profile === "rural" ? ["Acreage & privacy seekers", "Move-up buyers"] : ["Families", "Move-up buyers", "First-time buyers"],
    commute: "Milton GO + Highway 401 access",
    schools: "Public & Catholic options nearby — see school pages",
  };

  const milton = await buildMiltonWideContext().catch(() => null);
  // Both sides rounded through round5k BEFORE display and before the delta, so
  // the percentage a reader sees is derivable from the two figures beside it —
  // and the neighbourhood figure here is the same one the hero tile and the meta
  // description publish.
  const miltonDisplay = hubDisplayTypical(milton?.aggregates.typicalPrice);
  const marketCompare: HubMarketCompare[] =
    typicalDisplay && miltonDisplay
      ? [{ metricLabel: "Typical price", neighbourhoodValue: `$${compactPrice(typicalDisplay)}`, miltonValue: `$${compactPrice(miltonDisplay)}`, delta: deltaPct(typicalDisplay, miltonDisplay) }]
      : [];

  const [condos, siblings] = await Promise.all([condosFor(nbhd.id), siblingsFor(slug, profile)]);

  const name = content.neighbourhoodName ?? nbhd.name;
  // Fallback character line reads the LIVE description, not the stored one. This
  // was the last path by which a frozen figure could reach the rendered body: a
  // hub whose generation produced no overview paragraphs would print its
  // generation-time meta sentence — price, sale count and all — into the hero.
  const character = overview.length
    ? firstSentence(overview[0])
    : firstSentence((await getHubMetaLive(slug))?.description ?? "");

  return {
    slug,
    name,
    profile,
    character,
    intents: intentsFor(slug),
    stats,
    atAGlance,
    overview,
    marketCompare,
    commentary,
    streets,
    streetCount: publishedStreetCount, // published guides in this hub (ladder is published-only)
    hasStreetOverflow,
    vipStreets,
    condos,
    faqs,
    siblings,
    ctaBuyer: {
      heading: `Thinking of buying in ${name}?`,
      body: `Get the street-by-street read and the live listings for ${name}, ${"Milton"}.`,
      buttonLabel: "Explore listings",
      href: "/listings",
    },
    ctaSeller: {
      heading: `Own a home in ${name}?`,
      body: `Get a grounded valuation built on real ${name} comparables — the number, then the strategy.`,
      buttonLabel: "Value my home",
      href: "/sell",
    },
  };
}
