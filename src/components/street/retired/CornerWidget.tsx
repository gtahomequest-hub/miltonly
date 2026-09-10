"use client";

// RETIRED 2026-09-10. Not mounted by any page and not being added to street pages.
//
// The form posted natively to /api/leads with method="POST", so the browser sent a
// form-encoded body to a route whose first statement is request.json(). That threw on every
// submission: the route answered 500 {"error":"Failed to create lead"} and the browser
// rendered that JSON in place of the page. It now posts JSON to /api/leads/create — the same
// live ingress StreetAlertCTA and CondoCTAs use — which writes the lead row and fires the ops
// notification.
//
// The heading also read "Private access to <streetShort>". The resolved street name is the
// only name allowed in prose, so the copy and the captured field both carry `streetName`.
//
// NOTE: no page renders this component today (verified 2026-09-10 — only globals.css and this
// file reference it). Mounting it is a street-page composition decision and is not made here.

import { useEffect, useRef, useState } from "react";
import type { CornerWidgetProps } from "@/types/street";
import { postLead, type LeadClientIntent } from "@/lib/postLeadClient";

const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type Status = "idle" | "submitting" | "ok" | "error";

// What the visitor picks, and what each choice means to the value model. "Just watching" is a
// buy-side signal, not a third economic category — estimateLeadValue only understands
// rent | buy | sell, and inventing a fourth token there would score the lead at 0.
const INTENT_OPTIONS: Array<{ value: string; label: string; intent: LeadClientIntent }> = [
  { value: "buyer", label: "I am looking to buy here", intent: "buy" },
  { value: "seller", label: "I own here", intent: "sell" },
  { value: "watcher", label: "Just watching the market", intent: "buy" },
];

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
  const [status, setStatus] = useState<Status>("idle");
  const [email, setEmail] = useState("");
  const [choice, setChoice] = useState(INTENT_OPTIONS[0].value);

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === "submitting") return;
    const picked = INTENT_OPTIONS.find((o) => o.value === choice) ?? INTENT_OPTIONS[0];
    setStatus("submitting");
    const ok = await postLead({
      source: "street-corner-widget",
      intent: picked.intent,
      email,
      property_address: streetName,
      notes: `${picked.label}: ${streetName}`,
    });
    setStatus(ok ? "ok" : "error");
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
          Live on {streetName}
        </div>
        <div className="widget-summary-headline">{streetName}</div>
        <div className="widget-summary-stats">{heroHeadline}</div>
        <div className={`widget-summary-insight ${fading ? "fading" : ""}`}>{insight}</div>
      </div>
      {status === "ok" ? (
        <div className="widget-form">
          <div className="widget-form-header">
            <div>
              <div className="widget-form-title">Your message is in</div>
              <div className="widget-form-sub">
                We will reply about {streetName} during business hours.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <form className="widget-form" onSubmit={submit}>
          <div className="widget-form-header">
            <div>
              <div className="widget-form-title">Private access to {streetName}</div>
              <div className="widget-form-sub">No spam. One quick message to our team.</div>
            </div>
          </div>
          <input
            type="email"
            name="email"
            className="widget-form-field"
            placeholder="your@email.com"
            required
            aria-label={`Email about ${streetName}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <select
            name="intent"
            className="widget-form-field"
            aria-label="Intent"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
          >
            {INTENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {status === "error" && (
            <div className="widget-form-sub">Something went wrong. Please try again.</div>
          )}
          <button type="submit" className="widget-submit-btn" disabled={status === "submitting"}>
            {status === "submitting" ? "…" : "Request a response →"}
          </button>
        </form>
      )}
    </aside>
  );
}

