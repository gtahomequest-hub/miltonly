"use client";

import { config } from "@/lib/config";

const REALTOR_FIRST_NAME = config.realtor.name.split(" ")[0];

export interface StickyMobileBarProps {
  /** What the secondary (right) button does when tapped. Either "scroll-to-form" (default, scrolls to #lead-form) or a string URL to navigate to. */
  primaryAction?: "scroll-to-form" | string;
  /** Override the right-button label. Default: "Get matches →". */
  primaryLabel?: string;
}

export default function StickyMobileBar({
  primaryAction = "scroll-to-form",
  primaryLabel = "Get matches →",
}: StickyMobileBarProps) {
  function scrollToForm() {
    if (typeof window === "undefined") return;
    const el = document.getElementById("lead-form");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const primaryButton =
    primaryAction === "scroll-to-form" ? (
      <button
        type="button"
        onClick={scrollToForm}
        className="flex-1 inline-flex items-center justify-center bg-[#f59e0b] hover:bg-[#fbbf24] text-[#07111f] font-extrabold rounded-lg text-[14px] min-h-[48px]"
      >
        {primaryLabel}
      </button>
    ) : (
      <a
        href={primaryAction}
        className="flex-1 inline-flex items-center justify-center bg-[#f59e0b] hover:bg-[#fbbf24] text-[#07111f] font-extrabold rounded-lg text-[14px] min-h-[48px]"
      >
        {primaryLabel}
      </a>
    );

  return (
    <>
      <div
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#07111f]/95 backdrop-blur border-t border-[#1e3a5f] px-3 pt-2.5 flex gap-2"
        style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom))" }}
      >
        <a
          href={`tel:${config.realtor.phoneE164}`}
          className="flex-1 inline-flex items-center justify-center bg-[#0c1e35] border border-[#1e3a5f] text-white font-bold rounded-lg text-[14px] min-h-[48px]"
        >
          📞 Call {REALTOR_FIRST_NAME}
        </a>
        {primaryButton}
      </div>
      {/* Spacer so the footer isn't hidden behind the sticky bar when scrolled to bottom */}
      <div className="md:hidden h-20" aria-hidden />
    </>
  );
}
