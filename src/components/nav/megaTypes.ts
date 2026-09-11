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

export type MenuKey = 'buy' | 'streets' | 'sell';

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
  /** the list price before the most recent change, formatted, when one was observed */
  priorPrice?: string;
  /** "down $100,000" / "up $76,000", when priorPrice is known */
  change?: string;
  /** first photo, or null when the feed carries none; the card says so rather than hiding */
  photo: string | null;
  beds: number;
  baths: number;
  /** "12 days" or null when the feed has no count */
  dom: string | null;
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
  lead?: LeadSegment[];
  figures?: MegaFigure[];
  cards?: MegaListing[];
  hubs?: MegaHub[];
  videos?: MegaVideo[];
  letters?: MegaLetter[];
  edition?: MegaEdition;
  strip?: MegaStrip;
  /** one line of stated, true copy under the live blocks */
  note?: string;
}

/** menu -> item key -> content */
export type MegaLive = Partial<Record<MenuKey, Record<string, MegaItemContent>>>;
