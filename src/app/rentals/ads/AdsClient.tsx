"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Trophy, MapPin, Clock, Lock } from "lucide-react";
import { formatPriceFull, daysAgo } from "@/lib/format";
import { attributionPayload } from "@/lib/attribution";
import { config } from "@/lib/config";
import ComparisonTable from "./ComparisonTable";

const REALTOR_FIRST_NAME = config.realtor.name.split(" ")[0];
const BROKERAGE_SHORT_NAME = config.brokerage.name.replace(", Brokerage", "");

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

// Type-word injection for the dynamic headline AND the per-card display badge.
const TYPE_HEADLINE_WORD: Record<string, string> = {
  condo: "condo",
  detached: "detached",
  semi: "semi-detached",
  townhouse: "townhouse",
};
const TYPE_DISPLAY_LABEL: Record<string, string> = {
  condo: "Condo",
  detached: "Detached",
  semi: "Semi-Detached",
  townhouse: "Townhouse",
};

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

function AdsClientInner({
  listings,
  totalRentals,
  newThisWeek,
  renterCount,
  updatedMinAgo,
  initialType,
  heroSrc,
}: Props) {
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

  // Dynamic headline — inject the property-type word when ?type=… is on URL.
  const headline = useMemo(() => {
    const t = (initialType || "").toLowerCase();
    const typeWord = TYPE_HEADLINE_WORD[t];
    const noun = typeWord ? `${typeWord} rentals` : "rentals";
    return `Skip ${totalRentals} listings. Get 3-5 ${config.CITY_NAME} ${noun} hand-picked by ${REALTOR_FIRST_NAME}.`;
  }, [initialType, totalRentals]);

  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => { document.documentElement.style.scrollBehavior = ""; };
  }, []);

  // Sticky mobile CTA → smooth-scroll to the form element. Falls back to
  // window.scrollTo(0,0) if the form is somehow not in the DOM.
  function scrollToForm() {
    if (typeof window === "undefined") return;
    const el = document.getElementById("lead-form");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }

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
          source: "ads-rentals-lp",
          intent: "renter",
          budget,
          homeType: initialType || "any",
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
      router.push(redirect);
    } catch {
      setError(`Something went wrong. Please call ${REALTOR_FIRST_NAME} directly at ${config.realtor.phone}.`);
      setSubmitting(false);
    }
  }

  // Listings teaser — 3 clear + 3 blurred + 1 "see more" CTA card.
  const teaserClear = listings.slice(0, 3);
  const teaserBlurred = listings.slice(3, 6);
  const remainingCount = Math.max(0, totalRentals - 3);

  return (
    <div className="min-h-screen bg-[#07111f] text-[#f8f9fb] font-sans">
      {/* ── SLIM HEADER ── */}
      <header className="sticky top-0 z-50 bg-[#07111f]/95 backdrop-blur border-b border-[#1e3a5f]">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-[58px] px-4 sm:px-6">
          <Link href="/" className="shrink-0">
            <span className="text-[20px] font-extrabold tracking-[-0.5px]">
              <span className="text-[#f8f9fb]">{config.SITE_NAME.toLowerCase()}</span>
              <span className="text-[#f59e0b]">.</span>
            </span>
          </Link>
          <a
            href={`tel:${config.realtor.phoneE164}`}
            className="flex items-center gap-2 bg-[#f59e0b] text-[#07111f] text-[13px] sm:text-[14px] font-bold px-4 py-2 rounded-lg hover:bg-[#fbbf24] transition-colors"
          >
            <span aria-hidden>📞</span>
            <span className="hidden sm:inline">Call {REALTOR_FIRST_NAME}</span>
            <span>{config.realtor.phone}</span>
          </a>
        </div>
      </header>

      {/* ── HERO ── headline + sub + trust pills + 3-field form ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={heroSrc}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div
            className="absolute inset-0"
            style={{
              background: heroSrc.includes("neighbourhood")
                ? "linear-gradient(100deg, rgba(7,17,31,0.74) 0%, rgba(7,17,31,0.45) 45%, rgba(7,17,31,0.20) 100%)"
                : "linear-gradient(100deg, rgba(7,17,31,0.82) 0%, rgba(7,17,31,0.62) 45%, rgba(7,17,31,0.40) 100%)",
            }}
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-[#07111f]" aria-hidden />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-10 sm:pt-10 sm:pb-14 lg:pt-16 lg:pb-20">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-6 lg:gap-12 items-start">
            {/* LEFT — copy */}
            <div>
              <h1 className="text-[26px] sm:text-[40px] lg:text-[50px] font-extrabold leading-[1.08] tracking-[-0.02em] mb-3 sm:mb-4">
                {headline}
              </h1>
              <p className="text-[14px] sm:text-[17px] text-[#cbd5e1] leading-snug max-w-xl mb-3 sm:mb-5">
                Same {REALTOR_FIRST_NAME} who&apos;s done $55M+ in {config.CITY_NAME} real estate and helped 150+ families. Replies in under 60 minutes.
              </p>

              {/* TRUST PILLARS — 3 pills, horizontal row, compact on mobile */}
              <div className="flex flex-wrap gap-2 sm:gap-2.5 mb-4 sm:mb-0">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f59e0b]/40 bg-[#f59e0b]/10 px-3 py-1.5 text-[11px] sm:text-[12px] font-semibold text-[#fbbf24]">
                  <Trophy className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden />
                  RE/MAX Hall of Fame
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1e3a5f] bg-[#0c1e35] px-3 py-1.5 text-[11px] sm:text-[12px] font-semibold text-[#cbd5e1]">
                  <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden />
                  {config.realtor.yearsExperience} years · $55M+ in {config.CITY_NAME}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-[11px] sm:text-[12px] font-semibold text-green-300">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" aria-hidden />
                  Replies in &lt;60 min
                </span>
              </div>

              {/* Live activity badge — desktop only. Each segment renders only
                  when its count is > 0; entire badge hides when all are zero
                  (avoids "0 NEW THIS WEEK" reading as a negative trust signal). */}
              {(() => {
                const segs: string[] = [];
                if (totalRentals > 0) segs.push(`${totalRentals} active`);
                if (newThisWeek > 0) segs.push(`${newThisWeek} new this week`);
                if (renterCount > 0) segs.push(`${renterCount} matched this week`);
                if (segs.length === 0) return null;
                return (
                  <div className="hidden sm:inline-flex items-center gap-2 mt-5 bg-[#f59e0b]/10 border border-[#f59e0b]/25 rounded-full px-3 py-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#fbbf24] opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#f59e0b]" />
                    </span>
                    <span className="text-[11px] font-bold tracking-wider text-[#fbbf24] uppercase">
                      {segs.join(" · ")}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* RIGHT — 3-FIELD FORM (phone + email + budget). Sticky on desktop, below hero on mobile. */}
            <div id="lead-form" className="lg:sticky lg:top-[80px]">
              <form
                onSubmit={handleSubmit}
                className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 text-[#07111f]"
                noValidate
              >
                <h2 className="text-[18px] sm:text-[22px] font-extrabold leading-tight text-[#07111f] mb-1.5">
                  Get matched in 60 seconds
                </h2>
                <p className="text-[12px] sm:text-[13px] text-[#64748b] mb-3 sm:mb-4">
                  Phone + email + budget. {REALTOR_FIRST_NAME} texts 3–5 matches within the hour.
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
                  {submitting ? "Sending…" : "Unlock all matches"}
                </button>
                <p className="text-[11px] text-[#64748b] text-center mt-2.5 leading-relaxed">
                  🔒 No spam. No fees. By submitting you agree to be contacted.{" "}
                  <Link href="/privacy" className="underline hover:text-[#07111f]" target="_blank">Privacy</Link>.
                </p>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* ── LISTINGS TEASER — 3 clear + 3 blurred + CTA card ── */}
      <section id="matches" className="bg-[#0a1628] py-12 sm:py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
            <div>
              <div className="text-[11px] font-bold tracking-wider text-[#f59e0b] uppercase mb-1">
                Live TREB data ·{" "}
                {updatedMinAgo !== null
                  ? `Updated ${updatedMinAgo === 0 ? "just now" : `${updatedMinAgo} min ago`}`
                  : "Updated recently"}
              </div>
              <h2 className="text-[24px] sm:text-[30px] font-extrabold leading-tight">
                Recent {config.CITY_NAME} rentals from live MLS data
              </h2>
            </div>
            <a
              href="#lead-form"
              className="text-[13px] font-bold text-[#fbbf24] hover:text-[#f59e0b] transition-colors whitespace-nowrap"
            >
              Get all matches →
            </a>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {/* Real listings — full info visible, property-type badge below photo */}
            {teaserClear.map((l) => {
              const days = daysAgo(new Date(l.listedAt));
              const streetAddr = l.address.split(",")[0];
              const typeLabel = TYPE_DISPLAY_LABEL[l.propertyType?.toLowerCase()] || l.propertyType;
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
                  </div>
                  <div className="p-4">
                    {/* Property-type badge — branded amber pill, sits just above the price */}
                    {typeLabel && (
                      <span className="inline-block bg-[#f59e0b]/15 border border-[#f59e0b]/40 text-[#fbbf24] text-[11px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 mb-2">
                        {typeLabel}
                      </span>
                    )}
                    <div className="text-[20px] font-extrabold text-[#f8f9fb] mb-1">
                      {formatPriceFull(l.price)}<span className="text-[12px] font-semibold text-[#94a3b8]"> /mo</span>
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

            {/* Blurred listings — locked behind the form. Property-type badge shown
                un-blurred so the user can see what category is locked. */}
            {teaserBlurred.map((l) => {
              const streetAddr = l.address.split(",")[0];
              const typeLabel = TYPE_DISPLAY_LABEL[l.propertyType?.toLowerCase()] || l.propertyType;
              return (
                <a
                  key={l.mlsNumber}
                  href="#lead-form"
                  className="group relative block bg-[#0c1e35] border border-[#1e3a5f] rounded-xl overflow-hidden hover:border-[#f59e0b]/50 transition-all"
                  aria-label="Submit the form to unlock this match"
                >
                  <div
                    className="aspect-[4/3] bg-[#1e3a5f] bg-center bg-cover relative"
                    style={l.photos[0] ? { backgroundImage: `url(${l.photos[0]})`, filter: "blur(14px) saturate(0.7)" } : {}}
                  >
                    {!l.photos[0] && (
                      <div className="absolute inset-0 flex items-center justify-center text-[40px] opacity-30">🏠</div>
                    )}
                  </div>
                  <div className="p-4 relative">
                    {typeLabel && (
                      <span className="inline-block bg-[#f59e0b]/15 border border-[#f59e0b]/40 text-[#fbbf24] text-[11px] font-bold uppercase tracking-wider rounded-full px-2.5 py-1 mb-2">
                        {typeLabel}
                      </span>
                    )}
                    <div className="text-[20px] font-extrabold text-[#f8f9fb] mb-1 blur-[6px] select-none">
                      $X,XXX<span className="text-[12px] font-semibold text-[#94a3b8]"> /mo</span>
                    </div>
                    <div className="text-[13px] font-semibold text-[#cbd5e1] mb-1 line-clamp-1 blur-[5px] select-none">{streetAddr}</div>
                    <div className="flex gap-3 text-[12px] text-[#94a3b8] blur-[4px] select-none">
                      <span>🛏 {l.bedrooms} bed</span>
                      <span>🚿 {l.bathrooms} bath</span>
                    </div>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-[#07111f]/85 backdrop-blur-sm border border-[#f59e0b]/40 rounded-full px-3 py-1.5 inline-flex items-center gap-1.5 text-[#fbbf24] text-[11px] font-bold uppercase tracking-wider shadow-lg">
                      <Lock className="w-3.5 h-3.5" aria-hidden />
                      Unlock
                    </div>
                  </div>
                </a>
              );
            })}

            {/* CTA card — 7th tile, drives back to the form */}
            <a
              href="#lead-form"
              className="group block bg-gradient-to-br from-[#f59e0b] to-[#fbbf24] rounded-xl overflow-hidden hover:shadow-xl hover:shadow-[#f59e0b]/30 transition-all"
            >
              <div className="aspect-[4/3] relative flex flex-col items-center justify-center text-center p-5">
                <Lock className="w-8 h-8 text-[#07111f] mb-2" aria-hidden />
                <p className="text-[#07111f] text-[22px] font-extrabold leading-tight mb-1">
                  + {remainingCount} more matches
                </p>
                <p className="text-[#07111f]/80 text-[12px] font-semibold leading-snug">
                  in {REALTOR_FIRST_NAME}&apos;s private list
                </p>
              </div>
              <div className="p-4 bg-[#07111f]/10">
                <div className="bg-[#07111f] text-[#fbbf24] font-extrabold text-[14px] py-3 rounded-lg text-center group-hover:bg-[#0c1e35]">
                  Get all matches →
                </div>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* ── MEET REALTOR ── */}
      <section className="bg-[#07111f] py-14 sm:py-20 border-t border-[#1e3a5f]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="text-[11px] font-bold tracking-wider text-[#f59e0b] uppercase mb-3">
            Your {config.CITY_NAME} Realtor
          </div>
          <h2 className="text-[30px] sm:text-[38px] font-extrabold mb-3">{config.realtor.name}</h2>
          <p className="text-[14px] text-[#94a3b8] mb-6">{config.realtor.title} · {BROKERAGE_SHORT_NAME}</p>
          <p className="text-[15px] sm:text-[17px] text-[#cbd5e1] leading-relaxed max-w-2xl mx-auto mb-7">
            <strong className="text-white">{config.realtor.yearsExperience} years renting {config.CITY_NAME}, full-time.</strong> 150+ {config.CITY_NAME} families helped, $55M+ leased &amp; sold. You&apos;ll work with {REALTOR_FIRST_NAME} directly — not an assistant, not a junior agent. From first call to signed lease.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {[
              "🏆 RE/MAX Hall of Fame",
              "🏆 RE/MAX Executive Award",
              "🏆 RE/MAX 100% Club",
              `${config.realtor.yearsExperience} Years Full-Time`,
              `${config.CITY_NAME} Specialist`,
            ].map((a) => (
              <span key={a} className="text-[12px] font-semibold bg-[#0c1e35] border border-[#1e3a5f] text-[#cbd5e1] px-3 py-1.5 rounded-full">
                {a}
              </span>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={`tel:${config.realtor.phoneE164}`}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#f59e0b] hover:bg-[#fbbf24] text-[#07111f] font-extrabold px-7 py-4 rounded-xl text-[15px] transition-colors"
            >
              📞 Call {config.realtor.phone}
            </a>
            <a
              href={`https://wa.me/${config.realtor.phoneE164.replace(/^\+/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#0c1e35] border border-[#1e3a5f] hover:border-[#f59e0b]/50 text-white font-bold px-7 py-4 rounded-xl text-[15px] transition-colors"
            >
              💬 WhatsApp {REALTOR_FIRST_NAME}
            </a>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-[#0a1628] py-14 sm:py-20 border-t border-[#1e3a5f]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <h2 className="text-[26px] sm:text-[32px] font-extrabold text-center mb-8">Common questions</h2>
          <div className="space-y-3">
            {[
              {
                q: `Do I pay ${REALTOR_FIRST_NAME} to help me rent in ${config.CITY_NAME}?`,
                a: "No. Renter representation is paid by the listing side on most rental transactions. You get a full-service Realtor at no cost to you.",
              },
              {
                q: "How quickly will I hear back?",
                a: `${REALTOR_FIRST_NAME} personally replies within one business hour. Forms submitted after hours get a reply first thing the next morning — or call ${config.realtor.phone} for the fastest response.`,
              },
              {
                q: "Can I see a listing today?",
                a: `Often yes — if the property allows a same-day showing, ${REALTOR_FIRST_NAME} will coordinate directly with the listing side. Some properties need 24 hours' notice.`,
              },
              {
                q: "I already have a Realtor — should I still submit?",
                a: `Please don't — stick with your current Realtor. If you're not currently represented, ${REALTOR_FIRST_NAME} would love to help.`,
              },
              {
                q: "Where do these listings come from?",
                a: `Every rental you see is pulled live from TREB (Toronto Regional Real Estate Board) — the same MLS® data used by every licensed Realtor in ${config.CITY_PROVINCE}. Updated daily.`,
              },
            ].map((item, i) => (
              // First question is the #1 unstated objection for cold rental
              // traffic ("what's the catch?") — open by default so the "$0
              // to the renter" answer is visible without a tap.
              <details key={item.q} open={i === 0} className="group bg-[#0c1e35] border border-[#1e3a5f] rounded-xl overflow-hidden">
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

      {/* ── FINAL CTA BAND ── */}
      <section className="bg-gradient-to-br from-[#f59e0b] to-[#fbbf24] py-12 sm:py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-[26px] sm:text-[34px] font-extrabold text-[#07111f] mb-3 leading-tight">
            Ready to find your {config.CITY_NAME} rental?
          </h2>
          <p className="text-[14px] sm:text-[16px] text-[#07111f]/80 mb-6 max-w-xl mx-auto">
            Get matched with live listings that fit your needs — within 1 hour during business hours (9 AM – 9 PM ET).
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#lead-form"
              className="w-full sm:w-auto inline-block bg-[#07111f] hover:bg-[#0c1e35] text-white font-extrabold px-8 py-4 rounded-xl text-[15px] transition-colors"
            >
              Get my matches →
            </a>
            <a
              href={`tel:${config.realtor.phoneE164}`}
              className="w-full sm:w-auto inline-block bg-white hover:bg-[#f8f9fb] text-[#07111f] font-extrabold px-8 py-4 rounded-xl text-[15px] transition-colors"
            >
              📞 Call {config.realtor.phone}
            </a>
          </div>
        </div>
      </section>

      {/* ── COMPARISON — kept just-above-footer per CRO spec ── */}
      <ComparisonTable />

      {/* ── SLIM COMPLIANT FOOTER ── */}
      <footer className="bg-[#07111f] border-t border-[#1e3a5f] py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <Link href="/" className="shrink-0">
              <span className="text-[17px] font-extrabold">
                <span className="text-[#f8f9fb]">{config.SITE_NAME.toLowerCase()}</span>
                <span className="text-[#f59e0b]">.</span>
              </span>
            </Link>
            <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[12px]">
              <Link href="/privacy" className="text-[#94a3b8] hover:text-[#f8f9fb]">Privacy Policy</Link>
              <Link href="/terms" className="text-[#94a3b8] hover:text-[#f8f9fb]">Terms</Link>
              <Link href="/about" className="text-[#94a3b8] hover:text-[#f8f9fb]">About</Link>
              <a href={`tel:${config.realtor.phoneE164}`} className="text-[#94a3b8] hover:text-[#f8f9fb]">{config.realtor.phone}</a>
            </nav>
          </div>
          <div className="text-center text-[11px] text-[#64748b] leading-relaxed">
            © 2026 {config.SITE_DOMAIN} · {config.realtor.name}, {config.realtor.title} · {config.brokerage.name} · {config.CITY_NAME}, {config.CITY_PROVINCE}<br />
            <span className="text-[#64748b]/80">MLS® listings displayed courtesy of the Toronto Regional Real Estate Board (TRREB). Information deemed reliable but not guaranteed.</span>
          </div>
        </div>
      </footer>

      {/* ── STICKY MOBILE BOTTOM CTA — 50/50 split, safe-area-aware, md:hidden ── */}
      <div
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#07111f]/95 backdrop-blur border-t border-[#1e3a5f] px-3 pt-2.5 flex gap-2"
        style={{ paddingBottom: "calc(10px + env(safe-area-inset-bottom))" }}
      >
        <a
          href={`tel:${config.realtor.phoneE164}`}
          className="flex-1 inline-flex items-center justify-center bg-[#0c1e35] border border-[#1e3a5f] text-white font-bold rounded-lg text-[14px] min-h-[48px]"
        >
          📞 Call {REALTOR_FIRST_NAME}
        </a>
        <button
          type="button"
          onClick={scrollToForm}
          className="flex-1 inline-flex items-center justify-center bg-[#f59e0b] hover:bg-[#fbbf24] text-[#07111f] font-extrabold rounded-lg text-[14px] min-h-[48px]"
        >
          Get matches →
        </button>
      </div>
      {/* Spacer so the footer isn't hidden behind the sticky bar when scrolled to bottom */}
      <div className="md:hidden h-20" aria-hidden />
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
