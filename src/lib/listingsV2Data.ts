// src/lib/listingsV2Data.ts
// The listings-v2 seam loader — getListingsV2Data(query) — mirroring the
// getHubData / getCondoData / getStreetV2Data cutover pattern. RESTYLE ONLY:
// this ports the inline where-builder + Promise.all queries that lived in
// src/app/listings/page.tsx verbatim, with exactly three documented changes
// (per the design handoff in src/components/listings/v2/types.ts):
//   1. beds is now GTE (the live page matched bedrooms exactly despite the
//      "N+" label in its own UI),
//   2. the dead openHouse param is dropped (it was read but never filtered),
//   3. no priceReduced flag. It was derived from lastPriceChangeAt, which records
//      THAT a price changed and never what it changed from — so it could not tell a
//      reduction from an increase and the badge it fed said "Price reduced" over both.
//      Removed 2026-09-10 (ruling): no such claim until a prior price is stored.
//      A prior price is stored as of the same day (DEC-PRICE-HISTORY, `Listing.priorPrice`),
//      but the flag stays out until the columns have accumulated real observations —
//      today they are null corpus-wide, so the badge would be absent from every card and
//      the page would silently claim no listing has ever been reduced.
// Everything else is identical: the URL param contract (incl. the legacy
// maxPrice alias), the permAdvertise=true + city=Milton base where, the rent/
// sold status semantics, sort, 36-per-page, the activeBase stat aggregates,
// the neighbourhood dedup/title-case, and address redaction (applied here,
// server-side, so a withheld address never ships to the client at all —
// the live grid page didn't redact; the detail page's gate is the standard).
//
// MC-036: THE ADDRESS GATE IS THIS FILE. InternetAddressDisplayYN = N (Listing.displayAddress
// false) means the address, street number, street name, unit, postal code and any map position
// may not be displayed or mapped; the listing may still be counted. `toCard` is the one mapper
// every card surface reads through (the grid, the homepage, the menu, the place pages, the
// /rentals/ads teaser), and a withheld row leaves it as "Address on request" with no street;
// the pin query excludes withheld rows outright, since a pin is a map position.
//
// MC-036, item 4: an anonymous visitor may not page through the inventory. The grid reaches
// at most MAX_PAGES pages (72 listings) and the map at most MAP_PIN_CAP pins, whatever the
// filter returns; street inventory is gated in street-data.ts.

import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { config } from '@/lib/config';
import { hasValidCoords } from '@/lib/geo';
import type {
  ListingCardData,
  ListingCardVow,
  ListingsQuery,
  ListingsSort,
  ListingsType,
  ListingsV2Data,
  MapPin,
} from '@/components/listings/v2/types';
import { formatPriceFull } from '@/lib/format';
import { resolveStreetName } from "@/lib/streetName";
import { PUBLIC_SALE_WHERE, PUBLIC_LEASE_WHERE, PUBLIC_LISTING_WHERE } from '@/lib/listings/vow';

const PER_PAGE = 36;
// THE 100-RESULT LINE (MC-036, item 4). A public search may show a consumer at most 100
// listings for one query, so the pager stops at floor(100 / 36) = 2 pages: 72 listings are
// reachable for any filter, and a `page` beyond that clamps to the last page. Before this the
// grid paged through every row (469 sale rows over 14 pages, 1,200 lease rows over 34).
const MAX_PAGES = Math.floor(100 / PER_PAGE);
// The map pins are the same query with a coordinate, serialised into the same anonymous
// response, so they sit under the same line: 100 pins, newest (or cheapest, dearest) first,
// page-independent. It was 1,500, a runaway guard set above the whole inventory, which put
// 860 lease pins into one /listings?status=rent payload with a price and an address on each.
// MapPanel renders one <button> per pin; the count line beside it says how many are on the map.
const MAP_PIN_CAP = 100;

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
    // MC-029: 'sold' is not a public mode; the page redirects it to /sold before this runs.
    status: status === 'rent' ? 'rent' : 'active',
    type: ['detached', 'semi', 'townhouse', 'condo'].includes(type ?? '') ? (type as ListingsType) : 'all',
    min: num('min'),
    max: num('max') ?? num('maxPrice'),
    beds: num('beds'),
    baths: num('baths'),
    neighbourhood: get('neighbourhood'),
    q: get('q'),
    sort: sort === 'price_asc' || sort === 'price_desc' ? (sort as ListingsSort) : 'newest',
    // Clamped to the 100-result line here as well as in the loader, so a ?page=999 URL is
    // page 2 before any count is run.
    page: Math.min(MAX_PAGES, Math.max(1, num('page') ?? 1)),
  };
}

/** The live page's where-builder, verbatim (beds gte is the one semantic change). */
function buildWhere(query: ListingsQuery): Record<string, unknown> {
  // MC-029: the public predicate from src/lib/listings/vow.ts. The rent mode used to select
  // every For Lease row ever advertised, leased ones included, and rendered them "Leased".
  const where: Record<string, unknown> = {
    ...(query.status === 'rent' ? PUBLIC_LEASE_WHERE : PUBLIC_SALE_WHERE),
  };
  if (query.type !== 'all') where.propertyType = query.type;
  if (query.min != null) where.price = { ...(where.price as object || {}), gte: query.min };
  if (query.max != null) where.price = { ...(where.price as object || {}), lte: query.max };
  if (query.beds != null) where.bedrooms = { gte: query.beds };
  if (query.baths != null) where.bathrooms = { gte: query.baths };
  if (query.neighbourhood) where.neighbourhood = { contains: query.neighbourhood, mode: 'insensitive' };
  if (query.q) {
    where.OR = [
      // a withheld address cannot be the thing that finds a listing (MC-036)
      { address: { contains: query.q, mode: 'insensitive' }, displayAddress: true },
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
  transactionType: string | null;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  sqft: number | null;
  parking: number;
  photos: string[];
  listOfficeName: string | null;
  maintenanceFeeAmt: number | null;
  virtualTourUrl: string | null;
  displayAddress: boolean;
}

/** The VOW-only columns, selected only for an acknowledged session (VOW_SELECT below). */
interface VowRow {
  listedAt: Date;
  daysOnMarket: number | null;
  priorPrice: number | null;
  priceChangedAt: Date | null;
}

// THE SELECT IS THE GATE (MC-029). The public card select names no VOW-only column, so a row
// read through it cannot carry one; the VOW columns are added to the select only when the
// caller has established the session may see them, and the mapper puts them under `vow`.
const CARD_SELECT = {
  mlsNumber: true, address: true, neighbourhood: true, price: true,
  transactionType: true,
  propertyType: true, bedrooms: true, bathrooms: true, sqft: true,
  parking: true, photos: true,
  listOfficeName: true, maintenanceFeeAmt: true, virtualTourUrl: true,
  displayAddress: true,
} as const;
const VOW_SELECT = { listedAt: true, daysOnMarket: true, priorPrice: true, priceChangedAt: true } as const;

function vowOf(r: VowRow): ListingCardVow {
  return {
    daysOnMarket: r.daysOnMarket ?? Math.max(0, Math.floor((Date.now() - r.listedAt.getTime()) / 86_400_000)),
    listedAt: r.listedAt.toISOString(),
    priorPrice: r.priorPrice,
    priceChangedAt: r.priceChangedAt ? r.priceChangedAt.toISOString() : null,
  };
}

/** The one placeholder for a withheld address. Every surface that prints a card's address
 *  prints this string for a withheld row; the raw address is not on the card to print. */
const ADDRESS_ON_REQUEST = 'Address on request';

/** RECO/IDX address redaction, applied server-side so a withheld address
 *  never reaches the client (mirrors redactAddress in listings/display-gate). */
function gateAddress(row: { address: string; displayAddress: boolean }): string {
  return row.displayAddress ? row.address : ADDRESS_ON_REQUEST;
}

function toCard(row: CardRow): ListingCardData {
  return {
    mlsNumber: row.mlsNumber,
    address: gateAddress(row),
    neighbourhood: row.neighbourhood,
    price: row.price,
    transactionType: row.transactionType === 'For Lease' ? 'For Lease' : 'For Sale',
    propertyType: (['detached', 'semi', 'townhouse', 'condo'].includes(row.propertyType)
      ? row.propertyType
      : 'detached') as ListingCardData['propertyType'],
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    sqft: row.sqft,
    parking: row.parking,
    photos: row.photos,
    listOfficeName: row.listOfficeName,
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

/**
 * @param opts.vow true when the request's session is a signed-in, acknowledged VOW consumer
 *   (the page decides that with getSession; this loader never reads a cookie). The cards then
 *   carry `vow`. Default false: nothing VOW-only is selected, let alone serialised.
 */
export async function getListingsV2Data(query: ListingsQuery, opts: { vow?: boolean } = {}): Promise<ListingsV2Data> {
  const where = buildWhere(query);
  const vow = opts.vow === true;

  let orderBy: Record<string, string> = { listedAt: 'desc' };
  if (query.sort === 'price_asc') orderBy = { price: 'asc' };
  if (query.sort === 'price_desc') orderBy = { price: 'desc' };

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const activeBase = PUBLIC_SALE_WHERE;

  const totalCount = await prisma.listing.count({ where });
  // totalCount is still the true count (an aggregate may be shown); the pager may not walk it.
  const totalPages = Math.min(MAX_PAGES, Math.max(1, Math.ceil(totalCount / PER_PAGE)));
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
    vow
      ? prisma.listing.findMany({ where, orderBy, skip, take: PER_PAGE, select: { ...CARD_SELECT, ...VOW_SELECT } })
      : prisma.listing.findMany({ where, orderBy, skip, take: PER_PAGE, select: CARD_SELECT }),
    // map pins: the filtered results in the same order, page-independent, up to MAP_PIN_CAP,
    // lightweight select.
    //
    // The coordinate requirement is in the WHERE, not a .filter() after the fact, because
    // `take` is applied by the database BEFORE any JS filtering: fetching 400 rows and then
    // dropping the uncoordinated ones cost 70 pinnable listings that were never fetched. The
    // cap has to count pins, not candidates.
    //
    // displayAddress is in the WHERE for the same reason, and for a stronger one: a pin is a
    // map position, and a withheld listing may not be mapped, however its label reads. Before
    // this a withheld rental sat on the map at its rooftop, labelled "Address on request".
    prisma.listing.findMany({
      where: { ...where, displayAddress: true, townLat: { not: null }, townLng: { not: null } },
      orderBy,
      take: MAP_PIN_CAP,
      select: {
        mlsNumber: true, townLat: true, townLng: true, price: true,
        transactionType: true, propertyType: true,
        bedrooms: true, bathrooms: true, address: true, displayAddress: true,
        photos: true, listOfficeName: true,
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

  const listings = rows.map((r) => (vow && 'listedAt' in r ? { ...toCard(r), vow: vowOf(r as CardRow & VowRow) } : toCard(r)));

  // A PIN IS A CLAIM ABOUT WHERE A HOUSE IS. It renders only from a validated coordinate.
  //
  // This filter did not exist. hasValidCoords() has been in geo.ts since the map shipped and
  // nothing on this path called it, so every listing was pinned at its stored (0,0) — the whole
  // inventory stacked on one dot in the Gulf of Guinea, which is why the map read as broken. The
  // gate was never data-driven; it was absent. Now:
  //   · townLat/townLng — the Town's municipal rooftop, resolved on write, NULL when unknown
  //   · a listing without one is ABSENT from the map, never approximated from its street or
  //     neighbourhood centroid. A pin on the wrong house is worse than no pin.
  const mapPins: MapPin[] = pinRows
    .filter((r) => hasValidCoords(r.townLat, r.townLng))
    .map((r) => ({
      mlsNumber: r.mlsNumber,
      latitude: r.townLat as number,
      longitude: r.townLng as number,
      price: r.price,
      transactionType: r.transactionType === 'For Lease' ? 'For Lease' : 'For Sale',
      propertyType: r.propertyType,
      bedrooms: r.bedrooms,
      bathrooms: r.bathrooms,
      address: gateAddress(r),
      displayAddress: r.displayAddress,
      photo: r.photos[0] ?? null,
      listOfficeName: r.listOfficeName,
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
    name: resolveStreetName(s.streetSlug as string, s.streetName as string).name,
    count: s._count,
  }));

  const avg = Math.round(avgPriceAgg._avg.price || 0);
  const avgDom = Math.round(domAgg._avg.daysOnMarket || 0);
  const statusLabel = query.status === 'rent' ? 'for rent' : 'for sale';

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
      answer: `Click "Book a showing" on any listing card and ${config.realtor.name}, a licensed agent based in ${config.CITY_NAME} (${config.brokerage.name}), will confirm your appointment within the hour. No obligation, no pressure.`,
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

/**
 * The newest active sale listings, as cards.
 *
 * WHY THIS LIVES HERE AND NOT ON THE HOMEPAGE. `toCard` runs `gateAddress`, the RECO/IDX
 * display gate, so a listing whose seller withheld the address never has that address
 * serialised to the client at all. A second listing query written next to the section
 * that renders it would be a second chance to forget that, and forgetting it is not a
 * layout bug — it is a compliance one. One query shape, one mapper, one gate.
 *
 * Sale side only, `permAdvertise` only, ordered the way the grid's default sort orders.
 */
export async function getNewestListingCards(take = 8): Promise<ListingCardData[]> {
  const rows = await prisma.listing.findMany({
    where: PUBLIC_SALE_WHERE,
    orderBy: { listedAt: 'desc' },
    take,
    select: CARD_SELECT,
  });
  return rows.map(toCard);
}

/**
 * THE SAME MAPPER FOR ANY SLICE OF THE FEED. The mega menu's rail items each show a slice
 * (listed in the last 24 hours, price changed this week, condos, freehold, rentals), the school
 * and mosque pages show the homes near a place, the /rentals/ads teaser shows the newest twelve
 * leases over a price floor, and every one of them must come through `toCard`, where the
 * RECO/IDX address gate is applied. This is the one exported way to run a custom `where`
 * through that gate; there is no other, so a caller cannot reach a raw address by writing its
 * own query. (MC-036: the place pages and the ads teaser serialised whole Listing rows, raw
 * address included, and printed it.)
 *
 * The public predicate (`permAdvertise`, on the market, Milton) is ANDed in unconditionally.
 * A caller may narrow the set; it cannot widen it past what may be shown. The card select
 * names no VOW-only column (MC-029): a caller that orders by `lastPriceChangeAt` gets the
 * listings, never the prior price.
 */
export async function getListingCards(opts: {
  where: Prisma.ListingWhereInput;
  orderBy?: Prisma.ListingOrderByWithRelationInput | Prisma.ListingOrderByWithRelationInput[];
  take?: number;
}): Promise<ListingCardData[]> {
  const rows = await prisma.listing.findMany({
    where: { AND: [opts.where, PUBLIC_LISTING_WHERE] },
    orderBy: opts.orderBy ?? { listedAt: 'desc' },
    take: opts.take ?? 4,
    select: CARD_SELECT,
  });
  return rows.map(toCard);
}
