"use client";

// The pre-footer newsletter signup. Source "homepage-newsletter".
//
// IT HAD NO HONEYPOT, and it is the surface that produced the eight questionable
// homepage-newsletter rows. It also checked only `res.ok`, on a route that answered 200 with
// { success: true } for a spam submission, so a bot got the same green tick a person did.
// Through the shared helper it now carries the honeypot, the environment tag and the origin
// check, and it renders the confirmation only when the row was actually written.
//
// THE PROMISE ON THIS CARD IS A SUNDAY BRIEF, and no sender sends one. The daily-brief cron
// is Monday to Friday, so mapping this source onto a "brief" watch would have mailed these
// subscribers five times a week having promised them once. It deliberately leaves no watch;
// the unkept Sunday promise is recorded in HANDOFF-leads.md rather than papered over.

import { useState } from "react";
import { postLeadDetailed, honeypotInputProps, HONEYPOT_WRAPPER_STYLE } from "@/lib/postLeadClient";
import { config } from "@/lib/config";

export default function PreFooterCTA() {
  const [email, setEmail] = useState("");
  const [honey, setHoney] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.includes("@") || !email.includes(".")) {
      setError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    const result = await postLeadDetailed({
      source: "homepage-newsletter",
      intent: "buy",
      email,
      name: "Newsletter Subscriber",
      notes: "Pre-footer newsletter signup",
      honeypot: honey,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error || `Couldn't subscribe. Please try again or text Aamir at ${config.realtor.phone}`);
      return;
    }
    setSuccess(true);
  }

  return (
    <section className="bg-[#07111f]">
      <div className="max-w-3xl mx-auto py-12 md:py-16 px-5 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-amber-500 mb-3">
          📬 STAY CLOSE TO THE {config.CITY_NAME.toUpperCase()} MARKET
        </p>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
          Get Aamir&apos;s {config.CITY_NAME} Market Brief — Sundays at 8am
        </h2>
        <p className="text-sm md:text-base text-slate-400 mb-6 max-w-2xl mx-auto leading-relaxed">
          One short email. New listings, sold prices on your watchlist streets, and what&apos;s actually moving this week. No spam. Unsubscribe anytime.
        </p>

        {success ? (
          <div className="max-w-xl mx-auto">
            <p className="text-base text-green-400 font-semibold">
              ✅ You&apos;re in. First brief lands this Sunday at 8am.
            </p>
            <button
              type="button"
              onClick={() => { setSuccess(false); setEmail(""); }}
              className="text-xs text-slate-500 hover:text-amber-400 mt-2"
            >
              ← subscribe a different email
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col md:flex-row gap-3 max-w-xl mx-auto">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              autoComplete="email"
              className="flex-1 bg-slate-900 border border-slate-700 text-white rounded-lg px-4 py-3 text-sm focus:border-amber-500 focus:outline-none placeholder:text-slate-500"
            />
            <button
              type="submit"
              disabled={submitting}
              className="bg-amber-500 hover:bg-amber-400 text-[#07111f] font-bold rounded-lg px-6 py-3 text-sm whitespace-nowrap transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? "Subscribing…" : "Subscribe →"}
            </button>
            {/* Honeypot. A person never sees it; a bot fills it and the row is silently dropped. */}
            <div style={HONEYPOT_WRAPPER_STYLE} aria-hidden="true">
              <label>
                Company website
                <input {...honeypotInputProps} type="text" value={honey} onChange={(e) => setHoney(e.target.value)} />
              </label>
            </div>
          </form>
        )}

        {error && !success && (
          <p className="text-sm text-red-400 mt-2">{error}</p>
        )}

        <p className="text-xs text-slate-500 mt-4">
          Joining 1,400+ {config.CITY_NAME} homeowners and buyers. Curated, never automated.
        </p>
      </div>
    </section>
  );
}
