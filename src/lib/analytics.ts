// Google Analytics 4 event tracking
// GA_ID is loaded from NEXT_PUBLIC_GA_ID env var

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";

// Page view — called automatically by GoogleAnalytics component
export function pageview(url: string) {
  if (!GA_ID) return;
  window.gtag("config", GA_ID, { page_path: url });
}

// Custom events
export function trackEvent(action: string, params?: Record<string, string | number>) {
  if (!GA_ID) return;
  window.gtag("event", action, params);
}

// Pre-defined event helpers matching the blueprint
export const analytics = {
  searchPerformed(query: string) {
    trackEvent("search_performed", { search_term: query });
  },
  listingViewed(mlsNumber: string) {
    trackEvent("listing_viewed", { mls_number: mlsNumber });
  },
  sellerToolStarted(street: string) {
    trackEvent("seller_tool_started", { street_name: street });
  },
  leadCaptured(source: string, intent: string) {
    trackEvent("lead_captured", { source, intent });
  },
  comparisonMade(leftSide: string, rightSide: string, mode: string) {
    trackEvent("comparison_made", { left_side: leftSide, right_side: rightSide, mode });
  },
  pillClicked(pillLabel: string) {
    trackEvent("pill_clicked", { pill_label: pillLabel });
  },
  saveListing(mlsNumber: string) {
    trackEvent("save_listing", { mls_number: mlsNumber });
  },
};

// Type declaration for gtag
declare global {
  interface Window {
    gtag: (command: string, ...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}
