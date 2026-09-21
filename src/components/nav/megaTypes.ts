// src/components/nav/megaTypes.ts
// The mega menu's live-content seam. A plain serializable shape so a SERVER module can
// compute it and hand it to the client nav across the boundary.
//
// THE SHAPE FOLLOWS THE RAIL. Each menu has a left rail of items and each item selects its
// own right-hand panel. So the live content is keyed twice: by menu, then by item, and every
// item's content is one `MegaItemContent`, a bag of optional blocks that one renderer knows
// how to draw. A block that is absent is not drawn; a block that is present is live.
//
// TWO CONTRACTS.
//
// 1. EVERY FIGURE IS A DISPLAY STRING, FORMATTED ON THE SERVER, by src/lib/figureFormat.ts,
//    the same helpers the Board uses. The menu once formatted raw numbers itself and shipped
//    "$937,465.504", "27.829694323144103" and a ratio wearing a percent sign. The renderer
//    cannot format, so it cannot misformat.
//
// 2. EVERY BLOCK IS OPTIONAL. The nav renders on every page of the site. A page that passes
//    nothing renders the rails, each item's static blurb and its CTA, which is still a
//    complete, crawlable menu. A panel is never padded with a placeholder.

/** Four menus (MH-007 added Rent). The order the bar shows them in is the nav's MENUS. */
export type MenuKey = 'buy' | 'rent' | 'streets' | 'sell';

/** THE PAGE THE NAV IS ON (MH-006, MA-004 change 6). A street page or a hub hands the nav
 *  its subject, and the nav carries it: the bar CTA and the Sell panel CTA arrive at the
 *  valuation with the street prefilled (or at the hub's own /value page), the brief form
 *  records which street or hub the signup came from, and the Streets and Sell strips
 *  (change 10) are that hub's streets rather than the same eight from every page. A page
 *  with no subject passes nothing and gets the global chrome. */
export interface NavContext {
  street?: { slug: string; name: string };
  hub?: { slug: string; name: string };
}

/** A sentence with live figures in it. Figure segments render as <b data-fig data-value>. */
export interface LeadSegment {
  text: string;
  /** when set, `text` is a formatted figure and this is its data-fig key */
  fig?: string;
}

export interface MegaListing {
  mlsNumber: string;
  /** already through the RECO/IDX display gate: never the raw address */
  address: string;
  /** whole-dollar list price, formatted; rentals carry "/mo" */
  price: string;
  /** the listing brokerage's office name as the feed carries it; the card renders it inside
   *  the price at the price's size (TRREB item 27, MC-029) */
  listOfficeName: string | null;
  /** first photo, or null when the feed carries none; the card says so rather than hiding */
  photo: string | null;
  beds: number;
  baths: number;
  // NO DAY COUNT, NO PRIOR PRICE, NO CHANGE (MC-029). A menu card is an anonymous surface and
  // those are VOW-only facts (src/lib/listings/vow.ts).
  /** the PUBLISHED hub's name, or null when the raw TREB string has no hub */
  hub: string | null;
}

export interface MegaFigure {
  key: string;
  label: string;
  value: string;
  /** the window this figure was measured over; each figure states its own */
  window: string;
  /** the sample behind it, formatted, e.g. "412 sales"; empty when not applicable */
  sample: string;
}

/** A row of street links, sourced from one real query, each with the count that ranked it. */
export interface MegaStrip {
  label: string;
  items: { slug: string; name: string; note: string }[];
}

export interface MegaHub {
  slug: string;
  name: string;
  /** live listing count across the hub's raw strings, formatted */
  active: string;
  /** the link, when it is not the hub page: the Rent menu lists hubs as scoped /rentals */
  href?: string;
}

export interface MegaVideo {
  slug: string;
  name: string;
  poster: string;
  variant: 'day' | 'night';
}

/** One letter of the A to Z index: how many published street pages start with it. */
export interface MegaLetter {
  letter: string;
  count: string;
  /** null when no page starts with the letter; rendered as text, not a link */
  href: string | null;
}

/** The latest published Market Watch edition, as far as the menu states it. */
export interface MegaEdition {
  weekOf: string;
  label: string;
  /** the edition's own deterministic summary sentence */
  summary: string;
  href: string;
}

export interface MegaItemContent {
  /** the rail item's sub-label, one live fact under its name ("20 this week") */
  sub?: string;
  /** the item's CTA text with its count in it ("See all 460 for sale"); the ItemDef's static text otherwise */
  cta?: string;
  lead?: LeadSegment[];
  figures?: MegaFigure[];
  /** one sentence under the figures stating how they were measured, where two bases share a panel */
  basis?: string;
  cards?: MegaListing[];
  hubs?: MegaHub[];
  /** the hubs block's heading and figure key; "Neighbourhoods, with homes listed now" and
   *  `menu-hub-active` when absent (the Streets menu's, which the battery counts per page) */
  hubsLabel?: string;
  hubsFig?: string;
  videos?: MegaVideo[];
  letters?: MegaLetter[];
  edition?: MegaEdition;
  strip?: MegaStrip;
  /** one line of stated, true copy under the live blocks */
  note?: string;
}

/** menu -> item key -> content */
export type MegaLive = Partial<Record<MenuKey, Record<string, MegaItemContent>>>;
