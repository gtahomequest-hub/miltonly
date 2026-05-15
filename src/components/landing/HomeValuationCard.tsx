"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { attributionPayload } from "@/lib/attribution";
import { config } from "@/lib/config";

const REALTOR_FIRST_NAME = config.realtor.name.split(" ")[0];
const HONEYPOT_FIELD = "company_website";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_SOURCE = "sales-ads-home-valuation";

// CASL consent — EXACT text shown above the checkbox. Snapshotted to the
// Lead row at submit time for the audit trail.
const CONSENT_TEXT =
  "I consent to receive a written home valuation by email, a confirmation SMS, " +
  "and follow-up communication from Aamir Yaqoob (RE/MAX Realty Specialists Inc., " +
  "Brokerage). I can withdraw consent anytime by replying STOP or clicking " +
  "unsubscribe.";

// Auto-formatter — every keystroke calls this. Strips non-digits, drops a
// leading "1" country code, takes first 10 digits, formats with dashes.
// Identical to MarketPulseUnlockCard's formatter (Commit 4j-hotfix swap).
function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^1/, "").slice(0, 10);
  if (digits.length === 0) return "";
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

type GtagFn = (...a: unknown[]) => void;
function getGtag(): GtagFn | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { gtag?: GtagFn };
  return w.gtag || null;
}

export interface HomeValuationCardProps {
  /** MLS number of the originating listing — included in the lead row for
   *  attribution (visitor was viewing this listing when they submitted). */
  mlsNumber: string;
  /** Source tag sent to /api/leads + emitted as the GA4 generate_lead source.
   *  Defaults to "sales-ads-home-valuation" (the original sales-page surface).
   *  Pass a lease-tagged source from the rentals page. */
  source?: string;
  /** Eyebrow kicker above the title. Defaults to the sales-page copy. */
  kicker?: string;
  /** Card title. Defaults to "What's your current home worth?". */
  title?: string;
  /** Primary submit button label. Defaults to "Get my home's value". */
  ctaLabel?: string;
  /** Hint paragraph below the submit button. Defaults to the sales-page copy. */
  hint?: string;
  /** Visual theme. "dark" (default) matches the sales-page band. "light"
   *  swaps to a white surface with dark text for placement inside an aside
   *  that uses the white-card-with-shadow pattern. */
  theme?: "dark" | "light";
  /** GA4 generate_lead value (CAD). Defaults to 7500 — the sales-page
   *  move-up-seller economic value. Lease landlord surfaces should pass
   *  5000 per the Phase 1 attribution spec. */
  leadValue?: number;
  className?: string;
}

export default function HomeValuationCard({
  mlsNumber,
  source = DEFAULT_SOURCE,
  kicker = "Selling first? Aamir prepares a private valuation",
  title = "What's your current home worth?",
  ctaLabel = "Get my home's value",
  hint = "Aamir personally reviews comparable sales, recent listings, and current market conditions. You'll get a written valuation within 24 hours by email.",
  theme = "dark",
  leadValue = 7500,
  className = "",
}: HomeValuationCardProps) {
  const isLight = theme === "light";
  const [submitted, setSubmitted] = useState(false);
  const [yourHomeAddress, setYourHomeAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [honey, setHoney] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const searchParams = useSearchParams();
  const tracking = useMemo(
    () => ({
      utm_source: searchParams.get("utm_source") || "",
      utm_medium: searchParams.get("utm_medium") || "",
      utm_campaign: searchParams.get("utm_campaign") || "",
      utm_term: searchParams.get("utm_term") || "",
      utm_content: searchParams.get("utm_content") || "",
      gclid: searchParams.get("gclid") || "",
    }),
    [searchParams],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmedAddr = yourHomeAddress.trim();
    const trimmedEmail = email.trim();
    const phoneDigits = phone.replace(/\D/g, "");

    if (trimmedAddr.length < 4) {
      setError("Please enter the address of your current home.");
      return;
    }
    if (!trimmedEmail || !EMAIL_RE.test(trimmedEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (phoneDigits.length !== 10) {
      setError("Please enter a 10-digit phone number.");
      return;
    }
    if (!consent) {
      setError("Please tick the consent checkbox to continue.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: `Lead ${phoneDigits.slice(-4)}`,
          phone: phone.trim(),
          email: trimmedEmail,
          source,
          intent: "home-valuation",
          consent: true,
          consentText: CONSENT_TEXT,
          consentTimestamp: new Date().toISOString(),
          yourHomeAddress: trimmedAddr,
          notes: notes.trim() || undefined,
          mlsNumber,
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
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; id?: string };
      if (!res.ok) {
        setError(data?.error || `Could not submit. Please call ${config.realtor.phone} directly.`);
        setSubmitting(false);
        return;
      }

      // GA4 conversion event — fires only after res.ok (audit F1.4). Value
      // is configurable via `leadValue` prop: 7500 on sales (move-up
      // dual-transaction), 5000 on lease landlord surfaces.
      const gtag = getGtag();
      if (gtag) {
        gtag("event", "generate_lead", {
          transaction_id: typeof data?.id === "string" ? data.id : "",
          value: leadValue,
          currency: "CAD",
          source,
          intent: "home-valuation",
          listing_mls: mlsNumber,
        });
      }

      setSubmitted(true);
    } catch {
      setError(`Something went wrong. Please call ${REALTOR_FIRST_NAME} at ${config.realtor.phone}.`);
      setSubmitting(false);
    }
  }

  // Theme-aware class bundles. Default ("dark") matches the original
  // sales-band styling; "light" swaps surface + text colors so the card
  // reads correctly against a white aside.
  const surfaceClass = isLight
    ? "bg-white border border-[#e2e8f0] rounded-xl shadow-lg p-6"
    : "bg-[#0a1628] border border-[#1e3a5f] rounded-[14px] p-[24px]";
  const titleClass = isLight
    ? "text-[18px] font-medium text-[#07111f] leading-[1.3] tracking-tight mb-[14px]"
    : "text-[18px] font-medium text-[#f8f9fb] leading-[1.3] tracking-tight mb-[14px]";
  const inputClass = isLight
    ? "w-full h-11 px-3 rounded-[7px] border border-[#e2e8f0] bg-white text-[14px] text-[#07111f] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#f59e0b]"
    : "w-full h-11 px-3 rounded-[7px] border border-[#1e3a5f] bg-[#07111f] text-[14px] text-white placeholder:text-[#64748b] focus:outline-none focus:border-[#f59e0b]";
  const textareaClass = isLight
    ? "w-full px-3 py-2 rounded-[7px] border border-[#e2e8f0] bg-white text-[13px] text-[#07111f] placeholder:text-[#94a3b8] focus:outline-none focus:border-[#f59e0b] resize-none mb-2"
    : "w-full px-3 py-2 rounded-[7px] border border-[#1e3a5f] bg-[#07111f] text-[13px] text-white placeholder:text-[#64748b] focus:outline-none focus:border-[#f59e0b] resize-none mb-2";
  const consentTextClass = isLight ? "text-[11px] text-[#64748b] leading-[1.5]" : "text-[11px] text-[#94a3b8] leading-[1.5]";
  const hintTextClass = isLight ? "text-[10px] text-[#64748b] leading-relaxed mt-2" : "text-[10px] text-[#64748b] leading-relaxed mt-2";
  const errorClass = isLight
    ? "text-[12px] text-red-600 bg-red-50 border border-red-200 rounded-[6px] px-2.5 py-1.5 mb-2"
    : "text-[12px] text-red-300 bg-red-900/20 border border-red-700/40 rounded-[6px] px-2.5 py-1.5 mb-2";

  // ── Submitted state ──
  if (submitted) {
    return (
      <div className={`${surfaceClass} ${className}`}>
        <div className="bg-[#16a34a]/10 border border-[#16a34a]/40 rounded-[10px] p-[14px] flex items-start gap-2 mb-3">
          <Check className="w-4 h-4 text-[#16a34a] mt-0.5 shrink-0" aria-hidden />
          <div>
            <div className={`text-[14px] font-semibold leading-snug ${isLight ? "text-[#16a34a]" : "text-[#86efac]"}`}>
              Your request is in.
            </div>
            <div className={`text-[13px] mt-1 ${isLight ? "text-[#16a34a]/90" : "text-[#86efac]/80"}`}>
              {REALTOR_FIRST_NAME} will email your written report within 24 business hours.
            </div>
          </div>
        </div>
        <p className={`text-[12px] leading-relaxed ${isLight ? "text-[#64748b]" : "text-[#94a3b8]"}`}>
          For anything urgent before then, call or text{" "}
          <a href={`tel:${config.realtor.phoneE164}`} className={`font-semibold underline ${isLight ? "text-[#f59e0b]" : "text-[#fbbf24]"}`}>
            {config.realtor.phone}
          </a>.
        </p>
      </div>
    );
  }

  // ── Default form state ──
  return (
    <div className={`${surfaceClass} ${className}`}>
      <div className="text-[10px] font-medium tracking-[1.4px] uppercase text-[#f59e0b] mb-[6px]">
        {kicker}
      </div>
      <h3 className={titleClass}>
        {title}
      </h3>

      <form onSubmit={handleSubmit} noValidate>
        <input
          type="text"
          name="address"
          required
          value={yourHomeAddress}
          onChange={(e) => setYourHomeAddress(e.target.value)}
          placeholder="123 Your Street, Milton"
          autoComplete="street-address"
          aria-label="Address of your current home"
          className={`${inputClass} mb-2`}
        />
        <div className="grid sm:grid-cols-2 gap-2 mb-2">
          <input
            type="email"
            name="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            autoComplete="email"
            aria-label="Email"
            className={inputClass}
          />
          <input
            type="tel"
            name="phone"
            inputMode="numeric"
            pattern="[0-9]{3}-[0-9]{3}-[0-9]{4}"
            required
            value={phone}
            onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
            placeholder="647-839-9090"
            autoComplete="tel"
            aria-label="Mobile number"
            className={inputClass}
          />
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything else Aamir should know? (optional)"
          rows={2}
          aria-label="Notes for Aamir"
          className={textareaClass}
        />

        <label className="flex items-start gap-2 mb-3 cursor-pointer">
          <input
            type="checkbox"
            required
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className={`mt-0.5 h-4 w-4 rounded text-[#f59e0b] focus:ring-[#f59e0b] ${isLight ? "border-[#e2e8f0] bg-white" : "border-[#1e3a5f] bg-[#07111f]"}`}
          />
          <span className={consentTextClass}>
            {CONSENT_TEXT}
          </span>
        </label>

        {/* Honeypot */}
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
          <div className={errorClass}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[44px] bg-[#f59e0b] hover:bg-[#fbbf24] disabled:opacity-60 text-[#07111f] font-extrabold text-[14px] rounded-[8px] transition-colors"
        >
          {submitting ? "Sending…" : ctaLabel}
        </button>
        <p className={hintTextClass}>
          {hint}{" "}
          <Link href="/privacy" className={`underline ${isLight ? "hover:text-[#07111f]" : "hover:text-[#cbd5e1]"}`} target="_blank">View privacy</Link>.
        </p>
      </form>
    </div>
  );
}
