"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/UserProvider";
import {
  haversineKm, walkMinutes, driveMinutes, directionsUrl, hasValidCoords,
  GROCERIES, MOSQUES, PARKS, TRANSIT, COMMUTES, type POI,
} from "@/lib/geo";

interface SchoolLite {
  slug: string;
  name: string;
  board: string;
  level: string;
  grades: string;
  fraserScore: string | null;
  neighbourhood: string;
}

// ═══════════════════════════════════════════════════════════════
// SAVE + SHARE ROW
// ═══════════════════════════════════════════════════════════════
export function SaveShareRow({ mls, address, isRental }: { mls: string; address: string; isRental: boolean }) {
  const router = useRouter();
  const { user, isListingSaved, saveListing, unsaveListing } = useUser();
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const saved = isListingSaved(mls);

  const handleSave = async () => {
    if (!user) {
      router.push(`/signin?redirect=/listings/${mls}`);
      return;
    }
    if (saved) await unsaveListing(mls);
    else await saveListing(mls);
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const shareText = `${address} — ${isRental ? "for rent" : "for sale"} on Miltonly`;

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({ title: shareText, text: shareText, url: shareUrl });
        return;
      } catch {/* user cancelled */}
    }
    setShareOpen((o) => !o);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 mt-3">
      <button
        onClick={handleSave}
        className={`flex items-center gap-1.5 text-[12px] font-bold rounded-lg px-3 py-2 border transition-colors ${saved ? "bg-[#f59e0b] border-[#f59e0b] text-white" : "border-[#1e3a5f] text-[#f59e0b] hover:bg-[#0c1e35]"}`}
      >
        <span className="text-[14px]">{saved ? "♥" : "♡"}</span> {saved ? "Saved" : "Save"}
      </button>
      <div className="relative">
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 text-[12px] font-bold rounded-lg px-3 py-2 border border-[#1e3a5f] text-[#94a3b8] hover:bg-[#0c1e35] hover:text-[#f59e0b] transition-colors"
        >
          <span className="text-[14px]">↗</span> Share
        </button>
        {shareOpen && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-[#e2e8f0] rounded-lg shadow-lg min-w-[180px] z-20">
            <button onClick={copyLink} className="block w-full text-left px-3 py-2 text-[12px] text-[#475569] hover:bg-[#f8f9fb]">
              {copied ? "✓ Copied!" : "📋 Copy link"}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText + "\n" + shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 text-[12px] text-[#475569] hover:bg-[#f8f9fb]"
            >
              💬 Share on WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// WHAT'S NEARBY — 4 tabs
// ═══════════════════════════════════════════════════════════════
function NearbyRow({ p, lat, lng, commute = false, coordsValid }: { p: POI; lat: number; lng: number; commute?: boolean; coordsValid: boolean }) {
  let timeStr: string;
  if (coordsValid) {
    const km = haversineKm(lat, lng, p.lat, p.lng);
    const time = commute ? driveMinutes(km) : km < 2 ? walkMinutes(km) : driveMinutes(km);
    const mode = commute ? "drive" : km < 2 ? "walk" : "drive";
    timeStr = `${km.toFixed(1)} km · ${time} min ${mode}`;
  } else if (p.fallbackMin) {
    timeStr = `~${p.fallbackMin} min drive from Milton`;
  } else {
    timeStr = "In Milton area";
  }
  const url = coordsValid
    ? directionsUrl(p.lat, p.lng, lat, lng)
    : directionsUrl(p.lat, p.lng);
  return (
    <div className="flex items-center justify-between gap-3 bg-white border border-[#e2e8f0] rounded-lg px-3 py-2.5 hover:border-[#07111f] transition-colors">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-[16px] shrink-0">{p.icon}</span>
        <div className="min-w-0">
          {p.href ? (
            <Link href={p.href} className="text-[13px] font-semibold text-[#07111f] hover:text-[#f59e0b] truncate block">
              {p.name}
            </Link>
          ) : (
            <span className="text-[13px] font-semibold text-[#07111f] truncate block">{p.name}</span>
          )}
          <p className="text-[11px] text-[#94a3b8]">{timeStr}</p>
        </div>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] font-semibold text-[#f59e0b] hover:underline shrink-0"
      >
        Directions →
      </a>
    </div>
  );
}

export function WhatsNearby({ lat, lng, schools }: { lat: number; lng: number; schools: SchoolLite[] }) {
  const [tab, setTab] = useState<"groceries" | "schools" | "community" | "commutes">("commutes");
  const coordsValid = hasValidCoords(lat, lng);

  const unavailableNote = (
    <div className="bg-[#f8f9fb] border border-[#e2e8f0] rounded-lg p-4 text-center">
      <p className="text-[13px] font-semibold text-[#475569]">Precise distances unavailable for this listing</p>
      <p className="text-[11px] text-[#94a3b8] mt-1">Coordinates are still syncing. See the Commutes tab for Milton-average drive times.</p>
    </div>
  );

  return (
    <div className="mb-8">
      <h2 className="text-[18px] font-extrabold text-[#07111f] mb-3">What&apos;s nearby</h2>
      <div className="flex gap-1 mb-4 border-b border-[#e2e8f0] overflow-x-auto">
        {([
          ["commutes", "🏙️ Commutes"],
          ["groceries", "🛒 Groceries"],
          ["schools", "🎓 Schools"],
          ["community", "🕌 Community"],
        ] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`text-[12px] font-semibold px-3 py-2 border-b-2 -mb-[1px] transition-colors whitespace-nowrap ${tab === k ? "border-[#07111f] text-[#07111f]" : "border-transparent text-[#94a3b8] hover:text-[#475569]"}`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* Commutes — ALWAYS renders, uses fallback minutes when coords unavailable */}
      {tab === "commutes" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {COMMUTES.map((p) => <NearbyRow key={p.name} p={p} lat={lat} lng={lng} commute coordsValid={coordsValid} />)}
        </div>
      )}

      {tab === "groceries" && (
        coordsValid ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {GROCERIES.map((p) => <NearbyRow key={p.name} p={p} lat={lat} lng={lng} coordsValid />)}
          </div>
        ) : unavailableNote
      )}

      {tab === "schools" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {schools.length > 0 ? (
            schools.map((s) => (
              <Link
                key={s.slug}
                href={`/schools/${s.slug}`}
                className="flex items-start justify-between gap-3 bg-white border border-[#e2e8f0] rounded-lg px-3 py-2.5 hover:border-[#07111f] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#07111f] truncate">{s.name}</p>
                  <p className="text-[11px] text-[#94a3b8]">
                    {s.board === "public" ? "Public" : "Catholic"} · {s.grades}
                    {s.fraserScore && ` · Fraser ${s.fraserScore}/10`}
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-[#f59e0b] shrink-0 self-center">→</span>
              </Link>
            ))
          ) : (
            <p className="text-[13px] text-[#94a3b8] col-span-full py-4">No schools mapped to this neighbourhood yet — <Link href="/schools" className="text-[#f59e0b] hover:underline">browse all Milton schools</Link>.</p>
          )}
        </div>
      )}

      {tab === "community" && (
        coordsValid ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-[12px] font-bold text-[#07111f] uppercase tracking-[0.08em] mb-2">Mosques</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {MOSQUES.map((p) => <NearbyRow key={p.name} p={p} lat={lat} lng={lng} coordsValid />)}
              </div>
            </div>
            <div>
              <h3 className="text-[12px] font-bold text-[#07111f] uppercase tracking-[0.08em] mb-2">Parks & Trails</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {PARKS.map((p) => <NearbyRow key={p.name} p={p} lat={lat} lng={lng} coordsValid />)}
              </div>
            </div>
            <div>
              <h3 className="text-[12px] font-bold text-[#07111f] uppercase tracking-[0.08em] mb-2">Transit</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {TRANSIT.map((p) => <NearbyRow key={p.name} p={p} lat={lat} lng={lng} coordsValid />)}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=Milton+GO&travelmode=transit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 bg-[#07111f] text-[#f59e0b] text-[12px] font-semibold rounded-lg px-3 py-2.5 hover:bg-[#0c1e35] transition-colors"
                >
                  Plan transit route →
                </a>
              </div>
            </div>
          </div>
        ) : unavailableNote
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MORTGAGE + COST OF OWNERSHIP (interactive)
// ═══════════════════════════════════════════════════════════════
function ontarioLTT(price: number, firstTime: boolean): number {
  let t = 0;
  if (price <= 55000) t = price * 0.005;
  else if (price <= 250000) t = 275 + (price - 55000) * 0.01;
  else if (price <= 400000) t = 2225 + (price - 250000) * 0.015;
  else if (price <= 2000000) t = 4475 + (price - 400000) * 0.02;
  else t = 36475 + (price - 2000000) * 0.025;
  if (firstTime) t = Math.max(0, t - 4000);
  return Math.round(t);
}

export function MortgageCalc({ price, taxAmount, propertyType }: { price: number; taxAmount: number | null; propertyType: string }) {
  const [downPct, setDownPct] = useState(20);
  const [rate, setRate] = useState(5);
  const [amort, setAmort] = useState(25);
  const [firstTime, setFirstTime] = useState(false);

  const down = Math.round(price * (downPct / 100));
  const loan = price - down;
  const monthlyRate = rate / 100 / 12;
  const payments = amort * 12;
  const mortgage = monthlyRate > 0
    ? Math.round((loan * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -payments)))
    : Math.round(loan / payments);

  const taxPerMonth = taxAmount ? Math.round(taxAmount / 12) : 0;
  const maintenance = propertyType === "condo" ? 200 : propertyType === "townhouse" ? 275 : 350;
  const insurance = 150;
  const total = mortgage + taxPerMonth + maintenance + insurance;

  const ltt = ontarioLTT(price, firstTime);

  return (
    <div className="mb-8">
      <h2 className="text-[18px] font-extrabold text-[#07111f] mb-3">Mortgage & monthly cost</h2>
      <div className="bg-white rounded-xl border border-[#e2e8f0] p-5">
        <div className="flex items-baseline gap-1 mb-4">
          <span className="text-[32px] font-extrabold text-[#07111f]">${total.toLocaleString()}</span>
          <span className="text-[13px] text-[#94a3b8]">/month estimated total</span>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="flex items-center justify-between text-[12px] font-semibold text-[#475569] mb-1">
              Down payment <span className="text-[#07111f]">{downPct}% · ${down.toLocaleString()}</span>
            </label>
            <input type="range" min="5" max="50" step="1" value={downPct} onChange={(e) => setDownPct(parseInt(e.target.value))} className="w-full accent-[#f59e0b]" />
          </div>
          <div>
            <label className="flex items-center justify-between text-[12px] font-semibold text-[#475569] mb-1">
              Interest rate <span className="text-[#07111f]">{rate.toFixed(2)}%</span>
            </label>
            <input type="range" min="3" max="8" step="0.25" value={rate} onChange={(e) => setRate(parseFloat(e.target.value))} className="w-full accent-[#f59e0b]" />
          </div>
          <div>
            <label className="flex items-center justify-between text-[12px] font-semibold text-[#475569] mb-1">
              Amortization <span className="text-[#07111f]">{amort} yrs</span>
            </label>
            <input type="range" min="15" max="30" step="5" value={amort} onChange={(e) => setAmort(parseInt(e.target.value))} className="w-full accent-[#f59e0b]" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#f1f5f9] text-center">
          <div><p className="text-[10px] text-[#94a3b8] uppercase tracking-wider">Mortgage</p><p className="text-[14px] font-bold text-[#07111f]">${mortgage.toLocaleString()}</p></div>
          <div><p className="text-[10px] text-[#94a3b8] uppercase tracking-wider">Tax</p><p className="text-[14px] font-bold text-[#07111f]">${taxPerMonth.toLocaleString()}</p></div>
          <div><p className="text-[10px] text-[#94a3b8] uppercase tracking-wider">Maintenance</p><p className="text-[14px] font-bold text-[#07111f]">${maintenance}</p></div>
          <div><p className="text-[10px] text-[#94a3b8] uppercase tracking-wider">Insurance</p><p className="text-[14px] font-bold text-[#07111f]">${insurance}</p></div>
        </div>

        <div className="mt-4 pt-4 border-t border-[#f1f5f9]">
          <label className="flex items-center gap-2 text-[12px] font-semibold text-[#475569] mb-2 cursor-pointer">
            <input type="checkbox" checked={firstTime} onChange={(e) => setFirstTime(e.target.checked)} className="accent-[#f59e0b]" />
            First-time homebuyer (applies Ontario rebate up to $4,000)
          </label>
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="text-[#94a3b8]">Estimated Ontario Land Transfer Tax</span>
            <span className="font-bold text-[#07111f]">${ltt.toLocaleString()}</span>
          </div>
        </div>

        <p className="text-[10px] text-[#94a3b8] mt-3">Estimates only. Call Aamir for a full cost breakdown and pre-approval guidance.</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// INVESTOR WIDGET (sale > $500K)
// ═══════════════════════════════════════════════════════════════
export function InvestorWidget({ price, taxAmount, propertyType, hoodAvgRent }: { price: number; taxAmount: number | null; propertyType: string; hoodAvgRent: number | null }) {
  const estimatedRent = hoodAvgRent ?? (price > 1_500_000 ? 4200 : price > 900_000 ? 3400 : 2700);
  const annualRent = estimatedRent * 12;
  const capRate = (annualRent / price) * 100;
  const mortgage = Math.round((price * 0.8 * 0.05) / 12 + (price * 0.8) / (25 * 12));
  const monthlyTax = taxAmount ? Math.round(taxAmount / 12) : 0;
  const maintenance = propertyType === "condo" ? 200 : 300;
  const cashflow = estimatedRent - mortgage - monthlyTax - maintenance;
  return (
    <div className="mb-8">
      <h2 className="text-[18px] font-extrabold text-[#07111f] mb-3">Investment analysis</h2>
      <div className="bg-[#0c1e35] text-[#f8f9fb] rounded-xl p-5 border border-[#1e3a5f]">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#94a3b8]">Est. monthly rent</p>
            <p className="text-[22px] font-extrabold">${estimatedRent.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#94a3b8]">Gross cap rate</p>
            <p className="text-[22px] font-extrabold text-[#f59e0b]">{capRate.toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#94a3b8]">Monthly cashflow</p>
            <p className={`text-[22px] font-extrabold ${cashflow >= 0 ? "text-[#86efac]" : "text-[#fca5a5]"}`}>
              {cashflow >= 0 ? "+" : ""}${cashflow.toLocaleString()}
            </p>
          </div>
        </div>
        {cashflow < 0 && (
          <p className="text-[12px] text-[#fbbf24] mb-3 leading-relaxed font-medium">
            Negative cashflow reflects current mortgage rates. Contact Aamir for a full investment strategy — down-payment sizing, rate-shopping, and Milton-specific rental benchmarks can all move this number.
          </p>
        )}
        <p className="text-[11px] text-[#94a3b8] leading-relaxed">
          Assumes 20% down · 5% rate · 25-yr amortization · ${maintenance}/mo maintenance · est. rent
          {hoodAvgRent ? " from live Milton rental data" : " based on comparable Milton properties"}.
          Estimates only — contact Aamir for a full investment analysis.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VOW TEASER
// ═══════════════════════════════════════════════════════════════
export function VOWTeaser({ mls, soldCount, hoodSoldCount, hoodName }: { mls: string; soldCount: number; hoodSoldCount: number; hoodName: string }) {
  // Prefer street-level count; fall back to neighbourhood; always render the teaser.
  const useStreet = soldCount > 0;
  const n = useStreet ? soldCount : hoodSoldCount;
  const scope = useStreet ? "on this street" : `in ${hoodName}`;
  const heading = n > 0
    ? `${n} comparable home${n === 1 ? "" : "s"} sold ${scope} in the last 90 days`
    : `See sold prices in ${hoodName || "this neighbourhood"}`;
  return (
    <div className="mb-8">
      <Link
        href={`/signin?redirect=/listings/${mls}`}
        className="block bg-[#07111f] text-white rounded-xl p-5 border border-[#1e3a5f] hover:border-[#f59e0b] transition-colors"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[15px] font-extrabold mb-1">{heading}</p>
            <p className="text-[12px] text-[#94a3b8]">
              Sign in free to view sold prices, price history, and days on market.
            </p>
          </div>
          <span className="text-[#f59e0b] text-[14px] font-bold whitespace-nowrap">View sold prices →</span>
        </div>
      </Link>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LANDLORD / SELLER CTA
// ═══════════════════════════════════════════════════════════════
export function AudienceCTA({ mls, isRental }: { mls: string; isRental: boolean }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.includes("@")) return;
    setBusy(true);
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          firstName: "Valuation request",
          source: isRental ? "landlord-listing-page" : "seller-listing-page",
          intent: isRental ? "list-rental" : "seller",
          mlsNumber: mls,
        }),
      });
      setSent(true);
    } catch {/* ignore */} finally { setBusy(false); }
  };

  return (
    <div className="mb-8">
      <div className="bg-[#07111f] text-white rounded-xl p-6 border border-[#1e3a5f]">
        <p className="text-[11px] font-bold text-[#f59e0b] uppercase tracking-[0.14em] mb-2">
          {isRental ? "Milton landlord?" : "Milton homeowner?"}
        </p>
        <h3 className="text-[20px] font-extrabold mb-2">
          {isRental ? "Thinking about renting out your Milton home?" : "Own a similar home in Milton?"}
        </h3>
        <p className="text-[13px] text-[#94a3b8] mb-4 leading-relaxed">
          {isRental
            ? "Aamir manages rentals across Milton. Free rental valuation — find out what your home earns per month."
            : "Get a free valuation in 24 hours — see what a home like this could list for today."}
        </p>
        {sent ? (
          <p className="text-[13px] text-[#86efac] font-semibold">✓ Thanks — Aamir will email your valuation within 24 hours.</p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 bg-[#0c1e35] border border-[#1e3a5f] rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-[#475569] outline-none focus:border-[#f59e0b]"
            />
            <button
              onClick={submit}
              disabled={busy}
              className="bg-[#f59e0b] text-[#07111f] text-[13px] font-extrabold rounded-lg px-5 py-2.5 hover:bg-[#fbbf24] transition-colors disabled:opacity-60"
            >
              {busy ? "Sending…" : isRental ? "Get my rental estimate →" : "Get my valuation →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// URGENCY BANNER
// ═══════════════════════════════════════════════════════════════
export function UrgencyBanner({ viewsToday, domDays, isRental }: { viewsToday: number; domDays: number; isRental: boolean }) {
  const isNew = domDays <= 7;
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <span className="inline-flex items-center gap-1.5 bg-[#fef3c7] text-[#92400e] text-[11px] font-semibold rounded-full px-2.5 py-1 border border-[#fde68a]">
        👁 {viewsToday} people viewed today
      </span>
      {isNew && isRental && (
        <span className="inline-flex items-center gap-1.5 bg-[#fee2e2] text-[#991b1b] text-[11px] font-semibold rounded-full px-2.5 py-1 border border-[#fecaca]">
          🔥 New listing — rentals like this typically go within 2 weeks
        </span>
      )}
      {isNew && !isRental && (
        <span className="inline-flex items-center gap-1.5 bg-[#dbeafe] text-[#1e40af] text-[11px] font-semibold rounded-full px-2.5 py-1 border border-[#bfdbfe]">
          🆕 New to market · {domDays === 0 ? "listed today" : `listed ${domDays}d ago`}
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SIDEBAR — rental booking w/ pets + move-in
// ═══════════════════════════════════════════════════════════════
export function RentalBookingCard({ mls, address, price }: { mls: string; address: string; price: number }) {
  const [mode, setMode] = useState<"none" | "book" | "ask">("none");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [moveIn, setMoveIn] = useState("");
  const [pets, setPets] = useState<"yes" | "no" | "">("");
  const [msg, setMsg] = useState("");
  const [question, setQuestion] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (source: string, payload: Record<string, string>) => {
    setErr("");
    if (!payload.firstName || !payload.email || !payload.phone) {
      setErr("Name, email and phone are all required.");
      return;
    }
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          source,
          intent: "renter",
          mlsNumber: mls,
          street: address,
          transactionType: "Lease",
        }),
      });
      setSent(true);
    } catch { setErr("Could not submit — try again."); }
  };

  if (sent) {
    return (
      <div className="bg-[#07111f] rounded-2xl p-6">
        <p className="text-[16px] font-extrabold text-[#86efac] mb-2">✓ Request received</p>
        <p className="text-[13px] text-[#cbd5e1]">Aamir usually replies within the hour during business hours.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#07111f] rounded-2xl p-6">
      <p className="text-[22px] font-extrabold text-white">${price.toLocaleString()}<span className="text-[14px] font-normal text-[#94a3b8]">/month</span></p>
      <p className="text-[11px] text-[#94a3b8] mt-1 mb-5">Available now · Aamir usually replies within the hour</p>

      {mode === "none" && (
        <div className="space-y-2">
          <button onClick={() => setMode("book")} className="w-full bg-[#f59e0b] text-[#07111f] text-[14px] font-extrabold rounded-lg py-3 hover:bg-[#fbbf24] transition-colors">
            Book a showing
          </button>
          <button onClick={() => setMode("ask")} className="w-full border border-[#1e3a5f] text-[#94a3b8] text-[13px] font-semibold rounded-lg py-2.5 hover:border-[#f59e0b] hover:text-[#f59e0b] transition-colors">
            Ask a question
          </button>
        </div>
      )}

      {mode === "book" && (
        <div className="space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full px-3 py-2.5 text-[12px] bg-[#0c1e35] border border-[#1e3a5f] rounded-lg text-white placeholder:text-[#334155] outline-none focus:border-[#f59e0b]" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className="w-full px-3 py-2.5 text-[12px] bg-[#0c1e35] border border-[#1e3a5f] rounded-lg text-white placeholder:text-[#334155] outline-none focus:border-[#f59e0b]" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="Phone" className="w-full px-3 py-2.5 text-[12px] bg-[#0c1e35] border border-[#1e3a5f] rounded-lg text-white placeholder:text-[#334155] outline-none focus:border-[#f59e0b]" />
          <input value={moveIn} onChange={(e) => setMoveIn(e.target.value)} type="date" placeholder="Preferred move-in" className="w-full px-3 py-2.5 text-[12px] bg-[#0c1e35] border border-[#1e3a5f] rounded-lg text-white outline-none focus:border-[#f59e0b]" />
          <div>
            <p className="text-[11px] text-[#94a3b8] mb-1.5">Bringing pets?</p>
            <div className="flex gap-2">
              {(["yes", "no"] as const).map((v) => (
                <button key={v} onClick={() => setPets(v)} className={`flex-1 text-[12px] font-semibold rounded-lg py-2 border ${pets === v ? "border-[#f59e0b] bg-[#f59e0b]/10 text-[#f59e0b]" : "border-[#1e3a5f] text-[#94a3b8]"}`}>
                  {v === "yes" ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </div>
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message (optional)" rows={2} className="w-full px-3 py-2.5 text-[12px] bg-[#0c1e35] border border-[#1e3a5f] rounded-lg text-white placeholder:text-[#334155] outline-none focus:border-[#f59e0b] resize-none" />
          {err && <p className="text-[11px] text-[#fca5a5]">{err}</p>}
          <button
            onClick={() => submit("rental-detail-book", { firstName: name, email, phone, moveIn, pets, notes: msg })}
            className="w-full bg-[#f59e0b] text-[#07111f] text-[13px] font-extrabold rounded-lg py-3 hover:bg-[#fbbf24] transition-colors mt-1"
          >
            Submit booking request →
          </button>
          <button onClick={() => setMode("none")} className="w-full text-[11px] text-[#94a3b8] hover:text-white">← Back</button>
        </div>
      )}

      {mode === "ask" && (
        <div className="space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full px-3 py-2.5 text-[12px] bg-[#0c1e35] border border-[#1e3a5f] rounded-lg text-white placeholder:text-[#334155] outline-none focus:border-[#f59e0b]" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className="w-full px-3 py-2.5 text-[12px] bg-[#0c1e35] border border-[#1e3a5f] rounded-lg text-white placeholder:text-[#334155] outline-none focus:border-[#f59e0b]" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="Phone" className="w-full px-3 py-2.5 text-[12px] bg-[#0c1e35] border border-[#1e3a5f] rounded-lg text-white placeholder:text-[#334155] outline-none focus:border-[#f59e0b]" />
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What would you like to know?" rows={3} className="w-full px-3 py-2.5 text-[12px] bg-[#0c1e35] border border-[#1e3a5f] rounded-lg text-white placeholder:text-[#334155] outline-none focus:border-[#f59e0b] resize-none" />
          {err && <p className="text-[11px] text-[#fca5a5]">{err}</p>}
          <button
            onClick={() => submit("rental-detail-question", { firstName: name, email, phone, notes: question })}
            className="w-full bg-[#f59e0b] text-[#07111f] text-[13px] font-extrabold rounded-lg py-3 hover:bg-[#fbbf24] transition-colors"
          >
            Send my question →
          </button>
          <button onClick={() => setMode("none")} className="w-full text-[11px] text-[#94a3b8] hover:text-white">← Back</button>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <a href="tel:+16478399090" className="flex-1 text-center text-[11px] font-bold text-[#f59e0b] border border-[#1e3a5f] rounded-lg py-2 hover:border-[#f59e0b]">📞 (647) 839-9090</a>
        <a href="https://wa.me/16478399090" target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-[11px] font-bold text-[#94a3b8] border border-[#1e3a5f] rounded-lg py-2 hover:text-[#f59e0b] hover:border-[#f59e0b]">💬 WhatsApp</a>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MOBILE BOTTOM BAR
// ═══════════════════════════════════════════════════════════════
export function MobileBottomBar({ price, isRental, onBook }: { price: number; isRental: boolean; onBook: () => void }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-[#07111f] border-t border-white/10 px-4 py-3 md:hidden flex items-center gap-3"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <div className="min-w-0 flex-shrink-0">
        <p className="text-[14px] font-extrabold text-white leading-tight">
          ${price.toLocaleString()}
          {isRental && <span className="text-[11px] font-normal text-[#94a3b8]">/mo</span>}
        </p>
      </div>
      <button
        onClick={onBook}
        className="flex-1 bg-[#f59e0b] text-[#07111f] text-[13px] font-extrabold rounded-lg py-2.5"
      >
        {isRental ? "Book showing" : "Request showing"}
      </button>
      <a href="tel:+16478399090" className="w-10 h-10 flex items-center justify-center border border-white/15 rounded-lg text-[#f59e0b] text-[16px]">📞</a>
    </div>
  );
}

// Components are consumed individually via named exports by ListingDetailClient.

// Exported separately so it can be placed at the very top of the left column
export function UrgencySection({ viewsToday, domDays, isRental }: { viewsToday: number; domDays: number; isRental: boolean }) {
  return <UrgencyBanner viewsToday={viewsToday} domDays={domDays} isRental={isRental} />;
}
