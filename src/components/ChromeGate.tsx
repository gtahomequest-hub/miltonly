"use client";

import { usePathname } from "next/navigation";

/**
 * Hides site chrome (nav, agent strip, consent banner) on the
 * pre-launch coming-soon page so it renders completely clean.
 */
export default function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Homepage uses the v2 <HomePage> which renders its own nav; suppress the
  // global Navbar here. Exact match only — a prefix match would hide it site-wide.
  if (pathname === "/") return null;
  // Hub v2: /neighbourhoods/<slug> ships its own forest-green HubPage header;
  // suppress the global Navbar (exact-prefix so the /neighbourhoods index keeps it).
  if (pathname?.startsWith("/neighbourhoods/")) return null;
  // Forest-v2 content pages own their top chrome via their own hero/header (the hub
  // pattern), so the legacy navy global Navbar is suppressed on each. Exact-prefix
  // per route so the navy nav STILL renders on legacy/non-v2 pages — notably the
  // /condos (redirect) and /streets (navy grid) INDEX routes and the live navy
  // /streets/<slug> page, which keep the navy nav until their own v2 cutover.
  if (pathname?.startsWith("/condos/")) return null; // condo-v2 building pages
  if (pathname?.startsWith("/streets/")) return null; // street-v2 live page (trailing slash keeps the /streets index navy)
  if (pathname?.startsWith("/streets-v2-preview")) return null; // street-v2 design preview
  if (pathname === "/guide-preview") return null; // guides-v2 article preview
  if (pathname === "/guides-preview") return null; // guides-v2 index preview
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
