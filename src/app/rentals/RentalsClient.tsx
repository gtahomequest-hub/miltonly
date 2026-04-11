"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { formatPriceFull, daysAgo } from "@/lib/format";
import AgentContactSection from "@/components/AgentContactSection";
import "./rentals.css";

interface Listing {
  mlsNumber: string;
  address: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  propertyType: string;
  status: string;
  photos: string[];
  listedAt: string;
  neighbourhood: string;
  description: string | null;
  transactionType: string | null;
  petsAllowed: string | null;
  rentIncludes: string[];
  laundryFeatures: string | null;
  cooling: string | null;
  heatType: string | null;
  furnished: string | null;
  possessionDetails: string | null;
  minLeaseTerm: number | null;
  locker: string | null;
  basement: boolean;
}

interface RentAvg {
  label: string;
  avg: number;
  type: string;
  beds: number;
}

interface Props {
  listings: Listing[];
  totalRentals: number;
  avgRent: number;
  rentAvgs: RentAvg[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function RentalsClient({ listings, totalRentals, avgRent, rentAvgs }: Props) {
  // ── WIZARD STATE ──
  const [wizStep, setWizStep] = useState(1);
  const [wizData, setWizData] = useState({ type: "", budget: "", prio: "", beds: 1, park: 0, pet: "No pet", timeline: "" });
  const [wizSuccess, setWizSuccess] = useState(false);
  const [userName, setUserName] = useState("");

  // ── SEARCH STATE ──
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── FILTER STATE ──
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [typeFilter, setTypeFilter] = useState("All");
  const [filters, setFilters] = useState<Record<string, string>>({
    type: "All", beds: "Any", baths: "Any", avail: "Now", pets: "Any", util: "Any", basement: "Any", lease: "Any", park: "Any",
  });
  const [priceMin, setPriceMin] = useState(500);
  const [priceMax, setPriceMax] = useState(5000);
  const [sortBy, setSortBy] = useState("newest");
  const [availPill, setAvailPill] = useState("Available now");

  // ── UI STATE ──
  const [toast, setToast] = useState("");
  const [, setBookingMls] = useState("");
  const [bookingModal, setBookingModal] = useState<{ listing: Listing; type: "book" | "1hr" } | null>(null);

  // Fix overflow-x:hidden on body which breaks CSS sticky — restore it on unmount
  useEffect(() => {
    document.documentElement.style.overflowX = "clip";
    document.body.style.overflowX = "clip";
    return () => {
      document.documentElement.style.overflowX = "";
      document.body.style.overflowX = "";
    };
  }, []);



  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }, []);

  const submitLead = async (data: Record<string, string>) => {
    try {
      await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      return true;
    } catch { return false; }
  };

  const tglFilter = useCallback((key: string, val: string) => {
    setFilters((f) => ({ ...f, [key]: val }));
    if (key === "type") setTypeFilter(val);
  }, []);

  // ── FILTER + SORT LOGIC ──
  const filteredListings = useMemo(() => {
    const result = listings.filter((l) => {
      // Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchAddr = l.address.toLowerCase().includes(q);
        const matchMls = l.mlsNumber.toLowerCase().includes(q);
        const matchHood = l.neighbourhood.toLowerCase().includes(q);
        const matchType = l.propertyType.toLowerCase().includes(q);
        const matchDesc = l.description?.toLowerCase().includes(q) || false;
        if (!matchAddr && !matchMls && !matchHood && !matchType && !matchDesc) return false;
      }
      // Type
      if (typeFilter !== "All" && l.propertyType !== typeFilter.toLowerCase()) return false;
      // Beds
      if (filters.beds !== "Any") {
        const val = parseInt(filters.beds);
        if (filters.beds === "5+") { if (l.bedrooms < 5) return false; }
        else { if (l.bedrooms !== val) return false; }
      }
      // Baths
      if (filters.baths !== "Any") {
        const val = parseInt(filters.baths);
        if (filters.baths === "4+") { if (l.bathrooms < 4) return false; }
        else { if (l.bathrooms !== val) return false; }
      }
      // Price
      if (l.price < priceMin || l.price > priceMax) return false;
      // Parking
      if (filters.park !== "Any") {
        const min = parseInt(filters.park);
        if (l.parking < min) return false;
      }
      // Basement
      if (filters.basement === "Yes" && !l.basement) return false;
      if (filters.basement === "No" && l.basement) return false;
      // Pets
      if (filters.pets === "Pets OK" && (!l.petsAllowed || l.petsAllowed.toLowerCase() === "no" || l.petsAllowed.toLowerCase() === "none")) return false;
      if (filters.pets === "No pets" && l.petsAllowed && l.petsAllowed.toLowerCase() !== "no" && l.petsAllowed.toLowerCase() !== "none") return false;
      // Utilities
      if (filters.util === "Included" && (!l.rentIncludes || l.rentIncludes.length === 0)) return false;
      if (filters.util === "Tenant pays" && l.rentIncludes && l.rentIncludes.length > 0) return false;
      // Lease term
      if (filters.lease !== "Any") {
        if (filters.lease === "Month-to-month" && l.minLeaseTerm && l.minLeaseTerm > 1) return false;
        if (filters.lease === "6 months" && l.minLeaseTerm && l.minLeaseTerm > 6) return false;
        if (filters.lease === "12 months" && l.minLeaseTerm && l.minLeaseTerm > 12) return false;
      }
      // Move-in / availability
      if (filters.avail !== "Now" && filters.avail !== "Flexible") {
        const poss = (l.possessionDetails || "").toLowerCase();
        const month = filters.avail.toLowerCase();
        if (!poss.includes(month) && !poss.includes("flexible") && !poss.includes("tbd") && poss !== "vacant" && poss !== "immediate") return false;
      }
      if (filters.avail === "Now") {
        // "Now" = available now / immediate / vacant — don't filter out if possession is unknown
        const poss = (l.possessionDetails || "").toLowerCase();
        const futureMonths = ["may", "june", "july", "august", "september", "october", "november", "december"];
        const isFuture = futureMonths.some((m) => poss.includes(m));
        if (isFuture) return false;
      }
      return true;
    });

    // Sort
    if (sortBy === "price_asc") result.sort((a, b) => a.price - b.price);
    else if (sortBy === "price_desc") result.sort((a, b) => b.price - a.price);
    else result.sort((a, b) => new Date(b.listedAt).getTime() - new Date(a.listedAt).getTime());

    return result;
  }, [listings, searchQuery, typeFilter, filters, priceMin, priceMax, sortBy]);

  const progWidth = [0, 17, 33, 50, 67, 83, 100][wizStep - 1] || 0;
  const typeIcons: Record<string, string> = { detached: "🏠", semi: "🏘", townhouse: "🏗", condo: "🏢", other: "🏠" };

  // ── SEARCH HANDLER ──
  const handleSearch = () => {
    if (!searchQuery.trim()) {
      showToast("Type a street, MLS # or neighbourhood to search");
      return;
    }
    setSearchOpen(false);
    document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" });
    showToast(`🔍 Showing results for "${searchQuery}"`);
  };

  // ── BOOKING HANDLER (listing cards) ──
  const handleBookShowing = (listing: Listing) => {
    setBookingModal({ listing, type: "book" });
  };

  const handleOneHourShowing = (listing: Listing) => {
    setBookingModal({ listing, type: "1hr" });
  };

  const submitBooking = async () => {
    if (!bookingModal) return;
    const name = (document.getElementById("bm-name") as HTMLInputElement)?.value;
    const phone = (document.getElementById("bm-phone") as HTMLInputElement)?.value;
    if (!name) { showToast("Please enter your name."); return; }
    if (!phone) { showToast("Please enter your phone number."); return; }
    const ok = await submitLead({
      firstName: name,
      phone,
      source: bookingModal.type === "1hr" ? "listing-card-1hr" : "listing-card-book",
      intent: "renter",
      street: bookingModal.listing.address,
    });
    if (ok) {
      setBookingMls(bookingModal.listing.mlsNumber);
      const msg = bookingModal.type === "1hr"
        ? `⏱ 1-hour showing confirmed for ${bookingModal.listing.address.split(",")[0]}! We'll call you.`
        : `✓ Showing request sent for ${bookingModal.listing.address.split(",")[0]}!`;
      showToast(msg);
      setBookingModal(null);
    }
  };

  return (
    <div className="rentals-page">
      {/* ═══ HERO ═══ */}
      <div className="hero">
        {/* ── LEFT PANEL ── */}
        <div className="hl">
          <div className="live-badge"><span className="live-dot" />{totalRentals} active rentals · live TREB data</div>
          <h1>Find your next<br />home in <em>Milton</em></h1>
          <p className="hl-desc">Browse every active rental — condos, townhouses and detached homes. <strong>Same-day showings guaranteed.</strong></p>

          {/* Search box */}
          <div className="sbox" ref={searchRef}>
            <div className="srow">
              <input
                className="sinput"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(false); }}
                onFocus={() => { if (!searchQuery) setSearchOpen(true); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                placeholder="Street, MLS #, neighbourhood, school or GO station..."
              />
              <button className="sbtn" onClick={handleSearch}>Search →</button>
            </div>

            {/* Search dropdown — shows when input focused + empty */}
            {searchOpen && (
              <div className="sdrop open">
                <div className="sdi" onClick={() => { setSearchOpen(false); tglFilter("type", "All"); setSearchQuery(""); document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" }); }}>
                  <div className="sdi-ico am">🏠</div>
                  <div><div className="sdi-main">See all {totalRentals} active Milton rentals</div><div className="sdi-sub">Condos, townhouses, detached — all listings</div></div>
                </div>
                <div className="sdi" onClick={() => { setSearchOpen(false); tglFilter("type", "Condo"); setSearchQuery(""); showToast("🏢 Showing condos only"); document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" }); }}>
                  <div className="sdi-ico bl">🏢</div>
                  <div><div className="sdi-main">Show condos only</div><div className="sdi-sub">All Milton condo rentals</div></div>
                </div>
                <div className="sdi" onClick={() => { setSearchQuery("Main St"); setSearchOpen(false); showToast("🔍 Searching Main St..."); document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" }); }}>
                  <div className="sdi-ico gr">📍</div>
                  <div><div className="sdi-main">Main Street rentals</div><div className="sdi-sub">Popular Milton street</div></div>
                </div>
              </div>
            )}

            {/* Filter pills — Budget */}
            <div className="fpill-row">
              <span className="fpill-label">Budget:</span>
              {[
                { label: "Any price", min: 500, max: 5000 },
                { label: "Under $2K", min: 500, max: 2000 },
                { label: "$2K–$2.5K", min: 2000, max: 2500 },
                { label: "$2.5K–$3K", min: 2500, max: 3000 },
                { label: "$3K+", min: 3000, max: 5000 },
              ].map((p) => (
                <button key={p.label} className={`fpill${priceMin === p.min && priceMax === p.max ? " on" : ""}`} onClick={() => { setPriceMin(p.min); setPriceMax(p.max); document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" }); }}>
                  {p.label}
                </button>
              ))}
            </div>
            {/* Filter pills — Type */}
            <div className="fpill-row">
              <span className="fpill-label">Type:</span>
              {[
                { label: "Any", val: "All" },
                { label: "Condo/Apt", val: "Condo" },
                { label: "Townhouse", val: "Townhouse" },
                { label: "Semi-Det", val: "Semi" },
                { label: "Detached", val: "Detached" },
              ].map((p) => (
                <button key={p.label} className={`fpill${filters.type === p.val ? " on" : ""}`} onClick={() => { tglFilter("type", p.val); document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" }); }}>
                  {p.label}
                </button>
              ))}
            </div>
            {/* Filter pills — Beds + Move-in dropdown */}
            <div className="fpill-row">
              <span className="fpill-label">Beds:</span>
              {[
                { label: "Any", val: "Any" },
                { label: "1 bed", val: "1" },
                { label: "2 bed", val: "2" },
                { label: "3 bed", val: "3" },
                { label: "4+ bed", val: "4" },
              ].map((p) => (
                <button key={p.label} className={`fpill${filters.beds === p.val ? " on" : ""}`} onClick={() => { tglFilter("beds", p.val); document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" }); }}>
                  {p.label}
                </button>
              ))}
              <select className="fpill-select" value={availPill} onChange={(e) => { setAvailPill(e.target.value); tglFilter("avail", e.target.value === "Available now" ? "Now" : e.target.value === "Flexible" ? "Flexible" : e.target.value.replace(" 2026", "")); }}>
                <option value="Available now">Any move-in</option>
                <option value="Available now">Available now</option>
                <option value="May 2026">May 2026</option>
                <option value="June 2026">June 2026</option>
                <option value="July 2026">July 2026</option>
                <option value="Flexible">Flexible</option>
              </select>
            </div>
          </div>

          <div className="trust-row">
            <div className="ti">14 Years Full-Time Experience</div>
            <div className="ti">Tenants · Landlords · Buyers · Sellers</div>
            <div className="ti">Milton Specialist</div>
            <div className="ti">🏆 RE/MAX Hall of Fame</div>
          </div>
        </div>

        {/* ── MIDDLE — WIZARD ── */}
        <div className="hm">
          <div className="wiz-topbar">
            <div className="wiz-brand">Let Miltonly find you<em> what you&apos;re looking for.</em></div>
            <div className="wiz-sub">6 quick questions · 60 seconds · no commitment</div>
            <div className="prog-track"><div className="prog-bar" style={{ width: `${progWidth}%` }} /></div>
          </div>
          <div className="wiz-body">
            {!wizSuccess ? (
              <>
                {/* Step 1 — Type */}
                {wizStep === 1 && (
                  <div className="wiz-step active">
                    <div className="q-meta"><div className="q-badge">1</div><span className="q-of">Question 1 of 6</span></div>
                    <div className="q-text">What kind of home are you looking for?</div>
                    <div className="opt-grid">
                      {[{ icon: "🏠", label: "Detached" }, { icon: "🏘", label: "Semi-detached" }, { icon: "🏗", label: "Townhouse" }, { icon: "🏢", label: "Condo / apt" }].map((t) => (
                        <div key={t.label} className={`opt-tile${wizData.type === t.label ? " sel" : ""}`} onClick={() => {
                          setWizData({ ...wizData, type: t.label });
                          showToast(`✓ ${t.label} selected`);
                          setTimeout(() => setWizStep(2), 500);
                        }}>
                          <div className="opt-tick">✓</div>
                          <span className="opt-ico">{t.icon}</span>
                          <div className="opt-lbl">{t.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 2 — Budget */}
                {wizStep === 2 && (
                  <div className="wiz-step active">
                    <div className="q-meta"><div className="q-badge">2</div><span className="q-of">Question 2 of 6</span></div>
                    <div className="q-text">What&apos;s your monthly budget?</div>
                    <div className="opt-grid">
                      {["Under $2,000", "$2,000–$2,500", "$2,500–$3,000", "$3,000+"].map((b) => (
                        <div key={b} className={`opt-tile${wizData.budget === b ? " sel" : ""}`} onClick={() => {
                          setWizData({ ...wizData, budget: b });
                          showToast(`✓ Budget: ${b}/month`);
                          setTimeout(() => setWizStep(3), 500);
                        }}>
                          <div className="opt-tick">✓</div>
                          <span className="opt-ico" style={{ fontSize: 18, marginBottom: 5 }}>💰</span>
                          <div className="opt-lbl">{b}</div>
                        </div>
                      ))}
                    </div>
                    <div className="back-lnk" onClick={() => setWizStep(1)}>← Back</div>
                  </div>
                )}

                {/* Step 3 — Priority */}
                {wizStep === 3 && (
                  <div className="wiz-step active">
                    <div className="q-meta"><div className="q-badge">3</div><span className="q-of">Question 3 of 6</span></div>
                    <div className="q-text">What matters most to you?</div>
                    <div className="prio-list">
                      {[{ icon: "🚂", label: "Close to Milton GO station" }, { icon: "🎓", label: "Good school zone" }, { icon: "🌳", label: "Near parks & playgrounds" }, { icon: "🏡", label: "Quiet neighbourhood" }, { icon: "✌️", label: "No preference" }].map((p) => (
                        <div key={p.label} className={`prio-tile${wizData.prio === p.label ? " sel" : ""}`} onClick={() => {
                          setWizData({ ...wizData, prio: p.label });
                          showToast(`✓ Priority: ${p.label}`);
                          setTimeout(() => setWizStep(4), 500);
                        }}>
                          <span className="prio-ico">{p.icon}</span>
                          <span className="prio-txt">{p.label}</span>
                          <div className="prio-radio" />
                        </div>
                      ))}
                    </div>
                    <div className="back-lnk" onClick={() => setWizStep(2)}>← Back</div>
                  </div>
                )}

                {/* Step 4 — Rooms + Pets */}
                {wizStep === 4 && (
                  <div className="wiz-step active">
                    <div className="q-meta"><div className="q-badge">4</div><span className="q-of">Question 4 of 6</span></div>
                    <div className="q-text">Rooms, parking &amp; pets?</div>
                    <div className="cnt-card">
                      <div className="cnt-row">
                        <div><div className="cnt-lbl">Bedrooms</div></div>
                        <div className="cnt-ctrls">
                          <button className="cnt-btn" disabled={wizData.beds <= 1} onClick={() => setWizData((d) => ({ ...d, beds: d.beds - 1 }))}>−</button>
                          <span className="cnt-val">{wizData.beds}</span>
                          <button className="cnt-btn" disabled={wizData.beds >= 6} onClick={() => setWizData((d) => ({ ...d, beds: d.beds + 1 }))}>+</button>
                        </div>
                      </div>
                      <div className="cnt-div" />
                      <div className="cnt-row">
                        <div><div className="cnt-lbl">Parking</div></div>
                        <div className="cnt-ctrls">
                          <button className="cnt-btn" disabled={wizData.park <= 0} onClick={() => setWizData((d) => ({ ...d, park: d.park - 1 }))}>−</button>
                          <span className="cnt-val">{wizData.park}</span>
                          <button className="cnt-btn" disabled={wizData.park >= 3} onClick={() => setWizData((d) => ({ ...d, park: d.park + 1 }))}>+</button>
                        </div>
                      </div>
                    </div>
                    {/* Pet selection */}
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--t4)", letterSpacing: ".09em", textTransform: "uppercase" as const, marginBottom: 7 }}>Do you have a pet?</div>
                    <div className="opt-grid" style={{ marginBottom: 14 }}>
                      {[{ icon: "🚫", label: "No pet" }, { icon: "🐱", label: "Cat" }, { icon: "🐶", label: "Small dog" }, { icon: "🐕", label: "Large dog" }].map((p) => (
                        <div key={p.label} className={`opt-tile${wizData.pet === p.label ? " sel" : ""}`} onClick={() => setWizData((d) => ({ ...d, pet: p.label }))}>
                          <div className="opt-tick">✓</div>
                          <span className="opt-ico" style={{ fontSize: 18, marginBottom: 4 }}>{p.icon}</span>
                          <div className="opt-lbl">{p.label}</div>
                        </div>
                      ))}
                    </div>
                    <button className="next-btn dark" onClick={() => {
                      showToast(`✓ ${wizData.beds} bed · ${wizData.park} parking · ${wizData.pet}`);
                      setWizStep(5);
                    }}>Looks good — next <em>→</em></button>
                    <div className="back-lnk" onClick={() => setWizStep(3)}>← Back</div>
                  </div>
                )}

                {/* Step 5 — Timeline */}
                {wizStep === 5 && (
                  <div className="wiz-step active">
                    <div className="q-meta"><div className="q-badge">5</div><span className="q-of">Question 5 of 6</span></div>
                    <div className="q-text">When do you need to move in?</div>
                    <div className="time-list">
                      {[{ label: "As soon as possible", badge: "Moving now", cls: "tb-hot", val: "ASAP" }, { label: "Within the next month", badge: "Active search", cls: "tb-hot", val: "Within 1 month" }, { label: "1 to 3 months", badge: "Planning ahead", cls: "tb-warm", val: "1–3 months" }, { label: "Just exploring for now", badge: "Early stage", cls: "tb-browse", val: "Just exploring" }].map((t) => (
                        <div key={t.val} className={`time-tile${wizData.timeline === t.val ? " sel" : ""}`} onClick={() => {
                          setWizData({ ...wizData, timeline: t.val });
                          showToast(`✓ Timeline: ${t.label}`);
                          setTimeout(() => setWizStep(6), 500);
                        }}>
                          <span className="time-main">{t.label}</span>
                          <span className={`tbadge ${t.cls}`}>{t.badge}</span>
                        </div>
                      ))}
                    </div>
                    <div className="back-lnk" onClick={() => setWizStep(4)}>← Back</div>
                  </div>
                )}

                {/* Step 6 — Contact */}
                {wizStep === 6 && (
                  <div className="wiz-step active">
                    <div className="q-meta"><div className="q-badge">6</div><span className="q-of">Last step</span></div>
                    <div className="q-text">Your matches are ready.</div>
                    <div className="contact-hdr">
                      <div className="ch-num">{filteredListings.length}</div>
                      <div className="ch-lbl">Milton rentals match what you described</div>
                    </div>
                    <div className="cf"><label className="cf-lbl">Your first name</label><input className="cf-input" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="e.g. Sarah" /></div>
                    <div className="cf"><label className="cf-lbl">Phone number</label><input className="cf-input" id="wiz-phone" type="tel" placeholder="(647) 555-0000" /></div>
                    <div className="cf"><label className="cf-lbl">Email <span className="cf-opt">— optional</span></label><input className="cf-input" id="wiz-email" type="email" placeholder="your@email.com" /></div>
                    <button className="next-btn amber" onClick={async () => {
                      if (!userName) { showToast("Please enter your name."); return; }
                      const phone = (document.getElementById("wiz-phone") as HTMLInputElement).value;
                      const email = (document.getElementById("wiz-email") as HTMLInputElement).value;
                      if (!phone) { showToast("Please enter your phone number."); return; }
                      // Apply wizard preferences to filters
                      const typeMap: Record<string, string> = { "Detached": "Detached", "Semi-detached": "Semi", "Townhouse": "Townhouse", "Condo / apt": "Condo" };
                      if (wizData.type && typeMap[wizData.type]) tglFilter("type", typeMap[wizData.type]);
                      if (wizData.beds) tglFilter("beds", String(wizData.beds));
                      if (wizData.park > 0) tglFilter("park", wizData.park + "+");
                      if (wizData.pet !== "No pet") tglFilter("pets", "Pets OK");
                      if (wizData.budget) {
                        if (wizData.budget === "Under $2,000") { setPriceMin(500); setPriceMax(2000); }
                        else if (wizData.budget === "$2,000–$2,500") { setPriceMin(2000); setPriceMax(2500); }
                        else if (wizData.budget === "$2,500–$3,000") { setPriceMin(2500); setPriceMax(3000); }
                        else if (wizData.budget === "$3,000+") { setPriceMin(3000); setPriceMax(5000); }
                      }
                      // Send full wizard data to leads API
                      const ok = await submitLead({
                        firstName: userName, phone, email, source: "wizard", intent: "renter",
                        timeline: wizData.timeline,
                        propertyType: wizData.type, budget: wizData.budget, priority: wizData.prio,
                        bedrooms: String(wizData.beds), parking: String(wizData.park), pet: wizData.pet,
                      });
                      if (ok) {
                        setWizSuccess(true);
                        showToast("✓ Shortlist sent! We'll call you within 15 minutes.");
                        setTimeout(() => document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" }), 800);
                      }
                    }}>
                      Show me my {filteredListings.length} matches →
                    </button>
                    <div className="submit-note">Reply within 15 minutes · No spam · No cold calls</div>
                    <div className="back-lnk" onClick={() => setWizStep(5)}>← Back</div>
                  </div>
                )}
              </>
            ) : (
              /* ── SUCCESS SCREEN ── */
              <div className="success-screen show">
                <div className="ss-check">✓</div>
                <div className="ss-title">Your shortlist is ready, {userName}!</div>
                <div className="ss-sub">We found {filteredListings.length} matches and will call you within 15 minutes. Your results are below.</div>
                <button className="ss-alert" onClick={async () => {
                  await submitLead({ firstName: userName, source: "new-match-alert", intent: "renter" });
                  showToast("🔔 Alert set! You'll hear from us first.");
                }}>🔔 Alert me when new matches list</button>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT — BOOKING CARD ── */}
        <div className="hr">
          <div className="booking-card">
            <div className="bc-strip" />
            <div className="bc-head">
              <div className="bc-eyebrow"><span className="bc-eye-dot" />Flagship feature</div>
              <div className="bc-title">Booking confirmation<br />within <em>1 hour</em></div>
              <div className="bc-sub">Name any Milton listing. We confirm your showing within the hour.</div>
            </div>
            <div className="bc-form">
              <div><label className="bc-lbl">MLS # or address</label><input className="bc-input" id="bc-mls" placeholder="e.g. W12345678 or 142 Laurier Ave" /></div>
              <div><label className="bc-lbl">Your name</label><input className="bc-input" id="bc-name" required placeholder="First and last name" /></div>
              <div><label className="bc-lbl">Phone number</label><input className="bc-input" id="bc-phone" required type="tel" placeholder="(647) 555-0000" /></div>
              <button className="bc-btn" onClick={async () => {
                const name = (document.getElementById("bc-name") as HTMLInputElement).value;
                const phone = (document.getElementById("bc-phone") as HTMLInputElement).value;
                const mls = (document.getElementById("bc-mls") as HTMLInputElement).value;
                if (!name) { showToast("Please enter your name."); (document.getElementById("bc-name") as HTMLInputElement).focus(); return; }
                if (!phone) { showToast("Please enter your phone number."); (document.getElementById("bc-phone") as HTMLInputElement).focus(); return; }
                const ok = await submitLead({ firstName: name, phone, source: "1hr-booking", intent: "renter", street: mls || "Any Milton rental" });
                if (ok) {
                  showToast(`⏱ Booking confirmed! We'll call ${phone} within 15 minutes.`);
                  (document.getElementById("bc-name") as HTMLInputElement).value = "";
                  (document.getElementById("bc-phone") as HTMLInputElement).value = "";
                  (document.getElementById("bc-mls") as HTMLInputElement).value = "";
                }
              }}><em>⏱</em> Confirm my 1-hour showing</button>
              <div className="bc-agent">Aamir Yaqoob · RE/MAX Realty Specialists Inc.</div>
            </div>
          </div>
          <div className="micro-grid">
            <div className="mc"><span className="mc-v"><em>🏡</em></span><span className="mc-l">List My House</span></div>
            <div className="mc"><span className="mc-v"><em>🏠</em></span><span className="mc-l">Need to see a house today?</span></div>
            <div className="mc"><span className="mc-v"><em>📞</em></span><span className="mc-l">Let&apos;s Talk</span></div>
            <div className="mc"><span className="mc-v"><em>14</em>yr</span><span className="mc-l">Experience to protect your interest</span></div>
          </div>
        </div>
      </div>

      {/* ═══ RENT AVERAGES BAR ═══ */}
      <div className="rent-avgs">
        <div className="ra-header">
          <span className="ra-title">Average Rent in Milton</span>
          <span className="ra-subtitle">Live data from {totalRentals} active listings · Click to filter</span>
        </div>
        <div className="ra-scroll">
          {rentAvgs.map((r) => {
            const typeMap: Record<string, string> = { condo: "Condo", semi: "Semi", townhouse: "Townhouse", detached: "Detached" };
            return (
              <div
                key={r.label}
                className="ra-card"
                onClick={() => {
                  tglFilter("type", typeMap[r.type] || "All");
                  tglFilter("beds", String(r.beds));
                  document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" });
                  showToast(`Showing ${r.label} rentals`);
                }}
              >
                <span className="ra-price">${r.avg.toLocaleString()}</span>
                <span className="ra-label">{r.label}</span>
              </div>
            );
          })}
          <div className="ra-card ra-total">
            <span className="ra-price">{totalRentals}</span>
            <span className="ra-label">Active rentals</span>
          </div>
        </div>
      </div>

      {/* ═══ STICKY FILTER BAR ═══ */}
      <div className="filter-bar" id="filter-bar">
        <div className="fb-top">
          <div className="fb-count">
            <em>{totalRentals}</em> Milton rentals
            {filteredListings.length !== totalRentals && (
              <span style={{ fontSize: 11, color: "#f59e0b", marginLeft: 8 }}>· {filteredListings.length} match filters</span>
            )}
          </div>
          <div className="fb-right">
            <div className="view-toggle">
              <div className={`vtab${viewMode === "grid" ? " on" : ""}`} onClick={() => setViewMode("grid")} title="Grid view">⊞</div>
              <div className={`vtab${viewMode === "list" ? " on" : ""}`} onClick={() => setViewMode("list")} title="List view">☰</div>
            </div>
            <select className="fb-sort-sel" value={sortBy} onChange={(e) => { setSortBy(e.target.value); showToast(`Sorted: ${e.target.value}`); }}>
              <option value="newest">Newest first</option>
              <option value="price_asc">Price low–high</option>
              <option value="price_desc">Price high–low</option>
            </select>
          </div>
        </div>

        {/* ── SINGLE-ROW FILTER STRIP ── */}
        <div className="fstrip">
          {/* Type */}
          <div className="fs-group">
            <span className="fs-label">Type</span>
            <select className={`fs-sel${filters.type !== "All" ? " on" : ""}`} value={filters.type} onChange={(e) => tglFilter("type", e.target.value)}>
              {[["All", "All"], ["Detached", "Detached"], ["Semi", "Semi"], ["Townhouse", "Town"], ["Condo", "Condo"]].map(([val, lbl]) => (
                <option key={val} value={val}>{lbl}</option>
              ))}
            </select>
          </div>
          {/* Beds */}
          <div className="fs-group">
            <span className="fs-label">Beds</span>
            <select className={`fs-sel${filters.beds !== "Any" ? " on" : ""}`} value={filters.beds} onChange={(e) => tglFilter("beds", e.target.value)}>
              {["Any", "1", "2", "3", "4", "5+"].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          {/* Baths */}
          <div className="fs-group">
            <span className="fs-label">Baths</span>
            <select className={`fs-sel${filters.baths !== "Any" ? " on" : ""}`} value={filters.baths} onChange={(e) => tglFilter("baths", e.target.value)}>
              {["Any", "1", "2", "3", "4+"].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          {/* Price Min */}
          <div className="fs-group">
            <span className="fs-label">Min $</span>
            <select className={`fs-sel${priceMin !== 500 ? " on" : ""}`} value={priceMin} onChange={(e) => setPriceMin(parseInt(e.target.value))}>
              {[500, 1000, 1500, 2000, 2500, 3000, 3500, 4000].map((v) => (
                <option key={v} value={v}>{v >= 1000 ? (v / 1000).toFixed(1).replace(".0", "") + "k" : v}</option>
              ))}
            </select>
          </div>
          {/* Price Max */}
          <div className="fs-group">
            <span className="fs-label">Max $</span>
            <select className={`fs-sel${priceMax !== 5000 ? " on" : ""}`} value={priceMax} onChange={(e) => setPriceMax(parseInt(e.target.value))}>
              {[1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000].map((v) => (
                <option key={v} value={v}>{v >= 1000 ? (v / 1000).toFixed(1).replace(".0", "") + "k" : v}</option>
              ))}
            </select>
          </div>
          {/* Move-in */}
          <div className="fs-group">
            <span className="fs-label">Move-in</span>
            <select className={`fs-sel${filters.avail !== "Now" ? " on" : ""}`} value={filters.avail} onChange={(e) => { tglFilter("avail", e.target.value); setAvailPill(e.target.value === "Now" ? "Available now" : e.target.value === "Flexible" ? "Flexible" : e.target.value + " 2026"); }}>
              {["Now", "May", "June", "July", "Flexible"].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          {/* Parking */}
          <div className="fs-group">
            <span className="fs-label">Parking</span>
            <select className={`fs-sel${filters.park !== "Any" ? " on" : ""}`} value={filters.park} onChange={(e) => tglFilter("park", e.target.value)}>
              {["Any", "1+", "2+"].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          {/* Reset */}
          <button className="fs-reset" onClick={() => {
            setFilters({ type: "All", beds: "Any", baths: "Any", avail: "Now", pets: "Any", util: "Any", basement: "Any", lease: "Any", park: "Any" });
            setTypeFilter("All"); setPriceMin(500); setPriceMax(5000); setSearchQuery(""); setSortBy("newest"); setAvailPill("Available now");
            showToast("↺ Filters reset");
          }}>↺ Reset</button>
          {searchQuery && <div className="fs-search-chip">&quot;{searchQuery}&quot; <span className="fs-chip-x" onClick={() => setSearchQuery("")}>✕</span></div>}
        </div>
      </div>

      {/* ═══ LISTINGS ═══ */}
      <section className="listings-sec" id="listings">
        <div className="ls-header">
          <div>
            <div className="ls-title">{wizSuccess ? `${userName}'s Milton matches` : "All Milton rentals"}</div>
            <div className="ls-sub">{filteredListings.length} active listings · sorted by {sortBy === "price_asc" ? "price low–high" : sortBy === "price_desc" ? "price high–low" : "newest"}</div>
          </div>
        </div>

        {filteredListings.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No rentals match your filters</p>
            <p style={{ fontSize: 13 }}>Try adjusting your price range, bedrooms, or property type.</p>
            <button className="fs-reset" style={{ marginTop: 16 }} onClick={() => {
              setFilters({ type: "All", beds: "Any", baths: "Any", avail: "Now", pets: "Any", util: "Any", basement: "Any", lease: "Any", park: "Any" });
              setTypeFilter("All"); setPriceMin(500); setPriceMax(5000); setSearchQuery(""); setAvailPill("Available now");
            }}>↺ Reset all filters</button>
          </div>
        ) : (
          <div className={`lgrid${viewMode === "list" ? " list-view" : ""}`}>
            {filteredListings.map((l) => {
              const days = daysAgo(new Date(l.listedAt));
              const descPreview = l.description ? l.description.slice(0, 160).replace(/\s+\S*$/, "") + "…" : null;
              return (
                <div key={l.mlsNumber} className="lcard">
                  <Link href={`/listings/${l.mlsNumber}`}>
                    <div className="lcard-img" style={{ background: l.photos[0] ? `url(${l.photos[0]}) center/cover` : "#e0f2fe" }}>
                      {!l.photos[0] && <span style={{ fontSize: 44 }}>{typeIcons[l.propertyType] || "🏠"}</span>}
                      <span className="lbadge">{days === 0 ? "New today" : days <= 7 ? "New this week" : `${days}d ago`}</span>
                      <span className="avail-tag">{l.possessionDetails === "Vacant" || l.possessionDetails === "Immediate" ? "Available now" : l.possessionDetails || "Available"}</span>
                    </div>
                    <div className="lbody">
                      <div className="lprice">{formatPriceFull(l.price)} <span>/ month</span></div>
                      <div className="laddr">{l.address.split(",")[0]} · {l.neighbourhood.replace(/^\d+\s*-\s*\w+\s+/, "")}</div>
                      <div className="lspecs">
                        <span>🛏 {l.bedrooms} bed</span>
                        <span>🚿 {l.bathrooms} bath</span>
                        {l.parking > 0 && <span>🚗 {l.parking} park</span>}
                        <span style={{ textTransform: "capitalize" }}>{l.propertyType}</span>
                      </div>

                      {/* ── LIST VIEW EXTRAS — ALL REAL DATA ── */}
                      {viewMode === "list" && (
                        <div className="lv-extras">
                          {/* Feature tags — from real TREB fields */}
                          <div className="lfeats">
                            {l.rentIncludes && l.rentIncludes.length > 0 ? (
                              <span className="lf lf-util-y">💡 Incl: {l.rentIncludes.join(", ")}</span>
                            ) : (
                              <span className="lf lf-util-n">💡 Tenant pays utilities</span>
                            )}
                            {l.petsAllowed && l.petsAllowed.toLowerCase() !== "no" && l.petsAllowed !== "" ? (
                              <span className="lf lf-pet">🐾 Pets: {l.petsAllowed}</span>
                            ) : l.petsAllowed === "No" ? (
                              <span className="lf lf-util-n">🚫 No pets</span>
                            ) : null}
                            {l.laundryFeatures && <span className="lf lf-go">🧺 {l.laundryFeatures}</span>}
                            {l.furnished && l.furnished !== "Unfurnished" && <span className="lf lf-pet">🛋 {l.furnished}</span>}
                            {l.basement && <span className="lf lf-lease">🏠 Basement</span>}
                            {l.cooling && <span className="lf lf-go">❄️ {l.cooling}</span>}
                            {l.heatType && <span className="lf lf-lease">🔥 {l.heatType}</span>}
                            {l.locker && l.locker !== "None" && <span className="lf lf-lease">🔒 Locker: {l.locker}</span>}
                            {l.minLeaseTerm && <span className="lf lf-lease">📋 {l.minLeaseTerm}mo lease</span>}
                          </div>

                          {/* Possession + details */}
                          <div className="commute">
                            <div className="com-hd">📋 Rental details</div>
                            {l.possessionDetails && <div className="com-row"><span className="com-l">Move-in</span><span className="com-v">{l.possessionDetails}</span></div>}
                            {l.furnished && <div className="com-row"><span className="com-l">Furnished</span><span className="com-v">{l.furnished}</span></div>}
                            <div className="com-row"><span className="com-l">Parking</span><span className="com-v">{l.parking > 0 ? l.parking + " space" + (l.parking > 1 ? "s" : "") : "None"}</span></div>
                            <div className="com-row"><span className="com-l">MLS #</span><span className="com-v">{l.mlsNumber}</span></div>
                          </div>

                          {/* Description preview */}
                          {descPreview && <div className="ldesc">{descPreview}</div>}
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="lbtns-wrap">
                    <button className="lbtn lbtn-bk" onClick={() => handleBookShowing(l)}>Book showing</button>
                    <button className="lbtn lbtn-1h" onClick={() => handleOneHourShowing(l)}>I want to see this today</button>
                    {viewMode === "list" && (
                      <button className="lbtn lbtn-save" onClick={() => showToast(`♡ Saved ${l.address.split(",")[0]}`)}>♡ Save</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ═══ ALERT STRIP ═══ */}
      <div className="alert-strip">
        <div className="as-left">
          <h3>🔔 Get alerted before it lists publicly</h3>
          <p>Your current filters saved · SMS alert before it appears on any other site</p>
        </div>
        <div className="as-form">
          <input className="as-input" type="email" id="alert-email" placeholder="your@email.com" />
          <button className="as-btn" onClick={async () => {
            const email = (document.getElementById("alert-email") as HTMLInputElement).value;
            if (!email || !email.includes("@")) { showToast("Please enter a valid email."); return; }
            await submitLead({ email, source: "alert", intent: "renter", firstName: "Alert Subscriber" });
            showToast("🔔 Alert saved! You'll hear from us first.");
            (document.getElementById("alert-email") as HTMLInputElement).value = "";
          }}>Save this search →</button>
        </div>
      </div>

      {/* ═══ EXCLUSIVE CROSS-LINK BANNER ═══ */}
      <Link
        href="/exclusive"
        className="mx-5 sm:mx-11 my-4 bg-[#0c1e35] border border-[#1e3a5f] rounded-xl p-4 flex items-center justify-between gap-4 hover:border-[#2d5a8e] transition-colors"
      >
        <div>
          <p className="text-[14px] font-semibold text-[#f8f9fb]">🏠 Looking for exclusive off-market rentals?</p>
          <p className="text-[12px] text-[#94a3b8] mt-0.5">Aamir has exclusive listings not on MLS</p>
        </div>
        <span className="text-[13px] font-semibold text-[#f59e0b] shrink-0">View exclusive listings →</span>
      </Link>

      <AgentContactSection />

      {/* ═══ BOOKING MODAL ═══ */}
      {bookingModal && (
        <div className="bm-overlay" onClick={() => setBookingModal(null)}>
          <div className="bm-card" onClick={(e) => e.stopPropagation()}>
            <button className="bm-close" onClick={() => setBookingModal(null)}>✕</button>
            <div className="bm-title">{bookingModal.type === "1hr" ? "⏱ 1-Hour Showing" : "Book a Showing"}</div>
            <div className="bm-addr">{bookingModal.listing.address.split(",")[0]}</div>
            <div className="bm-price">{formatPriceFull(bookingModal.listing.price)}/mo · {bookingModal.listing.bedrooms} bed · {bookingModal.listing.bathrooms} bath</div>
            <div className="bm-fields">
              <input className="bm-input" id="bm-name" required placeholder="Your name" />
              <input className="bm-input" id="bm-phone" required type="tel" placeholder="Phone number" />
            </div>
            <button className="bm-submit" onClick={submitBooking}>
              {bookingModal.type === "1hr" ? "⏱ Confirm 1-hour showing" : "Request showing"}
            </button>
            <div className="bm-note">We&apos;ll call you within {bookingModal.type === "1hr" ? "1 hour" : "15 minutes"} to confirm</div>
          </div>
        </div>
      )}

      {/* ═══ TOAST ═══ */}
      <div className={`toast${toast ? " show" : ""}`}>
        <span className="toast-ck">✓</span>
        <span>{toast}</span>
      </div>
    </div>
  );
}
