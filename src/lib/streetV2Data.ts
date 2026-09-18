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
import { stripNumericSentences, stripNumericParagraphs, answersQuestion, isDisclaimerOnly, isFragment } from '@/lib/prose/numericSentences';
import { loadStreetGeneration, type LoadedStreetGeneration } from '@/lib/ai/loadStreetGeneration';
import { geometryFactsFor } from '@/lib/town/geometry';
import { K_ANON_PRICE, K_ANON_RANGE } from '@/lib/kAnon';
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
  ChartPoint,
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

function mapHeroStats(hp: StreetHeroProps, activeCount: number, data: StreetPageData): StreetStat[] {
  const byLabel = (l: string) => hp.heroStats.find((s) => s.label === l);
  const mix = byLabel('Housing mix');
  const typical = byLabel('Typical price');
  // Keep the range sub-line ONLY when the typical published (k>=5) AND a range
  // exists (k>=10) — getStreetPageData encodes the latter as a "range …" sub.
  const range =
    hp.rawTypicalPrice != null && typeof typical?.sub === 'string' && typical.sub.startsWith('range ')
      ? typical.sub
      : null;
  // THE PRICE FIRST (MA-001 defect 18). The housing mix led, and on a phone each tile is a
  // 110px block, so the one number the searcher came for arrived at 1,000px.
  return [
    {
      label: 'Typical price',
      kind: 'price',
      value: hp.rawTypicalPrice ?? null, // null => k-anon silent
      sub: range,
      basis: typical?.basis ?? null, // window+sample disclosure (mandatory on priced tiles)
      // the silence says what would end it (MA-001 defect 24)
      silentNote: `needs ${K_ANON_PRICE} sales, has ${data.enrichment.counts.sale12mo}`,
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
    { label: 'Housing mix', kind: 'text', value: null, textValue: mix ? String(mix.value) : null },
  ];
}

function mapPill(p: ProductPillData, anchor: string | null): ProductPill {
  // p.typicalPrice is already null when k<5; p.priceLabel is "sample too small" there.
  return {
    type: p.type,
    displayName: p.displayName,
    count: p.count,
    typicalPrice: p.typicalPrice,
    priceLabel: p.priceLabel,
    anchor,
  };
}

function mapType(t: TypeSectionProps, sampleCount: number): TypeBlock {
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
    sampleCount,
  };
}

/** THE YEAR-ON-YEAR SENTENCE (MH-005, MA-001 change 10). The quarterly chart carried figures
 *  with no axis; this states the one comparison a chart is for. The last four quarters against
 *  the four before, each window's typical the count-weighted mean of its quarters' typicals,
 *  stated only where BOTH windows clear K_ANON_PRICE and hold at least two quarters, so the
 *  sentence never rests on a sample the chart itself would suppress. */
function yoySentence(points: ChartPoint[] | undefined, streetName: string): string | null {
  if (!points || points.length < 5) return null;
  const recent = points.slice(-4);
  const prior = points.slice(-8, -4);
  const agg = (ps: ChartPoint[]) => {
    const n = ps.reduce((a, p) => a + p.count, 0);
    const v = n > 0 ? ps.reduce((a, p) => a + p.value * p.count, 0) / n : 0;
    return { n, v, q: ps.length };
  };
  const a = agg(recent);
  const b = agg(prior);
  if (a.q < 2 || b.q < 2 || a.n < K_ANON_PRICE || b.n < K_ANON_PRICE || a.v <= 0 || b.v <= 0) return null;
  const change = (a.v - b.v) / b.v;
  const pct = `${Math.abs(change * 100).toFixed(1)}%`;
  const direction = Math.abs(change) < 0.005 ? 'level with' : change > 0 ? `up ${pct} on` : `down ${pct} on`;
  const money = (v: number) => `$${Math.round(v / 1000) * 1000 >= 1_000_000 ? (Math.round(v / 10000) * 10000 / 1_000_000).toFixed(2).replace(/0$/, '') + 'M' : Math.round(v / 1000).toLocaleString('en-CA') + 'K'}`;
  return `Over the last four quarters homes on ${streetName} sold for typically ${money(a.v)} across ${a.n} sales, ${direction} the ${money(b.v)} of the four quarters before (${b.n} sales).`;
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
      stats: mapHeroStats(hp, activeCount, data),
      // THE ANCHOR MUST RESOLVE (MH-005, MA-001 change 7). A sale pill points at its type
      // section only where that section renders; a lease pill points at the leases card in the
      // market section where there is one. Otherwise the pill carries no href and the shell
      // renders it as text: a dead #type-condo on a street with no condo section is not a link.
      salePills: saleRow
        ? saleRow.pills.map((p) => mapPill(p, data.productTypes.some((t) => t.type === p.type) ? `#type-${p.type}` : null))
        : [],
      leasePills: leaseRow ? leaseRow.pills.map((p) => mapPill(p, ma.leasesSummary ? '#leases' : null)) : [],
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
          .filter((s) => s.paragraphs.length > 0 && !isDisclaimerOnly(s.paragraphs) && !isFragment(s.paragraphs))
      : [],
    ownerCtaPrice: ownerTyped && ownerTyped > 0 ? ownerTyped : null,

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

    productTypes: data.productTypes.map((t) => mapType(t, saleRow?.pills.find((p) => p.type === t.type)?.count ?? 0)),
    glance: mapGlance(data.glanceTiles),

    market: {
      sales: mapSummary(ma.salesSummary),
      leases: ma.leasesSummary ? mapSummary(ma.leasesSummary) : null,
      yoy: yoySentence(ma.priceChart?.data, data.street.name),
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
