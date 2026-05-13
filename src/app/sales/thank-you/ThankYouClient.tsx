"use client";

import { useEffect } from "react";
import Link from "next/link";
import { hashUserData } from "@/lib/hash";
import { config } from "@/lib/config";

const REALTOR_FIRST_NAME = config.realtor.name.split(" ")[0];
const REALTOR_INITIALS = config.realtor.name.split(" ").map((p) => p[0]).join("").toUpperCase();
const REALTOR_PHONE_DIGITS = config.realtor.phoneE164.replace(/^\+/, "");
const BROKERAGE_SHORT_NAME = config.brokerage.name.replace(", Brokerage", "");

// Weighted lead value for Google Ads Smart Bidding. Sales leads carry ~5x the
// expected commission of renter leads (renter base is 50 CAD), so a sales-side
// generate_lead event reports value=5000 CAD. Single tier — sales-variant form
// doesn't capture budget, and price tier would require listing lookup the
// client-side conversion already paid for via SSR. Flat rate keeps the bidding
// signal interpretable.
const SALES_LEAD_VALUE = 5000;

interface Lead {
  id: string;
  firstName: string;
  timeline: string | null;
  preApproved: string | null;
  mlsNumber: string | null;
  listingAddress: string | null;
  email: string | null;
  phone: string | null;
}

interface Props {
  lead: Lead | null;
  isSpam: boolean;
}

const TIMELINE_LABEL: Record<string, string> = {
  asap: "ASAP",
  "1-3months": "Next 1–3 months",
  "3-6months": "3–6 months",
  browsing: "Just browsing",
};

const PRE_APPROVED_LABEL: Record<string, string> = {
  yes: "Pre-approved",
  no: "Not pre-approved yet",
};

// Build the vCard 3.0 body shipped via the Save Contact button. Mirrors the
// rental thank-you's pattern so the contact card stays identical across both
// post-conversion flows.
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
  setTimeout(() => URL.revokeObjectURL(url), 1500);

  const w = window as unknown as { gtag?: (...a: unknown[]) => void };
  if (w.gtag) w.gtag("event", "save_contact", { source: "sales/thank-you" });
}

export default function ThankYouClient({ lead, isSpam }: Props) {
  // GA4 generate_lead — fired once on mount with the sales-weighted value.
  // Cold-cache resilient: polls every 200ms for up to 5s if gtag isn't yet
  // loaded. Skipped on spam (honeypot trip) — no conversion credit for
  // synthetic submissions.
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
            value: SALES_LEAD_VALUE,
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
  const timelineWord = lead?.timeline ? TIMELINE_LABEL[lead.timeline] || lead.timeline : null;
  const preApprovedWord = lead?.preApproved ? PRE_APPROVED_LABEL[lead.preApproved] || lead.preApproved : null;
  const listingLabel = lead?.listingAddress || lead?.mlsNumber || null;

  const echoSummary = [
    timelineWord ? `Timeline: ${timelineWord}` : null,
    preApprovedWord,
    listingLabel ? `Viewing: ${listingLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const whatsappUrl = `https://wa.me/${REALTOR_PHONE_DIGITS}?text=${encodeURIComponent(
    `Hi ${REALTOR_FIRST_NAME}, I just submitted the form on ${config.SITE_DOMAIN}${listingLabel ? ` about ${listingLabel}` : ""} — looking forward to hearing from you!`,
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
            Got it{lead?.firstName ? `, ${firstName}` : ""} — {REALTOR_FIRST_NAME} is calling you within 4 business hours.
          </h1>
          <p className="text-[15px] sm:text-[17px] text-[#cbd5e1] leading-relaxed max-w-xl mx-auto">
            {REALTOR_FIRST_NAME} reviews every sales request personally. You&apos;ll hear from him within 4 business hours (9 AM – 9 PM ET). For anything urgent before then, call or text {config.realtor.phone} directly.
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
              Wrong details? Reply to {REALTOR_FIRST_NAME}&apos;s text and he&apos;ll fix it before the call.
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
            So you recognize his call within 4 business hours.
          </p>
        </div>

        {/* ── SECTION 2: Aamir intro ── */}
        <section className="bg-[#0c1e35] border border-[#1e3a5f] rounded-2xl p-5 sm:p-6 mb-7">
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-start">
            <div className="shrink-0 mx-auto sm:mx-0 w-[88px] h-[88px] sm:w-[96px] sm:h-[96px] rounded-full bg-gradient-to-br from-[#f59e0b] to-[#fbbf24] text-[#07111f] font-extrabold text-[34px] sm:text-[36px] flex items-center justify-center shadow-lg shadow-[#f59e0b]/20">
              {REALTOR_INITIALS}
            </div>
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <p className="text-[15px] sm:text-[16px] text-[#f8f9fb] leading-relaxed mb-2">
                Hi, I&apos;m {REALTOR_FIRST_NAME}. I&apos;m RE/MAX Hall of Fame and have helped 150+ {config.CITY_NAME} families buy and sell in the last {config.realtor.yearsExperience} years.
              </p>
              <p className="text-[14px] sm:text-[15px] text-[#cbd5e1] leading-relaxed mb-2">
                I personally call every sales lead within 4 business hours. When you see a {config.CITY_NAME} number call you, that&apos;s me — save my contact above so you don&apos;t miss it.
              </p>
              <p className="text-[14px] sm:text-[15px] text-[#cbd5e1] leading-relaxed">
                You&apos;re never under any obligation. We talk, you decide. — {REALTOR_FIRST_NAME}
              </p>
            </div>
          </div>
        </section>

        {/* ── SECTION 3: What happens next ── */}
        <section className="bg-[#0c1e35] border border-[#1e3a5f] rounded-2xl p-5 sm:p-6 mb-7">
          <p className="text-[11px] font-bold tracking-wider text-[#f59e0b] uppercase mb-4">
            WHAT HAPPENS NEXT
          </p>
          <ol className="space-y-4">
            {[
              {
                when: "Step 1",
                what: `${REALTOR_FIRST_NAME} reviews your request and pulls 3–5 comparable sold properties`,
              },
              {
                when: "Step 2",
                what: `${REALTOR_FIRST_NAME} calls you within 4 business hours (9 AM – 9 PM ET)`,
              },
              {
                when: "Step 3",
                what: "You decide what you want to do — no pressure, no obligation",
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

        {/* ── SECTION 4: WhatsApp alternative CTA ── */}
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
      </main>

      {/* ── MINIMAL FOOTER — legal + copyright only ── */}
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
