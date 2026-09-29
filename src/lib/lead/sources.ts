// The lead surfaces that are mounted today, by the `source` tag each one sends.
//
// The weekly digest asks "which surface produced nothing in 28 days", and that question needs
// a list of surfaces to ask it of. The data cannot supply one: a surface that has never
// converted has no row to be counted from, and it is exactly the surface the question is
// about. So the list is written down here, once, and scripts/test-leads-digest.ts holds it to
// the code at prebuild: every entry below must still appear as a quoted literal in a mounted
// file under src/ (outside src/lib and outside any retired/ folder), and every source the
// confirmation copy in notify.ts names must be either live here or retired below. A surface
// unmounted without being moved to RETIRED fails the build with its name.
//
// The tag is the surface's identity across the whole layer: the confirmation line, the watch
// kind, the leads-per-page view and this digest all key on it. A label is kept beside each so
// the digest can say where a surface lives without the reader decoding the tag.

export interface LeadSource {
  source: string;
  /** Where the surface sits, in words a reader of the digest recognises. */
  where: string;
}

export const LIVE_SOURCES: readonly LeadSource[] = [
  // Street pages
  { source: "street-alert", where: "street page alert card" },
  { source: "street-valuation", where: "street page, the one-field valuation under the hero" },
  // Condo buildings
  { source: "condo-building-alert", where: "condo building alerts" },
  { source: "condo-building-contact", where: "condo building contact" },
  // Sold and valuation
  { source: "sold-home-valuation", where: "sold page valuation" },
  { source: "sell-page", where: "/sell valuation form" },
  { source: "doorhanger-valuation", where: "/value doorhanger landing" },
  { source: "sales-ads-home-valuation", where: "sales ad landing, valuation card" },
  { source: "homepage-valuation", where: "homepage valuation band" },
  // Places
  { source: "mosque-alert", where: "/mosques alert form" },
  { source: "school-alert", where: "/schools alert form" },
  // Homepage (the pre-footer newsletter, the mortgage calculator, the sold-on-my-street report,
  // the off-market list and the three persona routers left the page in the homepage rebuild and
  // are retired below, ML-014)
  { source: "daily-brief", where: "daily brief signup" },
  { source: "landlord", where: "Rent menu, landlord listing request" },
  // Exclusive listings
  { source: "exclusive-listing", where: "exclusive listing inquiry" },
  // Listing pages
  { source: "sale-detail", where: "sale listing detail" },
  { source: "seller-listing-page", where: "sale listing extras, seller" },
  { source: "landlord-listing-page", where: "rental listing extras, landlord" },
  { source: "rental-detail-book", where: "rental listing detail, booking" },
  { source: "rental-detail-question", where: "rental listing detail, question" },
  { source: "listing-card-book", where: "listing card booking" },
  { source: "book-page", where: "/book, the booking page the school and mosque pages link to" },
  { source: "listing-card-1hr", where: "rentals listing card, one-hour booking" },
  { source: "1hr-booking", where: "rentals one-hour booking" },
  // Rentals
  { source: "alert", where: "rentals alert signup" },
  { source: "new-match-alert", where: "rentals new-match alert" },
  { source: "rental-quiz", where: "rentals quiz" },
  // Rentals ad landings
  { source: "ads-rentals-lp", where: "rentals ad landing" },
  { source: "ads-rentals-lp-modal", where: "rentals ad landing, unlock modal" },
  { source: "rentals-ads-tenant-top", where: "rentals ad listing, tenant top form" },
  { source: "rentals-ads-landlord-top", where: "rentals ad listing, landlord top form" },
  { source: "rentals-ads-rental-valuation", where: "rentals ad listing, rental valuation" },
  { source: "rentals-ads-section-fallback", where: "rentals ad listing, section fallback" },
  { source: "rentals-ads-sticky-mobile", where: "rentals ad listing, sticky mobile" },
  // Sales ad landings
  { source: "sales-ads-market-pulse-unlock", where: "sales ad landing, market pulse unlock" },
  { source: "sales-ads-trust-card-message", where: "sales ad landing, trust card message" },
  { source: "sales-ads-slider-cta", where: "sales ad landing, listing slider" },
  { source: "sales-rentals-featured-top", where: "sales ad listing, featured top form" },
  { source: "sales-ads-section-fallback", where: "sales ad listing, section fallback" },
  { source: "sales-ads-sticky-mobile", where: "sales ad listing, sticky mobile" },
];

/** Sources the confirmation copy still knows but no mounted surface sends. Kept named so a
 *  row carrying one reads as history rather than as a surface the digest forgot. */
export const RETIRED_SOURCES: ReadonlySet<string> = new Set([
  "street-exit-intent",
  "street-corner-widget",
  "rental-booking",
  "rental-question",
  // ML-014 (2026-09-28): no page has mounted these since the homepage rebuild; their components
  // sit under src/components/sections/retired/. ML-013 found the digest reporting them as quiet.
  "homepage-newsletter",
  "homepage-mortgage-calculator",
  "homepage-sold-on-my-street",
  "homepage-exclusive",
  "homepage-persona-first-time-buyer",
  "homepage-persona-newcomer",
  "homepage-persona-move-up",
]);

export function isLiveSource(source: string): boolean {
  return LIVE_SOURCES.some((s) => s.source === source);
}
