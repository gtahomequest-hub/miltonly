"use client";

import { useEffect, useRef, useState } from "react";
import type { CornerWidgetProps } from "@/types/street";

const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function CornerWidget({
  streetName,
  streetShort,
  heroHeadline,
  sectionInsights,
  storageKey,
}: CornerWidgetProps) {
  const key = storageKey ?? `miltonly:widget:${streetShort.toLowerCase()}`;
  const [visible, setVisible] = useState(false);
  const [insightIdx, setInsightIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const [dismissed, setDismissed] = useState(true); // start true so nothing renders until mount resolves
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount: check cooldown state, then set up reveal + observers
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const prev = window.localStorage.getItem(key);
      if (prev) {
        const ts = parseInt(prev, 10);
        if (Number.isFinite(ts) && Date.now() - ts < COOLDOWN_MS) return; // cooldown active
      }
    } catch { /* storage blocked */ }
    setDismissed(false);

    const reveal = () => setVisible(true);
    timerRef.current = setTimeout(reveal, 3000);

    const onScroll = () => {
      const pct = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (pct > 0.1) reveal();
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // IntersectionObserver: track active section and update insight
    const indexById = new Map<string, number>();
    sectionInsights.forEach((s, i) => indexById.set(s.id, i));

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry whose top is closest to viewport midpoint among intersecting
        let bestIdx = -1;
        let bestY = Infinity;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = indexById.get(entry.target.id);
          if (idx === undefined) continue;
          const distance = Math.abs(entry.boundingClientRect.top - window.innerHeight / 3);
          if (distance < bestY) {
            bestY = distance;
            bestIdx = idx;
          }
        }
        if (bestIdx >= 0) {
          setFading(true);
          setTimeout(() => {
            setInsightIdx(bestIdx);
            setFading(false);
          }, 180);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5, 1] }
    );
    for (const insight of sectionInsights) {
      const el = document.getElementById(insight.id);
      if (el) observer.observe(el);
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [sectionInsights, key]);

  const dismiss = () => {
    setVisible(false);
    setDismissed(true);
    try { window.localStorage.setItem(key, String(Date.now())); } catch { /* storage blocked */ }
  };

  if (dismissed) return null;

  const insight = sectionInsights[insightIdx]?.text ?? "";

  return (
    <aside
      className={`corner-widget ${visible ? "is-visible" : ""}`}
      aria-label={`Summary widget for ${streetName}`}
    >
      <button className="corner-widget-dismiss" onClick={dismiss} aria-label="Dismiss widget">×</button>
      <div className="widget-summary">
        <div className="widget-summary-label">
          <span className="pulse" aria-hidden />
          Live on {streetShort}
        </div>
        <div className="widget-summary-headline">{streetName}</div>
        <div className="widget-summary-stats">{heroHeadline}</div>
        <div className={`widget-summary-insight ${fading ? "fading" : ""}`}>{insight}</div>
      </div>
      <form
        className="widget-form"
        action="/api/leads"
        method="POST"
      >
        <div className="widget-form-header">
          <div>
            <div className="widget-form-title">Private access to {streetShort}</div>
            <div className="widget-form-sub">No spam. One quick message to our team.</div>
          </div>
        </div>
        <input
          type="email"
          name="email"
          className="widget-form-field"
          placeholder="your@email.com"
          required
          aria-label="Email"
        />
        <select name="intent" className="widget-form-field" aria-label="Intent">
          <option value="buyer">I am looking to buy here</option>
          <option value="seller">I own here</option>
          <option value="watcher">Just watching the market</option>
        </select>
        <input type="hidden" name="street" value={streetShort} />
        <button type="submit" className="widget-submit-btn">
          Request a response →
        </button>
      </form>
    </aside>
  );
}

