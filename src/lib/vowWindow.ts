// THE DISPLAY WINDOW ON SOLD RECORDS (MC-037). PropTx VOW Best Practices items 41 to 44 and the
// VOW Policy's paragraph 15: sold data older than two years, on a rolling basis, is Archive Data
// under a separate agreement and token. DB2 keeps every row (the research store stays whole);
// what the site DISPLAYS from it is bounded here. Every full-window read of sold.sold_records
// that publishes a figure takes this bound: the street page's graduated fallback
// (src/lib/streetEnrichment.ts fullWindowAgg), the hub ladder's typical
// (src/lib/hubStreetLadder.ts rowsFull), the hub and condo prose's quarterly trend
// (src/lib/ai/buildHubInput.ts, buildCondoBuildingInput.ts), the condo building's "N trades on
// record" (src/lib/ai/buildBuildingAttributes.ts) and the hero search's "N homes"
// (src/lib/heroIndex.ts). The reads that publish no figure and only decide whether a page or a
// claim exists (the street existence probe, anySaleOnRecord behind "No resales recorded yet",
// countRecordedTransactions behind the publish floor) are deliberately NOT bounded: bounding
// them makes a page vanish or a page state a false absence, which is worse than a page with
// less data (MC-037's blast radius: walsh-avenue-milton would 404, twelve streets would claim
// no resales). The battery's record mirror (scripts/verify/lib/db.mjs) carries the same number
// as a literal; scripts/test-vow-fields.ts holds the two together.
//
// One edit reverts the cut if PropTx says holdings may stay: set this to null and every bound
// below falls away (the SQL then reaches back a thousand years, which is no bound).
export const VOW_DISPLAY_MONTHS: number | null = 24;

/** The number of months every bounded read interpolates: `sold_date >= NOW() - (INTERVAL '1
 *  month' * DISPLAY_MONTHS)`. Null above becomes a thousand years, so the clause stays in
 *  place and binds nothing. */
export const DISPLAY_MONTHS: number = VOW_DISPLAY_MONTHS ?? 12000;

// The quarterly trends the prose names start at the first WHOLE quarter inside the window: a
// quarter the window cuts through would be a label on a few days of sales that changes every
// day and vanishes at the quarter's end. Each trend query writes it as
//   sold_date >= date_trunc('quarter', NOW() - (INTERVAL '1 month' * DISPLAY_MONTHS)
//                                          + INTERVAL '3 months' - INTERVAL '1 day')
// which is the next quarter boundary at or after the cut (the cut itself when it is one).
