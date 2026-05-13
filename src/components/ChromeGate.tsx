"use client";

import { usePathname } from "next/navigation";

/**
 * Hides site chrome (nav, agent strip, consent banner) on the
 * pre-launch coming-soon page so it renders completely clean.
 */
export default function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
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
