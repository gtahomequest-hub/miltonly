"use client";

// Inline acknowledgement prompt (not a modal — don't block signin or nav,
// only block the VOW data itself). Rendered by VowGate when the user is
// signed in but has not yet acknowledged. Submits to the server, then
// reloads so the server-rendered page reflects the new state.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { VOW_ACKNOWLEDGEMENT_TEXT } from "@/lib/vow-acknowledgement";

export default function VowAcknowledgementPrompt() {
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit() {
    if (!agreed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/acknowledge-vow", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      // Server state is now updated — refresh so the RSC tree re-renders
      // with the full VOW children.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit right now.");
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2a5 5 0 0 0-5 5v3H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-2V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Z" fill="#0a1628"/>
        </svg>
        <h3 className="text-[14px] font-bold text-[#07111f] uppercase tracking-wide">
          One-time acknowledgement
        </h3>
      </div>

      <p className="text-[13px] text-[#475569] leading-relaxed mb-4">
        Under TREB VOW rules, consumers viewing sold and leased MLS<sup>®</sup> data
        must confirm a bona fide interest and a limited broker-consumer relationship.
        This is a one-time step — you won&apos;t see it again after you agree.
      </p>

      <div className="bg-[#f8f9fb] border border-[#e2e8f0] rounded-xl p-5 mb-5">
        <p className="text-[12px] text-[#07111f] leading-relaxed">
          {VOW_ACKNOWLEDGEMENT_TEXT}
        </p>
      </div>

      <label className="flex items-start gap-3 mb-5 cursor-pointer">
        <input
          type="checkbox"
          className="mt-[3px] w-4 h-4 accent-[#2563eb]"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          aria-label="I confirm the acknowledgement above"
        />
        <span className="text-[13px] text-[#07111f] font-medium">
          I agree to the terms above.
        </span>
      </label>

      {error && (
        <p className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!agreed || submitting}
        className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-[13px] font-bold bg-[#0a1628] text-white hover:bg-[#1e3a5f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? "Saving…" : "Agree and see sold data"}
      </button>

      <p className="mt-4 text-[10px] text-[#94a3b8]">
        Source: TREB MLS<sup>®</sup> VOW. Your agreement is recorded with a timestamp,
        IP address, and browser for audit purposes.
      </p>
    </section>
  );
}
