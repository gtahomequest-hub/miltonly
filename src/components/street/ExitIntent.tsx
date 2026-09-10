"use client";

// The form posted natively to /api/alerts/subscribe, a route that has never existed in this
// codebase, so every submission navigated the visitor to a 404 and captured nothing. It now
// posts JSON to /api/leads/create — the same live ingress StreetAlertCTA and CondoCTAs use —
// which writes the lead row and fires the ops notification.
//
// It also said "Before you leave <streetShort>" in a heading. The resolved street name is the
// only name allowed in prose, so both the copy and the captured field carry `streetName`.
//
// NOTE: no page renders this component today (verified 2026-09-10 — only globals.css and this
// file reference it). Mounting it is a street-page composition decision and is not made here.

import { useEffect, useState } from "react";
import type { ExitIntentProps } from "@/types/street";
import { postLead } from "@/lib/postLeadClient";

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

type Status = "idle" | "submitting" | "ok" | "error";

export function ExitIntent({
  streetName,
  streetShort,
  storageKey,
  headline,
  body,
}: ExitIntentProps) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [email, setEmail] = useState("");

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

  // The dialog stays open through the submit so the visitor sees the outcome. Closing on submit
  // is what let the old form fail invisibly. The cooldown is stamped on a confirmed write, so a
  // failed attempt does not burn the visitor's one showing for seven days.
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === "submitting") return;
    setStatus("submitting");
    const ok = await postLead({
      source: "street-exit-intent",
      intent: "buy",
      email,
      property_address: streetName,
      notes: `Street alerts requested from the exit prompt, ${streetName}`,
    });
    setStatus(ok ? "ok" : "error");
    if (ok) {
      try { window.localStorage.setItem(key, String(Date.now())); } catch { /* storage blocked */ }
    }
  };

  if (!armed || !open) return null;

  const hl = headline ?? `Before you leave ${streetName}`;
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
          {status === "ok" ? (
            <p className="popup-subhead">
              You are on the list for {streetName}. We will email you when a home there is listed
              or sold.
            </p>
          ) : (
            <>
              <p className="popup-subhead">{bd}</p>
              <form className="popup-alert-form" onSubmit={submit}>
                <input
                  type="email"
                  name="email"
                  placeholder="your@email.com"
                  required
                  aria-label={`Email for ${streetName} alerts`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <button type="submit" className="popup-submit-btn" disabled={status === "submitting"}>
                  {status === "submitting" ? "…" : "Yes, alert me"}
                </button>
              </form>
              {status === "error" && (
                <p className="popup-subhead">Something went wrong. Please try again.</p>
              )}
            </>
          )}
          <button type="button" className="popup-skip" onClick={close}>
            {status === "ok" ? "Close" : "No thanks"}
          </button>
        </div>
      </div>
    </div>
  );
}
