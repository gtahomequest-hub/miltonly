// src/lib/hubData.ts
// THE SEAM (read side). getHubData(slug) reads the vetted hub data (HubContent +
// HubGeneration.sectionsJson + the hub's public DB1 facts) and maps it into the HubData
// design contract. profile 'rural' drives the reduced layout; empty arrays hide sections.
//
// MC-046 Stage 1 (PropTx VOW Best Practices item 40). Every value derived from VOW records left
// the visitor view: the typical sold price and its sample, the sub-k sale count, the housing-type
// share of sales, the "N sales here" intent, the ladder's per-street sold count, typical and
// basis, the Milton compare block, the market commentary, the nearby hubs' typicals and counts,
// and the JSON-LD aggregatePrice. Nothing here reads DB2 or DB3: the hub's public input
// (hubLive.getHubPublicCached) is DB1 only. Stored generated prose (overview, lede, FAQs) is
// served through the numeric stripper AND the VOW topic filter (ruling R2).
import { condoDisplayName } from "@/lib/condoName";
import { prisma } from "@/lib/prisma";
import { HUB_STREET_LADDER_CAP } from "@/lib/streetSurface";
import { getHubPublicCached } from "@/lib/hubLive";
import { NEIGHBOURHOOD_SEED } from "@/lib/neighbourhood";
import { nearestHubs } from "@/lib/hubNearby";
import { resolveStreetName } from "@/lib/streetName";
import {
  stripNumericSentences,
  stripNumericParagraphs,
  sentenceHasNumber,
  answersQuestion,
  isDisclaimerOnly,
} from "@/lib/prose/numericSentences";
import { firstSentence } from "@/lib/prose/sentences";
import { stripVowTopicParagraphs, mentionsVowTopic, isVowTopicFaq } from "@/lib/prose/vowTopic";
import type {
  HubData, HubProfile, HubStats, HubAtAGlance, HubStreetCard, HubVipStreet, HubCondoBuilding,
  HubFaq, HubSibling, HubIntentSquare,
} from "@/components/hub/types";
import type { HubSection } from "@/types/hub-generator";

// ── THE VISITOR-VIEW PROSE RULE (MC-046 R2) ─────────────────────────────────────────────────
// Stored hub and condo prose was generated from inputs that carried sold and leased aggregates,
// and regeneration is barred. So the render removes, in order: every sentence that speaks about
// a VOW topic (price, sales, leases, rents, the market, time to sell; vowTopic.ts), then every
// sentence carrying a figure, with the numeric stripper's coherence pass cleaning up after both.
// Exported so the condo seam applies the same rule (condoData.ts).

/** Overview paragraphs as a visitor may read them. [] when nothing but caveats survives. */
export function visitorParagraphs(paragraphs: string[]): string[] {
  const kept = stripNumericParagraphs(stripVowTopicParagraphs(paragraphs.filter(Boolean)));
  return isDisclaimerOnly(kept) ? [] : kept;
}

/**
 * FAQ items as a visitor may read them. The answer loses its figure sentences; the item goes
 * whole when its question carries a figure, when the question or the surviving answer speaks
 * about a VOW topic, or when what survives no longer answers the question. The FAQPage JSON-LD
 * is built from exactly this list, so the markup and the page cannot differ, whatever the
 * stored generation's age.
 */
export function visitorFaqs(raw: unknown): HubFaq[] {
  if (!Array.isArray(raw)) return [];
  const out: HubFaq[] = [];
  for (const f of raw as Array<{ question?: unknown; answer?: unknown }>) {
    if (typeof f?.question !== "string" || typeof f?.answer !== "string") continue;
    const question = f.question.trim();
    const answer = stripNumericSentences(f.answer, { standalone: true });
    if (!question || !answer) continue;
    if (sentenceHasNumber(question)) continue;
    if (isVowTopicFaq(question, answer)) continue;
    if (!answersQuestion(question, answer)) continue;
    out.push({ question, answer });
  }
  return out;
}

/** The hero lede: the first sentence of the filtered overview that stands on its own. */
export function visitorLede(overview: string[]): string {
  for (const p of overview) {
    const s = stripNumericSentences(firstSentence(p), { standalone: true });
    if (s && !mentionsVowTopic(s)) return s;
  }
  return "";
}

function parseFaqJson(json: string | null | undefined): unknown {
  try {
    return JSON.parse(json || "[]");
  } catch {
    return [];
  }
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
 * NEARBY, BY POSITION. What a card says is derived: how far the hub is (boundary centre to
 * boundary centre, from the Town's polygons) and how many street guides it has. MC-046: the
 * sibling's typical sold price and its sale count are gone, and so is the DB2 query per sibling
 * that computed them. The four shown are the four nearest of every published hub; a hub the Town
 * has no polygon for gets the other rural hubs instead, and the section heading says so.
 */
async function siblingsFor(slug: string, profile: HubProfile): Promise<{ siblings: HubSibling[]; byDistance: boolean }> {
  const published = (
    await prisma.hubContent.findMany({ where: { status: "published", neighbourhoodSlug: { not: slug } }, select: { neighbourhoodSlug: true } })
  ).map((h) => h.neighbourhoodSlug);
  const hoods = await prisma.neighbourhood.findMany({
    where: { slug: { in: published } },
    orderBy: { name: "asc" },
    select: { id: true, slug: true, name: true, profile: true },
  });
  if (!hoods.length) return { siblings: [], byDistance: false };
  const { hubs, byDistance } = nearestHubs(slug, hoods.map((h) => h.slug), 4);
  // A hub with no polygon (the unmapped rural four) cannot be "near" anything, so its
  // siblings are the other RURAL hubs in the rural tier's own order (NEIGHBOURHOOD_SEED,
  // kind "rural"), not the first four rural_hub rows alphabetically (MA-005 defect 4, MC-027).
  const publishedSet = new Set(hoods.map((h) => h.slug));
  const ruralOrder = NEIGHBOURHOOD_SEED.filter((n) => n.kind === "rural" && n.slug !== slug && publishedSet.has(n.slug)).map((n) => n.slug);
  const sameTier = hoods.filter((h) => (h.profile === "urban_hub" ? "urban" : "rural") === profile).map((h) => h.slug);
  const chosen = byDistance ? hubs : nearestHubs(slug, profile === "rural" ? ruralOrder : sameTier, 4).hubs;
  const bySlug = new Map(hoods.map((h) => [h.slug, h]));
  const picked = chosen.map((c) => ({ ...c, hood: bySlug.get(c.slug)! })).filter((c) => c.hood);
  if (!picked.length) return { siblings: [], byDistance };

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
    siblings: picked.map(({ hood, distanceKm }) => ({
      name: hood.name,
      slug: hood.slug,
      streetPages: pagesByHood.get(hood.id) ?? 0,
      distanceKm,
    })),
  };
}

// ── the derived-fact glance, the ladder, and the video rung ──────────────────────────────────
import { buildLadder } from "@/lib/hubStreetLadder";
import { schoolsInHub } from "@/lib/hubSchools";
import { getVideoStreetSlugs, getStreetsWithVideoForSlugs } from "@/lib/homeSignals";
import type { HubFact } from "@/components/hub/types";

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
 * MC-046: the investing square no longer counts sales; it names the sold record and nothing
 * more. The buying square keeps its count of homes for sale today (IDX).
 */
function intentsFor(input: {
  slug: string;
  name: string;
  listingsToken: string | null;
  activeCount: number | null;
}): HubIntentSquare[] {
  const { slug, name, listingsToken, activeCount } = input;
  const buyHref = listingsToken ? `/listings?neighbourhood=${encodeURIComponent(listingsToken)}` : "/listings";
  const buySub =
    activeCount !== null && activeCount > 0
      ? `${activeCount} ${activeCount === 1 ? "home" : "homes"} for sale here today`
      : `Homes for sale in ${name}`;
  return [
    { key: "buy", label: "I'm buying", sub: buySub, href: buyHref },
    { key: "sell", label: "I'm selling", sub: `What a ${name} home is worth`, href: `/value/${slug}` },
    { key: "rent", label: "I'm renting", sub: `Leases in ${name}`, href: `/rentals?neighbourhood=${slug}` },
    { key: "invest", label: "I'm investing", sub: `The sold record for ${name}`, href: `/sold?nbhd=${encodeURIComponent(slug)}` },
  ];
}

/**
 * THE GLANCE PANEL, DERIVED. Every entry is computed from public data and carries the basis it
 * was computed over. A fact whose source is empty is DROPPED, never softened into a sentence.
 * Every href lands on the section of THIS page that lists what the figure counts, or on the
 * filtered feed for the active count.
 */
function buildFacts(input: {
  publishedStreets: number;
  filmedStreets: number;
  schoolCount: number;
  activeCount: number | null;
  listingsToken: string | null;
}): HubFact[] {
  const f: HubFact[] = [];
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
  return f;
}

export async function getHubData(slug: string): Promise<HubData | null> {
  // MC-046: the columns the page uses, never the row (statsJson and the stored meta carry
  // VOW-derived figures from generation time).
  const content = await prisma.hubContent.findUnique({
    where: { neighbourhoodSlug: slug },
    select: { status: true, faqJson: true, neighbourhoodName: true },
  });
  if (!content || content.status !== "published") return null;
  const pub = await getHubPublicCached(slug);
  if (!pub) return null;
  const nbhd = await prisma.neighbourhood.findUnique({ where: { slug }, select: { id: true } });
  if (!nbhd) return null;
  const profile: HubProfile = pub.profile;

  // Published-street count for this neighbourhood: streets with a canonical ResidentialStreet
  // row here whose StreetContent.status="published".
  const publishedStreetSlugs = new Set(pub.publishedStreets.map((s) => s.slug));
  const publishedStreetCount = publishedStreetSlugs.size;
  const hasStreetOverflow = publishedStreetCount > HUB_STREET_LADDER_CAP;

  const generation = await prisma.hubGeneration.findUnique({ where: { neighbourhoodSlug: slug } });
  const sections: HubSection[] =
    generation && generation.status === "succeeded" ? ((generation.sectionsJson as unknown as HubSection[]) ?? []) : [];

  const stats: HubStats = { onMarket: pub.activeCount };

  const para = (ids: string[]) => sections.filter((s) => ids.includes(s.id)).flatMap((s) => s.paragraphs).filter(Boolean);
  // liveMarket and comparedToMilton are not read: they were written from the sold aggregate.
  const overview = visitorParagraphs(para(["openingIdentity", "amenities", "bestFitFor", "inventorySnapshot"]));
  const faqs = visitorFaqs(parseFaqJson(content.faqJson));

  // THE LADDER IS EVERY PUBLISHED RESIDENTIAL STREET IN THE HUB, ordered by homes for sale today
  // (ruling R9). The cap still governs whether the A-to-Z overflow page exists.
  const ladderInput = pub.publishedStreets
    .filter((s) => s.isResidential)
    .map((s) => ({ slug: s.slug, name: resolveStreetName(s.slug, s.name).name, isVip: s.isVip }));

  // RUNG ONE and RUNG TWO share one video read. The strip shows the hood's filmed streets; the
  // ladder marks them, so the two sections cannot disagree about which streets are filmed.
  const videoSlugs = await getVideoStreetSlugs();
  const hoodFilmed = Array.from(publishedStreetSlugs).filter((sl) => videoSlugs.has(sl));
  const videoStreets = await getStreetsWithVideoForSlugs(hoodFilmed, hoodFilmed.length);

  const ladder = await buildLadder(ladderInput, videoSlugs);
  const streets: HubStreetCard[] = ladder.map((l) => ({
    name: l.name,
    slug: l.slug,
    activeCount: l.activeCount,
    hasVideo: l.hasVideo,
    signal: l.isVip ? "VIP street" : undefined,
  }));
  // The VIP strip is retired from the template (the ladder marks VIP streets inline); the field
  // is kept for the JSON-LD projector and the tenure hubs, which still read it.
  const vipStreets: HubVipStreet[] =
    profile === "urban" ? ladder.filter((s) => s.isVip).slice(0, 6).map((s) => ({ name: s.name, slug: s.slug })) : [];

  // NOTHING STATIC (ruling). Every glance fact is derived or absent.
  const hubSchools = schoolsInHub(slug);
  const listingsToken = listingsFilterToken(pub.rawStrings);
  const atAGlance: HubAtAGlance = {
    facts: buildFacts({
      publishedStreets: publishedStreetCount,
      filmedStreets: hoodFilmed.length,
      schoolCount: hubSchools.length,
      activeCount: stats.onMarket,
      listingsToken,
    }),
  };

  const [condos, { siblings, byDistance: nearbyByDistance }] = await Promise.all([condosFor(nbhd.id), siblingsFor(slug, profile)]);

  const name = content.neighbourhoodName ?? pub.name;
  // The lede is the filtered overview's first sentence, or nothing. It no longer falls back to the
  // meta description: that is a line of counts, and a lede is not.
  const character = visitorLede(overview);

  return {
    slug,
    name,
    profile,
    character,
    intents: intentsFor({ slug, name, listingsToken, activeCount: stats.onMarket }),
    stats,
    atAGlance,
    overview,
    marketCompare: [],
    commentary: { paragraphs: [], source: "" },
    streets,
    videoStreets,
    schools: hubSchools,
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
