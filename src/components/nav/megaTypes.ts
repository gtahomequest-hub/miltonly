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
  /**
   * THE SELL PANEL'S FIGURES, PRE-FORMATTED ON THE SERVER.
   *
   * They used to be raw numbers that the component formatted at render, and it got them
   * wrong in every possible way at once: `$937,465.504` for a price, `27.829694323144103`
   * for a day count, and the sold-to-ask RATIO with a percent sign welded on. All three
   * shipped to production and stayed there.
   *
   * The fix is structural rather than a better `money()`. A display string is produced ONCE,
   * by the same helpers the page body uses, on the side of the boundary that has the units —
   * so the component cannot format, and therefore cannot misformat. Each figure carries the
   * window it was measured over, because the three do not share one.
   */
  sell?: {
    figures: { key: string; label: string; value: string; window: string }[];
  };
  inDemandStreets?: { slug: string; name: string }[];
}
