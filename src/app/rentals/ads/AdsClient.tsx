"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { formatPriceFull, daysAgo } from "@/lib/format";
import TrustStrip from "./TrustStrip";
import SpeedToLeadBadge from "./SpeedToLeadBadge";
import ComparisonTable from "./ComparisonTable";

interface Listing {
  mlsNumber: string;
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  propertyType: string;
  photos: string[];
  listedAt: string;
  neighbourhood: string;
  possessionDetails: string | null;
}

interface Props {
  listings: Listing[];
  totalRentals: number;
  newThisWeek: number;
  renterCount: number;
  updatedMinAgo: number | null;
  initialType: string;
  initialBeds: number;
  initialMax: number;
  heroSrc: string;
}

const HOME_TYPE_OPTIONS = [
  { val: "any", label: "Any" },
  { val: "condo", label: "Condo" },
  { val: "townhouse", label: "Townhouse" },
  { val: "semi", label: "Semi" },
  { val: "detached", label: "Detached" },
];

const BED_OPTIONS = [
  { val: "any", label: "Any" },
  { val: "studio", label: "Studio" },
  { val: "1", label: "1" },
  { val: "2", label: "2" },
  { val: "3", label: "3" },
  { val: "4+", label: "4+" },
];

const BUDGET_OPTIONS = [
  { val: "0", label: "Any" },
  { val: "2000", label: "Under $2K" },
  { val: "2500", label: "Under $2.5K" },
  { val: "3000", label: "Under $3K" },
  { val: "3500", label: "Under $3.5K" },
];

const MOVE_IN_OPTIONS = [
  { val: "asap", label: "ASAP" },
  { val: "1month", label: "Within 1 month" },
  { val: "flexible", label: "Flexible" },
];

const HONEYPOT_FIELD = "company_website"; // matches HONEYPOT_FIELD env on server

const TYPE_LABEL: Record<string, string> = {
  condo: "Condo",
  townhouse: "Townhouse",
  semi: "Semi-Detached",
  detached: "Detached",
};

// Returns null when no URL params (fall back to static spec headline + amber clause).
// Returns dynamic SKAG-friendly H1 when any of type/beds/max are set.
function buildDynamicHeadline(type: string, beds: number, max: number): string | null {
  if (!type && !beds && !max) return null;
  const parts: string[] = [];
  if (beds > 0) parts.push(beds >= 4 ? "4+ Bedroom" : `${beds}-Bedroom`);
  if (type && TYPE_LABEL[type]) parts.push(TYPE_LABEL[type]);
  parts.push("Rentals");
  let h1 = `Milton ${parts.join(" ")}`;
  if (max > 0 && max < 5000) h1 += ` Under $${(max / 1000).toFixed(1).replace(".0", "")}K`;
  return h1;
}

const HERO_SUB =
  "Live TREB listings, hand-matched by Aamir Yaqoob — RE/MAX Hall of Fame, 14 years in Milton. No bots. No call centres. No spam.";

function AdsClientInner({
  listings,
  totalRentals,
  newThisWeek,
  renterCount,
  updatedMinAgo,
  initialType,
  initialBeds,
  initialMax,
  heroSrc,
}: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Form state — Step 1 chips, Step 2 contact. Defaults pre-fill from URL params
  // when present so deep-linked campaigns (e.g. /rentals/ads?type=condo&beds=2) land
  // on Step 1 with the correct chips already selected.
  const [step, setStep] = useState<1 | 2>(1);
  const [homeType, setHomeType] = useState<string>(initialType || "any");
  const [bedrooms, setBedrooms] = useState<string>(
    initialBeds >= 4 ? "4+" : initialBeds > 0 ? String(initialBeds) : "any"
  );
  const [budget, setBudget] = useState<string>(initialMax > 0 ? String(initialMax) : "0");
  const [moveIn, setMoveIn] = useState<string>("asap");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [honey, setHoney] = useState(""); // honeypot — must stay empty
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Tracking state — must live at parent so it survives the Step 1 → Step 2 transition.
  // Storing inside a Step 2 sub-component would lose URL params on every advance.
  const [tracking, setTracking] = useState({
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    utm_term: "",
    utm_content: "",
    gclid: "",
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

  // Hybrid H1 — dynamic when URL params drive a SKAG-friendly headline; static
  // (with amber " — Before Someone Else Does." suffix) otherwise.
  const dynamicHeadline = useMemo(
    () => buildDynamicHeadline(initialType, initialBeds, initialMax),
    [initialType, initialBeds, initialMax]
  );
  const headline = dynamicHeadline || "Find Your Milton Rental";
  const headlineSuffix = dynamicHeadline ? null : " — Before Someone Else Does.";

  // Live listings filter — applied client-side over the 60-row pool.
  const filteredListings = useMemo(() => {
    return listings.filter((l) => {
      if (homeType !== "any" && l.propertyType !== homeType) return false;
      if (bedrooms === "studio" && l.bedrooms !== 0) return false;
      if (bedrooms === "4+" && l.bedrooms < 4) return false;
      if (bedrooms === "1" && l.bedrooms !== 1) return false;
      if (bedrooms === "2" && l.bedrooms !== 2) return false;
      if (bedrooms === "3" && l.bedrooms !== 3) return false;
      if (budget !== "0") {
        const cap = parseInt(budget, 10);
        if (Number.isFinite(cap) && cap > 0 && l.price > cap) return false;
      }
      return true;
    });
  }, [listings, homeType, bedrooms, budget]);

  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = ""; };
  }, []);

  function advanceToStep2() {
    setStep(2);
    if (typeof window !== "undefined") {
      const w = window as unknown as { gtag?: (...a: unknown[]) => void };
      if (w.gtag) w.gtag("event", "form_step_2_view", { step: 2, source: "rentals/ads" });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const phoneDigits = phone.replace(/\D/g, "");

    if (trimmedName.length < 2) { setError("Please enter your first name."); return; }
    if (phoneDigits.length < 10 && !trimmedEmail) {
      setError("Please enter a phone number or email so Aamir can reach you.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: trimmedName,
          phone: phone.trim(),
          email: trimmedEmail,
          source: "ads-rentals-lp",
          intent: "renter",
          bedrooms,
          budget,
          moveIn,
          homeType,
          utm_source: tracking.utm_source,
          utm_medium: tracking.utm_medium,
          utm_campaign: tracking.utm_campaign,
          utm_term: tracking.utm_term,
          utm_content: tracking.utm_content,
          gclid: tracking.gclid,
          [HONEYPOT_FIELD]: honey,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || "Couldn't submit — please try again or call (647) 839-9090.");
        setSubmitting(false);
        return;
      }

      const redirect = data?.redirect || `/rentals/thank-you?lid=${data?.id || ""}`;
      router.push(redirect);
      // stay submitting=true until navigation completes
    } catch {
      setError("Something went wrong. Please call Aamir directly at (647) 839-9090.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#07111f] text-[#f8f9fb] font-sans">
      {/* ══ TRUST STRIP — top-of-page social proof ══ */}
      <TrustStrip />

      {/* ══ SLIM HEADER — no distractions ══ */}
      <header className="sticky top-0 z-50 bg-[#07111f]/95 backdrop-blur border-b border-[#1e3a5f]">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-[58px] px-4 sm:px-6">
          <Link href="/" className="shrink-0">
            <span className="text-[20px] font-extrabold tracking-[-0.5px]">
              <span className="text-[#f8f9fb]">miltonly</span>
              <span className="text-[#f59e0b]">.</span>
            </span>
          </Link>
          <a
            href="tel:+16478399090"
            className="flex items-center gap-2 bg-[#f59e0b] text-[#07111f] text-[13px] sm:text-[14px] font-bold px-4 py-2 rounded-lg hover:bg-[#fbbf24] transition-colors"
          >
            <span aria-hidden>📞</span>
            <span className="hidden sm:inline">Call Aamir</span>
            <span>(647) 839-9090</span>
          </a>
        </div>
      </header>

      {/* ══ HERO ══ */}
      <section className="relative overflow-hidden">
        {/* Background — brand photo with navy overlay */}
        <div className="absolute inset-0">
          <Image
            src={heroSrc}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          {/* Navy brand overlay — lighter so photo shows through; stronger on the left for text legibility.
              Neighbourhood photo gets an even lighter wash so the outdoor scene reads clearly. */}
          <div
            className="absolute inset-0"
            style={{
              background: heroSrc.includes("neighbourhood")
                ? "linear-gradient(100deg, rgba(7,17,31,0.68) 0%, rgba(7,17,31,0.35) 45%, rgba(7,17,31,0.10) 100%)"
                : "linear-gradient(100deg, rgba(7,17,31,0.78) 0%, rgba(7,17,31,0.55) 45%, rgba(7,17,31,0.30) 100%)",
            }}
            aria-hidden
          />
          {/* Bottom fade into page bg */}
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#07111f]" aria-hidden />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-12 sm:pt-14 sm:pb-16 lg:pt-20 lg:pb-24">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-14 items-start">
            {/* LEFT — copy */}
            <div>
              {/* Live badge */}
              <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/25 rounded-full px-3 py-1.5 mb-5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="text-[11px] font-bold tracking-wider text-green-300 uppercase">
                  {totalRentals} active · {newThisWeek} new this week
                </span>
              </div>

              <h1 className="text-[34px] sm:text-[44px] lg:text-[54px] font-extrabold leading-[1.04] tracking-[-0.02em] mb-4">
                <span className="text-[#f8f9fb]">{headline}</span>
                {headlineSuffix && (
                  <span className="text-[#f59e0b]">{headlineSuffix}</span>
                )}
              </h1>
              <p className="text-[15px] sm:text-[17px] text-[#cbd5e1] leading-relaxed max-w-xl mb-6">
                {HERO_SUB}
              </p>

              {/* Speed-to-lead guarantee */}
              <SpeedToLeadBadge />

              {/* Credentials strip */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-7 text-[12px] sm:text-[13px]">
                <span className="flex items-center gap-1.5 text-[#fbbf24] font-semibold">
                  <span aria-hidden>🏆</span> RE/MAX Hall of Fame
                </span>
                <span className="text-[#64748b]">·</span>
                <span className="text-[#cbd5e1] font-semibold">14 yrs full-time</span>
                <span className="text-[#64748b]">·</span>
                <span className="text-[#cbd5e1] font-semibold">Milton specialist</span>
              </div>

              {/* Why bullets */}
              <ul className="space-y-3 mb-2">
                <li className="flex items-start gap-3">
                  <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-[#f59e0b]/15 border border-[#f59e0b]/30 flex items-center justify-center text-[#fbbf24] text-[11px] font-bold">✓</span>
                  <span className="text-[14px] text-[#e2e8f0]">Every Milton rental — live from TREB, updated daily</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-[#f59e0b]/15 border border-[#f59e0b]/30 flex items-center justify-center text-[#fbbf24] text-[11px] font-bold">✓</span>
                  <span className="text-[14px] text-[#e2e8f0]">Same-day showings when the property allows</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-[#f59e0b]/15 border border-[#f59e0b]/30 flex items-center justify-center text-[#fbbf24] text-[11px] font-bold">✓</span>
                  <span className="text-[14px] text-[#e2e8f0]">You talk to Aamir directly — no juniors, no handoffs</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full bg-[#f59e0b]/15 border border-[#f59e0b]/30 flex items-center justify-center text-[#fbbf24] text-[11px] font-bold">✓</span>
                  <span className="text-[14px] text-[#e2e8f0]">Lease negotiation included — at no cost to you</span>
                </li>
              </ul>
            </div>

            {/* RIGHT — LEAD FORM (2-step, success → /rentals/thank-you) */}
            <div id="lead-form" className="lg:sticky lg:top-[80px]">
              <form
                onSubmit={handleSubmit}
                className="bg-white rounded-2xl shadow-2xl p-5 sm:p-7 text-[#07111f]"
                noValidate
              >
                {/* Progress header */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold tracking-wider text-[#f59e0b] uppercase">
                    Step {step} of 2 · 30 seconds
                  </span>
                  <div className="flex items-center gap-1" aria-hidden>
                    <span className={`w-2 h-2 rounded-full ${step >= 1 ? "bg-[#f59e0b]" : "bg-[#e2e8f0]"}`} />
                    <span className={`w-6 h-[2px] ${step === 2 ? "bg-[#f59e0b]" : "bg-[#e2e8f0]"}`} />
                    <span className={`w-2 h-2 rounded-full ${step === 2 ? "bg-[#f59e0b]" : "bg-[#e2e8f0]"}`} />
                  </div>
                </div>
                <h2 className="text-[22px] sm:text-[24px] font-extrabold leading-tight text-[#07111f]">
                  {step === 1 ? "Don't lose your top pick to someone faster." : "Where should Aamir send your matches?"}
                </h2>
                <p className="text-[13px] text-[#64748b] mt-1 mb-3">
                  {step === 1
                    ? "Get matched in 30 seconds. Aamir replies within 60 min."
                    : "3–5 hand-picked Milton rentals texted to you within the hour."}
                </p>

                {step === 1 && (
                  <>
                    {/* Urgency counter */}
                    <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-green-500/10 border border-green-500/25 rounded-lg">
                      <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                      </span>
                      <p className="text-[12px] font-semibold text-[#065f46]">
                        <span className="font-bold">{renterCount}</span> Milton renters got matched this week
                      </p>
                    </div>

                    {/* Home type pills */}
                    <div className="mb-3">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5">Home type</label>
                      <div className="flex flex-wrap gap-1.5">
                        {HOME_TYPE_OPTIONS.map((o) => (
                          <button
                            key={o.val}
                            type="button"
                            onClick={() => setHomeType(o.val)}
                            className={`px-3 py-2 rounded-lg text-[13px] font-semibold border transition-all ${
                              homeType === o.val
                                ? "bg-[#07111f] text-white border-[#07111f]"
                                : "bg-white text-[#374151] border-[#e2e8f0] hover:border-[#94a3b8]"
                            }`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Bedrooms pills */}
                    <div className="mb-3">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5">Bedrooms</label>
                      <div className="flex flex-wrap gap-1.5">
                        {BED_OPTIONS.map((o) => (
                          <button
                            key={o.val}
                            type="button"
                            onClick={() => setBedrooms(o.val)}
                            className={`px-3 py-2 rounded-lg text-[13px] font-semibold border transition-all min-w-[48px] ${
                              bedrooms === o.val
                                ? "bg-[#07111f] text-white border-[#07111f]"
                                : "bg-white text-[#374151] border-[#e2e8f0] hover:border-[#94a3b8]"
                            }`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Budget pills */}
                    <div className="mb-3">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5">Monthly budget</label>
                      <div className="flex flex-wrap gap-1.5">
                        {BUDGET_OPTIONS.map((o) => (
                          <button
                            key={o.val}
                            type="button"
                            onClick={() => setBudget(o.val)}
                            className={`px-3 py-2 rounded-lg text-[13px] font-semibold border transition-all ${
                              budget === o.val
                                ? "bg-[#07111f] text-white border-[#07111f]"
                                : "bg-white text-[#374151] border-[#e2e8f0] hover:border-[#94a3b8]"
                            }`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Move-in pills */}
                    <div className="mb-4">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5">Move-in</label>
                      <div className="flex flex-wrap gap-1.5">
                        {MOVE_IN_OPTIONS.map((o) => (
                          <button
                            key={o.val}
                            type="button"
                            onClick={() => setMoveIn(o.val)}
                            className={`px-3 py-2 rounded-lg text-[13px] font-semibold border transition-all ${
                              moveIn === o.val
                                ? "bg-[#07111f] text-white border-[#07111f]"
                                : "bg-white text-[#374151] border-[#e2e8f0] hover:border-[#94a3b8]"
                            }`}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={advanceToStep2}
                      className="w-full bg-[#f59e0b] hover:bg-[#fbbf24] text-[#07111f] font-extrabold text-[15px] py-4 rounded-xl transition-all shadow-lg shadow-[#f59e0b]/20 hover:shadow-xl hover:shadow-[#f59e0b]/30 active:scale-[0.99]"
                    >
                      See my matches → (Step 2 of 2)
                    </button>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div className="space-y-2.5 mb-3">
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="First name"
                        className="w-full px-4 py-3 rounded-lg border border-[#e2e8f0] bg-white text-[15px] focus:outline-none focus:border-[#f59e0b] focus:ring-2 focus:ring-[#f59e0b]/20"
                        autoComplete="given-name"
                        maxLength={60}
                      />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Phone (we'll text you)"
                        className="w-full px-4 py-3 rounded-lg border border-[#e2e8f0] bg-white text-[15px] focus:outline-none focus:border-[#f59e0b] focus:ring-2 focus:ring-[#f59e0b]/20"
                        autoComplete="tel"
                        inputMode="tel"
                      />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email (optional, for the cheat sheet)"
                        className="w-full px-4 py-3 rounded-lg border border-[#e2e8f0] bg-white text-[15px] focus:outline-none focus:border-[#f59e0b] focus:ring-2 focus:ring-[#f59e0b]/20"
                        autoComplete="email"
                      />
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
                      className="w-full bg-[#f59e0b] hover:bg-[#fbbf24] disabled:opacity-60 disabled:cursor-not-allowed text-[#07111f] font-extrabold text-[15px] py-4 rounded-xl transition-all shadow-lg shadow-[#f59e0b]/20 hover:shadow-xl hover:shadow-[#f59e0b]/30 active:scale-[0.99]"
                    >
                      {submitting ? "Sending…" : "Send to Aamir →"}
                    </button>
                    <p className="text-[12px] text-[#475569] text-center mt-3 leading-relaxed">
                      🔒 No obligation. No spam. If matches don&apos;t fit, we stop. That&apos;s it.
                    </p>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="w-full mt-2 text-[13px] text-[#64748b] hover:text-[#07111f] py-2"
                    >
                      ← Back
                    </button>

                    <p className="text-[11px] text-[#64748b] text-center mt-3 leading-relaxed">
                      No fees · No spam · Aamir usually replies within 1 business hour.<br />
                      By submitting you agree to be contacted about Milton rentals. See our{" "}
                      <Link href="/privacy" className="underline hover:text-[#07111f]" target="_blank">Privacy Policy</Link>.
                    </p>
                  </>
                )}
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ══ COMPARISON — Why Aamir vs DIY vs Out-of-area ══ */}
      <ComparisonTable />

      {/* ══ LISTING PREVIEW ══ */}
      <section id="matches" className="bg-[#0a1628] py-14 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-7 gap-4 flex-wrap">
            <div>
              <div className="text-[11px] font-bold tracking-wider text-[#f59e0b] uppercase mb-1.5">
                Live TREB data ·{" "}
                {updatedMinAgo !== null
                  ? `Updated ${updatedMinAgo === 0 ? "just now" : `${updatedMinAgo} min ago`}`
                  : "Updated recently"}
              </div>
              <h2 className="text-[26px] sm:text-[32px] font-extrabold leading-tight">
                Showing {filteredListings.length} of {totalRentals} matches
              </h2>
              <p className="text-[13px] text-[#94a3b8] mt-1">Sorted by newest. Filter narrows by your chip selections above.</p>
            </div>
            <a
              href="#lead-form"
              className="text-[13px] font-bold text-[#fbbf24] hover:text-[#f59e0b] transition-colors whitespace-nowrap"
            >
              Get full list →
            </a>
          </div>

          {filteredListings.length === 0 ? (
            <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-8 text-center">
              <p className="text-[15px] text-[#cbd5e1] mb-3">
                No exact matches — Aamir will hand-pick the closest fits. Submit your details →
              </p>
              <a href="#lead-form" className="inline-block bg-[#f59e0b] hover:bg-[#fbbf24] text-[#07111f] font-bold px-6 py-3 rounded-lg">
                Get matched →
              </a>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {filteredListings.map((l) => {
                const days = daysAgo(new Date(l.listedAt));
                const streetAddr = l.address.split(",")[0];
                const avail = l.possessionDetails === "Vacant" || l.possessionDetails === "Immediate"
                  ? "Available now"
                  : l.possessionDetails || "Available";
                return (
                  <Link
                    key={l.mlsNumber}
                    href={`/listings/${l.mlsNumber}`}
                    className="group block bg-[#0c1e35] border border-[#1e3a5f] rounded-xl overflow-hidden hover:border-[#f59e0b]/50 hover:shadow-lg hover:shadow-[#f59e0b]/10 transition-all"
                  >
                    <div
                      className="aspect-[4/3] bg-[#1e3a5f] bg-center bg-cover relative"
                      style={l.photos[0] ? { backgroundImage: `url(${l.photos[0]})` } : {}}
                    >
                      {!l.photos[0] && (
                        <div className="absolute inset-0 flex items-center justify-center text-[40px]">🏠</div>
                      )}
                      <span className="absolute top-2.5 left-2.5 bg-[#07111f]/85 backdrop-blur text-[10px] font-bold tracking-wider uppercase text-[#fbbf24] px-2 py-1 rounded">
                        {days === 0 ? "New today" : days <= 7 ? `${days}d new` : `${days}d ago`}
                      </span>
                      <span className="absolute bottom-2.5 left-2.5 bg-green-500/90 text-white text-[10px] font-bold tracking-wide px-2 py-1 rounded">
                        {avail}
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-baseline justify-between gap-2 mb-1">
                        <div className="text-[20px] font-extrabold text-[#f8f9fb]">
                          {formatPriceFull(l.price)}<span className="text-[12px] font-semibold text-[#94a3b8]"> /mo</span>
                        </div>
                      </div>
                      <div className="text-[13px] font-semibold text-[#cbd5e1] mb-1 line-clamp-1">{streetAddr}</div>
                      <div className="flex gap-3 text-[12px] text-[#94a3b8]">
                        <span>🛏 {l.bedrooms} bed</span>
                        <span>🚿 {l.bathrooms} bath</span>
                        {l.parking > 0 && <span>🚗 {l.parking}</span>}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {totalRentals > filteredListings.length && (
            <div className="text-center mt-8">
              <a
                href="#lead-form"
                className="inline-block bg-[#f59e0b] hover:bg-[#fbbf24] text-[#07111f] font-extrabold px-8 py-4 rounded-xl text-[15px] transition-colors"
              >
                Get all {totalRentals} matches sent to you →
              </a>
            </div>
          )}
        </div>
      </section>

      {/* ══ MEET AAMIR ══ */}
      <section className="bg-[#07111f] py-14 sm:py-20 border-t border-[#1e3a5f]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="text-[11px] font-bold tracking-wider text-[#f59e0b] uppercase mb-3">
            Your Milton Realtor
          </div>
          <h2 className="text-[30px] sm:text-[38px] font-extrabold mb-3">Aamir Yaqoob</h2>
          <p className="text-[14px] text-[#94a3b8] mb-6">Sales Representative · RE/MAX Realty Specialists Inc.</p>

          <p className="text-[15px] sm:text-[17px] text-[#cbd5e1] leading-relaxed max-w-2xl mx-auto mb-7">
            With <strong className="text-white">14 years of full-time experience</strong> in Milton, Aamir knows that renting is about more than price — it&apos;s about finding the right fit, the right protection, and the right outcome. You&apos;ll work with him directly from first call to signed lease.
          </p>

          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {[
              "🏆 RE/MAX Hall of Fame",
              "🏆 RE/MAX Executive Award",
              "🏆 RE/MAX 100% Club",
              "14 Years Full-Time",
              "Milton Specialist",
            ].map((a) => (
              <span key={a} className="text-[12px] font-semibold bg-[#0c1e35] border border-[#1e3a5f] text-[#cbd5e1] px-3 py-1.5 rounded-full">
                {a}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="tel:+16478399090"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#f59e0b] hover:bg-[#fbbf24] text-[#07111f] font-extrabold px-7 py-4 rounded-xl text-[15px] transition-colors"
            >
              📞 Call (647) 839-9090
            </a>
            <a
              href="https://wa.me/16478399090"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#0c1e35] border border-[#1e3a5f] hover:border-[#f59e0b]/50 text-white font-bold px-7 py-4 rounded-xl text-[15px] transition-colors"
            >
              💬 WhatsApp Aamir
            </a>
          </div>
        </div>
      </section>

      {/* ══ FAQ ══ */}
      <section className="bg-[#0a1628] py-14 sm:py-20 border-t border-[#1e3a5f]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-[26px] sm:text-[32px] font-extrabold text-center mb-8">Common questions</h2>
          <div className="space-y-3">
            {[
              {
                q: "Do I pay Aamir to help me rent in Milton?",
                a: "No. Renter representation is paid by the listing side on most rental transactions. You get a full-service Realtor at no cost to you.",
              },
              {
                q: "How quickly will I hear back?",
                a: "Aamir personally replies within one business hour. Forms submitted after hours get a reply first thing the next morning — or call (647) 839-9090 for the fastest response.",
              },
              {
                q: "Can I see a listing today?",
                a: "Often yes — if the property allows a same-day showing, Aamir will coordinate directly with the listing side. Some properties need 24 hours&apos; notice.",
              },
              {
                q: "I already have a Realtor — should I still submit?",
                a: "Please don&apos;t — stick with your current Realtor. If you&apos;re not currently represented, Aamir would love to help.",
              },
              {
                q: "Where do these listings come from?",
                a: "Every rental you see is pulled live from TREB (Toronto Regional Real Estate Board) — the same MLS® data used by every licensed Realtor in Ontario. Updated daily.",
              },
            ].map((item) => (
              <details key={item.q} className="group bg-[#0c1e35] border border-[#1e3a5f] rounded-xl overflow-hidden">
                <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-4 hover:bg-[#1e3a5f]/30 transition-colors">
                  <span className="text-[15px] font-bold text-white">{item.q}</span>
                  <span className="text-[#f59e0b] text-[20px] font-light group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-5 pb-5 text-[14px] text-[#cbd5e1] leading-relaxed">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FINAL CTA BAND ══ */}
      <section className="bg-gradient-to-br from-[#f59e0b] to-[#fbbf24] py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-[26px] sm:text-[34px] font-extrabold text-[#07111f] mb-3 leading-tight">
            Ready to find your Milton rental?
          </h2>
          <p className="text-[14px] sm:text-[16px] text-[#07111f]/80 mb-6 max-w-xl mx-auto">
            Get matched with live listings that fit your needs — usually within one business hour.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#lead-form"
              className="w-full sm:w-auto inline-block bg-[#07111f] hover:bg-[#0c1e35] text-white font-extrabold px-8 py-4 rounded-xl text-[15px] transition-colors"
            >
              Get my matches →
            </a>
            <a
              href="tel:+16478399090"
              className="w-full sm:w-auto inline-block bg-white hover:bg-[#f8f9fb] text-[#07111f] font-extrabold px-8 py-4 rounded-xl text-[15px] transition-colors"
            >
              📞 Call (647) 839-9090
            </a>
          </div>
        </div>
      </section>

      {/* ══ SLIM COMPLIANT FOOTER ══ */}
      <footer className="bg-[#07111f] border-t border-[#1e3a5f] py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <Link href="/" className="shrink-0">
              <span className="text-[17px] font-extrabold">
                <span className="text-[#f8f9fb]">miltonly</span>
                <span className="text-[#f59e0b]">.</span>
              </span>
            </Link>
            <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[12px]">
              <Link href="/privacy" className="text-[#94a3b8] hover:text-[#f8f9fb]">Privacy Policy</Link>
              <Link href="/terms" className="text-[#94a3b8] hover:text-[#f8f9fb]">Terms</Link>
              <Link href="/about" className="text-[#94a3b8] hover:text-[#f8f9fb]">About</Link>
              <a href="tel:+16478399090" className="text-[#94a3b8] hover:text-[#f8f9fb]">(647) 839-9090</a>
            </nav>
          </div>
          <div className="text-center text-[11px] text-[#64748b] leading-relaxed">
            © 2026 Miltonly.com · Aamir Yaqoob, Sales Representative · RE/MAX Realty Specialists Inc., Brokerage · Milton, Ontario<br />
            <span className="text-[#64748b]/80">MLS® listings displayed courtesy of the Toronto Regional Real Estate Board (TRREB). Information deemed reliable but not guaranteed.</span>
          </div>
        </div>
      </footer>

      {/* ══ MOBILE STICKY CTA ══ */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-[#07111f]/95 backdrop-blur border-t border-[#1e3a5f] px-3 py-2.5 flex gap-2">
        <a
          href="tel:+16478399090"
          className="shrink-0 bg-[#0c1e35] border border-[#1e3a5f] text-white font-bold px-4 py-3 rounded-lg text-[13px]"
          aria-label="Call Aamir"
        >
          📞
        </a>
        <a
          href="#lead-form"
          className="flex-1 text-center bg-[#f59e0b] hover:bg-[#fbbf24] text-[#07111f] font-extrabold py-3 rounded-lg text-[14px]"
        >
          Get my matches →
        </a>
      </div>
      {/* Spacer so content isn't hidden behind mobile CTA */}
      <div className="lg:hidden h-[60px]" aria-hidden />
    </div>
  );
}

export default function AdsClient(props: Props) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#07111f]" />}>
      <AdsClientInner {...props} />
    </Suspense>
  );
}
