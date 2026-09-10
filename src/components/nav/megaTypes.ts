// src/components/nav/megaTypes.ts
// The mega-menu's live-content seam. A plain serializable shape so a SERVER page can
// compute it and hand it to the client nav across the boundary.
//
// EVERY FIELD IS OPTIONAL, AND THAT IS THE CONTRACT. The nav renders on every page of
// the site; only the homepage pays for the queries behind this. A page that passes
// nothing renders the rails and nothing else, which is still a complete, crawlable menu.
// A panel is never padded with a placeholder when its data is missing.

export interface MegaBuyListing {
  mlsNumber: string;
  /** already through the RECO/IDX display gate — never the raw address */
  address: string;
  price: number;
}

export interface MegaLive {
  buy?: {
    activeCount: number;
    newThisWeek: number;
    listings: MegaBuyListing[];
  };
  streets?: {
    videoCount: number;
    videos: { slug: string; name: string; poster: string; variant: 'day' | 'night' }[];
  };
  sell?: {
    /** the window the Board states for its own figure, e.g. "12 months" */
    window: string;
    /** k-gated; null renders no row */
    typical: number | null;
    daysToSell: number | null;
    soldToAsk: number | null;
  };
  inDemandStreets?: { slug: string; name: string }[];
}
