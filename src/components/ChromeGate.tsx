"use client";

import { usePathname } from "next/navigation";

/**
 * Hides site chrome (nav, agent strip, consent banner) on the
 * pre-launch coming-soon page so it renders completely clean.
 */
export default function ChromeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/coming-soon") return null;
  return <>{children}</>;
}
