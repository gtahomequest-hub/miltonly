"use client";

import { useEffect, useState } from "react";
import { ABOUT_EVENTS, fireAboutEvent } from "./_tracking";

interface AboutStickyBarProps {
  phoneDisplay: string;
  phoneE164: string;
  whatsappE164: string;
  /** Scroll position (px) past which the bar appears. Defaults to
   *  roughly one mobile viewport so the bar surfaces after the hero
   *  scrolls out. */
  showAfterScrollY?: number;
}

/**
 * Sticky mobile call/text bar for /about. Mobile-only (hidden on lg
 * breakpoint and up — desktop has the hero CTAs always visible).
 *
 * New dedicated component rather than reusing the listing-coupled
 * StickyMobileBar from sales/ads + rentals/ads (per D7). Refactor to
 * a shared base is a later-sprint concern once a third caller exists.
 */
export default function AboutStickyBar(props: AboutStickyBarProps) {
  const threshold = props.showAfterScrollY ?? 600;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function onScroll() {
      setVisible(window.scrollY > threshold);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  if (!visible) return null;

  return (
    <div
      data-sticky-bar
      role="region"
      aria-label="Quick contact"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#07111f]/95 backdrop-blur border-t border-[#1e3a5f] px-3 py-2.5 flex gap-2.5 safe-bottom"
    >
      <a
        href={`tel:${props.phoneE164}`}
        onClick={() => fireAboutEvent(ABOUT_EVENTS.stickyBarCall)}
        data-action="call"
        className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#f59e0b] hover:bg-[#fbbf24] text-[#07111f] font-extrabold text-[14px] px-4 py-3 rounded-lg transition-colors min-h-[48px]"
      >
        <span aria-hidden>📞</span> Call
      </a>
      <a
        href={`https://wa.me/${props.whatsappE164}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => fireAboutEvent(ABOUT_EVENTS.stickyBarText)}
        data-action="text"
        className="flex-1 inline-flex items-center justify-center gap-1.5 bg-transparent border-2 border-[#f59e0b] text-[#f59e0b] hover:bg-[#f59e0b]/10 font-extrabold text-[14px] px-4 py-3 rounded-lg transition-colors min-h-[48px]"
      >
        <span aria-hidden>💬</span> Text
      </a>
    </div>
  );
}
