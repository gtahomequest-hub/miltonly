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
  // Strip site chrome on /rentals/thank-you so the post-conversion page
  // renders Aamir-only: vCard download + intro + timeline + WhatsApp.
  // The ThankYouClient renders its own minimal logo-only header + slim
  // legal footer; we don't want the site-wide Navbar's Buy/Rent/Sell/
  // Sign-in menu re-introducing distractions during the 60-min callback
  // window.
  if (pathname?.startsWith("/rentals/thank-you")) return null;
  return <>{children}</>;
}
