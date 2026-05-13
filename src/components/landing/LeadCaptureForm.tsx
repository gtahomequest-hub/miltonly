"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { attributionPayload } from "@/lib/attribution";
import { config } from "@/lib/config";

const REALTOR_FIRST_NAME = config.realtor.name.split(" ")[0];
const BROKERAGE_SHORT_NAME = config.brokerage.name.replace(", Brokerage", "");

// Honeypot field name — must match HONEYPOT_FIELD env on /api/leads.
const HONEYPOT_FIELD = "company_website";

// Budget brackets. Numeric `val` matches /api/leads budgetToInt() parsing
// → priceRangeMax. $4,500+ uses 6000 as the upper-cap proxy so Aamir's
// qualification has a meaningful number, not "any".
const BUDGET_OPTIONS = [
  { val: "2500", label: "Under $2,500" },
  { val: "3500", label: "$2,500 – $3,500" },
  { val: "4500", label: "$3,500 – $4,500" },
  { val: "6000", label: "$4,500+" },
];

// Email regex — same shape as /api/leads server-side check. Belt-and-suspenders
// validation: client catches typos, server still validates on POST.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Format-as-you-type North American 10-digit phone mask. Matches OffMarketForm.
function formatPhone(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export interface LeadCaptureFormProps {
  /** The `source` field sent to /api/leads. Required. Lets parent pages tag the lead provenance. */
  source: string;
  /** The `homeType` field sent to /api/leads. Defaults to "any". */
  homeType?: string;
  /** Optional callback fired after successful submission, BEFORE the router.push to thank-you. */
  onSuccess?: (data: { id?: string; redirect?: string }) => void;
  /** Optional className for outer form wrapper, defaults to "" — lets pages style positioning. */
  className?: string;
  /** Optional headline override. Defaults to "Get matched in 60 seconds". */
  headline?: string;
  /** Optional subheadline override. Defaults to the existing rental subhead. */
  subheadline?: string;
  /** Optional CTA button label. Defaults to "Text me my matches". */
  ctaLabel?: string;
}

export default function LeadCaptureForm({
  source,
  homeType = "any",
  onSuccess,
  className = "",
  headline = "Get matched in 60 seconds",
  subheadline,
  ctaLabel = "Text me my matches",
}: LeadCaptureFormProps) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Form state — phone + email + budget. firstName is auto-filled per submit
  // as `Lead ${phoneLast4}` so the existing /api/leads ads-path validation
  // (>=2 chars) passes AND each row in the DB is identifiable when scrolling
  // through recent leads without exposing a name field in the form.
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [budget, setBudget] = useState<string>("");
  const [honey, setHoney] = useState(""); // honeypot — must stay empty
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Tracking state — captured from URL + persistent attributionPayload().
  const [tracking, setTracking] = useState({
    utm_source: "", utm_medium: "", utm_campaign: "", utm_term: "", utm_content: "", gclid: "",
  });
  useEffect(() => {
    setTracking({
      utm_source: searchParams.get("utm_source") || "",
      utm_medium: searchParams.get("utm_medium") || "",
      utm_campaign: searchParams.get("utm_campaign") || "",
      utm_term: searchParams.get("utm_term") || "",
      utm_content: searchParams.get("utm_content") || "",
      gclid: searchParams.get("gclid") || "",
    });
  }, [searchParams]);

  const resolvedSubheadline =
    subheadline ??
    `Phone + email + budget. ${REALTOR_FIRST_NAME} texts 3–5 matches within the hour.`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const phoneDigits = phone.replace(/\D/g, "");
    const trimmedEmail = email.trim();

    if (phoneDigits.length !== 10) {
      setError("Please enter a 10-digit phone number.");
      return;
    }
    if (!trimmedEmail || !EMAIL_RE.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!budget) {
      setError("Please select your budget.");
      return;
    }

    setSubmitting(true);

    if (typeof window !== "undefined") {
      const w = window as unknown as { gtag?: (...a: unknown[]) => void };
      if (w.gtag) w.gtag("event", "form_submit", { source: "rentals/ads", form: "3-field" });
    }

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Placeholder firstName — `Lead 0199` shape makes leads scannable
          // in the DB. Real name comes from Aamir's follow-up call.
          firstName: `Lead ${phoneDigits.slice(-4)}`,
          phone: phone.trim(),
          email: trimmedEmail,
          source,
          intent: "renter",
          budget,
          homeType,
          utm_source: tracking.utm_source,
          utm_medium: tracking.utm_medium,
          utm_campaign: tracking.utm_campaign,
          utm_term: tracking.utm_term,
          utm_content: tracking.utm_content,
          gclid: tracking.gclid,
          ...attributionPayload(),
          [HONEYPOT_FIELD]: honey,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || `Couldn't submit — please try again or call ${config.realtor.phone}.`);
        setSubmitting(false);
        return;
      }
      const redirect = data?.redirect || `/rentals/thank-you?lid=${data?.id || ""}`;
      if (onSuccess) onSuccess({ id: data?.id, redirect });
      router.push(redirect);
    } catch {
      setError(`Something went wrong. Please call ${REALTOR_FIRST_NAME} directly at ${config.realtor.phone}.`);
      setSubmitting(false);
    }
  }

  return (
    <div id="lead-form" className={className}>
      <form
        onSubmit={handleSubmit}
        method="post"
        action="/api/leads"
        className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 text-[#07111f]"
        noValidate
      >
        <h2 className="text-[18px] sm:text-[22px] font-extrabold leading-tight text-[#07111f] mb-1.5">
          {headline}
        </h2>
        <p className="text-[12px] sm:text-[13px] text-[#64748b] mb-3 sm:mb-4">
          {resolvedSubheadline}
        </p>

        {/* Phone + Email — side-by-side on desktop (sm+), stacked on mobile */}
        <div className="grid sm:grid-cols-2 gap-2 sm:gap-3 mb-3">
          <div>
            <label htmlFor="lead-phone" className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1">
              Mobile number
            </label>
            <input
              id="lead-phone"
              type="tel"
              inputMode="tel"
              required
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="(647) 555-0123"
              autoComplete="tel"
              className="w-full h-12 px-4 rounded-lg border border-[#e2e8f0] bg-white text-[16px] focus:outline-none focus:border-[#f59e0b] focus:ring-2 focus:ring-[#f59e0b]/20"
            />
          </div>
          <div>
            <label htmlFor="lead-email" className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1">
              Email
            </label>
            <input
              id="lead-email"
              type="email"
              inputMode="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              autoComplete="email"
              className="w-full h-12 px-4 rounded-lg border border-[#e2e8f0] bg-white text-[16px] focus:outline-none focus:border-[#f59e0b] focus:ring-2 focus:ring-[#f59e0b]/20"
            />
          </div>
        </div>

        {/* Budget — 2x2 button grid */}
        <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1">
          Monthly budget
        </label>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {BUDGET_OPTIONS.map((o) => (
            <button
              key={o.val}
              type="button"
              onClick={() => setBudget(o.val)}
              className={`h-12 rounded-lg text-[13px] sm:text-[14px] font-semibold border transition-all ${
                budget === o.val
                  ? "bg-[#07111f] text-white border-[#07111f]"
                  : "bg-white text-[#374151] border-[#e2e8f0] hover:border-[#94a3b8]"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {/* Honeypot — silent spam trap */}
        <div style={{ position: "absolute", left: "-10000px", top: "-10000px" }} aria-hidden="true">
          <label>
            Company website
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              name={HONEYPOT_FIELD}
              value={honey}
              onChange={(e) => setHoney(e.target.value)}
            />
          </label>
        </div>

        {error && (
          <div className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[52px] bg-[#f59e0b] hover:bg-[#fbbf24] disabled:opacity-60 disabled:cursor-not-allowed text-[#07111f] font-extrabold text-[15px] sm:text-[16px] rounded-xl transition-all shadow-lg shadow-[#f59e0b]/20 hover:shadow-xl active:scale-[0.99]"
        >
          {submitting ? "Sending…" : ctaLabel}
        </button>
        <p className="text-[11px] text-[#64748b] text-center mt-2.5 leading-relaxed">
          🔒 No spam. No fees. By submitting, I consent to receive SMS and email from {config.realtor.name}, {BROKERAGE_SHORT_NAME}. Reply STOP to opt out.{" "}
          <Link href="/privacy" className="underline hover:text-[#07111f]" target="_blank">Privacy</Link>.
        </p>
      </form>
    </div>
  );
}
