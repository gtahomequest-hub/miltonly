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
      silentNote: 'sample too small to publish',
    },
    { label: 'Transactions tracked', kind: 'count', value: hp.rawTotalTransactions ?? 0 },
    { label: 'Active right now', kind: 'count', value: activeCount },
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
  return { title: s.title, body: s.body, stats: mapMarketStats(s.stats) };
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
  const ma = data.marketActivity;
  const saleRow = hp.productTypePills.find((r: ProductPillRow) => r.label === 'Recent sales');
  const leaseRow = hp.productTypePills.find((r: ProductPillRow) => r.label === 'Recent leases');
  const sCTA = data.descriptionSidebar.sidebarCTA;

  // Owner inline-CTA price: the first product type with a PUBLISHED typical (>0),
  // null when none publish (so the inline CTA hides — same rule as the legacy page).
  const ownerTyped = data.productTypes.find((p) => p.typicalPrice > 0);

  return {
    slug: data.street.slug,
    name: data.street.name,
    shortName: data.street.shortName,
    eyebrow: hp.eyebrow,
    subtitle: hp.subtitle || data.street.characterSummary,
    neighbourhoods: data.street.neighbourhoods,

    hero: {
      stats: mapHeroStats(hp, activeCount),
      salePills: saleRow ? saleRow.pills.map(mapPill) : [],
      leasePills: leaseRow ? leaseRow.pills.map(mapPill) : [],
    },

    // Prose: generated 8(+1) sections verbatim. No generation => placeholder state.
    placeholder: !generation,
    sections: generation
      ? generation.sections.map((s) => ({ id: s.id, heading: s.heading, paragraphs: s.paragraphs }))
      : [],
    ownerCtaPrice: ownerTyped ? ownerTyped.typicalPrice : null,

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
    faqs: generation ? generation.faq.map((f) => ({ question: f.question, answer: f.answer })) : [],

    finalCtas: {
      seller: { ...data.finalCTAs.sellerCTA },
      buyer: { ...data.finalCTAs.buyerCTA },
    },

    lastUpdated: data.lastUpdated,
  };
}

/** Named seam (mirrors getHubData/getCondoData). Fetches + maps; null when unknown. */
export async function getStreetV2Data(slug: string): Promise<StreetV2Data | null> {
  const [data, generation] = await Promise.all([getStreetPageData(slug), loadStreetGeneration(slug)]);
  if (!data) return null;
  return mapStreetV2Data(data, generation);
}
