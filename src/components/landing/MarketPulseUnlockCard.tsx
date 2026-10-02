"use client";

import { useState } from "react";
import Link from "next/link";
import { postLeadDetailed, honeypotInputProps } from "@/lib/postLeadClient";
import { config } from "@/lib/config";
import { cleanNeighbourhoodName } from "@/lib/format";

// MC-046 STAGE 1 (R15). This card used to "unlock" a stats packet the lead response carried:
// the neighbourhood's 90-day sold count, days on market, sold-to-ask and market score, all DB3
// aggregates of VOW records, shown to an anonymous submitter. The response carries no market
// figure any more, so the card shows none: it takes the request, and the confirmation says the
// report comes from Aamir. No stat tile, locked or unlocked, is drawn.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCE = "sales-ads-market-pulse-unlock";

// CASL consent — EXACT text shown above the checkbox. Snapshotted to the
// Lead row at submit time so the audit trail preserves what the user saw.
const CONSENT_TEXT =
  "I consent to receive the market-pulse report by email, a confirmation SMS, " +
  "and weekly Milton market updates from Aamir Yaqoob (RE/MAX Realty Specialists Inc., " +
  "Brokerage). I can withdraw consent anytime by replying STOP to any SMS or " +
  "clicking unsubscribe in any email.";

// The window the requested report covers, kept in matchCriteria for the lead audit trail.
const PERIOD_DAYS = 90;

// Auto-formatter — every keystroke calls this. Strips non-digits, drops a
// leading "1" country code, takes first 10 digits, formats with dashes.
// Switched from parens/spaces to dashes in Commit 4j-hotfix to align with
// LeadCaptureForm's pattern + the spec's defensive sweep on the broken
// phone input.
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

export interface MarketPulseUnlockCardProps {
  /** Property type slug — kept on the input for matchCriteria persistence
   *  + future per-type stat rollout. Not used in current copy. */
  propertyType: string;
  /** Neighbourhood string — keyed exactly as it appears in the analytics
   *  table. Header copy + matchCriteria both use it. */
  neighbourhood: string;
  /** City string — included in matchCriteria for the lead audit trail. */
  city: string;
  /** MLS number of the originating listing — included in the lead row for
   *  attribution. */
  mlsNumber: string;
  className?: string;
}

export default function MarketPulseUnlockCard({
  propertyType,
  neighbourhood,
  city,
  mlsNumber,
  className = "",
}: MarketPulseUnlockCardProps) {
  const [sent, setSent] = useState(false);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [honey, setHoney] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // THE PER-SURFACE UTM READ IS GONE. src/components/AttributionCapture.tsx runs in the root
  // layout and persists first-touch and last-touch for the whole session; the client helper
  // sends both. A form reading the current URL only ever saw the last landing page.

  // The `neighbourhood` prop is the RAW TREB string (e.g. "1032 - FO Ford")
  // because the analytics table is keyed on that exact value. The display
  // string strips the prefix for readable headers ("Ford market pulse").
  const neighbourhoodDisplay = cleanNeighbourhoodName(neighbourhood) || neighbourhood;
  const headerKicker = "Market report";
  const headerTitle = `${neighbourhoodDisplay} market report, by email`;

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
    if (!consent) {
      setError("Please tick the consent checkbox to continue.");
      return;
    }

    setSubmitting(true);

    {
      const result = await postLeadDetailed({
        source: SOURCE,
        intent: "buy",
        name: `Lead ${phoneDigits.slice(-4)}`,
        phone: phone.trim(),
        email: trimmedEmail,
        consent: true,
        consentText: CONSENT_TEXT,
        consentTimestamp: new Date().toISOString(),
        mlsNumber,
        matchCriteria: {
          propertyType,
          neighbourhood,
          city,
          periodDays: PERIOD_DAYS,
        },
        honeypot: honey,
      });
      if (!result.ok) {
        setError(result.error || `Could not send the request. Please call ${config.realtor.phone} directly.`);
        setSubmitting(false);
        return;
      }
      // GA4 conversion event, fired AFTER res.ok so failed POSTs never count
      // as conversions (audit F1.4). transaction_id = lead.id for GA4 dedup safety.
      const gtag = getGtag();
      if (gtag) {
        gtag("event", "generate_lead", {
          transaction_id: result.leadId ?? "",
          value: 2500,
          currency: "CAD",
          source: SOURCE,
          intent: "market-pulse-unlock",
          listing_mls: mlsNumber,
        });
      }

      setSent(true);
    }
  }

  // ── Sent state: a confirmation, no figure ──
  if (sent) {
    return (
      <div className={`bg-[#0a1628] border border-[#1e3a5f] rounded-[14px] p-[24px] ${className}`}>
        <div className="text-[10px] font-medium tracking-[1.4px] uppercase text-[#f59e0b] mb-[6px]">
          {headerKicker}
        </div>
        <h3 className="text-[18px] font-medium text-[#f8f9fb] leading-[1.3] tracking-tight mb-[10px]">
          Request received
        </h3>
        <p className="text-[13px] text-[#cbd5e1] leading-relaxed">
          {config.realtor.name.split(" ")[0]} is preparing your {neighbourhoodDisplay} report. You&apos;ll have it in this inbox within 24 hours.
        </p>
      </div>
    );
  }

  // ── Locked state ──
  return (
    <div className={`bg-[#0a1628] border border-[#1e3a5f] rounded-[14px] p-[24px] ${className}`}>
      <div className="text-[10px] font-medium tracking-[1.4px] uppercase text-[#f59e0b] mb-[6px]">
        {headerKicker}
      </div>
      <h3 className="text-[18px] font-medium text-[#f8f9fb] leading-[1.3] tracking-tight mb-[6px]">
        {headerTitle}
      </h3>
      <p className="text-[12px] text-[#94a3b8] leading-[1.5] mb-[14px]">
        A personalized report on this part of {config.CITY_NAME}, prepared by {config.realtor.name.split(" ")[0]} and sent to your inbox.
      </p>

      <form onSubmit={handleSubmit} noValidate>
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
            className="w-full h-11 px-3 rounded-[7px] border border-[#1e3a5f] bg-[#07111f] text-[14px] text-white placeholder:text-[#64748b] focus:outline-none focus:border-[#f59e0b]"
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
            className="w-full h-11 px-3 rounded-[7px] border border-[#1e3a5f] bg-[#07111f] text-[14px] text-white placeholder:text-[#64748b] focus:outline-none focus:border-[#f59e0b]"
          />
        </div>

        {/* CASL consent — full disclosure text above the checkbox */}
        <label className="flex items-start gap-2 mb-3 cursor-pointer">
          <input
            type="checkbox"
            required
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[#1e3a5f] bg-[#07111f] text-[#f59e0b] focus:ring-[#f59e0b]"
          />
          <span className="text-[11px] text-[#94a3b8] leading-[1.5]">
            {CONSENT_TEXT}
          </span>
        </label>

        {/* Honeypot */}
        <div style={{ position: "absolute", left: "-10000px", top: "-10000px" }} aria-hidden="true">
          <label>
            Company website
            <input
              {...honeypotInputProps}
              type="text"
              value={honey}
              onChange={(e) => setHoney(e.target.value)}
            />
          </label>
        </div>

        {error && (
          <div className="text-[12px] text-red-300 bg-red-900/20 border border-red-700/40 rounded-[6px] px-2.5 py-1.5 mb-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[44px] bg-[#f59e0b] hover:bg-[#fbbf24] disabled:opacity-60 text-[#07111f] font-extrabold text-[14px] rounded-[8px] transition-colors"
        >
          {submitting ? "Sending…" : "Email me the report"}
        </button>
        <p className="text-[10px] text-[#64748b] leading-relaxed mt-2">
          I&apos;ll email a market summary, send a confirmation SMS, and add you to my Monday market update. You can opt out anytime by replying STOP.{" "}
          <Link href="/privacy" className="underline hover:text-[#cbd5e1]" target="_blank">View privacy</Link>.
        </p>
      </form>
    </div>
  );
}
