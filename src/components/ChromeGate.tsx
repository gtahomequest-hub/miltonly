"use client";

import { usePathname } from "next/navigation";

/**
 * Gates the root layout's chrome (the chat widget and the consent banner) off the routes that
 * own their own chrome.
 *
 * Until MH-006 this also gated the legacy navy <Navbar>, which the root layout rendered on
 * every route not listed here; the forest SiteNav is rendered by each page (or by SiteChrome
 * for the pages with no theme of their own), so no header is global any more and a route
 * missing from this list can no longer ship two headers. The guides did (MA-004 defect 5).
 */
export default function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Homepage uses the v2 <HomePage> which renders its own nav; suppress the
  // global Navbar here. Exact match only — a prefix match would hide it site-wide.
  if (pathname === "/") return null;
  // Hub v2: /neighbourhoods/<slug> ships its own forest-green HubPage header;
  // suppress the global Navbar (exact-prefix so the /neighbourhoods index keeps it).
  if (pathname === "/neighbourhoods") return null; // neighbourhoods-v2 directory index renders its own SiteNav (exact match)
  if (pathname?.startsWith("/neighbourhoods/")) return null;
  // Forest-v2 content pages own their top chrome via their own hero/header (the hub
  // pattern), so the legacy navy global Navbar is suppressed on each. Exact-prefix
  // per route so the navy nav STILL renders on legacy/non-v2 pages — notably the
  // /condos (redirect) and /streets (navy grid) INDEX routes and the live navy
  // /streets/<slug> page, which keep the navy nav until their own v2 cutover.
  if (pathname === "/condos") return null; // condos-v2 directory index renders its own SiteNav (exact match)
  if (pathname?.startsWith("/condos/")) return null; // condo-v2 building pages
  if (pathname === "/streets") return null; // streets-v2 directory index renders its own SiteNav (exact match)
  if (pathname?.startsWith("/streets/")) return null; // street-v2 live page (trailing slash = detail pages)
  if (pathname?.startsWith("/streets-v2-preview")) return null; // street-v2 design preview
  if (pathname?.startsWith("/listings-v2-preview")) return null; // listings-v2 design preview
  if (pathname === "/listings") return null; // listings-v2 live page renders its own SiteNav (exact match)
  // /listings/<mls>, /guides and /market-watch are NOT listed, on purpose. MA-004 asked for a
  // /guides rule to stop the second header; with Navbar deleted there is no second header to
  // stop, and a rule here would only take the chat widget and the consent banner off those
  // pages, which nobody asked for. This list is about chat and consent now, nothing else.
  if (pathname === "/sell") return null; // sell-v2 page renders its own SiteNav (exact match)
  if (pathname?.startsWith("/value")) return null; // door-hanger valuation landing (focused conversion, mirrors /sales/ads — SiteNav owns chrome)
  if (pathname === "/mosques") return null; // mosques-v2 directory renders its own SiteNav (exact match)
  if (pathname?.startsWith("/mosques/")) return null; // mosque-v2 detail pages
  if (pathname === "/schools") return null; // schools-v2 directory renders its own SiteNav (exact match)
  if (pathname?.startsWith("/schools/")) return null; // school-v2 detail pages
  if (pathname === "/blog") return null; // blog noindex placeholder renders its own SiteNav (exact match)
  if (pathname === "/sold") return null; // sold-v2 page renders its own SiteNav (exact match)
  if (pathname === "/freehold") return null; // freehold tenure-hub renders its own SiteNav (exact match)
  if (pathname === "/condos-guide") return null; // condo tenure-hub renders its own SiteNav (exact match)
  if (pathname === "/potl") return null; // POTL tenure-hub renders its own SiteNav (exact match)
  if (pathname === "/compare") return null; // compare-v2 forest INDEX renders its own SiteNav (exact match)
  if (pathname?.startsWith("/compare/")) return null; // compare flagship + future sub-routes (forest ComparePage)
  if (pathname === "/guide-preview") return null; // guides-v2 article preview
  if (pathname === "/guides-preview") return null; // guides-v2 index preview
  if (pathname === "/hub-preview") return null; // hub-v2 design preview (forest body owns chrome)
  if (pathname === "/condo-preview") return null; // condo-v2 design preview (forest body owns chrome)
  if (pathname === "/coming-soon") return null;
  if (pathname?.startsWith("/rentals/ads")) return null;
  // Sales featured page (paid Google Ads traffic) — strip site chrome so
  // the page is a focused conversion surface, matching /rentals/ads.
  if (pathname?.startsWith("/sales/ads")) return null;
  // Strip site chrome on /rentals/thank-you so the post-conversion page
  // renders Aamir-only: vCard download + intro + timeline + WhatsApp.
  // The ThankYouClient renders its own minimal logo-only header + slim
  // legal footer; we don't want the site-wide Navbar's Buy/Rent/Sell/
  // Sign-in menu re-introducing distractions during the 60-min callback
  // window.
  if (pathname?.startsWith("/rentals/thank-you")) return null;
  // Same rationale for the sales-side post-conversion page; 4-business-hour
  // SLA copy on /sales/thank-you needs the same distraction-free chrome.
  if (pathname?.startsWith("/sales/thank-you")) return null;
  return <>{children}</>;
}
