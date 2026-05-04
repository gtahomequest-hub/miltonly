"use client";

import { useState } from "react";
import { attributionPayload } from "@/lib/attribution";
import { config } from "@/lib/config";

export default function PreFooterCTA() {
  const [email, setEmail] = useState("");
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
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: "Newsletter Subscriber",
          lastName: "",
          email,
          phone: "",
          source: "homepage-newsletter",
          notes: "Pre-footer newsletter signup",
          ...attributionPayload(),
        }),
      });
      if (!res.ok) throw new Error();
      setSuccess(true);
    } catch {
      setError(`Couldn't subscribe — please try again or text Aamir at ${config.realtor.phone}`);
    } finally {
      setSubmitting(false);
    }
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
