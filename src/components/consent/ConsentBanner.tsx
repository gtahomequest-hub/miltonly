"use client";

import { useState, useEffect } from "react";

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

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show banner if no consent decision has been made
    if (getConsent() === null) {
      setVisible(true);
    }
  }, []);

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
    <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-[#07111f] border-t border-[#1e3a5f] px-5 py-4 sm:px-8">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-[13px] text-[#cbd5e1] leading-relaxed">
            We use cookies and similar technologies to improve your experience,
            analyze site traffic, and personalize content. By clicking
            &ldquo;Accept&rdquo;, you consent to our use of cookies in
            accordance with Canadian privacy law (PIPEDA).
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={decline}
            className="text-[12px] font-semibold text-[#94a3b8] hover:text-white px-4 py-2 rounded-lg border border-[#334155] hover:border-[#64748b] transition-colors"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="text-[12px] font-bold text-[#07111f] bg-[#f59e0b] hover:bg-[#fbbf24] px-5 py-2 rounded-lg transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
