"use client";

// The one-time card (MP-002 shape). Rendered inline by whichever surface a signed-in person
// first asks for VOW records on: the street island, /sold. Not a modal; it blocks the records,
// not the page.
//
// It asks three things and shows one: the person's name (the VOW policy wants a name with the
// email), the street they live on (the account opens on it; optional, because a buyer may not
// live in Milton yet), and one tick that covers the VOW acknowledgement text shown in full and
// the consent sentence under it. The server records the text, the time, the IP and the browser.
//
// The street field is the registry autocomplete (/api/autocomplete?type=street), so what is
// stored is a ResidentialStreet slug the server has checked, never free text.
//
// `onDone` lets a client island refetch; without it the card refreshes the server tree, which
// is what /sold needs.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VOW_ACKNOWLEDGEMENT_TEXT } from "@/lib/vow-acknowledgement";
import { PORTAL_CONSENT_TEXT } from "@/lib/portal/consent";

interface StreetHit {
  name: string;
  slug: string;
}

export default function VowAcknowledgementPrompt({ onDone }: { onDone?: () => void }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [streetQuery, setStreetQuery] = useState("");
  const [street, setStreet] = useState<StreetHit | null>(null);
  const [hits, setHits] = useState<StreetHit[]>([]);
  const [open, setOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    const q = streetQuery.trim();
    if (street && q === street.name) return;
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const seq = ++searchSeq.current;
    const t = setTimeout(() => {
      fetch(`/api/autocomplete?type=street&q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((rows: StreetHit[]) => {
          if (seq !== searchSeq.current) return;
          setHits(Array.isArray(rows) ? rows : []);
          setOpen(true);
        })
        .catch(() => {});
    }, 150);
    return () => clearTimeout(t);
  }, [streetQuery, street]);

  async function submit() {
    if (!agreed || submitting) return;
    if (!firstName.trim()) {
      setError("Tell us your name.");
      return;
    }
    if (streetQuery.trim() && !street) {
      setError("Pick your street from the list, or clear the field.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/acknowledge-vow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: firstName.trim(), homeStreetSlug: street?.slug ?? "", consent: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      if (onDone) onDone();
      else router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit right now.");
      setSubmitting(false);
    }
  }

  const field =
    "w-full border border-[#dfe0dc] rounded-lg px-3.5 py-2.5 text-[16px] sm:text-[14px] text-[#073126] bg-white outline-none focus:border-[#017848] transition-colors";

  return (
    <section
      data-vow-ack
      className="rounded-2xl border border-[#dfe0dc] bg-[#f6f4ef] p-5 sm:p-7 text-left text-[#073126]"
      style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
    >
      <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[#017848] mb-1.5">One-time acknowledgement</p>
      <h3 className="text-[20px] leading-tight font-medium mb-2" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>
        Sold prices are for registered consumers
      </h3>
      <p className="text-[13px] text-[#4b5563] leading-relaxed mb-4">
        Under TRREB&apos;s VOW rules, sold and leased MLS<sup>®</sup> records go to people with a bona fide interest in buying,
        selling or leasing. Tell us your name, your street if you have one in Milton, and agree once. You will not see this
        card again.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 mb-4">
        <label className="block">
          <span className="block text-[12px] font-bold mb-1">Your name</span>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            autoComplete="given-name"
            placeholder="First name"
            className={field}
            maxLength={80}
          />
        </label>
        <label className="block relative">
          <span className="block text-[12px] font-bold mb-1">Your street in Milton <span className="font-normal text-[#6b6f6a]">(optional)</span></span>
          <input
            type="text"
            value={streetQuery}
            onChange={(e) => {
              setStreetQuery(e.target.value);
              setStreet(null);
            }}
            onFocus={() => hits.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            autoComplete="off"
            placeholder="Start typing"
            className={field}
            role="combobox"
            aria-controls="vow-street-options"
            aria-expanded={open && hits.length > 0}
            aria-autocomplete="list"
          />
          {open && hits.length > 0 && !street && (
            <ul id="vow-street-options" className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#dfe0dc] rounded-lg shadow-md max-h-56 overflow-auto" role="listbox">
              {hits.map((h) => (
                <li key={h.slug} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="w-full text-left px-3.5 py-2.5 text-[14px] hover:bg-[#f6f4ef]"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setStreet(h);
                      setStreetQuery(h.name);
                      setOpen(false);
                    }}
                  >
                    {h.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>
      </div>

      <div className="bg-white border border-[#dfe0dc] rounded-xl p-4 mb-4">
        <p className="text-[12px] leading-relaxed">{VOW_ACKNOWLEDGEMENT_TEXT}</p>
        <p className="text-[12px] leading-relaxed text-[#4b5563] mt-3">{PORTAL_CONSENT_TEXT}</p>
      </div>

      <label className="flex items-start gap-3 mb-4 cursor-pointer">
        <input
          type="checkbox"
          className="mt-[3px] w-4 h-4 accent-[#017848]"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          aria-label="I agree to the acknowledgement and consent above"
        />
        <span className="text-[13px] font-medium">I agree to both statements above.</span>
      </label>

      {error && (
        <p className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!agreed || submitting}
        className="inline-flex items-center justify-center px-5 py-3 rounded-lg text-[13px] font-bold bg-[#017848] text-white hover:bg-[#0a8f57] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {submitting ? "Saving…" : "Agree and see sold prices"}
      </button>

      <p className="mt-4 text-[10px] text-[#6b6f6a] leading-relaxed">
        Source: TREB MLS<sup>®</sup> VOW. Your agreement is recorded with the text shown, a timestamp, your IP address and
        browser, as the VOW rules require. Registration records are kept for at least 180 days after a sign-in expires.
      </p>
    </section>
  );
}
