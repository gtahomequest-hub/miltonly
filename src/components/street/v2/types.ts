// src/components/street/v2/types.ts
// THE SEAM. Data window implements getStreetV2Data(slug): Promise<StreetV2Data | null>
// (the loader the data window wires, mirroring getHubData / getCondoData). Layout
// window consumes it here. All fields serializable (server -> client boundary).
//
// THE VISITOR VIEW (MC-046 Stage 1, PropTx VOW Best Practices item 40). Nothing in this seam is
// derived from a sold, leased, expired or terminated record: every value is an IDX active
// listing (asking prices, active counts), Town open data, or the registry. The sold view for
// the street is the gated island (StreetSoldRecords), which reads its own route per session and
// is not part of this seam. Every field is serializable (server -> client boundary), so a
// VOW-derived field here would reach the client payload even where nothing renders it.
//
//   PROSE (sections[], faqs[]) is stored generation output. The mapper drops the market and
//   neighbourhoodComparable sections, every numeric sentence, and every FAQ item on a VOW
//   topic before it reaches this seam. `placeholder: true` => no generated prose exists.

export type ProductTypeKey =
  | 'detached'
  | 'semi'
  | 'townhouse'
  | 'condo'
  | 'link'
  | 'freehold-townhouse';

// ───── Hero ─────────────────────────────────────────────────────────────────
// MC-046 Stage 1 (PropTx VOW Best Practices item 40): the hero carries IDX facts only. The
// typical price, its range and basis, "Transactions tracked" and the sale and lease pills were
// derived from sold and leased records and left the visitor view; the one neutral line
// (SoldHistoryLine) stands where they were.

export interface StreetStat {
  label: string;
  /** null => the tile is not rendered. `kind` controls formatting of a non-null value. */
  value: number | null;
  kind: 'count' | 'text';
  /** when kind==='text', the string to show */
  textValue?: string | null;
  /** optional sub-line ("live listings · today") */
  sub?: string | null;
}

export interface StreetHeroData {
  stats: StreetStat[]; // IDX only: active right now, and the housing mix of the active listings
}

// ───── Prose (the 8 + optional 9th generated sections) ───────────────────────

export interface StreetProseSection {
  id: string; // about | homes | amenities | market | gettingAround | schools | bestFitFor | differentPriorities | neighbourhoodComparable
  heading: string;
  paragraphs: string[];
}

// ───── Sidebar ───────────────────────────────────────────────────────────────

export interface StreetFact {
  label: string;
  value: string; // IDX and registry facts only (MC-046): no sold- or leased-derived fact.
}

export interface NearbyPlace {
  category: string;
  name: string;
  /** null => suppressed until a per-street coordinate exists */
  distance: string | null;
  icon?: string;
  href?: string;
}

export interface StreetCta {
  eyebrow: string;
  headline: string;
  body: string;
  actionLabel: string;
  actionHref: string;
  trustLine?: string;
  secondary?: boolean;
}

export interface StreetSidebar {
  facts: StreetFact[];
  nearby: NearbyPlace[];
  cta: StreetCta;
  /** QUEUE item 5. The street's physical facts from the Town centreline (and OSM for surface
   *  and sidewalk), pre-formatted, with the attribution the card must carry. null => no card.
   *  Not a suppressible surface: nothing here is a price or a count of people. */
  geometry: { identity: string; facts: Array<{ key: string; label: string; value: string }>; attribution: string } | null;
}

// ───── Per-housing-type sections ─────────────────────────────────────────────

/** One home type listed on the street now (MC-046: IDX only). The sold rows (typical, band,
 *  time on market, sold to ask, the closed-sale count and the quarterly chart) left the visitor
 *  view; a card renders for a type with an active listing, never for a type with sales. */
export interface TypeBlock {
  type: ProductTypeKey;
  displayName: string;
  intro: string;
  /** active listings of this type, as a count */
  active: string;
  /** "avg asking $1.2M": the mean asking price of those listings */
  activeDetail?: string;
}

// Sold records are rendered by a self-contained client island (StreetSoldRecords)
// that fetches /api/streets/<slug>/sold-records and applies the TREB-VOW sign-in
// gate per session — it is NOT part of this server-serializable seam (the gate is
// auth-dependent and must resolve client-side, preserving unlock for signed-in users).

// ───── Commute ───────────────────────────────────────────────────────────────

export interface CommuteDestination {
  name: string;
  primaryTime: string | null;
  secondaryTime?: string | null;
  href?: string;
}

export interface CommuteCategory {
  id: string;
  title: string;
  subtitle: string;
  icon: 'transit' | 'schools' | 'health' | 'parks' | 'shopping' | 'worship';
  destinations: CommuteDestination[];
}

// ───── Active inventory ──────────────────────────────────────────────────────

export interface ListingCard {
  mlsNumber: string;
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  propertyType: string;
  listOfficeName: string | null;
  photo?: string;
  href: string;
}

// ───── Address ladder (QUEUE item 3) ─────────────────────────────────────────
// Passed through from src/lib/streetAddresses.ts unchanged. It is NOT a suppressible
// surface: it carries no price at any grain, so there is no k-anon state to render. A
// street the Town has no address points for arrives as null and the section is absent.

export type { AddressLadder, AddressMark, AddressCrossTick } from '@/lib/streetAddresses';

// ───── Context cards ─────────────────────────────────────────────────────────

export interface ContextStreet {
  slug: string;
  name: string;
  avgPrice: number;
  count: number;
}
export interface ContextNeighbourhood {
  slug: string;
  name: string;
  summary: string;
}
export interface ContextSchool {
  slug: string;
  name: string;
  board: string;
  level: string;
}
/** A street that physically intersects this one (StreetAdjacency) — link + label. */
export interface ConnectedStreet {
  slug: string;
  name: string;
}
export interface ContextBlock {
  similarStreets: ContextStreet[];
  connectedStreets: ConnectedStreet[];
  neighbourhoods: ContextNeighbourhood[];
  schools: ContextSchool[];
}

// ───── FAQ ───────────────────────────────────────────────────────────────────

export interface StreetFaq {
  question: string;
  answer: string;
}

// ───── Master page shape (the seam getStreetV2Data returns) ──────────────────

import type { StreetVideoView } from '@/lib/streetVideo';
import type { AddressLadder as AddressLadderView } from '@/lib/streetAddresses';

export interface StreetV2Data {
  slug: string;
  name: string; // display: "Main Street East"
  shortName: string; // prose: "Main St E"
  eyebrow: string; // "Street Profile · Old Milton · Milton, ON"
  subtitle: string; // characterSummary
  neighbourhoods: string[];

  hero: StreetHeroData;

  /** true => no generated prose; render the "profile in preparation" placeholder. */
  placeholder: boolean;
  sections: StreetProseSection[]; // empty when placeholder

  sidebar: StreetSidebar;
  productTypes: TypeBlock[];
  commute: CommuteCategory[];
  activeListings: ListingCard[];
  /** The Town's civic addresses on this street, or null where it carries none. */
  addresses: AddressLadderView | null;
  context: ContextBlock;
  faqs: StreetFaq[];
  finalCtas: { seller: StreetCta; buyer: StreetCta };

  /** The street's neighbourhood from the registry, for the CTAs' wording. Registry data only:
   *  the neighbourhood typical and its sample left with MC-046, and the sold-derived tier and
   *  hasAnySale with them. */
  areaContext: {
    neighbourhoodName: string;
    neighbourhoodSlug: string | null;
  } | null;

  /** Street-video PoC: resolved day/night clips, or null when the street carries no clip.
   *  A null value (and a null clip within it) renders nothing. See src/lib/streetVideo.ts. */
  video: StreetVideoView | null;

  lastUpdated: string;
}
