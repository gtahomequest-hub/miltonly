"use client";

import { useEffect, useState } from "react";
import type { ExitIntentProps } from "@/types/street";

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function ExitIntent({
  streetName,
  streetShort,
  storageKey,
  headline,
  body,
}: ExitIntentProps) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);

  const key = storageKey ?? `miltonly:exit:${streetShort.toLowerCase()}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Cooldown check
    try {
      const prev = window.localStorage.getItem(key);
      if (prev) {
        const ts = parseInt(prev, 10);
        if (Number.isFinite(ts) && Date.now() - ts < COOLDOWN_MS) return; // still in cooldown
      }
    } catch { /* storage blocked */ }

    setArmed(true);

    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY >= 10) return;
      const pct = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (pct < 0.5) return;
      trigger();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    const trigger = () => {
      setOpen(true);
      document.body.style.overflow = "hidden";
      document.removeEventListener("mouseleave", onMouseLeave);
    };

    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const close = () => {
    setOpen(false);
    document.body.style.overflow = "";
    try { window.localStorage.setItem(key, String(Date.now())); } catch { /* storage blocked */ }
  };

  if (!armed || !open) return null;

  const hl = headline ?? `Before you leave ${streetShort}`;
  const bd = body ?? `We can hold a spot on the alert list for ${streetName}. We will email you the moment a new listing goes live. No newsletter, no re-marketing.`;

  return (
    <div
      className="popup-overlay is-open"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-intent-headline"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="popup-card">
        <div className="popup-body">
          <button className="popup-close" onClick={close} aria-label="Close">×</button>
          <div className="popup-eyebrow">Street watch</div>
          <div className="popup-headline" id="exit-intent-headline">{hl}</div>
          <p className="popup-subhead">{bd}</p>
          <form
            className="popup-alert-form"
            action="/api/alerts/subscribe"
            method="POST"
            onSubmit={() => close()}
          >
            <input type="email" name="email" placeholder="your@email.com" required aria-label="Email" />
            <input type="hidden" name="street" value={streetShort} />
            <button type="submit" className="popup-submit-btn">Yes, alert me</button>
          </form>
          <button type="button" className="popup-skip" onClick={close}>No thanks</button>
        </div>
      </div>
    </div>
  );
}

