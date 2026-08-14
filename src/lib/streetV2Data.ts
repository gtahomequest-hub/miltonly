// src/lib/streetV2Data.ts
// THE SEAM (read side) for the forest-v2 street page. Maps the SAME vetted output
// the legacy navy page already used — getStreetPageData(slug) (k-anon applied) +
// loadStreetGeneration(slug) (privacy-vetted prose) — into the StreetV2Data design
// contract. Mirrors getHubData / getCondoData.
//
// RESTYLE ONLY. Does NOT re-query DB2 trades or re-run the validator/k-anon gate.
// Suppression is ALREADY enforced upstream: structured stats arrive pre-formatted
// with "—" (or the cell omitted) where below threshold, and rawTypicalPrice is null.
// We pass those through as null so the v2 .s-silent states render — never a number
// where getStreetPageData suppressed one.
import 'server-only';
import { getStreetPageData } from '@/lib/street-data';
import { windowDisclosure } from '@/lib/streetEnrichment';
import { stripNumericSentences, stripNumericParagraphs, answersQuestion, isDisclaimerOnly } from '@/lib/prose/numericSentences';
import { loadStreetGeneration, type LoadedStreetGeneration } from '@/lib/ai/loadStreetGeneration';
import type {
  StreetPageData,
  StreetHeroProps,
  ProductPillData,
  ProductPillRow,
  TypeSectionProps,
  StatCell,
  MarketSummary,
} from '@/types/street';
import type {
  StreetV2Data,
  StreetStat,
  ProductPill,
  TypeBlock,
  GlanceTile,
  MarketStat,
  MarketSummaryCard,
  CommuteCategory,
} from '@/components/street/v2/types';

const SILENT = '—'; // the sentinel getStreetPageData renders for a suppressed stat

/** "—" => null (silent); any other formatted value passes through unchanged. */
function unsilent(v: string): string | null {
  return v === SILENT ? null : v;
}

function mapHeroStats(hp: StreetHeroProps, activeCount: number): StreetStat[] {
  const byLabel = (l: string) => hp.heroStats.find((s) => s.label === l);
  const mix = byLabel('Housing mix');
  const typical = byLabel('Typical price');
  // Keep the range sub-line ONLY when the typical published (k>=5) AND a range
  // exists (k>=10) — getStreetPageData encodes the latter as a "range …" sub.
  const range =
    hp.rawTypicalPrice != null && typeof typical?.sub === 'string' && typical.sub.startsWith('range ')
      ? typical.sub
      : null;
  return [
    { label: 'Housing mix', kind: 'text', value: null, textValue: mix ? String(mix.value) : null },
    {
      label: 'Typical price',
      kind: 'price',
      value: hp.rawTypicalPrice ?? null, // null => k-anon silent
      sub: range,
      basis: typical?.basis ?? null, // window+sample disclosure (mandatory on priced tiles)
      silentNote: 'sample too small to publish',
    },
    // EVERY count states its subject and its window. This mapper REBUILDS the hero tiles, so a sub
    // set upstream in buildHero never reaches the v2 shell — it has to be set here.
    // "Transactions tracked" is sales + leases over 12 months; the pill row beside it counts SALES
    // ONLY over the same window. Unlabelled, the two numbers read as a contradiction.
    {
      label: 'Transactions tracked',
      kind: 'count',
      value: hp.rawTotalTransactions ?? 0,
      sub: (hp.rawTotalTransactions ?? 0) > 0 ? 'sales + leases · last 12 months' : 'no closed deals · last 12 months',
    },
    { label: 'Active right now', kind: 'count', value: activeCount, sub: 'live listings · today' },
  ];
}

function mapPill(p: ProductPillData): ProductPill {
  // p.typicalPrice is already null when k<5; p.priceLabel is "sample too small" there.
  return {
    type: p.type,
    displayName: p.displayName,
    count: p.count,
    typicalPrice: p.typicalPrice,
    priceLabel: p.priceLabel,
    anchor: p.anchor,
  };
}

function mapType(t: TypeSectionProps): TypeBlock {
  // statsSold cells are pre-formatted; a suppressed stat's cell is simply ABSENT
  // (getStreetPageData omits Typical price / Price band / DOM / Sold-to-ask below
  // k>=5). Absent -> null -> .s-silent. No re-derivation.
  const cell = (label: string) => t.statsSold.find((c) => c.label === label);
  const typical = cell('Typical price');
  const active = cell('Active listings');
  return {
    type: t.type,
    displayName: t.displayName,
    intro: t.intro,
    typicalPrice: typical?.value ?? null,
    typicalDetail: typical?.detail,
    priceBand: cell('Price band')?.value ?? null,
    dom: cell('Time on market')?.value ?? null,
    soldToAsk: cell('Sold to ask')?.value ?? null,
    active: active?.value ?? null,
    activeDetail: active?.detail,
    chart: t.chartSold
      ? {
          headline: t.chartSold.headline,
          note: t.chartSold.note,
          trendLabel: t.chartSold.trendLabel,
          data: t.chartSold.data.map((d) => ({ quarter: d.quarter, value: d.value, count: d.count })),
        }
      : null,
    contactTeamPrompt: !!t.showContactTeamPrompt,
  };
}

function mapGlance(tiles: StatCell[]): GlanceTile[] {
  return tiles.map((t) => {
    const silent = t.value === SILENT;
    return silent
      ? { label: t.label, value: null, silentNote: t.detail }
      : { label: t.label, value: t.value, detail: t.detail };
  });
}

function mapMarketStats(cells: StatCell[]): MarketStat[] {
  return cells.map((c) => ({ label: c.label, value: unsilent(c.value) }));
}
function mapSummary(s: MarketSummary): MarketSummaryCard {
  // body is generated prose; the stats beside it are the deterministic layer and stay.
  return { title: s.title, body: stripNumericSentences(s.body), stats: mapMarketStats(s.stats) };
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
  const activeCount = data.activeInventory.listings.length;
  // No sale on record and nothing listed => a per-property claim in the prose has no source
  // anywhere. Only there do we suppress property detail that carries no number.
  //
  // pricePublished/bandPublished read the RENDERED truth, not a recomputation: rawTypicalPrice
  // is exactly what the hero tile shows, and the sidebar fact is exactly what the band shows.
  // A stored sentence may not deny a figure the page is publishing two inches above it.
  // soldOverAskPublished reads the SAME WAY: the glance tile as rendered. A suppressed tile is
  // "—" and parses to null, so a page that publishes no sold-to-ask figure cannot contradict one.
  const staTile = data.glanceTiles.find((t) => t.label === 'Sold to ask')?.value ?? null;
  const staPct = staTile && /\d/.test(staTile) ? Number(staTile.replace(/[^\d.]/g, '')) : null;
  const stripOpts = {
    noRecord: !data.enrichment.hasAnySale && activeCount === 0,
    pricePublished: hp.rawTypicalPrice != null,
    bandPublished: data.descriptionSidebar.streetFacts['Price band'] != null,
    soldOverAskPublished: staPct != null && staPct > 100,
  };
  const ma = data.marketActivity;
  const saleRow = hp.productTypePills.find((r: ProductPillRow) => r.label === 'Recent sales');
  const leaseRow = hp.productTypePills.find((r: ProductPillRow) => r.label === 'Recent leases');
  const sCTA = data.descriptionSidebar.sidebarCTA;

  // Owner inline-CTA price. It used to take the first product type with a published typical,
  // so "Own on Miltonbrook? Typical is $884K" was quoting the SEMI-detached figure as the
  // street's — a fourth price on a page whose headline said $995K. It is the street typical or
  // it is nothing: same source as the hero, so it can never be a different number.
  const ownerTyped = data.heroProps.rawTypicalPrice;

  return {
    slug: data.street.slug,
    name: data.street.name,
    shortName: data.street.shortName,
    eyebrow: hp.eyebrow,
    // the fallback is stored prose too — strip it rather than let it round the guard
    subtitle: hp.subtitle || stripNumericSentences(data.street.characterSummary, stripOpts),
    neighbourhoods: data.street.neighbourhoods,

    hero: {
      stats: mapHeroStats(hp, activeCount),
      salePills: saleRow ? saleRow.pills.map(mapPill) : [],
      leasePills: leaseRow ? leaseRow.pills.map(mapPill) : [],
      leaseWindowNote: data.enrichment.leaseBasis
        ? data.enrichment.leaseBasis.window === '12mo' ? 'last 12 months' : 'last ~2 years'
        : null,
    },

    // Prose: generated sections with EVERY numeric sentence suppressed (see numericSentences.ts).
    // A section whose paragraphs are all numeric drops out entirely rather than rendering a
    // heading over nothing.
    placeholder: !generation,
    sections: generation
      ? generation.sections
          .map((s) => ({ id: s.id, heading: s.heading, paragraphs: stripNumericParagraphs(s.paragraphs, stripOpts) }))
          // A heading is a promise that something follows it. Empty fails that; so does a
          // section whose only survivor is the compliance caveat.
          .filter((s) => s.paragraphs.length > 0 && !isDisclaimerOnly(s.paragraphs))
      : [],
    ownerCtaPrice: ownerTyped && ownerTyped > 0 ? ownerTyped : null,

    sidebar: {
      facts: Object.entries(data.descriptionSidebar.streetFacts).map(([label, value]) => ({ label, value })),
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

    productTypes: data.productTypes.map(mapType),
    glance: mapGlance(data.glanceTiles),

    market: {
      sales: mapSummary(ma.salesSummary),
      leases: ma.leasesSummary ? mapSummary(ma.leasesSummary) : null,
      priceChart: ma.priceChart
        ? {
            data: ma.priceChart.data.map((d) => ({ quarter: d.quarter, value: d.value, count: d.count })),
            caption: ma.priceChart.caption,
          }
        : null,
      rentByBeds: ma.rentByBeds
        ? ma.rentByBeds.map((r) => ({ label: r.label, value: unsilent(r.value), detail: r.detail }))
        : null,
    },

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
      daysOnMarket: l.daysOnMarket,
      photo: l.photo,
      href: l.href,
    })),

    context: {
      similarStreets: data.contextCards.similarStreets.map((s) => ({
        slug: s.slug,
        name: s.name,
        avgPrice: s.avgPrice,
        count: s.count,
      })),
      neighbourhoods: data.contextCards.neighbourhoods.map((n) => ({ slug: n.slug, name: n.name, summary: n.summary })),
      schools: data.contextCards.schools.map((s) => ({ slug: s.slug, name: s.name, board: s.board, level: s.level })),
    },

    // FAQ: generated when present; placeholder (no generation) => none, matching the
    // legacy page's FAQ suppression in placeholder mode.
    // FAQ answers are stored generation output too — mae-court's carried a THIRD conflicting
    // Campbellville typical. An answer with nothing qualitative left takes its question with it.
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
      : [],

    finalCtas: {
      seller: { ...data.finalCTAs.sellerCTA },
      buyer: { ...data.finalCTAs.buyerCTA },
    },

    // DEC-CONDO-6 street port — area-context anchor + tier.
    areaContext: data.enrichment.areaContext
      ? {
          neighbourhoodName: data.enrichment.areaContext.neighbourhoodName,
          neighbourhoodSlug: data.enrichment.areaContext.neighbourhoodSlug,
          typicalPrice: data.enrichment.areaContext.typicalPrice,
          // Was the literal 'across sales in the last 12 months' — no sample count, and it read as a
          // typo under a published dollar figure on 213 live pages. Same disclosure helper every
          // other published price on the page uses, so the count and the plural are real.
          basis:
            data.enrichment.areaContext.sampleCount != null
              ? windowDisclosure({
                  typical: data.enrichment.areaContext.typicalPrice ?? 0,
                  count: data.enrichment.areaContext.sampleCount,
                  window: '12mo',
                })
              : null,
        }
      : null,
    tier: data.enrichment.tier,
    hasAnySale: data.enrichment.hasAnySale,

    lastUpdated: data.lastUpdated,
  };
}

/** Named seam (mirrors getHubData/getCondoData). Fetches + maps; null when unknown. */
export async function getStreetV2Data(slug: string): Promise<StreetV2Data | null> {
  const [data, generation] = await Promise.all([getStreetPageData(slug), loadStreetGeneration(slug)]);
  if (!data) return null;
  return mapStreetV2Data(data, generation);
}
