// src/lib/listingsV2Data.ts
// The listings-v2 seam loader — getListingsV2Data(query) — mirroring the
// getHubData / getCondoData / getStreetV2Data cutover pattern. RESTYLE ONLY:
// this ports the inline where-builder + Promise.all queries that lived in
// src/app/listings/page.tsx verbatim, with exactly three documented changes
// (per the design handoff in src/components/listings/v2/types.ts):
//   1. beds is now GTE (the live page matched bedrooms exactly despite the
//      "N+" label in its own UI),
//   2. the dead openHouse param is dropped (it was read but never filtered),
//   3. priceReduced derives from lastPriceChangeAt (changed within 14 days).
// Everything else is identical: the URL param contract (incl. the legacy
// maxPrice alias), the permAdvertise=true + city=Milton base where, the rent/
// sold status semantics, sort, 36-per-page, the activeBase stat aggregates,
// the neighbourhood dedup/title-case, and address redaction (applied here,
// server-side, so a withheld address never ships to the client at all —
// the live grid page didn't redact; the detail page's gate is the standard).

import { prisma } from '@/lib/prisma';
import { config } from '@/lib/config';
import type {
  ListingCardData,
  ListingsQuery,
  ListingsSort,
  ListingsStatus,
  ListingsType,
  ListingsV2Data,
  MapPin,
} from '@/components/listings/v2/types';
import { formatPriceFull } from '@/lib/format';

const PER_PAGE = 36;
const MAP_PIN_CAP = 400;
const PRICE_REDUCED_WINDOW_DAYS = 14;

export const NEIGHBOURHOOD_FILTER_OPTIONS = [
  'Dempsey', 'Beaty', 'Willmott', 'Hawthorne Village', 'Timberlea', 'Old Milton',
  'Coates', 'Clarke', 'Scott', 'Harrison', 'Ford', 'Walker', 'Cobban',
];

const FEATURED_SCHOOLS: ListingsV2Data['schools'] = [
  { slug: 'chris-hadfield-ps', name: 'Chris Hadfield PS', board: 'Public', neighbourhood: 'Dempsey', fraser: null },
  { slug: 'bishop-pf-reding-catholic-secondary-school', name: 'Bishop P.F. Reding', board: 'Catholic', neighbourhood: 'Old Milton', fraser: '8.0' },
  { slug: 'guardian-angels-catholic-es', name: 'Guardian Angels Catholic ES', board: 'Catholic', neighbourhood: 'Milton', fraser: null },
  { slug: 'irma-coulson-ps', name: 'Irma Coulson PS', board: 'Public', neighbourhood: 'Beaty', fraser: null },
];

/** URL searchParams -> ListingsQuery. Same params the live page accepted,
 *  including the legacy maxPrice alias for max. */
export function parseListingsQuery(
  sp: Record<string, string | string[] | undefined>,
): ListingsQuery {
  const get = (k: string) => {
    const v = sp[k];
    return typeof v === 'string' && v.length > 0 ? v : null;
  };
  const num = (k: string) => {
    const v = get(k);
    if (!v) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  };
  const status = get('status');
  const type = get('type');
  const sort = get('sort');
  return {
    status: status === 'rent' || status === 'sold' ? (status as ListingsStatus) : 'active',
    type: ['detached', 'semi', 'townhouse', 'condo'].includes(type ?? '') ? (type as ListingsType) : 'all',
    min: num('min'),
    max: num('max') ?? num('maxPrice'),
    beds: num('beds'),
    baths: num('baths'),
    neighbourhood: get('neighbourhood'),
    q: get('q'),
    sort: sort === 'price_asc' || sort === 'price_desc' ? (sort as ListingsSort) : 'newest',
    page: Math.max(1, num('page') ?? 1),
  };
}

/** The live page's where-builder, verbatim (beds gte is the one semantic change). */
function buildWhere(query: ListingsQuery): Record<string, unknown> {
  const where: Record<string, unknown> = {
    city: config.PRISMA_CITY_VALUE,
    permAdvertise: true,
  };
  if (query.type !== 'all') where.propertyType = query.type;
  if (query.status === 'rent') where.transactionType = 'For Lease';
  else if (query.status === 'sold') where.status = 'sold';
  else where.status = 'active';
  if (query.min != null) where.price = { ...(where.price as object || {}), gte: query.min };
  if (query.max != null) where.price = { ...(where.price as object || {}), lte: query.max };
  if (query.beds != null) where.bedrooms = { gte: query.beds };
  if (query.baths != null) where.bathrooms = { gte: query.baths };
  if (query.neighbourhood) where.neighbourhood = { contains: query.neighbourhood, mode: 'insensitive' };
  if (query.q) {
    where.OR = [
      { address: { contains: query.q, mode: 'insensitive' } },
      { neighbourhood: { contains: query.q, mode: 'insensitive' } },
      { mlsNumber: { contains: query.q, mode: 'insensitive' } },
      { description: { contains: query.q, mode: 'insensitive' } },
    ];
  }
  return where;
}

interface CardRow {
  mlsNumber: string;
  address: string;
  neighbourhood: string;
  price: number;
  soldPrice: number | null;
  soldDate: Date | null;
  status: string;
  transactionType: string | null;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number | null;
  parking: number;
  photos: string[];
  listedAt: Date;
  daysOnMarket: number | null;
  listOfficeName: string | null;
  latitude: number;
  longitude: number;
  lastPriceChangeAt: Date | null;
  maintenanceFeeAmt: number | null;
  virtualTourUrl: string | null;
  displayAddress: boolean;
}

const CARD_SELECT = {
  mlsNumber: true, address: true, neighbourhood: true, price: true,
  soldPrice: true, soldDate: true, status: true, transactionType: true,
  propertyType: true, bedrooms: true, bathrooms: true, sqft: true,
  parking: true, photos: true, listedAt: true, daysOnMarket: true,
  listOfficeName: true, latitude: true, longitude: true,
  lastPriceChangeAt: true, maintenanceFeeAmt: true, virtualTourUrl: true,
  displayAddress: true,
} as const;

function isPriceReduced(row: { status: string; lastPriceChangeAt: Date | null }): boolean {
  if (row.status !== 'active' || !row.lastPriceChangeAt) return false;
  return Date.now() - row.lastPriceChangeAt.getTime() < PRICE_REDUCED_WINDOW_DAYS * 86_400_000;
}

/** RECO/IDX address redaction, applied server-side so a withheld address
 *  never reaches the client (mirrors redactAddress in listings/display-gate). */
function gateAddress(row: { address: string; displayAddress: boolean }): string {
  return row.displayAddress ? row.address : 'Address withheld by seller';
}

function toCard(row: CardRow): ListingCardData {
  return {
    mlsNumber: row.mlsNumber,
    address: gateAddress(row),
    neighbourhood: row.neighbourhood,
    price: row.price,
    soldPrice: row.soldPrice,
    soldDate: row.soldDate ? row.soldDate.toISOString() : null,
    status: row.status === 'sold' ? 'sold' : row.status === 'rented' ? 'rented' : 'active',
    transactionType: row.transactionType === 'For Lease' ? 'For Lease' : 'For Sale',
    propertyType: (['detached', 'semi', 'townhouse', 'condo'].includes(row.propertyType)
      ? row.propertyType
      : 'detached') as ListingCardData['propertyType'],
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    sqft: row.sqft,
    parking: row.parking,
    photos: row.photos,
    listedAt: row.listedAt.toISOString(),
    daysOnMarket: row.daysOnMarket,
    listOfficeName: row.listOfficeName,
    latitude: row.latitude,
    longitude: row.longitude,
    priceReduced: isPriceReduced(row),
    maintenanceFeeAmt: row.maintenanceFeeAmt,
    virtualTourUrl: row.virtualTourUrl,
    displayAddress: row.displayAddress,
  };
}

/** TREB stores variants like "1035 - OM Old Milton" — dedup to a clean name
 *  (ported verbatim from the live page's titleCaseHood + hoodMap logic). */
function titleCaseHood(h: string): string {
  const cleaned = h.replace(/^\d+\s*-\s*\w+\s+/, '').trim();
  return cleaned
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export async function getListingsV2Data(query: ListingsQuery): Promise<ListingsV2Data> {
  const where = buildWhere(query);

  let orderBy: Record<string, string> = { listedAt: 'desc' };
  if (query.sort === 'price_asc') orderBy = { price: 'asc' };
  if (query.sort === 'price_desc') orderBy = { price: 'desc' };

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const activeBase = {
    status: 'active',
    city: config.PRISMA_CITY_VALUE,
    permAdvertise: true,
  } as const;

  const totalCount = await prisma.listing.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));
  const page = Math.min(query.page, totalPages);
  const skip = (page - 1) * PER_PAGE;

  const [
    rows,
    pinRows,
    avgPriceAgg,
    domAgg,
    newThisWeek,
    activeCount,
    neighbourhoodStats,
    topStreets,
  ] = await Promise.all([
    prisma.listing.findMany({ where, orderBy, skip, take: PER_PAGE, select: CARD_SELECT }),
    // map pins: ALL filtered results (page-independent), lightweight select
    prisma.listing.findMany({
      where,
      orderBy,
      take: MAP_PIN_CAP,
      select: {
        mlsNumber: true, latitude: true, longitude: true, price: true,
        transactionType: true, status: true, propertyType: true,
        bedrooms: true, bathrooms: true, address: true, displayAddress: true,
        photos: true, lastPriceChangeAt: true,
      },
    }),
    prisma.listing.aggregate({ where: activeBase, _avg: { price: true } }),
    prisma.listing.aggregate({
      where: { ...activeBase, daysOnMarket: { gt: 0 } },
      _avg: { daysOnMarket: true },
    }),
    prisma.listing.count({ where: { ...activeBase, listedAt: { gte: sevenDaysAgo } } }),
    prisma.listing.count({ where: activeBase }),
    prisma.listing.groupBy({
      by: ['neighbourhood'],
      _count: true,
      _avg: { price: true },
      where: activeBase,
      orderBy: { _count: { neighbourhood: 'desc' } },
      take: 30,
    }),
    prisma.listing.groupBy({
      by: ['streetSlug', 'streetName'],
      _count: true,
      where: { ...activeBase, streetName: { not: null } },
      orderBy: { _count: { streetSlug: 'desc' } },
      take: 6,
    }),
  ]);

  const listings = rows.map(toCard);

  const mapPins: MapPin[] = pinRows.map((r) => ({
    mlsNumber: r.mlsNumber,
    latitude: r.latitude,
    longitude: r.longitude,
    price: r.price,
    transactionType: r.transactionType === 'For Lease' ? 'For Lease' : 'For Sale',
    status: r.status === 'sold' ? 'sold' : r.status === 'rented' ? 'rented' : 'active',
    propertyType: r.propertyType,
    bedrooms: r.bedrooms,
    bathrooms: r.bathrooms,
    address: gateAddress(r),
    displayAddress: r.displayAddress,
    photo: r.photos[0] ?? null,
    priceReduced: isPriceReduced(r),
  }));

  // ── dedup + title-case neighbourhood stats (ported verbatim) ──
  const hoodMap = new Map<string, { count: number; avgSum: number; avgN: number }>();
  for (const h of neighbourhoodStats) {
    const name = titleCaseHood(h.neighbourhood);
    if (!name) continue;
    const avgPrice = h._avg.price || 0;
    const existing = hoodMap.get(name);
    if (existing) {
      existing.count += h._count;
      existing.avgSum += avgPrice * h._count;
      existing.avgN += h._count;
    } else {
      hoodMap.set(name, { count: h._count, avgSum: avgPrice * h._count, avgN: h._count });
    }
  }
  const hoods = Array.from(hoodMap.entries())
    .filter(([name]) => name && name.toLowerCase() !== config.CITY_NAME.toLowerCase())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 6)
    .map(([name, s]) => ({
      name,
      count: s.count,
      avgPrice: s.avgN > 0 ? Math.round(s.avgSum / s.avgN) : null,
    }));

  const streets = topStreets.map((s) => ({
    slug: s.streetSlug,
    name: s.streetName as string,
    count: s._count,
  }));

  const avg = Math.round(avgPriceAgg._avg.price || 0);
  const avgDom = Math.round(domAgg._avg.daysOnMarket || 0);
  const statusLabel =
    query.status === 'rent' ? 'for rent' : query.status === 'sold' ? 'sold' : 'for sale';

  // FAQs ported from the live page — built from the same real aggregates.
  const faqs = [
    {
      question: `How many homes are for sale in ${config.CITY_NAME} ${config.CITY_PROVINCE}?`,
      answer: `There are currently ${totalCount} homes ${statusLabel} in ${config.CITY_NAME}, ${config.CITY_PROVINCE}. Listings update daily from TREB MLS® data and include detached homes, semis, townhouses, and condos across every ${config.CITY_NAME} neighbourhood.`,
    },
    {
      question: `What is the average home price in ${config.CITY_NAME}?`,
      answer: `The average asking price for a ${config.CITY_NAME} home right now is ${formatPriceFull(avg)}. Prices range widely by property type and neighbourhood — detached homes in established areas like Old ${config.CITY_NAME} sit higher, while condos and townhouses in newer subdivisions can come in considerably lower.`,
    },
    {
      question: `What neighbourhoods are in ${config.CITY_NAME} ${config.CITY_PROVINCE}?`,
      answer: `${config.CITY_NAME}'s main residential neighbourhoods include Dempsey, Beaty, Willmott, Hawthorne Village, Timberlea, Old ${config.CITY_NAME}, Coates, Clarke, Scott, Harrison, Ford, Walker, and Cobban. Each has its own mix of housing stock, schools, and price points — use the neighbourhood filter to narrow your search.`,
    },
    {
      question: `How do I book a showing for a ${config.CITY_NAME} home?`,
      answer: `Click "Book a showing" on any listing card and ${config.realtor.name} — a licensed ${config.brokerage.name.replace(', Brokerage', '')} agent based in ${config.CITY_NAME} — will confirm your appointment within the hour. No obligation, no pressure.`,
    },
  ];

  return {
    query: { ...query, page },
    totalCount,
    totalPages,
    listings,
    mapPins,
    stats: { avgPrice: avg, avgDom, newThisWeek, activeCount },
    neighbourhoodOptions: NEIGHBOURHOOD_FILTER_OPTIONS,
    hoods,
    streets,
    schools: FEATURED_SCHOOLS,
    faqs,
  };
}
