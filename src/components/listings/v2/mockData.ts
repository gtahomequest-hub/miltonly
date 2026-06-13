// src/components/listings/v2/mockData.ts
// In-memory fixtures + a tiny query engine for the design preview. The engine
// mirrors the LIVE where-builder semantics (status/type/min/max/beds/baths/
// neighbourhood/q/sort/page) so the preview proves the URL contract end-to-end
// against mocks — with beds as GTE, the semantics the wiring should adopt.
// Addresses/hoods/brokerages are deliberately ALL-CAPS / TREB-coded to prove
// the card's title-casing. Coordinates are real Milton geography.

import type {
  ListingCardData,
  ListingsQuery,
  ListingsV2Data,
  ListingsSort,
  ListingsStatus,
  ListingsType,
  MapPin,
} from './types';

const PER_PAGE = 9; // small on purpose so the mock set demonstrates pagination

const daysAgoIso = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();
const photo = (seed: string, n: number) => `https://picsum.photos/seed/lv-${seed}-${n}/720/480`;
const photos = (seed: string, count: number) => Array.from({ length: count }, (_, i) => photo(seed, i));

export const mockListings: ListingCardData[] = [
  {
    mlsNumber: 'W9001001',
    address: '425 BENNETT BOULEVARD, MILTON',
    neighbourhood: '1027 - DP DEMPSEY',
    price: 1_249_000,
    soldPrice: null,
    soldDate: null,
    status: 'active',
    transactionType: 'For Sale',
    propertyType: 'detached',
    bedrooms: 4,
    bathrooms: 3.5,
    sqft: 2480,
    parking: 4,
    photos: photos('bennett', 5),
    listedAt: daysAgoIso(0),
    daysOnMarket: 0,
    listOfficeName: 'ROYAL LEPAGE MEADOWTOWNE REALTY',
    latitude: 43.5232,
    longitude: -79.8624,
    priceReduced: false,
    maintenanceFeeAmt: null,
    virtualTourUrl: null,
    displayAddress: true,
  },
  {
    mlsNumber: 'W9001002',
    address: '87 HOLMES CRESCENT, MILTON',
    neighbourhood: '1038 - WI WILLMOTT',
    price: 989_000,
    soldPrice: null,
    soldDate: null,
    status: 'active',
    transactionType: 'For Sale',
    propertyType: 'townhouse',
    bedrooms: 3,
    bathrooms: 2.5,
    sqft: 1640,
    parking: 2,
    photos: photos('holmes', 8),
    listedAt: daysAgoIso(21),
    daysOnMarket: 21,
    listOfficeName: 'RE/MAX REAL ESTATE CENTRE INC',
    latitude: 43.4965,
    longitude: -79.8741,
    priceReduced: true,
    maintenanceFeeAmt: null,
    virtualTourUrl: null,
    displayAddress: true,
  },
  {
    mlsNumber: 'W9001003',
    address: '610 - 100 MILLSIDE DRIVE, MILTON',
    neighbourhood: '1035 - OM OLD MILTON',
    price: 579_900,
    soldPrice: null,
    soldDate: null,
    status: 'active',
    transactionType: 'For Sale',
    propertyType: 'condo',
    bedrooms: 2,
    bathrooms: 1,
    sqft: null, // the graceful no-sqft state
    parking: 1,
    photos: photos('millside', 12),
    listedAt: daysAgoIso(6),
    daysOnMarket: 6,
    listOfficeName: 'CENTURY 21 MILLER REAL ESTATE LTD',
    latitude: 43.5114,
    longitude: -79.8839,
    priceReduced: false,
    maintenanceFeeAmt: 612,
    virtualTourUrl: 'https://example.com/tour',
    displayAddress: true,
  },
  {
    mlsNumber: 'W9001004',
    address: '1184 FERGUSON DRIVE, MILTON',
    neighbourhood: '1023 - BE BEATY',
    price: 1_059_000,
    soldPrice: null,
    soldDate: null,
    status: 'active',
    transactionType: 'For Sale',
    propertyType: 'semi',
    bedrooms: 4,
    bathrooms: 3,
    sqft: 1980,
    parking: 3,
    photos: photos('ferguson', 4),
    listedAt: daysAgoIso(2),
    daysOnMarket: 2,
    listOfficeName: 'KELLER WILLIAMS EDGE REALTY',
    latitude: 43.5028,
    longitude: -79.8489,
    priceReduced: false,
    maintenanceFeeAmt: null,
    virtualTourUrl: null,
    displayAddress: true,
  },
  {
    mlsNumber: 'W9001005',
    address: '356 KINGSLEIGH COURT, MILTON',
    neighbourhood: '1032 - HA HARRISON',
    price: 1_399_000,
    soldPrice: null,
    soldDate: null,
    status: 'active',
    transactionType: 'For Sale',
    propertyType: 'detached',
    bedrooms: 4,
    bathrooms: 4,
    sqft: 2890,
    parking: 6,
    photos: photos('kingsleigh', 3),
    listedAt: daysAgoIso(11),
    daysOnMarket: 11,
    listOfficeName: 'IPRO REALTY LTD',
    latitude: 43.5067,
    longitude: -79.8935,
    priceReduced: false,
    maintenanceFeeAmt: null,
    virtualTourUrl: null,
    displayAddress: false, // RECO redaction state — "Address on request"
  },
  {
    mlsNumber: 'W9001006',
    address: '78 CHRETIEN STREET, MILTON',
    neighbourhood: '1039 - CB COBBAN',
    price: 899_000,
    soldPrice: null,
    soldDate: null,
    status: 'active',
    transactionType: 'For Sale',
    propertyType: 'townhouse',
    bedrooms: 3,
    bathrooms: 3,
    sqft: 1550,
    parking: 2,
    photos: [],
    listedAt: daysAgoIso(4),
    daysOnMarket: 4,
    listOfficeName: 'EXP REALTY',
    latitude: 43.4889,
    longitude: -79.8552,
    priceReduced: false,
    maintenanceFeeAmt: null,
    virtualTourUrl: null,
    displayAddress: true,
  },
  {
    mlsNumber: 'W9001007',
    address: '15 - 620 FARMSTEAD DRIVE, MILTON',
    neighbourhood: '1038 - WI WILLMOTT',
    price: 2_850,
    soldPrice: null,
    soldDate: null,
    status: 'active',
    transactionType: 'For Lease',
    propertyType: 'townhouse',
    bedrooms: 3,
    bathrooms: 2.5,
    sqft: 1520,
    parking: 1,
    photos: photos('farmstead', 6),
    listedAt: daysAgoIso(1),
    daysOnMarket: 1,
    listOfficeName: 'HOMELIFE MIRACLE REALTY LTD',
    latitude: 43.4993,
    longitude: -79.8698,
    priceReduced: false,
    maintenanceFeeAmt: null,
    virtualTourUrl: null,
    displayAddress: true,
  },
  {
    mlsNumber: 'W9001008',
    address: '204 - 1050 MAIN STREET EAST, MILTON',
    neighbourhood: '1027 - DP DEMPSEY',
    price: 2_350,
    soldPrice: null,
    soldDate: null,
    status: 'active',
    transactionType: 'For Lease',
    propertyType: 'condo',
    bedrooms: 1,
    bathrooms: 1,
    sqft: null,
    parking: 1,
    photos: [],
    listedAt: daysAgoIso(9),
    daysOnMarket: 9,
    listOfficeName: 'RIGHT AT HOME REALTY',
    latitude: 43.5201,
    longitude: -79.8585,
    priceReduced: false,
    maintenanceFeeAmt: null,
    virtualTourUrl: null,
    displayAddress: true,
  },
  {
    mlsNumber: 'W9001009',
    address: '912 SCOTT BOULEVARD, MILTON',
    neighbourhood: '1036 - SC SCOTT',
    price: 1_299_900,
    soldPrice: 1_355_000, // sold over asking
    soldDate: daysAgoIso(12),
    status: 'sold',
    transactionType: 'For Sale',
    propertyType: 'detached',
    bedrooms: 4,
    bathrooms: 3.5,
    sqft: 2610,
    parking: 4,
    photos: photos('scott', 5),
    listedAt: daysAgoIso(26),
    daysOnMarket: 14,
    listOfficeName: 'ROYAL LEPAGE MEADOWTOWNE REALTY',
    latitude: 43.5159,
    longitude: -79.9013,
    priceReduced: false,
    maintenanceFeeAmt: null,
    virtualTourUrl: null,
    displayAddress: true,
  },
  {
    mlsNumber: 'W9001010',
    address: '440 BARCLAY CRESCENT, MILTON',
    neighbourhood: '1029 - TM TIMBERLEA',
    price: 3_100,
    soldPrice: 3_050,
    soldDate: daysAgoIso(5),
    status: 'rented',
    transactionType: 'For Lease',
    propertyType: 'detached',
    bedrooms: 4,
    bathrooms: 2,
    sqft: 2100,
    parking: 3,
    photos: photos('barclay', 4),
    listedAt: daysAgoIso(31),
    daysOnMarket: 26,
    listOfficeName: 'SUTTON GROUP QUANTUM REALTY INC',
    latitude: 43.5176,
    longitude: -79.8702,
    priceReduced: false,
    maintenanceFeeAmt: null,
    virtualTourUrl: null,
    displayAddress: true,
  },
  {
    mlsNumber: 'W9001011',
    address: '129 HOLLOWAY TERRACE, MILTON',
    neighbourhood: '1037 - FO FORD',
    price: 1_149_000,
    soldPrice: null,
    soldDate: null,
    status: 'active',
    transactionType: 'For Sale',
    propertyType: 'detached',
    bedrooms: 4,
    bathrooms: 3,
    sqft: 2240,
    parking: 4,
    photos: photos('holloway', 14),
    listedAt: daysAgoIso(33),
    daysOnMarket: 33,
    listOfficeName: 'REMAX ABOUTOWNE REALTY CORP',
    latitude: 43.4923,
    longitude: -79.8463,
    priceReduced: true,
    maintenanceFeeAmt: null,
    virtualTourUrl: 'https://example.com/tour',
    displayAddress: true,
  },
  {
    mlsNumber: 'W9001012',
    address: '23 - 80 ACREDALE DRIVE, MILTON',
    neighbourhood: '1026 - CL CLARKE',
    price: 729_000,
    soldPrice: null,
    soldDate: null,
    status: 'active',
    transactionType: 'For Sale',
    propertyType: 'townhouse',
    bedrooms: 2,
    bathrooms: 2,
    sqft: null,
    parking: 1,
    photos: photos('acredale', 7),
    listedAt: daysAgoIso(3),
    daysOnMarket: 3,
    listOfficeName: 'CENTURY 21 MILLER REAL ESTATE LTD',
    latitude: 43.5258,
    longitude: -79.8696,
    priceReduced: false,
    maintenanceFeeAmt: 348,
    virtualTourUrl: null,
    displayAddress: true,
  },
  {
    mlsNumber: 'W9001013',
    address: '67 LAURIER AVENUE, MILTON',
    neighbourhood: '1029 - TM TIMBERLEA',
    price: 849_900,
    soldPrice: null,
    soldDate: null,
    status: 'active',
    transactionType: 'For Sale',
    propertyType: 'semi',
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1430,
    parking: 2,
    photos: photos('laurier', 5),
    listedAt: daysAgoIso(17),
    daysOnMarket: 17,
    listOfficeName: 'RE/MAX ESCARPMENT REALTY INC',
    latitude: 43.5189,
    longitude: -79.8654,
    priceReduced: false,
    maintenanceFeeAmt: null,
    virtualTourUrl: null,
    displayAddress: true,
  },
  {
    mlsNumber: 'W9001014',
    address: '1455 CLARK BOULEVARD, MILTON',
    neighbourhood: '1023 - BE BEATY',
    price: 1_649_000,
    soldPrice: null,
    soldDate: null,
    status: 'active',
    transactionType: 'For Sale',
    propertyType: 'detached',
    bedrooms: 5,
    bathrooms: 4.5,
    sqft: 3320,
    parking: 6,
    photos: photos('clark', 9),
    listedAt: daysAgoIso(8),
    daysOnMarket: 8,
    listOfficeName: 'ROYAL LEPAGE SIGNATURE REALTY',
    latitude: 43.5052,
    longitude: -79.8421,
    priceReduced: false,
    maintenanceFeeAmt: null,
    virtualTourUrl: null,
    displayAddress: true,
  },
];

export const NEIGHBOURHOOD_OPTIONS = [
  'Dempsey', 'Beaty', 'Willmott', 'Hawthorne Village', 'Timberlea', 'Old Milton',
  'Coates', 'Clarke', 'Scott', 'Harrison', 'Ford', 'Walker', 'Cobban',
];

/* ───── query engine (mirrors the live where-builder) ───── */

export function parseQuery(sp: Record<string, string | string[] | undefined>): ListingsQuery {
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
    max: num('max') ?? num('maxPrice'), // legacy alias kept
    beds: num('beds'),
    baths: num('baths'),
    neighbourhood: get('neighbourhood'),
    q: get('q'),
    sort: sort === 'price_asc' || sort === 'price_desc' ? (sort as ListingsSort) : 'newest',
    page: Math.max(1, num('page') ?? 1),
  };
}

function hoodOf(raw: string): string {
  return raw.replace(/^\d+\s*-\s*\w+\s+/, '').trim().toLowerCase();
}

export function queryMocks(query: ListingsQuery): ListingsV2Data {
  let rows = mockListings.filter((l) => {
    if (query.status === 'rent') {
      if (l.transactionType !== 'For Lease' || l.status !== 'active') return false;
    } else if (query.status === 'sold') {
      if (l.status !== 'sold' && l.status !== 'rented') return false;
    } else if (l.status !== 'active' || l.transactionType !== 'For Sale') {
      return false;
    }
    if (query.type !== 'all' && l.propertyType !== query.type) return false;
    if (query.min != null && l.price < query.min) return false;
    if (query.max != null && l.price > query.max) return false;
    if (query.beds != null && l.bedrooms < query.beds) return false; // gte — the contract the wiring adopts
    if (query.baths != null && l.bathrooms < query.baths) return false;
    if (query.neighbourhood && !hoodOf(l.neighbourhood).includes(query.neighbourhood.toLowerCase())) return false;
    if (query.q) {
      const q = query.q.toLowerCase();
      const hit =
        l.address.toLowerCase().includes(q) ||
        l.neighbourhood.toLowerCase().includes(q) ||
        l.mlsNumber.toLowerCase().includes(q);
      if (!hit) return false;
    }
    return true;
  });

  if (query.sort === 'price_asc') rows = [...rows].sort((a, b) => a.price - b.price);
  else if (query.sort === 'price_desc') rows = [...rows].sort((a, b) => b.price - a.price);
  else rows = [...rows].sort((a, b) => +new Date(b.listedAt) - +new Date(a.listedAt));

  const totalCount = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PER_PAGE));
  const page = Math.min(query.page, totalPages);
  const pageRows = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const mapPins: MapPin[] = rows.map((l) => ({
    mlsNumber: l.mlsNumber,
    latitude: l.latitude,
    longitude: l.longitude,
    price: l.price,
    transactionType: l.transactionType,
    status: l.status,
    propertyType: l.propertyType,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    address: l.address,
    displayAddress: l.displayAddress,
    photo: l.photos[0] ?? null,
    priceReduced: l.priceReduced,
  }));

  const actives = mockListings.filter((l) => l.status === 'active' && l.transactionType === 'For Sale');
  const avgPrice = Math.round(actives.reduce((s, l) => s + l.price, 0) / Math.max(1, actives.length));
  const avgDom = Math.round(
    actives.reduce((s, l) => s + (l.daysOnMarket ?? 0), 0) / Math.max(1, actives.length),
  );

  return {
    query: { ...query, page },
    totalCount,
    totalPages,
    listings: pageRows,
    mapPins,
    stats: {
      avgPrice,
      avgDom,
      newThisWeek: actives.filter((l) => Date.now() - +new Date(l.listedAt) < 7 * 86_400_000).length,
      activeCount: actives.length,
    },
    neighbourhoodOptions: NEIGHBOURHOOD_OPTIONS,
    hoods: [
      { name: 'Dempsey', count: 14, avgPrice: 1_180_000 },
      { name: 'Beaty', count: 11, avgPrice: 1_240_000 },
      { name: 'Willmott', count: 9, avgPrice: 985_000 },
      { name: 'Old Milton', count: 7, avgPrice: 1_320_000 },
      { name: 'Timberlea', count: 6, avgPrice: 1_050_000 },
      { name: 'Hawthorne Village', count: 5, avgPrice: 1_110_000 },
    ],
    streets: [
      { slug: 'scott-boulevard-milton', name: 'Scott Boulevard', count: 4 },
      { slug: 'main-street-east-milton', name: 'Main Street East', count: 3 },
      { slug: 'ferguson-drive-milton', name: 'Ferguson Drive', count: 3 },
      { slug: 'bennett-boulevard-milton', name: 'Bennett Boulevard', count: 2 },
      { slug: 'farmstead-drive-milton', name: 'Farmstead Drive', count: 2 },
      { slug: 'clark-boulevard-milton', name: 'Clark Boulevard', count: 2 },
    ],
    schools: [
      { slug: 'chris-hadfield-ps', name: 'Chris Hadfield PS', board: 'Public', neighbourhood: 'Dempsey', fraser: null },
      { slug: 'bishop-pf-reding-catholic-secondary-school', name: 'Bishop P.F. Reding', board: 'Catholic', neighbourhood: 'Old Milton', fraser: '8.0' },
      { slug: 'guardian-angels-catholic-es', name: 'Guardian Angels Catholic ES', board: 'Catholic', neighbourhood: 'Milton', fraser: null },
      { slug: 'irma-coulson-ps', name: 'Irma Coulson PS', board: 'Public', neighbourhood: 'Beaty', fraser: null },
    ],
    faqs: [
      {
        question: 'How many homes are for sale in Milton right now?',
        answer:
          'The count at the top of this page is live — it updates daily from TREB MLS® data and covers detached homes, semis, townhouses, and condos across every Milton neighbourhood.',
      },
      {
        question: 'What is the average home price in Milton?',
        answer:
          'The average asking price sits in the market snapshot above. Prices spread widely by type and pocket — entry condos start in the high $500Ks while established detached streets in Old Milton and Dempsey routinely clear $1.2M.',
      },
      {
        question: 'Which Milton neighbourhoods should I shortlist?',
        answer:
          'Dempsey, Beaty, Willmott, Hawthorne Village, Timberlea, Old Milton, Coates, Clarke, Scott, Harrison, Ford, Walker, and Cobban each trade differently. Use the neighbourhood filter, or browse the neighbourhood cards below the results.',
      },
      {
        question: 'How do I book a showing?',
        answer:
          'Tap "Book a showing" on any card, leave a name and number, and Aamir — a licensed Milton-based agent — confirms your appointment within the hour. No obligation, no pressure.',
      },
    ],
  };
}
