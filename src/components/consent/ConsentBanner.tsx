"use client";

import { useEffect, useRef, useState } from "react";

const CONSENT_KEY = "miltonly_consent";

type ConsentStatus = "accepted" | "declined" | null;

function getConsent(): ConsentStatus {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(CONSENT_KEY);
  if (stored === "accepted" || stored === "declined") return stored;
  return null;
}

export function hasConsent(): boolean {
  return getConsent() === "accepted";
}

// ONE LINE, IN THE SITE TOKENS, AND IT PUSHES THE PAGE UP RATHER THAN COVERING IT (MH-008).
// The banner was four navy lines with an orange button and a "personalize content" claim the
// site does not act on; it sat over the footer's brief field on a phone until dismissed. Now
// it says what the cookies are for (analytics, nothing else), in the forest with the accent
// on the CTA, and while it is up the body carries its height as bottom padding, so the last
// thing on every page, the footer's brief field included, scrolls above it.
export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Show banner if no consent decision has been made
    if (getConsent() === null) {
      setVisible(true);
    }
  }, []);

  useEffect(() => {
    if (!visible || !ref.current) return;
    const el = ref.current;
    const body = document.body;
    const prev = body.style.paddingBottom;
    const apply = () => {
      body.style.paddingBottom = `${el.getBoundingClientRect().height}px`;
    };
    apply();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(apply) : null;
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      body.style.paddingBottom = prev;
    };
  }, [visible]);

  function accept() {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
    // Enable analytics now that consent is given
    if (window.gtag) {
      window.gtag("consent", "update", {
        analytics_storage: "granted",
      });
    }
  }

  function decline() {
    localStorage.setItem(CONSENT_KEY, "declined");
    setVisible(false);
    // Ensure analytics stays disabled
    if (window.gtag) {
      window.gtag("consent", "update", {
        analytics_storage: "denied",
      });
    }
  }

  if (!visible) return null;

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Cookies"
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-[#073126] border-t border-[rgba(0,255,128,0.25)] px-4 py-2.5 sm:px-8"
      style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-[13px] leading-snug text-[rgba(255,255,255,0.84)] m-0">
          Cookies for site analytics only, under PIPEDA.{" "}
          <a href="/privacy" className="underline underline-offset-2 text-[#5cffa8]">
            Privacy
          </a>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={decline}
            className="text-[13px] font-semibold text-white/80 hover:text-white px-3 py-1.5 rounded-md border border-white/25 hover:border-white/50 transition-colors"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={accept}
            className="text-[13px] font-bold text-white bg-[#017848] hover:bg-[#0a8f57] px-4 py-1.5 rounded-md transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
