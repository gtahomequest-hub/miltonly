"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/components/UserProvider";
import { formatPriceFull, daysAgo } from "@/lib/format";
import { attributionPayload } from "@/lib/attribution";
import { config } from "@/lib/config";

export interface CardListing {
  mlsNumber: string;
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number | null;
  propertyType: string;
  status: string;
  transactionType: string | null;
  photos: string[];
  listedAt: string;
  neighbourhood: string;
  daysOnMarket: number | null;
  listOfficeName: string | null;
}

const ALL_CAPS_FIXUPS: Record<string, string> = {
  "Remax": "RE/MAX",
  "Re/Max": "RE/MAX",
  "Mls": "MLS",
  "Ltd": "Ltd.",
  "Inc": "Inc.",
  "Re": "RE",
};
const SMALL_WORDS = new Set(["of", "at", "the", "in", "and", "on", "for", "by", "to"]);
function titleCase(s: string): string {
  if (!s) return s;
  const out = s
    .toLowerCase()
    .split(/(\s+|-|\/)/)
    .map((tok, i) => {
      if (!tok.trim() || tok === "/" || tok === "-") return tok;
      if (i > 0 && SMALL_WORDS.has(tok)) return tok;
      return tok.charAt(0).toUpperCase() + tok.slice(1);
    })
    .join("");
  return Object.entries(ALL_CAPS_FIXUPS).reduce(
    (acc, [from, to]) => acc.replace(new RegExp(`\\b${from}\\b`, "g"), to),
    out,
  );
}
const hoodOf = (h: string) => h.replace(/^\d+\s*-\s*\w+\s+/, "").trim();
const propertyBadgeLabel = (t: string) => {
  const l = (t || "").toLowerCase();
  if (l === "detached") return "Detached";
  if (l === "semi") return "Semi";
  if (l === "townhouse") return "Townhouse";
  if (l === "condo") return "Condo";
  return t;
};

export default function ListingsCardsClient({ listings }: { listings: CardListing[] }) {
  const router = useRouter();
  const { user, isListingSaved, saveListing, unsaveListing } = useUser();
  const [toast, setToast] = useState("");
  const [bookingModal, setBookingModal] = useState<CardListing | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const handleSave = async (e: React.MouseEvent, mls: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      router.push("/signin?redirect=/listings");
      return;
    }
    if (isListingSaved(mls)) {
      await unsaveListing(mls);
      showToast("Removed from saved");
    } else {
      await saveListing(mls);
      showToast("Saved to your listings");
    }
  };

  const handleBook = (e: React.MouseEvent, l: CardListing) => {
    e.preventDefault();
    e.stopPropagation();
    setBookingModal(l);
  };

  const submitBooking = async () => {
    if (!bookingModal) return;
    const name = (document.getElementById("lc-bk-name") as HTMLInputElement)?.value;
    const phone = (document.getElementById("lc-bk-phone") as HTMLInputElement)?.value;
    if (!name) { showToast("Enter your name"); return; }
    if (!phone) { showToast("Enter your phone number"); return; }
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: name,
          phone,
          source: "listing-card-book",
          intent: "buyer",
          street: bookingModal.address,
          mlsNumber: bookingModal.mlsNumber,
          ...attributionPayload(),
        }),
      });
      showToast(`Showing requested — ${config.realtor.name.split(" ")[0]} will call you within the hour`);
      setBookingModal(null);
    } catch {
      showToast("Could not submit — please try again");
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {listings.map((l) => {
          const days = daysAgo(new Date(l.listedAt));
          const dom = l.daysOnMarket ?? days;
          const isRental = l.transactionType === "For Lease";
          const saved = isListingSaved(l.mlsNumber);
          const cleanedAddress = titleCase(l.address);
          const cleanedBrokerage = l.listOfficeName ? titleCase(l.listOfficeName) : "MLS®";
          const rawHood = hoodOf(l.neighbourhood);
          const cleanedHood = titleCase(rawHood);
          return (
            <Link
              key={l.mlsNumber}
              href={`/listings/${l.mlsNumber}`}
              className="group bg-white rounded-xl border border-[#e2e8f0] overflow-hidden hover:shadow-lg transition-all block"
            >
              {/* Photo */}
              <div className="aspect-[3/2] relative bg-[#f1f5f9]">
                {l.photos[0] ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={l.photos[0]} alt={cleanedAddress} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#cbd5e1] text-[32px]">🏠</div>
                )}
                {days <= 3 && (
                  <span className="absolute top-2.5 left-2.5 bg-[#07111f] text-[#f59e0b] text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {days === 0 ? "New today" : "New"}
                  </span>
                )}
                {l.photos.length > 1 && (
                  <span className="absolute bottom-2.5 right-2.5 bg-black/70 text-white text-[11px] font-bold px-2.5 py-1 rounded-md flex items-center gap-1.5 backdrop-blur-sm">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
                    {l.photos.length}
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => handleSave(e, l.mlsNumber)}
                  className={`absolute top-2.5 right-2.5 w-9 h-9 rounded-full flex items-center justify-center text-[18px] transition-colors ${saved ? "bg-[#f59e0b] text-white" : "bg-white/90 text-[#07111f] hover:bg-white"}`}
                  aria-label={saved ? "Unsave listing" : "Save listing"}
                >
                  {saved ? "♥" : "♡"}
                </button>
              </div>

              {/* Body */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="min-w-0">
                    <p className="text-[20px] font-extrabold text-[#07111f] tracking-[-0.3px]">
                      {formatPriceFull(l.price)}
                      {isRental ? <span className="text-[13px] font-normal text-[#94a3b8]">/mo</span> : ""}
                    </p>
                    <p className="text-[13px] font-medium text-[#475569] mt-0.5">
                      {l.bedrooms} bd · {l.bathrooms} ba
                      {l.sqft ? ` · ${l.sqft.toLocaleString()} sqft` : ""}
                      {` · ${dom}d on market`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${isRental ? "bg-[#eff6ff] text-[#1e3a8a]" : l.status === "sold" ? "bg-[#fef2f2] text-[#991b1b]" : "bg-[#15803d] text-white"}`}>
                      {isRental ? "Lease" : l.status}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#07111f] text-[#cbd5e1]">
                      {propertyBadgeLabel(l.propertyType)}
                    </span>
                  </div>
                </div>
                <p className="text-[13px] font-medium text-[#64748b] truncate">{cleanedAddress}</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    router.push(`/listings?neighbourhood=${encodeURIComponent(rawHood)}`);
                  }}
                  className="text-[12px] font-medium text-[#64748b] hover:text-[#f59e0b] mt-1 block text-left transition-colors"
                >
                  {cleanedHood} →
                </button>
                <p className="text-[12px] text-[#94a3b8] mt-2">
                  {cleanedBrokerage} · {days === 0 ? "Listed today" : `${days}d on ${config.SITE_NAME}`}
                </p>
                <button
                  type="button"
                  onClick={(e) => handleBook(e, l)}
                  className="mt-3 w-full bg-[#07111f] text-white text-[13px] font-bold py-2.5 rounded-lg hover:bg-[#0c1e35] transition-colors"
                >
                  Book showing
                </button>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Booking modal */}
      {bookingModal && (
        <div onClick={() => setBookingModal(null)} className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-start justify-between mb-4">
              <div className="min-w-0">
                <p className="text-[16px] font-extrabold text-[#07111f]">Book a showing</p>
                <p className="text-[13px] text-[#64748b] mt-1 truncate">{titleCase(bookingModal.address)}</p>
                <p className="text-[12px] text-[#94a3b8] mt-0.5">MLS® {bookingModal.mlsNumber}</p>
              </div>
              <button onClick={() => setBookingModal(null)} className="text-[#94a3b8] hover:text-[#07111f] text-[22px] leading-none shrink-0" aria-label="Close">×</button>
            </div>
            <input id="lc-bk-name" placeholder="Your name" className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2.5 text-[14px] mb-2 outline-none focus:border-[#07111f]" />
            <input id="lc-bk-phone" placeholder="Phone" type="tel" className="w-full border border-[#e2e8f0] rounded-lg px-3 py-2.5 text-[14px] mb-3 outline-none focus:border-[#07111f]" />
            <button onClick={submitBooking} className="w-full bg-[#f59e0b] text-[#07111f] font-bold rounded-lg py-3 text-[14px] hover:bg-[#fbbf24] transition-colors">
              Request showing
            </button>
            <p className="text-[11px] text-[#94a3b8] mt-2 text-center">{config.realtor.name.split(" ")[0]} confirms within the hour · no obligation</p>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 bg-[#07111f] border border-[#1e3a5f] text-white px-4 py-3 rounded-lg text-[13px] font-medium z-50 shadow-xl">
          {toast}
        </div>
      )}
    </>
  );
}
