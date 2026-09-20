"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/UserProvider";
import {
  haversineKm, walkMinutes, driveMinutes, directionsUrl, hasValidCoords,
  GROCERIES, MOSQUES, PARKS, CONSERVATION_AREAS, TRANSIT, COMMUTES, type POI,
} from "@/lib/geo";
import { postLeadDetailed, honeypotInputProps, HONEYPOT_WRAPPER_STYLE } from "@/lib/postLeadClient";
import { hashUserData } from "@/lib/hash";
import { config } from "@/lib/config";
import { REPLY_FINE_PRINT, VALUATION_FINE_PRINT } from "@/lib/lead/finePrint";

// Fires GA4 generate_lead with cold-cache polling (mirrors /rentals/thank-you).
// Same event Google Ads imports as a conversion via the GA4↔Ads link, so listing-
// detail submits attribute alongside the /rentals/ads form submits.
//
// Email + phone (when present) are hashed client-side via SHA-256 and passed
// inside user_data for Enhanced Conversions manual mode. Skip user_data when
// neither contact field is provided so we don't send empty hash fields.
async function fireGenerateLead(
  leadId: string | null | undefined,
  email?: string | null,
  phone?: string | null,
) {
  if (typeof window === "undefined") return;
  const transactionId = leadId || `no-lid-${Date.now()}`;
  const userData = await hashUserData(email, phone);
  const hasUserData = userData.sha256_email_address || userData.sha256_phone_number;
  let fired = false;
  const start = Date.now();
  const tryFire = () => {
    if (fired) return;
    const w = window as unknown as { gtag?: (...a: unknown[]) => void };
    if (typeof w.gtag === "function") {
      // See ThankYouClient.tsx — inline user_data is dropped by gtag.js for GA4.
      // Back-to-back set+event in the same tick is the canonical EC pattern.
      if (hasUserData) w.gtag("set", "user_data", userData);
      w.gtag("event", "generate_lead", {
        transaction_id: transactionId,
        value: 1.0,
        currency: "CAD",
        lead_id: leadId || transactionId,
      });
      fired = true;
      return;
    }
    if (Date.now() - start > 5000) return;
    setTimeout(tryFire, 200);
  };
  tryFire();
}

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
  const shareText = `${address}, ${isRental ? "for rent" : "for sale"} on ${config.SITE_NAME}`;

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
        className={`flex items-center gap-1.5 text-[12px] font-bold rounded-lg px-3 py-2 border transition-colors ${saved ? "bg-[#00ff80] border-[#017848] text-[#073126]" : "border-[#dfe0dc] text-[#017848] hover:bg-[#f6f6f3]"}`}
      >
        <span className="text-[14px]">{saved ? "♥" : "♡"}</span> {saved ? "Saved" : "Save"}
      </button>
      <div className="relative">
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 text-[12px] font-bold rounded-lg px-3 py-2 border border-[#dfe0dc] text-[#3e423f] hover:bg-[#f6f6f3] hover:text-[#017848] transition-colors"
        >
          <span className="text-[14px]">↗</span> Share
        </button>
        {shareOpen && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-[#dfe0dc] rounded-lg shadow-lg min-w-[180px] z-20">
            <button onClick={copyLink} className="block w-full text-left px-3 py-2 text-[12px] text-[#3e423f] hover:bg-[#fffdfa]">
              {copied ? "✓ Copied!" : "📋 Copy link"}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText + "\n" + shareUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 text-[12px] text-[#3e423f] hover:bg-[#fffdfa]"
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
/** The six parks nearest this listing, plus the two conservation areas that are regional
 *  landmarks rather than Town parks. Without a valid coordinate there is no "nearest", so the
 *  list falls back to the two landmarks and the largest District parks — named, undistanced. */
function nearestParks(lat: number, lng: number, coordsValid: boolean): POI[] {
  if (!coordsValid) return [...CONSERVATION_AREAS, ...PARKS.slice(0, 4)];
  return [...CONSERVATION_AREAS, ...PARKS]
    .map((p) => ({ p, km: haversineKm(lat, lng, p.lat, p.lng) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 6)
    .map((x) => x.p);
}

function NearbyRow({ p, lat, lng, commute = false, coordsValid }: { p: POI; lat: number; lng: number; commute?: boolean; coordsValid: boolean }) {
  let timeStr: string;
  if (coordsValid) {
    const km = haversineKm(lat, lng, p.lat, p.lng);
    const time = commute ? driveMinutes(km) : km < 2 ? walkMinutes(km) : driveMinutes(km);
    const mode = commute ? "drive" : km < 2 ? "walk" : "drive";
    timeStr = `${km.toFixed(1)} km · ${time} min ${mode}`;
  } else if (p.fallbackMin) {
    timeStr = `~${p.fallbackMin} min drive from ${config.CITY_NAME}`;
  } else {
    timeStr = `In ${config.CITY_NAME} area`;
  }
  const url = coordsValid
    ? directionsUrl(p.lat, p.lng, lat, lng)
    : directionsUrl(p.lat, p.lng);
  return (
    <div className="flex items-center justify-between gap-3 bg-white border border-[#dfe0dc] rounded-lg px-3 py-2.5 hover:border-[#073126] transition-colors">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-[16px] shrink-0">{p.icon}</span>
        <div className="min-w-0">
          {p.href ? (
            <Link href={p.href} className="text-[13px] font-semibold text-[#073126] hover:text-[#017848] truncate block">
              {p.name}
            </Link>
          ) : (
            <span className="text-[13px] font-semibold text-[#073126] truncate block">{p.name}</span>
          )}
          <p className="text-[11px] text-[#6b6f6a]">{timeStr}</p>
        </div>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] font-semibold text-[#017848] hover:underline shrink-0"
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
    <div className="bg-[#fffdfa] border border-[#dfe0dc] rounded-lg p-4 text-center">
      <p className="text-[13px] font-semibold text-[#3e423f]">Precise distances unavailable for this listing</p>
      <p className="text-[11px] text-[#6b6f6a] mt-1">Coordinates are still syncing. See the Commutes tab for {config.CITY_NAME}-average drive times.</p>
    </div>
  );

  return (
    <div className="mb-8">
      <h2 className="text-[18px] font-extrabold text-[#073126] mb-3">What&apos;s nearby</h2>
      {/* Where the derived fact is the content. With a rooftop these are real distances from
          this house to Town-published school and park geometry; the source is named beside them,
          not only in a footer. Absent when there is nothing derived to attribute. */}
      {coordsValid && (
        <p className="text-[11px] text-[#6b6f6a] mb-3">
          Distances from this property&apos;s municipal address point. Contains information
          licensed under the Open Government Licence – Milton.
        </p>
      )}
      <div className="flex gap-1 mb-4 border-b border-[#dfe0dc] overflow-x-auto">
        {([
          ["commutes", "🏙️ Commutes"],
          ["groceries", "🛒 Groceries"],
          ["schools", "🎓 Schools"],
          ["community", "🕌 Community"],
        ] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`text-[12px] font-semibold px-3 py-2 border-b-2 -mb-[1px] transition-colors whitespace-nowrap ${tab === k ? "border-[#073126] text-[#073126]" : "border-transparent text-[#6b6f6a] hover:text-[#3e423f]"}`}
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
                className="flex items-start justify-between gap-3 bg-white border border-[#dfe0dc] rounded-lg px-3 py-2.5 hover:border-[#073126] transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#073126] truncate">{s.name}</p>
                  <p className="text-[11px] text-[#6b6f6a]">
                    {s.board === "public" ? "Public" : "Catholic"} · {s.grades}
                    {s.fraserScore && ` · Fraser ${s.fraserScore}/10`}
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-[#017848] shrink-0 self-center">→</span>
              </Link>
            ))
          ) : (
            <p className="text-[13px] text-[#6b6f6a] col-span-full py-4">No schools mapped to this neighbourhood yet. <Link href="/schools" className="text-[#017848] hover:underline">browse all {config.CITY_NAME} schools</Link>.</p>
          )}
        </div>
      )}

      {tab === "community" && (
        coordsValid ? (
          <div className="space-y-4">
            <div>
              <h3 className="text-[12px] font-bold text-[#073126] uppercase tracking-[0.08em] mb-2">Mosques</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {MOSQUES.map((p) => <NearbyRow key={p.name} p={p} lat={lat} lng={lng} coordsValid />)}
              </div>
            </div>
            <div>
              <h3 className="text-[12px] font-bold text-[#073126] uppercase tracking-[0.08em] mb-2">Parks & Trails</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {/* The parks list went from 9 hand-entered coordinates to the Town's 93. Rendering
                    all of them would be a wall, and the far ones say nothing about this house —
                    so it is the NEAREST six, which is what the section was always claiming to be
                    back when nine happened to be the whole list. */}
                {nearestParks(lat, lng, coordsValid).map((p) => (
                  <NearbyRow key={p.name} p={p} lat={lat} lng={lng} coordsValid />
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-[12px] font-bold text-[#073126] uppercase tracking-[0.08em] mb-2">Transit</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {TRANSIT.map((p) => <NearbyRow key={p.name} p={p} lat={lat} lng={lng} coordsValid />)}
                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${encodeURIComponent(`${config.CITY_NAME} GO`)}&travelmode=transit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 bg-[#073126] text-[#00ff80] text-[12px] font-semibold rounded-lg px-3 py-2.5 hover:bg-[#0a3d30] transition-colors"
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
      <h2 className="text-[18px] font-extrabold text-[#073126] mb-3">Mortgage & monthly cost</h2>
      <div className="bg-white rounded-xl border border-[#dfe0dc] p-5">
        <div className="flex items-baseline gap-1 mb-4">
          <span className="text-[32px] font-extrabold text-[#073126]">${total.toLocaleString()}</span>
          <span className="text-[13px] text-[#6b6f6a]">/month estimated total</span>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="flex items-center justify-between text-[12px] font-semibold text-[#3e423f] mb-1">
              Down payment <span className="text-[#073126]">{downPct}% · ${down.toLocaleString()}</span>
            </label>
            <input type="range" min="5" max="50" step="1" value={downPct} onChange={(e) => setDownPct(parseInt(e.target.value))} className="w-full accent-[#017848]" />
          </div>
          <div>
            <label className="flex items-center justify-between text-[12px] font-semibold text-[#3e423f] mb-1">
              Interest rate <span className="text-[#073126]">{rate.toFixed(2)}%</span>
            </label>
            <input type="range" min="3" max="8" step="0.25" value={rate} onChange={(e) => setRate(parseFloat(e.target.value))} className="w-full accent-[#017848]" />
          </div>
          <div>
            <label className="flex items-center justify-between text-[12px] font-semibold text-[#3e423f] mb-1">
              Amortization <span className="text-[#073126]">{amort} yrs</span>
            </label>
            <input type="range" min="15" max="30" step="5" value={amort} onChange={(e) => setAmort(parseInt(e.target.value))} className="w-full accent-[#017848]" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-[#f6f6f3] text-center">
          <div><p className="text-[10px] text-[#6b6f6a] uppercase tracking-wider">Mortgage</p><p className="text-[14px] font-bold text-[#073126]">${mortgage.toLocaleString()}</p></div>
          <div><p className="text-[10px] text-[#6b6f6a] uppercase tracking-wider">Tax</p><p className="text-[14px] font-bold text-[#073126]">${taxPerMonth.toLocaleString()}</p></div>
          <div><p className="text-[10px] text-[#6b6f6a] uppercase tracking-wider">Maintenance</p><p className="text-[14px] font-bold text-[#073126]">${maintenance}</p></div>
          <div><p className="text-[10px] text-[#6b6f6a] uppercase tracking-wider">Insurance</p><p className="text-[14px] font-bold text-[#073126]">${insurance}</p></div>
        </div>

        <div className="mt-4 pt-4 border-t border-[#f6f6f3]">
          <label className="flex items-center gap-2 text-[12px] font-semibold text-[#3e423f] mb-2 cursor-pointer">
            <input type="checkbox" checked={firstTime} onChange={(e) => setFirstTime(e.target.checked)} className="accent-[#017848]" />
            First-time homebuyer (applies Ontario rebate up to $4,000)
          </label>
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="text-[#6b6f6a]">Estimated Ontario Land Transfer Tax</span>
            <span className="font-bold text-[#073126]">${ltt.toLocaleString()}</span>
          </div>
        </div>

        <p className="text-[10px] text-[#6b6f6a] mt-3">Estimates only. Call {config.realtor.name.split(" ")[0]} for a full cost breakdown and pre-approval guidance.</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TYPICAL RENT (sale listings; MH-008)
// ═══════════════════════════════════════════════════════════════
// The investment analysis this replaces printed a gross cap rate and a monthly cashflow from
// an assumed 20% down, a 5% rate, a flat maintenance figure and an average ASKING rent from
// the feed, and rendered a negative cashflow as "$-3,341". None of those was a figure this
// site measured. What it does measure is what homes of this type LEASED for: the Board's
// closed leases over 12 months, midpoint, k-gated per home type and unit class in
// src/lib/rentSignals.ts, the same figure the Rent menu states. The block renders only when
// the whole-home figure for this type clears the floor; below it there is nothing to say.
export interface ListingRentFigure {
  /** the home type, in words ("Detached") */
  label: string;
  /** whole-home typical, already formatted ("$3,500/mo"), with its sample ("308 leases") */
  whole: { value: string; sample: string };
  /** basement-unit typical, present only where it cleared the floor */
  basement: { value: string; sample: string } | null;
  /** "last 12 months" */
  window: string;
  /** the date in prose the closed leases run through, or null */
  through: string | null;
}

export function TypicalRentBlock({ rent }: { rent: ListingRentFigure | null }) {
  if (!rent) return null;
  return (
    <div className="mb-8">
      <h2 className="text-[18px] font-extrabold text-[#073126] mb-3">Typical rent, {rent.label.toLowerCase()}</h2>
      <div className="bg-[#073126] text-[#fffdfa] rounded-xl p-5 border border-[#1a5a47]">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-white/60">{rent.basement ? "Whole home" : "Typical rent"}</p>
            <p className="text-[22px] font-extrabold" data-fig="listing-rent-whole" data-value={rent.whole.value}>{rent.whole.value}</p>
            <p className="text-[11px] text-white/60">{rent.window} · {rent.whole.sample}</p>
          </div>
          {rent.basement ? (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-white/60">Basement unit</p>
              <p className="text-[22px] font-extrabold" data-fig="listing-rent-basement" data-value={rent.basement.value}>{rent.basement.value}</p>
              <p className="text-[11px] text-white/60">{rent.window} · {rent.basement.sample}</p>
            </div>
          ) : null}
        </div>
        <p className="text-[11px] text-white/60 leading-relaxed">
          The midpoint of the {rent.label.toLowerCase()} leases the Board recorded as closed in {config.CITY_NAME} in the {rent.window}, where at least five closed.
          {rent.basement ? " Whole home leaves out leases of a basement unit or of the upper floors only." : ""}
          {rent.through ? ` Closed leases through ${rent.through}.` : ""} Not a projection for this home: ask {config.realtor.name.split(" ")[0]} what it would lease for.
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
        rel="nofollow"
        className="block bg-[#073126] text-white rounded-xl p-5 border border-[#1a5a47] hover:border-[#00ff80] transition-colors"
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[15px] font-extrabold mb-1">{heading}</p>
            <p className="text-[12px] text-white/60">
              Sign in free to view sold prices, price history, and days on market.
            </p>
          </div>
          <span className="text-[#00ff80] text-[14px] font-bold whitespace-nowrap">View sold prices →</span>
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
  const [honey, setHoney] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!email.includes("@")) return;
    setBusy(true);
    setErr("");
    // Both variants are a listing intent, which is what "sell" means to the value model.
    // "list-rental" and "seller" both normalized to a 0 lead value before Phase 1.
    const result = await postLeadDetailed({
      source: isRental ? "landlord-listing-page" : "seller-listing-page",
      intent: "sell",
      email,
      name: "Valuation request",
      mlsNumber: mls,
      consentText: VALUATION_FINE_PRINT,
      consentTimestamp: new Date().toISOString(),
      honeypot: honey,
    });
    setBusy(false);
    if (!result.ok) {
      setErr(result.error || "Could not submit. Please try again.");
      return;
    }
    fireGenerateLead(result.leadId, email, null);
    setSent(true);
  };

  return (
    <div className="mb-8">
      <div className="bg-[#073126] text-white rounded-xl p-6 border border-[#1a5a47]">
        <p className="text-[11px] font-bold text-[#00ff80] uppercase tracking-[0.14em] mb-2">
          {isRental ? `${config.CITY_NAME} landlord?` : `${config.CITY_NAME} homeowner?`}
        </p>
        <h3 className="text-[20px] font-extrabold mb-2">
          {isRental ? `Thinking about renting out your ${config.CITY_NAME} home?` : `Own a similar home in ${config.CITY_NAME}?`}
        </h3>
        <p className="text-[13px] text-white/60 mb-4 leading-relaxed">
          {isRental
            ? `${config.realtor.name.split(" ")[0]} manages rentals across ${config.CITY_NAME}. Free rental valuation: find out what your home earns per month.`
            : "Get a free valuation in 24 hours: see what a home like this could list for today."}
        </p>
        {sent ? (
          <p className="text-[13px] text-[#86efac] font-semibold">✓ Thanks. {config.realtor.name.split(" ")[0]} will email your valuation within 24 hours.</p>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 bg-[#0a3d30] border border-[#1a5a47] rounded-lg px-3 py-2.5 text-[13px] text-white placeholder:text-white/40 outline-none focus:border-[#00ff80]"
            />
            <button
              onClick={submit}
              disabled={busy}
              className="bg-[#00ff80] text-[#073126] text-[13px] font-extrabold rounded-lg px-5 py-2.5 hover:bg-[#5cffa8] transition-colors disabled:opacity-60"
            >
              {busy ? "Sending…" : isRental ? "Get my rental estimate →" : "Get my valuation →"}
            </button>
            {/* Honeypot. A person never sees it; a bot fills it and the row is silently dropped. */}
            <div style={HONEYPOT_WRAPPER_STYLE} aria-hidden="true">
              <label>
                Company website
                <input {...honeypotInputProps} type="text" value={honey} onChange={(e) => setHoney(e.target.value)} />
              </label>
            </div>
          </div>
        )}
        {err && !sent && <p className="text-[12px] text-[#fca5a5] mt-2">{err}</p>}
        {!sent && <p className="text-[10px] text-white/50 mt-3 leading-snug">{VALUATION_FINE_PRINT}</p>}
      </div>
    </div>
  );
}

// The urgency banner ("New to market · listed Nd ago") was removed by MC-029: days since the
// list date is the listing's time on market, a VOW-only fact. The island (ListingVowFacts)
// shows it to an acknowledged session.

// ═══════════════════════════════════════════════════════════════
// SIDEBAR — rental booking w/ pets + move-in
// ═══════════════════════════════════════════════════════════════
export function RentalBookingCard({ mls, address, price }: { mls: string; address: string; price: number }) {
  const [mode, setMode] = useState<"none" | "book" | "ask">("none");
  const [honey, setHoney] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [moveIn, setMoveIn] = useState("");
  const [pets, setPets] = useState<"yes" | "no" | "">("");
  const [msg, setMsg] = useState("");
  const [question, setQuestion] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (source: string, payload: { name: string; email: string; phone: string; notes?: string }) => {
    setErr("");
    if (!payload.name || !payload.email || !payload.phone) {
      setErr("Name, email and phone are all required.");
      return;
    }
    const result = await postLeadDetailed({
      source,
      intent: "rent",
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      notes: payload.notes,
      property_address: address,
      mlsNumber: mls,
      consentText: REPLY_FINE_PRINT,
      consentTimestamp: new Date().toISOString(),
      honeypot: honey,
    });
    if (!result.ok) {
      setErr(result.error || "Could not submit. Please try again.");
      return;
    }
    fireGenerateLead(result.leadId, payload.email, payload.phone);
    setSent(true);
  };

  if (sent) {
    return (
      <div className="bg-[#073126] rounded-2xl p-6">
        <p className="text-[16px] font-extrabold text-[#86efac] mb-2">✓ Request received</p>
        <p className="text-[13px] text-[#c7c9c5]">{config.realtor.name.split(" ")[0]} usually replies within the hour during business hours.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#073126] rounded-2xl p-6">
      <p className="text-[22px] font-extrabold text-white">${price.toLocaleString()}<span className="text-[14px] font-normal text-white/60">/month</span></p>
      <p className="text-[11px] text-white/60 mt-1 mb-5">Available now · {config.realtor.name.split(" ")[0]} usually replies within the hour</p>

      {mode === "none" && (
        <div className="space-y-2">
          <button onClick={() => setMode("book")} className="w-full bg-[#00ff80] text-[#073126] text-[14px] font-extrabold rounded-lg py-3 hover:bg-[#5cffa8] transition-colors">
            Book a showing
          </button>
          <button onClick={() => setMode("ask")} className="w-full border border-[#1a5a47] text-white/60 text-[13px] font-semibold rounded-lg py-2.5 hover:border-[#00ff80] hover:text-[#00ff80] transition-colors">
            Ask a question
          </button>
        </div>
      )}

      {mode === "book" && (
        <div className="space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full px-3 py-2.5 text-[12px] bg-[#0a3d30] border border-[#1a5a47] rounded-lg text-white placeholder:text-white/40 outline-none focus:border-[#00ff80]" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className="w-full px-3 py-2.5 text-[12px] bg-[#0a3d30] border border-[#1a5a47] rounded-lg text-white placeholder:text-white/40 outline-none focus:border-[#00ff80]" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="Phone" className="w-full px-3 py-2.5 text-[12px] bg-[#0a3d30] border border-[#1a5a47] rounded-lg text-white placeholder:text-white/40 outline-none focus:border-[#00ff80]" />
          <input value={moveIn} onChange={(e) => setMoveIn(e.target.value)} type="date" placeholder="Preferred move-in" className="w-full px-3 py-2.5 text-[12px] bg-[#0a3d30] border border-[#1a5a47] rounded-lg text-white outline-none focus:border-[#00ff80]" />
          <div>
            <p className="text-[11px] text-white/60 mb-1.5">Bringing pets?</p>
            <div className="flex gap-2">
              {(["yes", "no"] as const).map((v) => (
                <button key={v} onClick={() => setPets(v)} className={`flex-1 text-[12px] font-semibold rounded-lg py-2 border ${pets === v ? "border-[#017848] bg-[#00ff80]/10 text-[#00ff80]" : "border-[#1a5a47] text-white/60"}`}>
                  {v === "yes" ? "Yes" : "No"}
                </button>
              ))}
            </div>
          </div>
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message (optional)" rows={2} className="w-full px-3 py-2.5 text-[12px] bg-[#0a3d30] border border-[#1a5a47] rounded-lg text-white placeholder:text-white/40 outline-none focus:border-[#00ff80] resize-none" />
          {/* Honeypot. A person never sees it; a bot fills it and the row is silently dropped. */}
          <div style={HONEYPOT_WRAPPER_STYLE} aria-hidden="true">
            <label>
              Company website
              <input {...honeypotInputProps} type="text" value={honey} onChange={(e) => setHoney(e.target.value)} />
            </label>
          </div>
          {err && <p className="text-[11px] text-[#fca5a5]">{err}</p>}
          <button
            onClick={() => submit("rental-detail-book", { name, email, phone, notes: [msg, moveIn ? `Move-in: ${moveIn}` : "", pets ? `Pets: ${pets}` : ""].filter(Boolean).join(". ") })}
            className="w-full bg-[#00ff80] text-[#073126] text-[13px] font-extrabold rounded-lg py-3 hover:bg-[#5cffa8] transition-colors mt-1"
          >
            Submit booking request →
          </button>
          <p className="text-[10px] text-white/50 leading-snug">{REPLY_FINE_PRINT}</p>
          <button onClick={() => setMode("none")} className="w-full text-[11px] text-white/60 hover:text-white">← Back</button>
        </div>
      )}

      {mode === "ask" && (
        <div className="space-y-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full px-3 py-2.5 text-[12px] bg-[#0a3d30] border border-[#1a5a47] rounded-lg text-white placeholder:text-white/40 outline-none focus:border-[#00ff80]" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" className="w-full px-3 py-2.5 text-[12px] bg-[#0a3d30] border border-[#1a5a47] rounded-lg text-white placeholder:text-white/40 outline-none focus:border-[#00ff80]" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="Phone" className="w-full px-3 py-2.5 text-[12px] bg-[#0a3d30] border border-[#1a5a47] rounded-lg text-white placeholder:text-white/40 outline-none focus:border-[#00ff80]" />
          <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What would you like to know?" rows={3} className="w-full px-3 py-2.5 text-[12px] bg-[#0a3d30] border border-[#1a5a47] rounded-lg text-white placeholder:text-white/40 outline-none focus:border-[#00ff80] resize-none" />
          {/* Honeypot. A person never sees it; a bot fills it and the row is silently dropped. */}
          <div style={HONEYPOT_WRAPPER_STYLE} aria-hidden="true">
            <label>
              Company website
              <input {...honeypotInputProps} type="text" value={honey} onChange={(e) => setHoney(e.target.value)} />
            </label>
          </div>
          {err && <p className="text-[11px] text-[#fca5a5]">{err}</p>}
          <button
            onClick={() => submit("rental-detail-question", { name, email, phone, notes: question })}
            className="w-full bg-[#00ff80] text-[#073126] text-[13px] font-extrabold rounded-lg py-3 hover:bg-[#5cffa8] transition-colors"
          >
            Send my question →
          </button>
          <p className="text-[10px] text-white/50 leading-snug">{REPLY_FINE_PRINT}</p>
          <button onClick={() => setMode("none")} className="w-full text-[11px] text-white/60 hover:text-white">← Back</button>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <a href={`tel:${config.realtor.phoneE164}`} className="flex-1 text-center text-[11px] font-bold text-[#00ff80] border border-[#1a5a47] rounded-lg py-2 hover:border-[#00ff80]">📞 {config.realtor.phone}</a>
        <a href="https://wa.me/16478399090" target="_blank" rel="noopener noreferrer" className="flex-1 text-center text-[11px] font-bold text-white/60 border border-[#1a5a47] rounded-lg py-2 hover:text-[#00ff80] hover:border-[#00ff80]">💬 WhatsApp</a>
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
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-[#073126] border-t border-white/10 px-4 py-3 md:hidden flex items-center gap-3"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <div className="min-w-0 flex-shrink-0">
        <p className="text-[14px] font-extrabold text-white leading-tight">
          ${price.toLocaleString()}
          {isRental && <span className="text-[11px] font-normal text-white/60">/mo</span>}
        </p>
      </div>
      <button
        onClick={onBook}
        className="flex-1 bg-[#00ff80] text-[#073126] text-[13px] font-extrabold rounded-lg py-2.5"
      >
        {isRental ? "Book showing" : "Request showing"}
      </button>
      <a href={`tel:${config.realtor.phoneE164}`} className="w-10 h-10 flex items-center justify-center border border-white/15 rounded-lg text-[#017848] text-[16px]">📞</a>
    </div>
  );
}

// Components are consumed individually via named exports by ListingDetailClient.

