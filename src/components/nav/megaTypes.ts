// src/components/nav/megaTypes.ts
// The mega menu's live-content seam. A plain serializable shape so a SERVER module can
// compute it and hand it to the client nav across the boundary.
//
// TWO CONTRACTS.
//
// 1. EVERY FIGURE IS A DISPLAY STRING, FORMATTED ON THE SERVER. The menu once formatted raw
//    numbers itself and shipped "$937,465.504", "27.829694323144103" and a ratio wearing a
//    percent sign. Every value here is produced by src/lib/figureFormat.ts, the same helpers
//    the Board uses, on the side of the boundary that knows the units. The renderer cannot
//    format, so it cannot misformat.
//
// 2. EVERY SECTION IS OPTIONAL. The nav renders on every page of the site. A page that passes
//    nothing renders the rails, the search and nothing else, which is still a complete,
//    crawlable menu. A panel is never padded with a placeholder when its data is missing.

export interface MegaListing {
  mlsNumber: string;
  /** already through the RECO/IDX display gate: never the raw address */
  address: string;
  /** whole-dollar list price, formatted */
  price: string;
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
  /** the sample behind it, formatted, e.g. "412 sales" */
  sample: string;
}

/** A row of street links, different for every menu and sourced from one real query each. */
export interface MegaStrip {
  /** e.g. "Most for sale right now" */
  label: string;
  items: { slug: string; name: string; note: string }[];
}

export interface MegaHub {
  slug: string;
  name: string;
  /** live listing count across the hub's raw strings, formatted */
  active: string;
}

export interface MegaLive {
  buy?: {
    /** the one true thing this panel teaches, e.g. "457 homes for sale in Milton, 38 new this week." */
    lead: string;
    active: string;
    newThisWeek: string;
    listings: MegaListing[];
    strip?: MegaStrip;
  };
  streets?: {
    lead: string;
    pages: string;
    filmed: string;
    hubs: MegaHub[];
    videos: { slug: string; name: string; poster: string; variant: 'day' | 'night' }[];
    strip?: MegaStrip;
  };
  sell?: {
    /** null when any figure it would state is suppressed: a sentence is never padded */
    lead: string | null;
    figures: MegaFigure[];
    strip?: MegaStrip;
  };
}
