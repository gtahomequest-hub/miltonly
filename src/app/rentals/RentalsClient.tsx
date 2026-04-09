"use client";

import { useState, useCallback } from "react";
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
  const [wizStep, setWizStep] = useState(1);
  const [wizData, setWizData] = useState({ type: "", budget: "", prio: "", beds: 1, park: 0, pet: "No pet", timeline: "" });
  const [wizSuccess, setWizSuccess] = useState(false);
  const [userName, setUserName] = useState("");
  const [toast, setToast] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [typeFilter, setTypeFilter] = useState("all");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }, []);

  const submitLead = async (data: Record<string, string>) => {
    try {
      await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    } catch { /* silent */ }
  };

  const filteredListings = typeFilter === "all" ? listings : listings.filter((l) => l.propertyType === typeFilter);

  const progWidth = [0, 17, 33, 50, 67, 83, 100][wizStep - 1] || 0;

  const typeIcons: Record<string, string> = { detached: "🏠", semi: "🏘", townhouse: "🏗", condo: "🏢", other: "🏠" };

  return (
    <div className="rentals-page">
      {/* ═══ HERO ═══ */}
      <div className="hero">
        {/* LEFT */}
        <div className="hl">
          <div className="live-badge"><span className="live-dot" />{totalRentals} active rentals · live TREB data</div>
          <h1>Find your next<br />home in <em>Milton</em></h1>
          <p className="hl-desc">Browse every active rental — condos, townhouses and detached homes. <strong>Same-day showings guaranteed.</strong></p>
          <div className="sbox">
            <div className="srow">
              <input className="sinput" placeholder="Street, MLS #, neighbourhood, school or GO station..." />
              <button className="sbtn" onClick={() => showToast("Searching Milton rentals...")}>Search →</button>
            </div>
            <div className="avail-row">
              <span className="avail-lbl">Move in:</span>
              {["Available now", "May 2026", "June 2026", "July 2026", "Flexible"].map((a, i) => (
                <button key={a} className={`apill${i === 0 ? " on" : ""}`} onClick={(e) => { document.querySelectorAll(".apill").forEach((p) => p.classList.remove("on")); (e.target as HTMLElement).classList.add("on"); showToast("📅 " + a); }}>{a}</button>
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

        {/* MIDDLE — WIZARD */}
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
                        <div key={t.label} className={`opt-tile${wizData.type === t.label ? " sel" : ""}`} onClick={() => { setWizData({ ...wizData, type: t.label }); setTimeout(() => setWizStep(2), 400); }}>
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
                        <div key={b} className={`opt-tile${wizData.budget === b ? " sel" : ""}`} onClick={() => { setWizData({ ...wizData, budget: b }); setTimeout(() => setWizStep(3), 400); }}>
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
                        <div key={p.label} className={`prio-tile${wizData.prio === p.label ? " sel" : ""}`} onClick={() => { setWizData({ ...wizData, prio: p.label }); setTimeout(() => setWizStep(4), 400); }}>
                          <span className="prio-ico">{p.icon}</span>
                          <span className="prio-txt">{p.label}</span>
                          <div className="prio-radio" />
                        </div>
                      ))}
                    </div>
                    <div className="back-lnk" onClick={() => setWizStep(2)}>← Back</div>
                  </div>
                )}

                {/* Step 4 — Rooms */}
                {wizStep === 4 && (
                  <div className="wiz-step active">
                    <div className="q-meta"><div className="q-badge">4</div><span className="q-of">Question 4 of 6</span></div>
                    <div className="q-text">Rooms, parking &amp; pets?</div>
                    <div className="cnt-card">
                      <div className="cnt-row">
                        <div><div className="cnt-lbl">Bedrooms</div></div>
                        <div className="cnt-ctrls">
                          <button className="cnt-btn" disabled={wizData.beds <= 1} onClick={() => setWizData({ ...wizData, beds: wizData.beds - 1 })}>−</button>
                          <span className="cnt-val">{wizData.beds}</span>
                          <button className="cnt-btn" onClick={() => setWizData({ ...wizData, beds: wizData.beds + 1 })}>+</button>
                        </div>
                      </div>
                      <div className="cnt-div" />
                      <div className="cnt-row">
                        <div><div className="cnt-lbl">Parking</div></div>
                        <div className="cnt-ctrls">
                          <button className="cnt-btn" disabled={wizData.park <= 0} onClick={() => setWizData({ ...wizData, park: wizData.park - 1 })}>−</button>
                          <span className="cnt-val">{wizData.park}</span>
                          <button className="cnt-btn" onClick={() => setWizData({ ...wizData, park: wizData.park + 1 })}>+</button>
                        </div>
                      </div>
                    </div>
                    <button className="next-btn dark" onClick={() => setWizStep(5)}>Looks good — next <em>→</em></button>
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
                        <div key={t.val} className={`time-tile${wizData.timeline === t.val ? " sel" : ""}`} onClick={() => { setWizData({ ...wizData, timeline: t.val }); setTimeout(() => setWizStep(6), 400); }}>
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
                      await submitLead({ firstName: userName, phone, email, source: "wizard", intent: "renter", timeline: wizData.timeline });
                      setWizSuccess(true);
                      showToast("✓ Shortlist sent!");
                    }}>
                      Show me my {filteredListings.length} matches →
                    </button>
                    <div className="submit-note">Reply within 15 minutes · No spam · No cold calls</div>
                    <div className="back-lnk" onClick={() => setWizStep(5)}>← Back</div>
                  </div>
                )}
              </>
            ) : (
              <div className="success-screen show">
                <div className="ss-check">✓</div>
                <div className="ss-title">Your shortlist is ready, {userName}!</div>
                <div className="ss-sub">We found {filteredListings.length} matches and will call you within 15 minutes.</div>
                <button className="ss-alert" onClick={() => showToast("🔔 Alert set!")}>🔔 Alert me when new matches list</button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Booking */}
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
                if (!name || !phone) { showToast("Please enter name and phone."); return; }
                await submitLead({ firstName: name, phone, source: "1hr-booking", intent: "renter", street: mls });
                showToast("⏱ Booking sent! Expect a call within 15 minutes.");
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

      {/* STATS BAR */}
      <div className="stats-bar">
        <div className="stat"><span className="sv">${avgRent.toLocaleString()}</span><span className="sl">Avg rent / month</span></div>
        <div className="stat"><span className="sv">{totalRentals}</span><span className="sl">Active rentals today</span></div>
        <div className="stat"><span className="sv">11 days</span><span className="sl">Avg days to lease</span></div>
        <div className="stat"><span className="sv">1.2%</span><span className="sl">Vacancy rate</span></div>
      </div>

      {/* FILTER BAR */}
      <div className="filter-bar">
        <div className="fb-top">
          <div className="fb-count">Showing <em>{filteredListings.length}</em> Milton rentals</div>
          <div className="fb-right">
            <div className="view-toggle">
              <div className={`vtab${viewMode === "grid" ? " on" : ""}`} onClick={() => setViewMode("grid")}>⊞</div>
              <div className={`vtab${viewMode === "list" ? " on" : ""}`} onClick={() => setViewMode("list")}>☰</div>
            </div>
          </div>
        </div>
        <div className="fb-filters">
          <div className="fg-block">
            <span className="fg-label">Property type</span>
            <div className="toggle-group">
              {["all", "detached", "semi", "townhouse", "condo"].map((t) => (
                <button key={t} className={`tgl${typeFilter === t ? " on" : ""}`} onClick={() => setTypeFilter(t)}>{t === "all" ? "All" : t.charAt(0).toUpperCase() + t.slice(1)}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* LISTINGS */}
      <section className="listings-sec" id="listings">
        <div className="ls-header">
          <div>
            <div className="ls-title">{wizSuccess ? `${userName}'s Milton matches` : "All Milton rentals"}</div>
            <div className="ls-sub">{filteredListings.length} active listings · sorted by newest</div>
          </div>
        </div>

        <div className={`lgrid${viewMode === "list" ? " list-view" : ""}`}>
          {filteredListings.map((l) => {
            const days = daysAgo(new Date(l.listedAt));
            return (
              <Link key={l.mlsNumber} href={`/listings/${l.mlsNumber}`} className="lcard">
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
                    <span className="capitalize">{l.propertyType}</span>
                  </div>
                  <div className="lbtns">
                    <button className="lbtn lbtn-bk" onClick={(e) => { e.preventDefault(); showToast(`Showing booked for ${l.address.split(",")[0]}!`); }}>Book showing</button>
                    <button className="lbtn lbtn-1h" onClick={(e) => { e.preventDefault(); showToast("⏱ 1-hour showing sent!"); }}>⏱ See in 1 hr</button>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ALERT STRIP */}
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
            showToast("🔔 Alert saved!");
            (document.getElementById("alert-email") as HTMLInputElement).value = "";
          }}>Save this search →</button>
        </div>
      </div>

      {/* FOOTER CTA */}
      <section className="footer-cta">
        <h2>Start your Milton<br />rental search <em>today</em></h2>
        <p>{totalRentals} active rentals · See any home in 1 hour · Milton&apos;s only rental specialist</p>
        <div className="footer-btns">
          <button className="fbtn-p" onClick={() => document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" })}>Browse all rentals →</button>
          <Link href="/listings" className="fbtn-s">View all listings</Link>
        </div>
      </section>

      {/* TOAST */}
      <div className={`toast${toast ? " show" : ""}`}>
        <span className="toast-ck">✓</span>
        <span>{toast}</span>
      </div>
    </div>
  );
}
