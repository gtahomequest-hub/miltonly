"use client";

import { useEffect } from "react";
import Link from "next/link";

interface Lead {
  id: string;
  firstName: string;
  bedrooms: number | null;
  priceRangeMax: number | null;
  timeline: string | null;
  propertyType: string | null;
}

interface Props {
  lead: Lead | null;
  isSpam: boolean;
  cheatsheetEnabled: boolean;
  awConversionId: string;
  awConversionLabel: string;
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

export default function ThankYouClient({
  lead,
  isSpam,
  cheatsheetEnabled,
  awConversionId,
  awConversionLabel,
}: Props) {
  // Fire Google Ads conversion exactly once on mount.
  // Skip on spam (honeypot fired) — no conversion for synthetic submissions.
  // Cold-cache resilience: if gtag isn't loaded yet, poll every 200ms up to 5s.
  useEffect(() => {
    if (isSpam) return;
    if (!awConversionId || !awConversionLabel) return;

    const transactionId = lead?.id || `no-lid-${Date.now()}`;
    let fired = false;
    const start = Date.now();

    function tryFire() {
      if (fired) return;
      const w = window as unknown as { gtag?: (...a: unknown[]) => void };
      if (typeof w.gtag === "function") {
        w.gtag("event", "conversion", {
          send_to: `${awConversionId}/${awConversionLabel}`,
          transaction_id: transactionId,
          value: 1.0,
          currency: "CAD",
        });
        fired = true;
        return;
      }
      if (Date.now() - start > 5000) return;
      setTimeout(tryFire, 200);
    }
    tryFire();
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

  return (
    <div className="min-h-screen bg-[#07111f] text-[#f8f9fb] font-sans">
      {/* Slim header */}
      <header className="bg-[#07111f] border-b border-[#1e3a5f]">
        <div className="max-w-3xl mx-auto flex items-center justify-between h-[58px] px-4 sm:px-6">
          <Link href="/" className="shrink-0">
            <span className="text-[20px] font-extrabold tracking-[-0.5px]">
              <span className="text-[#f8f9fb]">miltonly</span>
              <span className="text-[#f59e0b]">.</span>
            </span>
          </Link>
          <a
            href="tel:+16478399090"
            className="flex items-center gap-2 bg-[#f59e0b] text-[#07111f] text-[13px] font-bold px-4 py-2 rounded-lg hover:bg-[#fbbf24]"
          >
            📞 (647) 839-9090
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 pb-32 md:pb-14">
        {/* Personalized hero */}
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-full bg-green-500 text-white items-center justify-center text-[34px] mb-4 shadow-lg shadow-green-500/20">
            ✓
          </div>
          <h1 className="text-[28px] sm:text-[36px] font-extrabold tracking-[-0.02em] leading-[1.1] mb-2">
            Thanks {firstName}! Aamir is already on it.
          </h1>
          <p className="text-[15px] sm:text-[17px] text-[#cbd5e1] leading-relaxed max-w-xl mx-auto">
            Your request is in his queue. You&apos;ll get 3–5 hand-picked Milton matches by end of business day.
          </p>
        </div>

        {/* Request echo card */}
        {lead && echoSummary && (
          <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-2xl p-5 sm:p-6 mb-6">
            <p className="text-[11px] font-bold tracking-wider text-[#f59e0b] uppercase mb-2">
              YOUR REQUEST
            </p>
            <p className="text-[16px] sm:text-[18px] font-bold text-[#f8f9fb] leading-snug">
              {echoSummary}
            </p>
            <p className="text-[12px] text-[#94a3b8] mt-2">
              Wrong details? Reply to Aamir&apos;s text and he&apos;ll fix it before sending matches.
            </p>
          </div>
        )}

        {/* What happens next — 4 step timeline */}
        <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-2xl p-5 sm:p-6 mb-6">
          <p className="text-[11px] font-bold tracking-wider text-[#f59e0b] uppercase mb-4">
            WHAT HAPPENS NEXT
          </p>
          <ol className="space-y-4">
            {[
              { t: "Now", h: "You'll get a confirmation text from Aamir's number", b: "(647) 839-9090 — save it before he sends matches." },
              { t: "~1 hour", h: "Aamir personally reviews your criteria", b: "Hand-picks 3–5 matches from the live TREB feed. No bots, no batch-and-blast." },
              { t: "By end of business day", h: "Matches land in your texts", b: "With photos, prices, and links. Reply to lock in showings." },
              { t: "Within 24–48 hours", h: "Showings booked", b: "Aamir handles the listing-side coordination. You just show up." },
            ].map((s, i) => (
              <li key={i} className="flex gap-3">
                <div className="shrink-0 w-7 h-7 rounded-full bg-[#f59e0b] text-[#07111f] font-extrabold text-[12px] flex items-center justify-center">
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#f59e0b]">{s.t}</p>
                  <p className="text-[14px] font-bold text-[#f8f9fb] mt-0.5">{s.h}</p>
                  <p className="text-[12px] text-[#94a3b8] mt-0.5 leading-relaxed">{s.b}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* SMS preview mockup */}
        <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-2xl p-5 sm:p-6 mb-6">
          <p className="text-[11px] font-bold tracking-wider text-[#f59e0b] uppercase mb-3">
            WHAT THE TEXT LOOKS LIKE
          </p>
          <div className="bg-[#07111f] rounded-2xl p-4 max-w-[320px] mx-auto">
            <div className="flex items-center gap-2 pb-3 border-b border-[#1e3a5f] mb-3">
              <div className="w-8 h-8 rounded-full bg-[#f59e0b] text-[#07111f] font-extrabold text-[13px] flex items-center justify-center">AY</div>
              <div>
                <p className="text-[13px] font-bold text-[#f8f9fb] leading-tight">Aamir Yaqoob</p>
                <p className="text-[10px] text-[#94a3b8]">(647) 839-9090</p>
              </div>
            </div>
            <div className="bg-[#1e3a5f] rounded-2xl rounded-tl-sm px-3 py-2.5 mb-2 text-[13px] text-[#f8f9fb] leading-relaxed">
              Hi {firstName}! It&apos;s Aamir from RE/MAX 👋 Got your request{lead?.bedrooms !== null && lead?.bedrooms !== undefined ? ` for a ${beds}` : ""}{price ? ` under ${price}` : ""} in Milton. Pulling matches now — you&apos;ll have 3-5 listings by 4 PM today.
            </div>
            <div className="bg-[#1e3a5f] rounded-2xl rounded-tl-sm px-3 py-2.5 text-[13px] text-[#f8f9fb] leading-relaxed">
              Quick Q: any preferred area (Hawthorne, Scott, Willmott)?
            </div>
          </div>
        </div>

        {/* 3 secondary action cards */}
        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          <a
            href="tel:+16478399090"
            className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-4 text-center hover:border-[#f59e0b]/60 transition-colors"
          >
            <div className="text-[26px] mb-1">📞</div>
            <p className="text-[13px] font-bold text-[#f8f9fb]">Call now</p>
            <p className="text-[11px] text-[#94a3b8] mt-0.5">(647) 839-9090</p>
          </a>
          <a
            href="https://wa.me/16478399090?text=Hi%20Aamir%2C%20I%20just%20submitted%20a%20rental%20request"
            target="_blank"
            rel="noopener"
            className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-4 text-center hover:border-green-500/60 transition-colors"
          >
            <div className="text-[26px] mb-1">💬</div>
            <p className="text-[13px] font-bold text-[#f8f9fb]">WhatsApp</p>
            <p className="text-[11px] text-[#94a3b8] mt-0.5">Faster reply</p>
          </a>
          <a
            href="https://www.instagram.com/aamiryaqoobrealtor/"
            target="_blank"
            rel="noopener"
            className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-4 text-center hover:border-[#f59e0b]/60 transition-colors"
          >
            <div className="text-[26px] mb-1">📷</div>
            <p className="text-[13px] font-bold text-[#f8f9fb]">Instagram</p>
            <p className="text-[11px] text-[#94a3b8] mt-0.5">@aamiryaqoobrealtor</p>
          </a>
        </div>

        {/* Calendar slots */}
        <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-2xl p-5 sm:p-6 mb-6">
          <p className="text-[11px] font-bold tracking-wider text-[#f59e0b] uppercase mb-2">
            PREFER A 15-MIN CALL?
          </p>
          <p className="text-[13px] text-[#cbd5e1] mb-4">Pick a slot — Aamir will phone you back at the time you choose.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {["Today 5–6 PM", "Today 6–7 PM", "Tomorrow 10–11 AM", "Tomorrow 12–1 PM", "Tomorrow 5–6 PM", "Saturday 10–11 AM"].map((s) => (
              <a
                key={s}
                href={`tel:+16478399090`}
                className="text-center bg-[#07111f] border border-[#1e3a5f] hover:border-[#f59e0b] hover:text-[#f59e0b] text-[12px] font-semibold text-[#cbd5e1] rounded-lg py-2 px-2 transition-colors"
              >
                {s}
              </a>
            ))}
          </div>
          <p className="text-[10px] text-[#64748b] text-center mt-3">
            All slots route to Aamir&apos;s direct line — booking confirms via the same number.
          </p>
        </div>

        {/* Cheat sheet — only when env flag is on */}
        {cheatsheetEnabled && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 sm:p-6 mb-6">
            <p className="text-[11px] font-bold tracking-wider text-[#fbbf24] uppercase mb-2">
              📘 BONUS — IN YOUR INBOX
            </p>
            <p className="text-[15px] font-bold text-[#f8f9fb] mb-1">Milton Renter&apos;s Cheat Sheet</p>
            <p className="text-[12px] text-[#cbd5e1] leading-relaxed">
              Aamir&apos;s 6-page PDF: what landlords actually ask for, prices by neighbourhood, and 3 red flags to spot. Check your email — it landed there moments ago.
            </p>
          </div>
        )}

        {/* Testimonials */}
        <div className="mb-6">
          <p className="text-[11px] font-bold tracking-wider text-[#f59e0b] uppercase mb-3 text-center">
            RECENT MILTON RENTERS
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              { name: "Priya S.", quote: "Found us a 2-bed in Hawthorne in 4 days. Aamir actually picks up the phone." },
              { name: "James R.", quote: "Skipped the Zumper rabbit hole entirely. Three matches, signed lease in a week." },
            ].map((t) => (
              <div key={t.name} className="bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-4">
                <p className="text-[14px] text-[#f8f9fb] leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                <p className="text-[11px] text-[#94a3b8] mt-2 font-semibold">— {t.name}, Milton renter</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-[11px] text-[#64748b] mt-6">
          🛡️ Free for renters. Aamir is paid by the listing side, never by you.
        </p>
      </main>

      {/* Sticky mobile CTA */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#07111f]/95 backdrop-blur border-t border-[#1e3a5f] px-3 py-2.5 flex gap-2">
        <a
          href="tel:+16478399090"
          className="flex-1 text-center bg-[#f59e0b] hover:bg-[#fbbf24] text-[#07111f] font-extrabold py-3 rounded-lg text-[14px]"
        >
          📞 Call Aamir now
        </a>
      </div>
      <div className="md:hidden h-[60px]" aria-hidden />
    </div>
  );
}
