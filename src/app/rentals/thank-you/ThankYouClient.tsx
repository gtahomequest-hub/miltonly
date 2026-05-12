"use client";

import { useEffect } from "react";
import Link from "next/link";
import { hashUserData } from "@/lib/hash";
import { config } from "@/lib/config";

const REALTOR_FIRST_NAME = config.realtor.name.split(" ")[0];
const REALTOR_INITIALS = config.realtor.name.split(" ").map((p) => p[0]).join("").toUpperCase();
const REALTOR_PHONE_DIGITS = config.realtor.phoneE164.replace(/^\+/, "");
const BROKERAGE_SHORT_NAME = config.brokerage.name.replace(", Brokerage", "");

// Weighted lead values for Google Ads Smart Bidding. Approximates expected
// commission × close-rate per budget tier. Without this, Smart Bidding sees
// every lead as value=1 CAD and can't optimize bid toward higher-budget
// renters (who carry materially higher expected revenue). Tiers match the
// 4 budget options on /rentals/ads (mapped through priceRangeMax: int).
function getLeadValueByBudget(priceRangeMax: number | null): number {
  switch (priceRangeMax) {
    case 2500: return 50;   // "Under $2,500"
    case 3500: return 100;  // "$2,500 – $3,500"
    case 4500: return 150;  // "$3,500 – $4,500"
    case 6000: return 250;  // "$4,500+"
    default: return 50;     // fallback for unexpected / missing values
  }
}

interface Lead {
  id: string;
  firstName: string;
  bedrooms: number | null;
  priceRangeMax: number | null;
  timeline: string | null;
  propertyType: string | null;
  email: string | null;
  phone: string | null;
}

interface Props {
  lead: Lead | null;
  isSpam: boolean;
  cheatsheetEnabled: boolean;
}

const TIMELINE_LABEL: Record<string, string> = {
  asap: "ASAP",
  "1month": "within 1 month",
  flexible: "flexible",
};

const TYPE_LABEL: Record<string, string> = {
  condo: "Condo",
  townhouse: "Townhouse",
  semi: "Semi-Detached",
  detached: "Detached",
  any: "any home type",
};

function bedroomLabel(beds: number | null): string {
  if (beds === null) return "any size";
  if (beds === 0) return "studio";
  if (beds >= 4) return "4+ bedroom";
  return `${beds} bedroom`;
}

function priceLabel(max: number | null): string | null {
  if (max === null || max <= 0) return null;
  return `$${(max / 1000).toFixed(1).replace(".0", "")}K/mo`;
}

// Build the vCard 3.0 body shipped via the Save Contact button. Pure function
// so it's testable + tweakable without touching the click handler.
function buildAamirVCard(): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    "N:Yaqoob;Aamir;;;",
    `FN:${config.realtor.name}`,
    `ORG:${BROKERAGE_SHORT_NAME}`,
    `TITLE:${config.realtor.title}`,
    `TEL;TYPE=CELL:${config.realtor.phoneE164}`,
    `EMAIL:${process.env.NEXT_PUBLIC_REALTOR_EMAIL || "gtahomequest@gmail.com"}`,
    `URL:${config.SITE_URL_WWW}`,
    "END:VCARD",
  ];
  // RFC 6350 / 2426 prefer CRLF line endings. iOS Contacts is lenient but
  // some Android Contacts apps require CRLF to parse multiline fields.
  return lines.join("\r\n");
}

function downloadAamirVCard() {
  if (typeof window === "undefined") return;
  const blob = new Blob([buildAamirVCard()], { type: "text/vcard;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Aamir-Yaqoob.vcf";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revoke so iOS Safari has time to consume the blob URL.
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  // Optional analytics — non-blocking. Failing to fire doesn't break the download.
  const w = window as unknown as { gtag?: (...a: unknown[]) => void };
  if (w.gtag) w.gtag("event", "save_contact", { source: "rentals/thank-you" });
}

export default function ThankYouClient({
  lead,
  isSpam,
}: Props) {
  // GA4 generate_lead event fired exactly once on mount. Cold-cache resilient:
  // if gtag isn't loaded yet, polls every 200ms for up to 5s. Skip on spam
  // (honeypot tripped) — no conversion credit for synthetic submissions.
  // Conversion value is weighted by budget tier so Smart Bidding can optimize
  // toward higher-revenue lead profiles.
  useEffect(() => {
    if (isSpam) return;

    const transactionId = lead?.id || `no-lid-${Date.now()}`;
    let fired = false;
    let cancelled = false;
    const start = Date.now();

    (async () => {
      const userData = await hashUserData(lead?.email, lead?.phone);
      const hasUserData = userData.sha256_email_address || userData.sha256_phone_number;

      const tryFire = () => {
        if (fired || cancelled) return;
        const w = window as unknown as { gtag?: (...a: unknown[]) => void };
        if (typeof w.gtag === "function") {
          if (hasUserData) w.gtag("set", "user_data", userData);
          w.gtag("event", "generate_lead", {
            transaction_id: transactionId,
            value: getLeadValueByBudget(lead?.priceRangeMax ?? null),
            currency: "CAD",
            lead_id: lead?.id || transactionId,
          });
          fired = true;
          return;
        }
        if (Date.now() - start > 5000) return;
        setTimeout(tryFire, 200);
      };
      tryFire();
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const firstName = lead?.firstName || "there";
  const beds = bedroomLabel(lead?.bedrooms ?? null);
  const price = priceLabel(lead?.priceRangeMax ?? null);
  const timelineWord = lead?.timeline ? TIMELINE_LABEL[lead.timeline] || lead.timeline : null;
  const typeWord = lead?.propertyType ? TYPE_LABEL[lead.propertyType] || lead.propertyType : null;

  const echoSummary = [
    `${beds}${typeWord && typeWord !== "any home type" ? ` ${typeWord.toLowerCase()}` : ""}`,
    price ? `under ${price}` : null,
    timelineWord ? `move-in ${timelineWord}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const whatsappUrl = `https://wa.me/${REALTOR_PHONE_DIGITS}?text=${encodeURIComponent(
    `Hi ${REALTOR_FIRST_NAME}, I just submitted the form on ${config.SITE_DOMAIN} — looking forward to hearing from you!`,
  )}`;

  return (
    <div className="min-h-screen bg-[#07111f] text-[#f8f9fb] font-sans">
      {/* ── MINIMAL HEADER — logo only, no nav or CTAs ── */}
      <header className="bg-[#07111f] border-b border-[#1e3a5f]">
        <div className="max-w-3xl mx-auto flex items-center justify-start h-[58px] px-4 sm:px-6">
          <Link href="/" className="shrink-0" aria-label={`${config.SITE_NAME} home`}>
            <span className="text-[20px] font-extrabold tracking-[-0.5px]">
              <span className="text-[#f8f9fb]">{config.SITE_NAME.toLowerCase()}</span>
              <span className="text-[#f59e0b]">.</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-24">
        {/* ── SECTION 1: Above the fold ── */}
        <div className="text-center mb-7">
          <div className="inline-flex w-16 h-16 rounded-full bg-green-500 text-white items-center justify-center text-[34px] mb-4 shadow-lg shadow-green-500/20">
            ✓
          </div>
          <h1 className="text-[28px] sm:text-[36px] font-extrabold tracking-[-0.02em] leading-[1.1] mb-2">
            Thanks {firstName}! {REALTOR_FIRST_NAME} is already on it.
          </h1>
          <p className="text-[15px] sm:text-[17px] text-[#cbd5e1] leading-relaxed max-w-xl mx-auto">
            {REALTOR_FIRST_NAME}&apos;s seen your request and is matching you with {config.CITY_NAME} rentals right now. You&apos;ll hear from him within 1 hour during business hours (9 AM – 9 PM ET), or first thing in the morning if it&apos;s after hours. Talk soon.
          </p>
        </div>

        {/* Lead summary card — what they asked for */}
        {lead && echoSummary && (
          <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-2xl p-5 sm:p-6 mb-5">
            <p className="text-[11px] font-bold tracking-wider text-[#f59e0b] uppercase mb-2">
              YOUR REQUEST
            </p>
            <p className="text-[16px] sm:text-[18px] font-bold text-[#f8f9fb] leading-snug">
              {echoSummary}
            </p>
            <p className="text-[12px] text-[#94a3b8] mt-2">
              Wrong details? Reply to {REALTOR_FIRST_NAME}&apos;s text and he&apos;ll fix it before sending matches.
            </p>
          </div>
        )}

        {/* Save Contact — vCard download. Most-prominent CTA on the page. */}
        <div className="text-center mb-9">
          <button
            type="button"
            onClick={downloadAamirVCard}
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto sm:min-w-[280px] min-h-[52px] px-6 bg-[#f59e0b] hover:bg-[#fbbf24] text-[#07111f] font-extrabold text-[15px] sm:text-[16px] rounded-xl shadow-lg shadow-[#f59e0b]/20 hover:shadow-xl active:scale-[0.99] transition-all"
          >
            <span aria-hidden>📇</span>
            Save {REALTOR_FIRST_NAME}&apos;s Contact
          </button>
          <p className="text-[12px] sm:text-[13px] text-[#94a3b8] mt-2.5">
            So you recognize his text/call within the hour.
          </p>
        </div>

        {/* ── SECTION 2: Aamir intro — first-person, conversational ── */}
        <section className="bg-[#0c1e35] border border-[#1e3a5f] rounded-2xl p-5 sm:p-6 mb-7">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-start">
            {/* TODO: when Aamir provides a headshot, drop the file at
                public/aamir.jpg (or similar) and swap this initials circle
                for <Image src="/aamir.jpg" alt={config.realtor.name} ...>. */}
            <div className="shrink-0 mx-auto sm:mx-0 w-[88px] h-[88px] sm:w-[96px] sm:h-[96px] rounded-full bg-gradient-to-br from-[#f59e0b] to-[#fbbf24] text-[#07111f] font-extrabold text-[34px] sm:text-[36px] flex items-center justify-center shadow-lg shadow-[#f59e0b]/20">
              {REALTOR_INITIALS}
            </div>
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <p className="text-[15px] sm:text-[16px] text-[#f8f9fb] leading-relaxed mb-2">
                Hi, I&apos;m {REALTOR_FIRST_NAME}. I&apos;ve been renting {config.CITY_NAME} for {config.realtor.yearsExperience} years — 150+ families helped find their place.
              </p>
              <p className="text-[14px] sm:text-[15px] text-[#cbd5e1] leading-relaxed mb-2">
                I personally text every match, every time. When you see a {config.CITY_NAME} number text you within the hour, that&apos;s me. Save my contact above so you don&apos;t miss it.
              </p>
              <p className="text-[14px] sm:text-[15px] text-[#cbd5e1] leading-relaxed">
                Looking forward to helping you find your place. — {REALTOR_FIRST_NAME}
              </p>
            </div>
          </div>
        </section>

        {/* ── SECTION 3: Timeline ── */}
        <section className="bg-[#0c1e35] border border-[#1e3a5f] rounded-2xl p-5 sm:p-6 mb-7">
          <p className="text-[11px] font-bold tracking-wider text-[#f59e0b] uppercase mb-4">
            WHAT HAPPENS NEXT
          </p>
          <ol className="space-y-4">
            {[
              {
                when: "Within 60 minutes",
                what: `${REALTOR_FIRST_NAME} texts your 3–5 hand-picked ${config.CITY_NAME} matches`,
              },
              {
                when: "Tonight or tomorrow",
                what: `You pick favourites; ${REALTOR_FIRST_NAME} books showings`,
              },
              {
                when: "Within 48 hours",
                what: "First showing scheduled",
              },
              {
                when: "Within 1–2 weeks",
                what: "Signed lease, keys in hand",
              },
            ].map((s, i) => (
              <li key={i} className="flex gap-3 sm:gap-4">
                <div className="shrink-0 w-8 h-8 rounded-full bg-[#f59e0b] text-[#07111f] font-extrabold text-[13px] flex items-center justify-center">
                  {i + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#fbbf24] mb-0.5">
                    {s.when}
                  </p>
                  <p className="text-[14px] sm:text-[15px] font-semibold text-[#f8f9fb] leading-snug">
                    {s.what}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ── SECTION 4: WhatsApp alternative CTA — secondary visual weight ── */}
        <div className="text-center mb-2">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto sm:min-w-[280px] min-h-[48px] px-6 bg-[#0c1e35] border border-[#1e3a5f] hover:border-green-500/60 text-[#f8f9fb] font-bold text-[14px] sm:text-[15px] rounded-xl transition-colors"
          >
            <span aria-hidden>💬</span>
            Or message {REALTOR_FIRST_NAME} on WhatsApp
          </a>
        </div>

        {/* ── SECTION 5: TESTIMONIALS_PLACEHOLDER ──
            Reserved for 2-3 testimonials once Aamir collects them (planned
            within the week). Intentionally renders nothing for v1 — drop
            <section>…</section> here when the testimonial content lands. */}
        {/* <!-- TESTIMONIALS_PLACEHOLDER --> */}
      </main>

      {/* ── MINIMAL FOOTER — legal + copyright only, no feature links ── */}
      <footer className="bg-[#07111f] border-t border-[#1e3a5f] py-6">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[12px] mb-3">
            <Link href="/privacy" className="text-[#94a3b8] hover:text-[#f8f9fb]">Privacy Policy</Link>
            <Link href="/terms" className="text-[#94a3b8] hover:text-[#f8f9fb]">Terms</Link>
          </nav>
          <p className="text-center text-[11px] text-[#64748b] leading-relaxed">
            © 2026 {config.SITE_DOMAIN} · {config.realtor.name}, {config.realtor.title} · {BROKERAGE_SHORT_NAME}
          </p>
        </div>
      </footer>
    </div>
  );
}
