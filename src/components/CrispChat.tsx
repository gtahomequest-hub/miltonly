"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Routes where the Crisp widget is suppressed. /about is a paid-traffic
// landing surface with its own inline form + sticky call bar +
// tel/WhatsApp/email — six chat channels on a 6.1" phone is excessive,
// so Crisp is intentionally hidden here (DEC-ABOUT-CANONICAL 2026-05-19,
// D6). Add routes to this array if future surfaces want the same opt-out.
const CRISP_EXCLUDED_PATH_PREFIXES = ["/about"];

export default function CrispChat() {
  const pathname = usePathname();
  const excluded = CRISP_EXCLUDED_PATH_PREFIXES.some((p) =>
    pathname?.startsWith(p),
  );

  useEffect(() => {
    if (excluded) return;
    const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;
    if (!websiteId) return;

    // Crisp loading script
    window.$crisp = [];
    window.CRISP_WEBSITE_ID = websiteId;

    const script = document.createElement("script");
    script.src = "https://client.crisp.chat/l.js";
    script.async = true;
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [excluded]);

  return null;
}

// Type declarations for Crisp globals
declare global {
  interface Window {
    $crisp: unknown[];
    CRISP_WEBSITE_ID: string;
  }
}
