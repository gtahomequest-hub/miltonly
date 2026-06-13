// src/components/listings/v2/types.ts
// THE SEAM. Data window implements getListingsV2Data(query): Promise<ListingsV2Data>
// (mirroring getHubData / getCondoData / getStreetV2Data). The design window owns
// only presentation; the loader owns the Prisma where-builder.
//
// URL PARAM CONTRACT (unchanged from the live page — deep links keep working):
//   type / status / min / max / beds / baths / neighbourhood / q / sort / page
// FiltersBar reads + writes exactly these params via router.push; the server
// re-queries on navigation (same GET model as today, no client-side filtering).
//
// WIRING NOTES (quirks the loader should fix while wiring, see handoff):
//   - beds should become gte (live query is exact-match despite the "N+" label)
//   - q gains a real input (the live page supports ?q= but had no search box)
//   - priceReduced derives from lastPriceChangeAt (e.g. changed within 14 days)
//   - mapPins should be ALL filtered results (capped ~400, page-independent) so
//     the map isn't limited to the current page of 36.

export type ListingsStatus = 'active' | 'rent' | 'sold';
export type ListingsType = 'all' | 'detached' | 'semi' | 'townhouse' | 'condo';
export type ListingsSort = 'newest' | 'price_asc' | 'price_desc';

export interface ListingsQuery {
  status: ListingsStatus;
  type: ListingsType;
  min: number | null;
  max: number | null;
  /** semantics: N or more (loader maps to gte) */
  beds: number | null;
  baths: number | null;
  neighbourhood: string | null;
  q: string | null;
  sort: ListingsSort;
  page: number;
}

/** One result card. Raw TREB strings (ALL-CAPS address/brokerage/hood) are passed
 *  through as-is — the card owns title-casing, mirroring the live grid. */
export interface ListingCardData {
  mlsNumber: string;
  address: string;
  /** raw TREB form, e.g. "1035 - OM Old Milton" — card cleans it */
  neighbourhood: string;
  price: number;
  /** present on sold records; card renders the sold treatment */
  soldPrice: number | null;
  soldDate: string | null; // ISO
  status: 'active' | 'sold' | 'rented';
  transactionType: 'For Sale' | 'For Lease';
  propertyType: 'detached' | 'semi' | 'townhouse' | 'condo';
  bedrooms: number;
  bathrooms: number;
  /** approximate (parsed from LivingAreaRange); null is common — card omits gracefully */
  sqft: number | null;
  parking: number;
  photos: string[];
  listedAt: string; // ISO
  daysOnMarket: number | null;
  listOfficeName: string | null;
  latitude: number;
  longitude: number;
  /** loader derives from lastPriceChangeAt recency; design only shows the badge */
  priceReduced: boolean;
  /** condo fee, when present */
  maintenanceFeeAmt: number | null;
  virtualTourUrl: string | null;
  /** false => render "Address on request" (RECO display gate) */
  displayAddress: boolean;
}

/** Lightweight pin for the map view — all filtered results, not just this page. */
export interface MapPin {
  mlsNumber: string;
  latitude: number;
  longitude: number;
  price: number;
  transactionType: 'For Sale' | 'For Lease';
  status: 'active' | 'sold' | 'rented';
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  address: string;
  displayAddress: boolean;
  photo: string | null;
  priceReduced: boolean;
}

export interface ListingsStats {
  avgPrice: number;
  avgDom: number;
  newThisWeek: number;
  activeCount: number;
}

export interface HoodLink {
  name: string;
  count: number;
  avgPrice: number | null;
}

export interface StreetLink {
  slug: string;
  name: string;
  count: number;
}

export interface SchoolCardData {
  slug: string;
  name: string;
  board: 'Public' | 'Catholic';
  neighbourhood: string;
  fraser: string | null;
}

export interface ListingsFaq {
  question: string;
  answer: string;
}

/** The master shape getListingsV2Data(query) returns. All serializable. */
export interface ListingsV2Data {
  query: ListingsQuery;
  totalCount: number;
  totalPages: number;
  listings: ListingCardData[];
  mapPins: MapPin[];
  stats: ListingsStats;
  /** the 13 filterable hoods (select options) */
  neighbourhoodOptions: string[];
  /** browse-by-neighbourhood cards (top 6 by active count) */
  hoods: HoodLink[];
  /** top-streets pill strip (top 6 by active count) */
  streets: StreetLink[];
  schools: SchoolCardData[];
  faqs: ListingsFaq[];
}
