"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { formatPriceFull, daysAgo } from "@/lib/format";
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
}

interface Props {
  listings: Listing[];
  totalRentals: number;
  avgRent: number;
}

export default function RentalsClient({ listings, totalRentals, avgRent }: Props) {
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [, setFilterStuck] = useState(false);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const filterPlaceholderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const nav = document.querySelector("header");
    const navH = nav ? nav.offsetHeight : 0;

    const onScroll = () => {
      const ph = filterPlaceholderRef.current;
      const fb = filterBarRef.current;
      if (!ph || !fb) return;

      const rect = ph.getBoundingClientRect();
      // Stick when placeholder reaches the bottom edge of the nav
      const stuck = rect.top <= navH;

      if (stuck) {
        fb.style.position = "fixed";
        fb.style.top = navH + "px";
        fb.style.left = "0px";
        fb.style.right = "0px";
        fb.style.zIndex = "200";
        fb.style.boxShadow = "0 4px 20px rgba(0,0,0,.3)";
        ph.style.height = fb.offsetHeight + "px";
      } else {
        fb.style.position = "";
        fb.style.top = "";
        fb.style.left = "";
        fb.style.right = "";
        fb.style.zIndex = "";
        fb.style.boxShadow = "";
        ph.style.height = "0";
      }

      setFilterStuck(stuck);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
        if (!matchAddr && !matchMls && !matchHood) return false;
      }
      // Type
      if (typeFilter !== "All" && l.propertyType !== typeFilter.toLowerCase()) return false;
      // Beds
      if (filters.beds !== "Any") {
        const min = filters.beds === "5+" ? 5 : parseInt(filters.beds);
        if (l.bedrooms < min) return false;
      }
      // Baths
      if (filters.baths !== "Any") {
        const min = filters.baths === "4+" ? 4 : parseInt(filters.baths);
        if (l.bathrooms < min) return false;
      }
      // Price
      if (l.price < priceMin || l.price > priceMax) return false;
      // Parking
      if (filters.park !== "Any") {
        const min = parseInt(filters.park);
        if (l.parking < min) return false;
      }
      // Basement
      if (filters.basement === "Yes" && !l.description?.toLowerCase().includes("basement")) return false;
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
  const handleBookShowing = async (listing: Listing) => {
    await submitLead({
      firstName: "Showing Request",
      source: "listing-card-book",
      intent: "renter",
      street: listing.address,
    });
    showToast(`✓ Showing request sent for ${listing.address.split(",")[0]}!`);
  };

  const handleOneHourShowing = async (listing: Listing) => {
    await submitLead({
      firstName: "1-Hour Showing",
      source: "listing-card-1hr",
      intent: "renter",
      street: listing.address,
    });
    setBookingMls(listing.mlsNumber);
    showToast(`⏱ 1-hour showing confirmed for ${listing.address.split(",")[0]}! We'll call you.`);
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
                <div className="sdi" onClick={() => { setSearchOpen(false); document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" }); }}>
                  <div className="sdi-ico am">🏠</div>
                  <div><div className="sdi-main">See all {totalRentals} active Milton rentals</div><div className="sdi-sub">Condos, townhouses, detached — all listings</div></div>
                </div>
                <div className="sdi" onClick={() => { setSearchQuery("condo"); setSearchOpen(false); showToast("🔍 Filtering condos..."); }}>
                  <div className="sdi-ico bl">🏢</div>
                  <div><div className="sdi-main">Show condos only</div><div className="sdi-sub">All Milton condo rentals</div></div>
                </div>
                <div className="sdi" onClick={() => { setSearchQuery("Main St"); setSearchOpen(false); showToast("🔍 Searching Main St..."); }}>
                  <div className="sdi-ico gr">📍</div>
                  <div><div className="sdi-main">Main Street rentals</div><div className="sdi-sub">Popular Milton street</div></div>
                </div>
              </div>
            )}

            {/* Move-in pills */}
            <div className="avail-row">
              <span className="avail-lbl">Move in:</span>
              {["Available now", "May 2026", "June 2026", "July 2026", "Flexible"].map((a) => (
                <button
                  key={a}
                  className={`apill${availPill === a ? " on" : ""}`}
                  onClick={() => {
                    setAvailPill(a);
                    tglFilter("avail", a === "Available now" ? "Now" : a.replace(" 2026", ""));
                    showToast(`📅 Showing rentals: ${a}`);
                  }}
                >{a}</button>
              ))}
            </div>
          </div>

          <div className="trust-row">
            <div className="ti">178 families placed this year</div>
            <div className="ti">4.9 ★ Google rating</div>
            <div className="ti">Milton-only specialist</div>
            <div className="ti">No fees ever</div>
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
                      const ok = await submitLead({ firstName: userName, phone, email, source: "wizard", intent: "renter", timeline: wizData.timeline });
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
              <div><label className="bc-lbl">Your name</label><input className="bc-input" id="bc-name" placeholder="First and last name" /></div>
              <div><label className="bc-lbl">Phone number</label><input className="bc-input" id="bc-phone" type="tel" placeholder="(647) 555-0000" /></div>
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
            </div>
          </div>
          <div className="micro-grid">
            <div className="mc"><span className="mc-v"><em>{totalRentals}</em></span><span className="mc-l">Active today</span></div>
            <div className="mc"><span className="mc-v"><em>11</em>d</span><span className="mc-l">Avg to lease</span></div>
            <div className="mc"><span className="mc-v"><em>1.2</em>%</span><span className="mc-l">Vacancy</span></div>
            <div className="mc"><span className="mc-v">4.<em>9</em>★</span><span className="mc-l">Google</span></div>
          </div>
        </div>
      </div>

      {/* ═══ STATS BAR ═══ */}
      <div className="stats-bar">
        <div className="stat"><span className="sv">${avgRent.toLocaleString()}</span><span className="sl">Avg rent / month</span></div>
        <div className="stat"><span className="sv">{totalRentals}</span><span className="sl">Active rentals today</span></div>
        <div className="stat"><span className="sv">11 days</span><span className="sl">Avg days to lease</span></div>
        <div className="stat"><span className="sv">1.2%</span><span className="sl">Vacancy rate</span></div>
      </div>

      {/* ═══ STICKY FILTER BAR ═══ */}
      <div ref={filterPlaceholderRef} className="fb-placeholder" />
      <div ref={filterBarRef} className="filter-bar" id="filter-bar">
        <div className="fb-top">
          <div className="fb-count">
            <em>{totalRentals}</em> Milton rentals
            {filteredListings.length !== totalRentals && (
              <span style={{ fontSize: 11, color: "#f59e0b", marginLeft: 8 }}>· {filteredListings.length} match filters</span>
            )}
          </div>
          <div className="fb-right">
            <button
              className={`fb-toggle${filtersOpen ? " open" : ""}`}
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              {filtersOpen ? "Hide filters ✕" : "Filters ▾"}
            </button>
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

        {filtersOpen && <div className="fb-filters">
          {/* PROPERTY TYPE */}
          <div className={`fg-block${filters.type !== "All" ? " active" : ""}`}>
            <span className="fg-label">Property type</span>
            <div className="toggle-group">
              {["All", "Detached", "Semi", "Townhouse", "Condo"].map((v) => (
                <button key={v} className={`tgl${filters.type === v ? " on" : ""}`} onClick={() => tglFilter("type", v)}>{v}</button>
              ))}
            </div>
          </div>
          {/* BEDROOMS */}
          <div className={`fg-block${filters.beds !== "Any" ? " active" : ""}`}>
            <span className="fg-label">Bedrooms</span>
            <div className="toggle-group">
              {["Any", "1", "2", "3", "4", "5+"].map((v) => (
                <button key={v} className={`tgl${filters.beds === v ? " on" : ""}`} onClick={() => tglFilter("beds", v)}>{v}</button>
              ))}
            </div>
          </div>
          {/* BATHROOMS */}
          <div className={`fg-block${filters.baths !== "Any" ? " active" : ""}`}>
            <span className="fg-label">Bathrooms</span>
            <div className="toggle-group">
              {["Any", "1", "2", "3", "4+"].map((v) => (
                <button key={v} className={`tgl${filters.baths === v ? " on" : ""}`} onClick={() => tglFilter("baths", v)}>{v}</button>
              ))}
            </div>
          </div>
          {/* PRICE RANGE */}
          <div className="fg-block active">
            <span className="fg-label">Monthly rent</span>
            <div className="range-group">
              <div className="range-vals">
                <span className="range-val"><em>${priceMin.toLocaleString()}</em></span>
                <span className="range-val"><em>${priceMax.toLocaleString()}</em></span>
              </div>
              <div className="range-row" style={{ marginBottom: 6 }}>
                <span className="range-lbl">Min</span>
                <input type="range" className="frange" min={500} max={4000} step={100} value={priceMin} onChange={(e) => setPriceMin(Math.min(parseInt(e.target.value), priceMax - 500))} />
              </div>
              <div className="range-row">
                <span className="range-lbl">Max</span>
                <input type="range" className="frange" min={1000} max={5000} step={100} value={priceMax} onChange={(e) => setPriceMax(Math.max(parseInt(e.target.value), priceMin + 500))} />
              </div>
            </div>
          </div>
          {/* MOVE-IN DATE */}
          <div className={`fg-block${filters.avail !== "Now" ? " active" : ""}`}>
            <span className="fg-label">Move-in date</span>
            <div className="toggle-group">
              {["Now", "May", "June", "July", "Flexible"].map((v) => (
                <button key={v} className={`tgl${filters.avail === v ? " on" : ""}`} onClick={() => tglFilter("avail", v)}>{v}</button>
              ))}
            </div>
          </div>
          {/* PETS */}
          <div className={`fg-block${filters.pets !== "Any" ? " active" : ""}`}>
            <span className="fg-label">Pets</span>
            <div className="toggle-group">
              {["Any", "Pets OK", "No pets"].map((v) => (
                <button key={v} className={`tgl${filters.pets === v ? " on" : ""}`} onClick={() => tglFilter("pets", v)}>{v}</button>
              ))}
            </div>
          </div>
          {/* UTILITIES */}
          <div className={`fg-block${filters.util !== "Any" ? " active" : ""}`}>
            <span className="fg-label">Utilities</span>
            <div className="toggle-group">
              {["Any", "Included", "Tenant pays"].map((v) => (
                <button key={v} className={`tgl${filters.util === v ? " on" : ""}`} onClick={() => tglFilter("util", v)}>{v}</button>
              ))}
            </div>
          </div>
          {/* FINISHED BASEMENT */}
          <div className={`fg-block${filters.basement !== "Any" ? " active" : ""}`}>
            <span className="fg-label">Finished basement</span>
            <div className="toggle-group">
              {["Any", "Yes", "No"].map((v) => (
                <button key={v} className={`tgl${filters.basement === v ? " on" : ""}`} onClick={() => tglFilter("basement", v)}>{v}</button>
              ))}
            </div>
          </div>
          {/* LEASE LENGTH */}
          <div className={`fg-block${filters.lease !== "Any" ? " active" : ""}`}>
            <span className="fg-label">Lease length</span>
            <div className="toggle-group">
              {["Any", "Month-to-month", "6 months", "12 months"].map((v) => (
                <button key={v} className={`tgl${filters.lease === v ? " on" : ""}`} onClick={() => tglFilter("lease", v)}>{v}</button>
              ))}
            </div>
          </div>
          {/* PARKING */}
          <div className={`fg-block${filters.park !== "Any" ? " active" : ""}`}>
            <span className="fg-label">Parking</span>
            <div className="toggle-group">
              {["Any", "1+", "2+"].map((v) => (
                <button key={v} className={`tgl${filters.park === v ? " on" : ""}`} onClick={() => tglFilter("park", v)}>{v}</button>
              ))}
            </div>
          </div>

          <button className="clear-btn" onClick={() => {
            setFilters({ type: "All", beds: "Any", baths: "Any", avail: "Now", pets: "Any", util: "Any", basement: "Any", lease: "Any", park: "Any" });
            setTypeFilter("All"); setPriceMin(500); setPriceMax(5000); setSearchQuery(""); setSortBy("newest");
            showToast("↺ Filters reset — showing all rentals");
          }}>↺ Reset all</button>
        </div>}

        {/* chips — always visible when filters are active */}
        <div className="fb-chips">
          <span className="fb-lbl">Active:</span>
          <div className="fchip on">🏠 <span>{filters.type === "All" ? "All types" : filters.type}</span> <span className="fchip-x">✕</span></div>
          <div className="fchip on">🛏 <span>{filters.beds === "Any" ? "Any beds" : filters.beds + " bed" + (filters.beds === "1" ? "" : "s")}</span> <span className="fchip-x">✕</span></div>
          <div className="fchip on">🚿 <span>{filters.baths === "Any" ? "Any baths" : filters.baths + " bath" + (filters.baths === "1" ? "" : "s")}</span> <span className="fchip-x">✕</span></div>
          <div className="fchip on">💰 <span>${priceMin.toLocaleString()}–${priceMax.toLocaleString()}</span> <span className="fchip-x">✕</span></div>
          <div className="fchip on">📅 <span>{filters.avail === "Now" ? "Available now" : "Move in " + filters.avail}</span> <span className="fchip-x">✕</span></div>
          {searchQuery && <div className="fchip on">🔍 <span>&quot;{searchQuery}&quot;</span> <span className="fchip-x" onClick={() => setSearchQuery("")}>✕</span></div>}
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
            <button className="clear-btn" style={{ marginTop: 16 }} onClick={() => {
              setFilters({ type: "All", beds: "Any", baths: "Any", avail: "Now", pets: "Any", util: "Any", basement: "Any", lease: "Any", park: "Any" });
              setTypeFilter("All"); setPriceMin(500); setPriceMax(5000); setSearchQuery("");
            }}>↺ Reset all filters</button>
          </div>
        ) : (
          <div className={`lgrid${viewMode === "list" ? " list-view" : ""}`}>
            {filteredListings.map((l) => {
              const days = daysAgo(new Date(l.listedAt));
              return (
                <div key={l.mlsNumber} className="lcard">
                  <Link href={`/listings/${l.mlsNumber}`}>
                    <div className="lcard-img" style={{ background: l.photos[0] ? `url(${l.photos[0]}) center/cover` : "#e0f2fe" }}>
                      {!l.photos[0] && <span style={{ fontSize: 44 }}>{typeIcons[l.propertyType] || "🏠"}</span>}
                      <span className="lbadge">{days === 0 ? "New today" : days <= 7 ? "New this week" : `${days}d ago`}</span>
                      <span className="avail-tag">Available now</span>
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
                    </div>
                  </Link>
                  <div className="lbtns" style={{ padding: "0 16px 14px" }}>
                    <button className="lbtn lbtn-bk" onClick={() => handleBookShowing(l)}>Book showing</button>
                    <button className="lbtn lbtn-1h" onClick={() => handleOneHourShowing(l)}>⏱ See in 1 hr</button>
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

      {/* ═══ FOOTER CTA ═══ */}
      <section className="footer-cta">
        <h2>Start your Milton<br />rental search <em>today</em></h2>
        <p>{totalRentals} active rentals · See any home in 1 hour · Milton&apos;s only rental specialist</p>
        <div className="footer-btns">
          <button className="fbtn-p" onClick={() => {
            setFilters({ type: "All", beds: "Any", baths: "Any", avail: "Now", pets: "Any", util: "Any", basement: "Any", lease: "Any", park: "Any" });
            setTypeFilter("All"); setPriceMin(500); setPriceMax(5000); setSearchQuery("");
            document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" });
          }}>Browse all rentals →</button>
          <Link href="/listings" className="fbtn-s">View all listings</Link>
        </div>
      </section>

      {/* ═══ TOAST ═══ */}
      <div className={`toast${toast ? " show" : ""}`}>
        <span className="toast-ck">✓</span>
        <span>{toast}</span>
      </div>
    </div>
  );
}
