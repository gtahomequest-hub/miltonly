// src/lib/streetV2Data.ts
// THE SEAM (read side) for the forest-v2 street page. Maps getStreetPageData(slug) (IDX, Town
// and registry data) + loadStreetGeneration(slug) (stored prose) into the StreetV2Data design
// contract. Mirrors getHubData / getCondoData.
//
// THE VISITOR VIEW (MC-046 Stage 1, PropTx VOW Best Practices item 40). No value derived from a
// sold, leased, expired or terminated record crosses this seam. getStreetPageData no longer
// reads one; the prose it maps is stored generation output written from inputs that did, so the
// mapper drops the two sections written from market aggregates (market, neighbourhoodComparable),
// every numeric sentence, and every FAQ item on a VOW topic (isVowTopicFaq), before the page or
// its JSON-LD sees any of it.
import 'server-only';
import { getStreetPageData } from '@/lib/street-data';
import { stripNumericSentences, stripNumericParagraphs, answersQuestion, isDisclaimerOnly, isFragment } from '@/lib/prose/numericSentences';
import { isVowTopicFaq, stripVowTopicParagraphs } from '@/lib/prose/vowTopic';
import { loadStreetGeneration, type LoadedStreetGeneration } from '@/lib/ai/loadStreetGeneration';
import { geometryFactsFor } from '@/lib/town/geometry';
import type { StreetPageData, StreetHeroProps, TypeSectionProps } from '@/types/street';
import type { StreetV2Data, StreetStat, TypeBlock, CommuteCategory } from '@/components/street/v2/types';

/** The generated sections written from sold and leased aggregates (ruling R1). Dropped whole:
 *  the numeric stripper takes their figures, but the qualitative claims left behind ("prices
 *  have firmed", "homes here move quickly") are still derived from VOW records. */
export const VOW_SECTION_IDS: ReadonlySet<string> = new Set(['market', 'neighbourhoodComparable']);

/** IDX tiles only: the active count, and the housing mix of the active listings where any exist. */
function mapHeroStats(hp: StreetHeroProps, activeCount: number): StreetStat[] {
  const mix = hp.heroStats.find((s) => s.label === 'Housing mix');
  const out: StreetStat[] = [{ label: 'Active right now', kind: 'count', value: activeCount, sub: 'live listings · today' }];
  if (mix && typeof mix.value === 'string' && mix.value) {
    out.push({ label: 'Housing mix', kind: 'text', value: null, textValue: mix.value, sub: mix.sub ?? null });
  }
  return out;
}

function mapType(t: TypeSectionProps): TypeBlock | null {
  // The card's one cell is the active count with the mean asking price as its detail.
  const active = t.statsSold.find((c) => c.label === 'Active listings');
  if (!active) return null;
  return {
    type: t.type,
    displayName: t.displayName,
    intro: t.intro,
    active: active.value,
    activeDetail: active.detail,
  };
}

const COMMUTE_ICON: Record<string, CommuteCategory['icon']> = {
  transit: 'transit',
  education: 'schools',
  schools: 'schools',
  health: 'health',
  parks: 'parks',
  shopping: 'shopping',
  worship: 'worship',
};

/** PURE mapper — route reuses its own getStreetPageData/loadStreetGeneration fetch. */
export function mapStreetV2Data(
  data: StreetPageData,
  generation: LoadedStreetGeneration | null,
): StreetV2Data {
  const hp = data.heroProps;
  const activeCount = data.activeInventory.total;
  // No row on record and nothing listed => a per-property claim in the prose has no source
  // anywhere. Only there do we suppress property detail that carries no number. The page
  // publishes no price, band or sold-to-ask figure (MC-046), so no stored sentence is kept on
  // the strength of one: the published-figure options stay unset.
  const stripOpts = {
    noRecord: !data.enrichment.hasRecord && activeCount === 0,
  };
  const sCTA = data.descriptionSidebar.sidebarCTA;

  return {
    slug: data.street.slug,
    name: data.street.name,
    shortName: data.street.shortName,
    eyebrow: hp.eyebrow,
    // hp.subtitle has passed the numeric and VOW-topic strips (street-data buildHero); the
    // fallback is the same suppressed sentence, so nothing reaches the hero unfiltered.
    subtitle: hp.subtitle || data.street.characterSummary,
    neighbourhoods: data.street.neighbourhoods,

    hero: {
      stats: mapHeroStats(hp, activeCount),
    },

    // Prose: the generated sections, less the two written from market aggregates, with EVERY
    // numeric sentence suppressed (see numericSentences.ts). A section whose paragraphs are all
    // numeric drops out entirely rather than rendering a heading over nothing.
    placeholder: !generation,
    sections: generation
      ? generation.sections
          .filter((s) => !VOW_SECTION_IDS.has(s.id))
          // MC-046 R1: after the numeric pass, the topic pass. A sentence on price, sales, leases,
          // rents or the market was written from VOW aggregates even when it carries no digit
          // ("every recorded sale has been a townhouse", "homes here move quickly").
          .map((s) => ({ id: s.id, heading: s.heading, paragraphs: stripVowTopicParagraphs(stripNumericParagraphs(s.paragraphs, stripOpts)) }))
          // A heading is a promise that something follows it. Empty fails that; so does a
          // section whose only survivor is the compliance caveat.
          .filter((s) => s.paragraphs.length > 0 && !isDisclaimerOnly(s.paragraphs) && !isFragment(s.paragraphs))
      : [],

    sidebar: {
      facts: Object.entries(data.descriptionSidebar.streetFacts).map(([label, value]) => ({ label, value })),
      // QUEUE item 5: the Town's physical facts for this street, or null. Looked up by slug
      // here, at the seam, so the data window and the shell never compute it twice.
      geometry: geometryFactsFor(data.street.slug),
      nearby: data.descriptionSidebar.nearbyPlaces.map((n) => ({
        category: n.category,
        name: n.name,
        distance: n.distance,
        icon: n.icon,
        href: n.href,
      })),
      cta: {
        eyebrow: sCTA.eyebrow,
        headline: sCTA.headline,
        body: sCTA.body,
        actionLabel: sCTA.actionLabel,
        actionHref: sCTA.actionHref,
        trustLine: sCTA.trustLine,
      },
    },

    productTypes: data.productTypes.map(mapType).filter((t): t is TypeBlock => t !== null),

    commute: data.commuteGrid.categories.map((c) => ({
      id: c.id,
      title: c.title,
      subtitle: c.subtitle,
      icon: COMMUTE_ICON[c.id] ?? 'transit',
      destinations: c.destinations.map((d) => ({
        name: d.name,
        primaryTime: d.primaryTime,
        secondaryTime: d.secondaryTime,
        href: d.href,
      })),
    })),

    activeListings: data.activeInventory.listings.map((l) => ({
      mlsNumber: l.mlsNumber,
      address: l.address,
      price: l.price,
      bedrooms: l.bedrooms,
      bathrooms: l.bathrooms,
      parking: l.parking,
      propertyType: l.propertyType,
      listOfficeName: l.listOfficeName,
      photo: l.photo,
      href: l.href,
    })),

    // Pass-through, not a re-derivation. The ladder is built once in getStreetPageData from the
    // Town projection plus the listing rows it already holds; nothing here re-reads either.
    addresses: data.addressLadder,

    context: {
      similarStreets: data.contextCards.similarStreets.map((s) => ({
        slug: s.slug,
        name: s.name,
        avgPrice: s.avgPrice,
        count: s.count,
      })),
      // Physically-connected streets (StreetAdjacency) — pass through; empty renders nothing.
      connectedStreets: data.contextCards.connectedStreets.map((s) => ({ slug: s.slug, name: s.name })),
      neighbourhoods: data.contextCards.neighbourhoods.map((n) => ({ slug: n.slug, name: n.name, summary: n.summary })),
      schools: data.contextCards.schools.map((s) => ({ slug: s.slug, name: s.name, board: s.board, level: s.level })),
    },

    // FAQ: generated when present; placeholder (no generation) => none, matching the
    // legacy page's FAQ suppression in placeholder mode.
    // FAQ answers are stored generation output too — mae-court's carried a THIRD conflicting
    // Campbellville typical. An answer with nothing qualitative left takes its question with it.
    // The page's FAQPage JSON-LD is built from exactly this list (page.tsx), so the filters below
    // decide both surfaces at once.
    faqs: generation
      ? generation.faq
          // standalone: an answer is read on its own, so its opening sentence has to resolve on
          // its own. "Both provide clearer price benchmarks than Alder Gate." was surviving on
          // 126 pages because the sentence naming the two streets was numeric and sat in a
          // different FAQ item, so no cut was on record in this one when the opener was tested.
          .map((f) => ({ question: f.question, answer: stripNumericSentences(f.answer, { ...stripOpts, standalone: true }) }))
          // empty AND non-responsive both go: an answer left addressing a different subject than
          // its question ("What kinds of homes…" -> "Lots tend to be generous…") is worse than none
          .filter((f) => answersQuestion(f.question, f.answer))
          // THE TOPIC FILTER (MC-046, R1). An item whose question or answer speaks about price,
          // sales, leases, rents, time to sell or the market goes whole, after the numeric pass:
          // a qualitative claim of that kind was written from VOW aggregates even with no digit.
          .filter((f) => !isVowTopicFaq(f.question, f.answer))
      : [],

    finalCtas: {
      seller: { ...data.finalCTAs.sellerCTA },
      buyer: { ...data.finalCTAs.buyerCTA },
    },

    // The street's registry neighbourhood, for the CTAs' wording. The neighbourhood typical, its
    // basis, the tier and hasAnySale were VOW-derived and left with MC-046.
    areaContext: data.enrichment.areaContext
      ? {
          neighbourhoodName: data.enrichment.areaContext.neighbourhoodName,
          neighbourhoodSlug: data.enrichment.areaContext.neighbourhoodSlug,
        }
      : null,

    // Street-video PoC — already fully resolved (URLs + derived poster/caption) upstream;
    // pass through unchanged. null (and null clips within) render nothing.
    video: data.video,

    lastUpdated: data.lastUpdated,
  };
}

/** Named seam (mirrors getHubData/getCondoData). Fetches + maps; null when unknown. */
export async function getStreetV2Data(slug: string): Promise<StreetV2Data | null> {
  const [data, generation] = await Promise.all([getStreetPageData(slug), loadStreetGeneration(slug)]);
  if (!data) return null;
  return mapStreetV2Data(data, generation);
}
