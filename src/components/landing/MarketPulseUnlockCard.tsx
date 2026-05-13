"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { attributionPayload } from "@/lib/attribution";
import { config } from "@/lib/config";
import { formatPriceFull } from "@/lib/format";

const REALTOR_FIRST_NAME = config.realtor.name.split(" ")[0];
const HONEYPOT_FIELD = "company_website";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SOURCE = "sales-ads-market-pulse-unlock";

// CASL consent — EXACT text shown above the checkbox. Snapshotted to the
// Lead row at submit time so the audit trail preserves what the user saw.
const CONSENT_TEXT =
  "I consent to receive the market-pulse report by email, a confirmation SMS, " +
  "and weekly Milton market updates from Aamir Yaqoob (RE/MAX Realty Specialists Inc., " +
  "Brokerage). I can withdraw consent anytime by replying STOP to any SMS or " +
  "clicking unsubscribe in any email.";

// 30-day window — matches src/lib/market-pulse.ts.
const PERIOD_DAYS = 30;

function formatPhone(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

type GtagFn = (...a: unknown[]) => void;
function getGtag(): GtagFn | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { gtag?: GtagFn };
  return w.gtag || null;
}

// Match the shape that /api/leads returns in `stats` for this intent.
export interface MarketPulseStatsPayload {
  sold_count: number;
  avg_sold_price: number | null;
  median_sold_price: number | null;
  avg_dom: number | null;
  avg_sold_to_ask: number | null;
  min_sold_price: number | null;
  max_sold_price: number | null;
  period_days: number;
  match_basis: string;
}

export interface MarketPulseUnlockCardProps {
  /** Listing context — passed to /api/leads as matchCriteria for the
   *  aggregate computation. */
  propertyType: string;
  bedrooms: number;
  city: string;
  /** MLS number of the originating listing — included in the lead row for
   *  attribution. */
  mlsNumber: string;
  /** Property-type label used in headlines (e.g. "townhouse"). */
  propertyTypeLabel: string;
  /** First-line street address of the originating listing — used in
   *  headline copy ("homes like 1265 Manitou Way"). */
  listingStreetAddr: string;
  className?: string;
}

export default function MarketPulseUnlockCard({
  propertyType,
  bedrooms,
  city,
  mlsNumber,
  propertyTypeLabel,
  listingStreetAddr,
  className = "",
}: MarketPulseUnlockCardProps) {
  const [stats, setStats] = useState<MarketPulseStatsPayload | null>(null);
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
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

  const headerKicker = `How ${propertyTypeLabel}s like ${listingStreetAddr} are actually selling`;
  const headerTitle = `${config.CITY_NAME} ${propertyTypeLabel} market — last ${PERIOD_DAYS} days`;

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

    const gtag = getGtag();
    if (gtag) {
      gtag("event", "generate_lead", {
        value: 2500,
        currency: "CAD",
        source: SOURCE,
        intent: "market-pulse-unlock",
        listing_mls: mlsNumber,
      });
    }

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: `Lead ${phoneDigits.slice(-4)}`,
          phone: phone.trim(),
          email: trimmedEmail,
          source: SOURCE,
          intent: "market-pulse-unlock",
          consent: true,
          consentText: CONSENT_TEXT,
          consentTimestamp: new Date().toISOString(),
          mlsNumber,
          matchCriteria: {
            propertyType,
            bedrooms,
            city,
            periodDays: PERIOD_DAYS,
          },
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
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string; stats?: MarketPulseStatsPayload | null };
      if (!res.ok) {
        setError(data?.error || `Could not unlock the report. Please call ${config.realtor.phone} directly.`);
        setSubmitting(false);
        return;
      }
      // Reveal stats from server response. If server returned no stats
      // (helper failure, env unset), still flip to "subscribed" state with
      // a fallback message — the lead is captured, just no on-page reveal.
      setStats(data?.stats ?? {
        sold_count: 0,
        avg_sold_price: null,
        median_sold_price: null,
        avg_dom: null,
        avg_sold_to_ask: null,
        min_sold_price: null,
        max_sold_price: null,
        period_days: PERIOD_DAYS,
        match_basis: "deferred",
      });
    } catch {
      setError(`Something went wrong. Please call ${REALTOR_FIRST_NAME} at ${config.realtor.phone}.`);
      setSubmitting(false);
    }
  }

  // ── Unlocked state ──
  if (stats !== null) {
    return (
      <div className={`bg-[#0a1628] border border-[#1e3a5f] rounded-[14px] p-[24px] ${className}`}>
        <div className="text-[10px] font-medium tracking-[1.4px] uppercase text-[#f59e0b] mb-[6px]">
          {headerKicker}
        </div>
        <h3 className="text-[18px] font-medium text-[#f8f9fb] leading-[1.3] tracking-tight mb-[18px]">
          {headerTitle}
        </h3>

        {stats.sold_count >= 5 ? (
          <>
            <div className="grid grid-cols-2 gap-[10px] mb-[10px]">
              <StatTile label="Average price" value={stats.avg_sold_price !== null ? formatPriceFull(Math.round(stats.avg_sold_price)) : "—"} />
              <StatTile label="Days on market" value={stats.avg_dom !== null ? String(Math.round(stats.avg_dom)) : "—"} />
              <StatTile label="Sold-to-ask" value={stats.avg_sold_to_ask !== null ? `${Math.round(stats.avg_sold_to_ask * 100)}%` : "—"} />
              <StatTile label="Sold count" value={String(stats.sold_count)} />
            </div>
            {stats.sold_count >= 10 && stats.min_sold_price !== null && stats.max_sold_price !== null && (
              <div className="grid grid-cols-2 gap-[10px]">
                <StatTile label="Range — low" value={formatPriceFull(Math.round(stats.min_sold_price))} />
                <StatTile label="Range — high" value={formatPriceFull(Math.round(stats.max_sold_price))} />
              </div>
            )}
            <p className="text-[12px] text-[#94a3b8] leading-relaxed mt-[14px]">
              Aamir&apos;s richer report — with specific examples — arrives when he calls you back.
            </p>
          </>
        ) : (
          <p className="text-[13px] text-[#cbd5e1] leading-relaxed">
            Thin slice of recent sales for this exact match. Aamir is preparing a personalized report — you&apos;ll have it in this inbox within 24 hours.
          </p>
        )}

        <div className="mt-[14px] text-[10px] text-[#64748b] tracking-[0.3px]">
          Based on {stats.match_basis === "deferred" ? "Aamir&apos;s manual lookup" : stats.match_basis.replace(/_/g, " · ")}
        </div>
      </div>
    );
  }

  // ── Locked state ──
  return (
    <div className={`bg-[#0a1628] border border-[#1e3a5f] rounded-[14px] p-[24px] ${className}`}>
      <div className="text-[10px] font-medium tracking-[1.4px] uppercase text-[#f59e0b] mb-[6px]">
        {headerKicker}
      </div>
      <h3 className="text-[18px] font-medium text-[#f8f9fb] leading-[1.3] tracking-tight mb-[14px]">
        {headerTitle}
      </h3>

      {/* Blurred preview grid — purely decorative, no real data */}
      <div className="relative mb-[14px]">
        <div className="grid grid-cols-2 gap-[10px] select-none" aria-hidden>
          <BlurredTile label="Average price" />
          <BlurredTile label="Days on market" />
          <BlurredTile label="Sold-to-ask" />
          <BlurredTile label="Sold count" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-[#07111f]/85 backdrop-blur-sm rounded-full w-12 h-12 flex items-center justify-center border border-[#f59e0b]/40">
            <Lock className="w-5 h-5 text-[#fbbf24]" aria-hidden />
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid sm:grid-cols-2 gap-2 mb-2">
          <input
            type="email"
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
            inputMode="tel"
            required
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="(647) 555-0123"
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
          <div className="text-[12px] text-red-300 bg-red-900/20 border border-red-700/40 rounded-[6px] px-2.5 py-1.5 mb-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[44px] bg-[#f59e0b] hover:bg-[#fbbf24] disabled:opacity-60 text-[#07111f] font-extrabold text-[14px] rounded-[8px] transition-colors"
        >
          {submitting ? "Unlocking…" : "Unlock the report"}
        </button>
        <p className="text-[10px] text-[#64748b] leading-relaxed mt-2">
          I&apos;ll email a market summary, send a confirmation SMS, and add you to my Monday market update. You can opt out anytime by replying STOP.{" "}
          <Link href="/privacy" className="underline hover:text-[#cbd5e1]" target="_blank">View privacy</Link>.
        </p>
      </form>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#07111f] border border-[#1e3a5f] rounded-[10px] p-[12px]">
      <div className="text-[10px] uppercase tracking-[0.5px] text-[#94a3b8] mb-[4px]">
        {label}
      </div>
      <div className="text-[18px] font-medium text-[#fbbf24]">
        {value}
      </div>
    </div>
  );
}

function BlurredTile({ label }: { label: string }) {
  return (
    <div className="bg-[#07111f] border border-[#1e3a5f] rounded-[10px] p-[12px]">
      <div className="text-[10px] uppercase tracking-[0.5px] text-[#94a3b8] mb-[4px]">
        {label}
      </div>
      <div className="text-[18px] font-medium text-[#fbbf24] blur-[6px] select-none">
        $XXX,XXX
      </div>
    </div>
  );
}
