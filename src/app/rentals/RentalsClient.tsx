"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPriceFull, daysAgo } from "@/lib/format";
import AgentContactSection from "@/components/AgentContactSection";
import { useUser } from "@/components/UserProvider";
import { attributionPayload } from "@/lib/attribution";
import { config } from "@/lib/config";
import "./rentals.css";

const REALTOR_FIRST_NAME = config.realtor.name.split(" ")[0];
const BROKERAGE_SHORT_NAME = config.brokerage.name.replace(", Brokerage", "");

const FOOTER_NEIGHBOURHOODS = ["Dempsey", "Beaty", "Willmott", "Hawthorne Village", "Timberlea", "Old Milton"];
const toFooterSlug = (n: string) =>
  n.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");

const svgProps = {
  width: 26,
  height: 26,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  style: { display: "inline-block" as const, verticalAlign: "middle" as const },
};
const HomeTypeIcon = {
  Detached: (
    <svg {...svgProps}>
      <path d="M3 12l9-8 9 8V20H3z" />
      <path d="M10 20v-6h4v6" />
    </svg>
  ),
  Semi: (
    <svg {...svgProps}>
      <path d="M2 11l5-5 5 5 5-5 5 5V20H2z" />
      <line x1="12" y1="11" x2="12" y2="20" />
    </svg>
  ),
  Townhouse: (
    <svg {...svgProps}>
      <path d="M2 11l3-4 3 4 3-4 3 4 3-4 3 4V20H2z" />
      <line x1="8" y1="11" x2="8" y2="20" />
      <line x1="14" y1="11" x2="14" y2="20" />
    </svg>
  ),
  Condo: (
    <svg {...svgProps}>
      <rect x="5" y="3" width="14" height="18" />
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="5" y1="8" x2="19" y2="8" />
      <line x1="5" y1="13" x2="19" y2="13" />
      <line x1="5" y1="18" x2="19" y2="18" />
    </svg>
  ),
};

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
  listOfficeName?: string | null;
}

const TC_SMALL = new Set(["of", "at", "the", "in", "and", "on", "for", "by", "to"]);
const TC_FIXUPS: Record<string, string> = { Remax: "RE/MAX", "Re/Max": "RE/MAX", Mls: "MLS", Ltd: "Ltd.", Inc: "Inc.", Re: "RE" };
function titleCase(s: string | null | undefined): string {
  if (!s) return "";
  const out = s.toLowerCase().split(/(\s+|-|\/)/).map((tok, i) => {
    if (!tok.trim() || tok === "/" || tok === "-") return tok;
    if (i > 0 && TC_SMALL.has(tok)) return tok;
    return tok.charAt(0).toUpperCase() + tok.slice(1);
  }).join("");
  return Object.entries(TC_FIXUPS).reduce((acc, [f, t]) => acc.replace(new RegExp(`\\b${f}\\b`, "g"), t), out);
}
const propertyBadgeLabel = (t: string) => {
  const l = (t || "").toLowerCase();
  if (l === "detached") return "Detached";
  if (l === "semi") return "Semi";
  if (l === "townhouse") return "Townhouse";
  if (l === "condo") return "Condo";
  return t;
};

interface RentAvg {
  label: string;
  avg: number;
  type: string;
  beds: number;
  count: number;
}

interface Props {
  listings: Listing[];
  totalRentals: number;
  avgRent: number;
  rentAvgs: RentAvg[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function RentalsClient({ listings, totalRentals, avgRent, rentAvgs }: Props) {
  const router = useRouter();
  const { user, isListingSaved, saveListing, unsaveListing } = useUser();

  // ── WIZARD STATE ──
  const [wizStep, setWizStep] = useState(1);
  const [wizData, setWizData] = useState({ type: "", budget: "" });
  const [wizSuccess, setWizSuccess] = useState(false);
  const [userName, setUserName] = useState("");

  // ── SEARCH STATE ──
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const raScrollRef = useRef<HTMLDivElement>(null);

  // ── FILTER STATE ──
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [typeFilter, setTypeFilter] = useState("All");
  const [filters, setFilters] = useState<Record<string, string>>({
    type: "All", beds: "Any", baths: "Any", avail: "Now", pets: "Any", util: "Any", basement: "Any", lease: "Any", park: "Any",
  });
  const [priceMin, setPriceMin] = useState(1500);
  const [priceMax, setPriceMax] = useState(5000);
  const [sortBy, setSortBy] = useState("newest");
  const [, setAvailPill] = useState("Available now");

  // Hero pill PENDING selections — accumulated until user clicks "Show results"
  const [pendingPriceMin, setPendingPriceMin] = useState(1500);
  const [pendingPriceMax, setPendingPriceMax] = useState(5000);
  const [pendingType, setPendingType] = useState("All");
  const [pendingBeds, setPendingBeds] = useState("Any");

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
      await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, ...attributionPayload() }) });
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

  const progWidth = wizSuccess ? 100 : Math.round((wizStep / 3) * 100);
  const newThisWeek = useMemo(() => listings.filter((l) => daysAgo(new Date(l.listedAt)) <= 7).length, [listings]);
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

  // Hero pill options (shared between rendering + label lookup for summary row)
  const budgetOptions = [
    { label: "Any price", min: 1500, max: 5000 },
    { label: "Under $2K", min: 1500, max: 2000 },
    { label: "$2K–$2.5K", min: 2000, max: 2500 },
    { label: "$2.5K–$3K", min: 2500, max: 3000 },
    { label: "$3K+", min: 3000, max: 5000 },
  ];
  const typeOptions = [
    { label: "Any", val: "All" },
    { label: "Condo/Apt", val: "Condo" },
    { label: "Townhouse", val: "Townhouse" },
    { label: "Semi-Det", val: "Semi" },
    { label: "Detached", val: "Detached" },
  ];
  const bedsOptions = [
    { label: "Any", val: "Any" },
    { label: "1 bed", val: "1" },
    { label: "2 bed", val: "2" },
    { label: "3 bed", val: "3" },
    { label: "4+ bed", val: "4" },
  ];

  const pendingBudgetActive = pendingPriceMin !== 1500 || pendingPriceMax !== 5000;
  const pendingTypeActive = pendingType !== "All";
  const pendingBedsActive = pendingBeds !== "Any";
  const pendingActiveLabels: string[] = [];
  if (pendingBudgetActive) {
    const m = budgetOptions.find((o) => o.min === pendingPriceMin && o.max === pendingPriceMax);
    if (m) pendingActiveLabels.push(m.label);
  }
  if (pendingTypeActive) {
    const m = typeOptions.find((o) => o.val === pendingType);
    if (m) pendingActiveLabels.push(m.label);
  }
  if (pendingBedsActive) {
    const m = bedsOptions.find((o) => o.val === pendingBeds);
    if (m) pendingActiveLabels.push(m.label);
  }
  const hasActivePending = pendingActiveLabels.length > 0;
  const appliedIsDefault = priceMin === 1500 && priceMax === 5000 && filters.type === "All" && filters.beds === "Any";
  const pendingMatchesApplied = pendingPriceMin === priceMin && pendingPriceMax === priceMax && pendingType === filters.type && pendingBeds === filters.beds;

  const handleApplyFilters = () => {
    setPriceMin(pendingPriceMin);
    setPriceMax(pendingPriceMax);
    tglFilter("type", pendingType);
    tglFilter("beds", pendingBeds);
    document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" });
  };
  const handleClearFilters = () => {
    setPendingPriceMin(1500);
    setPendingPriceMax(5000);
    setPendingType("All");
    setPendingBeds("Any");
    setPriceMin(1500);
    setPriceMax(5000);
    tglFilter("type", "All");
    tglFilter("beds", "Any");
  };

  // Listing-card save handler (redirects to sign-in if not authenticated)
  const handleSaveListing = async (mlsNumber: string, addr: string) => {
    if (!user) {
      router.push(`/signin?next=${encodeURIComponent("/rentals")}`);
      return;
    }
    if (isListingSaved(mlsNumber)) {
      await unsaveListing(mlsNumber);
      showToast(`♡ Removed ${addr.split(",")[0]}`);
    } else {
      await saveListing(mlsNumber);
      showToast(`♥ Saved ${addr.split(",")[0]}`);
    }
  };

  // Rent-averages scroll handlers
  const scrollRa = (dir: "left" | "right") => {
    const el = raScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -240 : 240, behavior: "smooth" });
  };

  // Street-slug helper for listing cards + footer
  const streetOf = (addr: string) => addr.split(",")[0].replace(/^\d+[a-zA-Z]?\s+/, "").trim();
  const streetSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
  const hoodOf = (hood: string) => hood.replace(/^\d+\s*-\s*\w+\s+/, "").trim();

  // Top streets by listing count (for footer)
  const topStreets = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of listings) {
      const s = streetOf(l.address);
      if (!s) continue;
      counts.set(s, (counts.get(s) || 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => ({ name, slug: streetSlug(name) }));
  }, [listings]);

  return (
    <div className="rentals-page">
      {/* ═══ HERO ═══ */}
      <div className="hero">
        {/* ── LEFT PANEL ── */}
        <div className="hl">
          <div className="live-row">
            <div className="live-badge"><span className="live-dot" />{totalRentals} active rentals · live TREB data</div>
            {newThisWeek > 0 && <span className="new-this-week">· {newThisWeek} new this week</span>}
            <a href={`tel:${config.realtor.phoneE164}`} className="hero-phone-link" style={{color:"#f59e0b"}}>
              📞 Call {REALTOR_FIRST_NAME} · {config.realtor.phone}
            </a>
          </div>
          <h1>Find your next<br />home in <em>{config.CITY_NAME}</em></h1>
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
                placeholder="Street, neighbourhood or MLS #..."
              />
              <button className="sbtn" onClick={handleSearch}>Search →</button>
            </div>

            {/* Search dropdown — shows when input focused + empty */}
            {searchOpen && (
              <div className="sdrop open">
                <div className="sdi" onClick={() => { setSearchOpen(false); tglFilter("type", "All"); setSearchQuery(""); document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" }); }}>
                  <div className="sdi-ico am">🏠</div>
                  <div><div className="sdi-main">See all {totalRentals} active {config.CITY_NAME} rentals</div><div className="sdi-sub">Condos, townhouses, detached — all listings</div></div>
                </div>
                <div className="sdi" onClick={() => { setSearchOpen(false); tglFilter("type", "Condo"); setSearchQuery(""); showToast("🏢 Showing condos only"); document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" }); }}>
                  <div className="sdi-ico bl">🏢</div>
                  <div><div className="sdi-main">Show condos only</div><div className="sdi-sub">All {config.CITY_NAME} condo rentals</div></div>
                </div>
                <div className="sdi" onClick={() => { setSearchQuery("Main St"); setSearchOpen(false); showToast("🔍 Searching Main St..."); document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" }); }}>
                  <div className="sdi-ico gr">📍</div>
                  <div><div className="sdi-main">Main Street rentals</div><div className="sdi-sub">Popular {config.CITY_NAME} street</div></div>
                </div>
              </div>
            )}

            {/* Filter pills — Budget */}
            <div className="fpill-row">
              <span className="fpill-label">Budget:</span>
              {budgetOptions.map((p) => (
                <button key={p.label} className={`fpill${pendingPriceMin === p.min && pendingPriceMax === p.max ? " on" : ""}`} onClick={() => { setPendingPriceMin(p.min); setPendingPriceMax(p.max); }}>
                  {p.label}
                </button>
              ))}
            </div>
            {/* Filter pills — Type */}
            <div className="fpill-row">
              <span className="fpill-label">Type:</span>
              {typeOptions.map((p) => (
                <button key={p.label} className={`fpill${pendingType === p.val ? " on" : ""}`} onClick={() => { setPendingType(p.val); }}>
                  {p.label}
                </button>
              ))}
            </div>
            {/* Filter pills — Beds */}
            <div className="fpill-row">
              <span className="fpill-label">Beds:</span>
              {bedsOptions.map((p) => (
                <button key={p.label} className={`fpill${pendingBeds === p.val ? " on" : ""}`} onClick={() => { setPendingBeds(p.val); }}>
                  {p.label}
                </button>
              ))}
            </div>
            {/* Filter pills — Move-in (immediate-apply, consistent styling with rows above) */}
            <div className="fpill-row">
              <span className="fpill-label">Move-in:</span>
              {[
                { label: "Available", val: "Now", availLabel: "Available now" },
                { label: "May", val: "May", availLabel: "May 2026" },
                { label: "June", val: "June", availLabel: "June 2026" },
                { label: "July", val: "July", availLabel: "July 2026" },
                { label: "Flexible", val: "Flexible", availLabel: "Flexible" },
              ].map((p) => (
                <button key={p.label} className={`fpill${filters.avail === p.val ? " on" : ""}`} onClick={() => { tglFilter("avail", p.val); setAvailPill(p.availLabel); }}>
                  {p.label}
                </button>
              ))}
            </div>
            {/* Divider */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "12px 0 10px" }} />
            {/* Active filter summary + apply/clear */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontSize: 11, lineHeight: 1.4 }}>
                {hasActivePending ? (
                  <>
                    <span style={{ color: "#f59e0b", fontWeight: 700 }}>{pendingActiveLabels.length} filter{pendingActiveLabels.length === 1 ? "" : "s"} selected</span>
                    <span style={{ color: "var(--t4)" }}> — {pendingActiveLabels.join(", ")}</span>
                  </>
                ) : (
                  <span style={{ color: "var(--t3)" }}>Select filters above</span>
                )}
              </div>
              {hasActivePending && (
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button onClick={handleClearFilters} style={{ background: "transparent", border: "none", color: "var(--t4)", fontSize: 11, fontWeight: 600, cursor: "pointer", padding: "6px 4px", textDecoration: "underline" }}>
                    Clear all
                  </button>
                  <button className="sbtn" onClick={handleApplyFilters}>
                    Show results
                  </button>
                </div>
              )}
            </div>
          </div>
          {/* Muted hint — pending-vs-applied status */}
          <div style={{ fontSize: 11, color: "var(--t4)", marginTop: -8, marginBottom: 14, paddingLeft: 2 }}>
            {appliedIsDefault && pendingMatchesApplied
              ? `Showing all ${totalRentals} rentals`
              : !pendingMatchesApplied
              ? "Hit Show results to apply"
              : `Showing ${filteredListings.length} rentals matching your filters`}
          </div>

          <div className="trust-row">
            {config.realtor.yearsExperience} Years Full-Time Experience · Tenants · Landlords · Buyers · Sellers · {config.CITY_NAME} Specialist · RE/MAX Hall of Fame
          </div>
        </div>

        {/* ── MIDDLE — WIZARD ── */}
        <div className="hm">
          <div className="wiz-topbar">
            <h1 style={{fontSize:"clamp(30px,2.8vw,44px)",fontWeight:800,color:"var(--pearl)",lineHeight:1.09,marginBottom:3}}>Answer 3 questions. Get matched.</h1>
            <div className="wiz-sub">3 quick questions · 30 seconds · no commitment</div>
            <div className="prog-track"><div className="prog-bar" style={{ width: `${progWidth}%` }} /></div>
          </div>
          <div className="wiz-body">
            {!wizSuccess ? (
              <>
                {/* Step 1 — Home type */}
                {wizStep === 1 && (
                  <div className="wiz-step active">
                    <div className="q-meta"><div className="q-badge">1</div><span className="q-of">Question 1 of 3</span></div>
                    <div className="q-text">What kind of home are you looking for?</div>
                    <div className="opt-grid">
                      {[
                        { icon: HomeTypeIcon.Detached, label: "Detached" },
                        { icon: HomeTypeIcon.Semi, label: "Semi" },
                        { icon: HomeTypeIcon.Townhouse, label: "Townhouse" },
                        { icon: HomeTypeIcon.Condo, label: "Condo" },
                      ].map((t) => (
                        <div key={t.label} className={`opt-tile${wizData.type === t.label ? " sel" : ""}`} onClick={() => {
                          setWizData({ ...wizData, type: t.label });
                          showToast(`✓ ${t.label} selected`);
                          setTimeout(() => setWizStep(2), 500);
                        }}>
                          {wizData.type === t.label && <div className="opt-tick">✓</div>}
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
                    <div className="q-meta"><div className="q-badge">2</div><span className="q-of">Question 2 of 3</span></div>
                    <div className="q-text">What&apos;s your monthly budget?</div>
                    <div className="opt-grid">
                      {["Under $2K", "$2K–$2.5K", "$2.5K–$3K", "$3K+"].map((b) => (
                        <div key={b} className={`opt-tile${wizData.budget === b ? " sel" : ""}`} onClick={() => {
                          setWizData({ ...wizData, budget: b });
                          showToast(`✓ Budget: ${b}/month`);
                          setTimeout(() => setWizStep(3), 500);
                        }}>
                          {wizData.budget === b && <div className="opt-tick">✓</div>}
                          <span className="opt-ico" style={{ fontSize: 18, marginBottom: 5 }}>💰</span>
                          <div className="opt-lbl">{b}</div>
                        </div>
                      ))}
                    </div>
                    <div className="back-lnk" onClick={() => setWizStep(1)}>← Back</div>
                  </div>
                )}

                {/* Step 3 — Lead capture */}
                {wizStep === 3 && (
                  <div className="wiz-step active">
                    <div className="q-meta"><div className="q-badge">3</div><span className="q-of">Last step</span></div>
                    <div className="q-text">Your matches are ready.</div>
                    <div className="contact-hdr">
                      <div className="ch-num">{filteredListings.length}</div>
                      <div className="ch-lbl">{config.CITY_NAME} rentals match what you described</div>
                    </div>
                    <div className="cf"><label className="cf-lbl">Full name</label><input className="cf-input" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="First and last name" /></div>
                    <div className="cf"><label className="cf-lbl">Email</label><input className="cf-input" id="wiz-email" type="email" placeholder="your@email.com" /></div>
                    <div className="cf"><label className="cf-lbl">Phone number</label><input className="cf-input" id="wiz-phone" type="tel" placeholder="(647) 555-0000" /></div>
                    <button className="next-btn amber" onClick={async () => {
                      if (!userName) { showToast("Please enter your name."); return; }
                      const email = (document.getElementById("wiz-email") as HTMLInputElement).value;
                      const phone = (document.getElementById("wiz-phone") as HTMLInputElement).value;
                      if (!email) { showToast("Please enter your email."); return; }
                      if (!phone) { showToast("Please enter your phone number."); return; }
                      // Apply quiz preferences to listing filters below
                      if (wizData.type) tglFilter("type", wizData.type);
                      if (wizData.budget === "Under $2K") { setPriceMin(1500); setPriceMax(2000); }
                      else if (wizData.budget === "$2K–$2.5K") { setPriceMin(2000); setPriceMax(2500); }
                      else if (wizData.budget === "$2.5K–$3K") { setPriceMin(2500); setPriceMax(3000); }
                      else if (wizData.budget === "$3K+") { setPriceMin(3000); setPriceMax(5000); }
                      // Post quiz to leads API
                      const ok = await submitLead({
                        firstName: userName, phone, email, source: "rental-quiz", intent: "renter",
                        propertyType: wizData.type,
                        budget: wizData.budget,
                      });
                      if (ok) {
                        setWizSuccess(true);
                        showToast("✓ Matches sent!");
                        setTimeout(() => document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" }), 800);
                      }
                    }}>
                      Show me matching rentals →
                    </button>
                    <div className="submit-note">{REALTOR_FIRST_NAME} usually replies within the hour · No spam</div>
                    <div className="back-lnk" onClick={() => setWizStep(2)}>← Back</div>
                  </div>
                )}
              </>
            ) : (
              /* ── SUCCESS SCREEN ── */
              <div className="success-screen show">
                <div className="ss-check">✓</div>
                <div className="ss-title">Thanks, {userName}!</div>
                <div className="ss-sub">We&apos;ll send you matches within the hour. {REALTOR_FIRST_NAME} will follow up personally.</div>
                <button className="ss-alert" onClick={async () => {
                  await submitLead({ firstName: userName, source: "new-match-alert", intent: "renter" });
                  showToast("🔔 Alert set! You'll hear from us first.");
                }}>🔔 Alert me when new matches list</button>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT — BOOKING CARD ── */}
        <div className="hr" id="book-showing">
          <div className="booking-card">
            <div className="bc-strip" />
            <div className="bc-head">
              <div className="bc-eyebrow">Book a showing</div>
              <h2 className="bc-title" style={{fontSize:"clamp(30px,2.8vw,44px)",fontWeight:800,lineHeight:1.09,margin:0}}>Usually confirmed within <span style={{color:"#f59e0b"}}>the hour</span></h2>
              <div className="bc-sub">Name any {config.CITY_NAME} listing. {REALTOR_FIRST_NAME} typically confirms your showing within an hour during business hours.</div>
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
                const ok = await submitLead({ firstName: name, phone, source: "1hr-booking", intent: "renter", street: mls || `Any ${config.CITY_NAME} rental` });
                if (ok) {
                  showToast(`⏱ Booking confirmed! We'll call ${phone} within 15 minutes.`);
                  (document.getElementById("bc-name") as HTMLInputElement).value = "";
                  (document.getElementById("bc-phone") as HTMLInputElement).value = "";
                  (document.getElementById("bc-mls") as HTMLInputElement).value = "";
                }
              }}><em>⏱</em> Request my showing</button>
              <div className="bc-trust">No obligation · {REALTOR_FIRST_NAME} usually calls back within the hour</div>
              <div className="bc-agent">{config.realtor.name} · {BROKERAGE_SHORT_NAME}</div>
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
          <span className="ra-eyebrow">Rental Market</span>
          <div className="ra-titles">
            <span className="ra-title">Average Rent in {config.CITY_NAME}</span>
            <span className="ra-subtitle">Live data from {totalRentals} active listings · Click to filter</span>
          </div>
        </div>
        <div className="ra-scroll-wrap">
          <button className="ra-scroll-btn ra-prev" onClick={() => scrollRa("left")} aria-label="Scroll left">‹</button>
          <div className="ra-scroll" ref={raScrollRef}>
            {rentAvgs.map((r) => {
              const typeMap: Record<string, string> = { condo: "Condo", semi: "Semi", townhouse: "Townhouse", detached: "Detached" };
              const applyRentFilter = () => {
                tglFilter("type", typeMap[r.type] || "All");
                tglFilter("beds", String(r.beds));
                document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" });
                showToast(`Showing ${r.label} rentals`);
              };
              return (
                <div key={r.label} className="ra-card" onClick={applyRentFilter}>
                  <span className="ra-price">${r.avg.toLocaleString()}</span>
                  <span className="ra-label">{r.label}<span className="ra-arrow"> →</span></span>
                  <span className="ra-count">{r.count} listing{r.count === 1 ? "" : "s"}</span>
                  <button
                    className="ra-view"
                    onClick={(e) => { e.stopPropagation(); applyRentFilter(); }}
                  >
                    View →
                  </button>
                </div>
              );
            })}
            <div
              className="ra-card ra-total"
              onClick={() => document.getElementById("listings")?.scrollIntoView({ behavior: "smooth" })}
            >
              View all {totalRentals} →
            </div>
          </div>
          <button className="ra-scroll-btn ra-next" onClick={() => scrollRa("right")} aria-label="Scroll right">›</button>
        </div>
      </div>

      {/* ═══ WHY {SITE_NAME} TRUST SECTION ═══ */}
      <section className="trust-why">
        <div className="trust-why-inner">
          <div className="trust-why-item"><span className="trust-why-ico">✓</span>Every {config.CITY_NAME} rental live from TREB — updated daily</div>
          <div className="trust-why-item"><span className="trust-why-ico">✓</span>No fake listings — all verified MLS data</div>
          <div className="trust-why-item"><span className="trust-why-ico">⏱</span>{REALTOR_FIRST_NAME} confirms your showing within the hour</div>
        </div>
      </section>

      {/* ═══ STICKY FILTER BAR ═══ */}
      <div className="filter-bar" id="filter-bar">
        <div className="fb-top">
          <div className="fb-count">
            <em>{totalRentals}</em> {config.CITY_NAME} rentals
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
            <select className={`fs-sel${priceMin !== 1500 ? " on" : ""}`} value={priceMin} onChange={(e) => setPriceMin(parseInt(e.target.value))}>
              {[1500, 2000, 2500, 3000, 3500, 4000, 4500].map((v) => (
                <option key={v} value={v}>{(v / 1000).toFixed(1).replace(".0", "") + "k"}</option>
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
            setTypeFilter("All"); setPriceMin(1500); setPriceMax(5000); setSearchQuery(""); setSortBy("newest"); setAvailPill("Available now");
            showToast("↺ Filters reset");
          }}>↺ Reset</button>
          {searchQuery && <div className="fs-search-chip">&quot;{searchQuery}&quot; <span className="fs-chip-x" onClick={() => setSearchQuery("")}>✕</span></div>}
        </div>
      </div>

      {/* ═══ LISTINGS ═══ */}
      <section className="listings-sec" id="listings">
        <div className="ls-header">
          <div>
            <div className="ls-title">{wizSuccess ? `${userName}'s ${config.CITY_NAME} matches` : `All ${config.CITY_NAME} rentals`}</div>
            <div className="ls-sub">{filteredListings.length} active listings · sorted by {sortBy === "price_asc" ? "price low–high" : sortBy === "price_desc" ? "price high–low" : "newest"}</div>
          </div>
        </div>

        {filteredListings.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>No rentals match your filters</p>
            <p style={{ fontSize: 13 }}>Try adjusting your price range, bedrooms, or property type.</p>
            <button className="fs-reset" style={{ marginTop: 16 }} onClick={() => {
              setFilters({ type: "All", beds: "Any", baths: "Any", avail: "Now", pets: "Any", util: "Any", basement: "Any", lease: "Any", park: "Any" });
              setTypeFilter("All"); setPriceMin(1500); setPriceMax(5000); setSearchQuery(""); setAvailPill("Available now");
            }}>↺ Reset all filters</button>
          </div>
        ) : (
          <div className={`lgrid${viewMode === "list" ? " list-view" : ""}`}>
            {filteredListings.map((l) => {
              const days = daysAgo(new Date(l.listedAt));
              const descPreview = l.description ? l.description.slice(0, 160).replace(/\s+\S*$/, "") + "…" : null;
              const cardStreet = streetOf(l.address);
              const cardHood = hoodOf(l.neighbourhood);
              return (
                <div
                  key={l.mlsNumber}
                  className="lcard"
                  onClick={() => router.push(`/listings/${l.mlsNumber}`)}
                >
                    <div className="lcard-img" style={{ background: l.photos[0] ? `url(${l.photos[0]}) center/cover` : "#e0f2fe" }}>
                      {!l.photos[0] && <span style={{ fontSize: 44 }}>{typeIcons[l.propertyType] || "🏠"}</span>}
                      <span className="lbadge">{days === 0 ? "New today" : days <= 7 ? "New this week" : `${days}d ago`}</span>
                      <span className="avail-tag">{l.possessionDetails === "Vacant" || l.possessionDetails === "Immediate" ? "Available now" : l.possessionDetails || "Available"}</span>
                    </div>
                    <div className="lbody">
                      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:2}}>
                        <div className="lprice" style={{marginBottom:0}}>{formatPriceFull(l.price)} <span>/ month</span></div>
                        <span style={{background:"#07111f",color:"#cbd5e1",fontSize:10,fontWeight:800,letterSpacing:".05em",textTransform:"uppercase",padding:"3px 8px",borderRadius:999,flexShrink:0,alignSelf:"center"}}>
                          {propertyBadgeLabel(l.propertyType)}
                        </span>
                      </div>
                      <div className="laddr">{titleCase(l.address.split(",")[0])}</div>
                      <div className="lcard-links">
                        <Link href={`/streets/${streetSlug(cardStreet)}`} onClick={(e) => e.stopPropagation()}>{titleCase(cardStreet)}</Link>
                        <span className="sep">·</span>
                        <Link href={`/listings?neighbourhood=${encodeURIComponent(cardHood)}`} onClick={(e) => e.stopPropagation()}>{titleCase(cardHood)}</Link>
                      </div>
                      <div className="lspecs">
                        <span>🛏 {l.bedrooms} bed</span>
                        <span>🚿 {l.bathrooms} bath</span>
                        {l.parking > 0 && <span>🚗 {l.parking} park</span>}
                        <span>⏱ {days}d on market</span>
                      </div>
                      <div style={{fontSize:11,color:"#94a3b8",marginTop:-4,marginBottom:8}}>
                        {l.listOfficeName ? titleCase(l.listOfficeName) : "MLS®"} · {days === 0 ? "Listed today" : `${days}d on ${config.SITE_NAME}`}
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
                  <div className="lbtns-wrap" onClick={(e) => e.stopPropagation()}>
                    <button className="lbtn lbtn-bk" onClick={() => handleBookShowing(l)}>Book showing</button>
                    <button className="lbtn lbtn-1h" onClick={() => handleOneHourShowing(l)}>See this today →</button>
                    <button
                      className="lbtn-save-mini"
                      onClick={() => handleSaveListing(l.mlsNumber, l.address)}
                      aria-label={isListingSaved(l.mlsNumber) ? "Unsave listing" : "Save listing"}
                      title={isListingSaved(l.mlsNumber) ? "Unsave listing" : "Save listing"}
                    >
                      {isListingSaved(l.mlsNumber) ? "♥" : "♡"}
                    </button>
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
          <p className="text-[12px] text-[#94a3b8] mt-0.5">{REALTOR_FIRST_NAME} has exclusive listings not on MLS</p>
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

      {/* ═══ RENTALS PAGE FOOTER ═══ */}
      <footer className="rentals-footer">
        <div className="rf-inner">
          <div className="rf-col">
            <h4>Popular {config.CITY_NAME} streets</h4>
            <ul>
              {topStreets.map((s) => (
                <li key={s.slug}><Link href={`/streets/${s.slug}`}>{s.name}</Link></li>
              ))}
              {topStreets.length === 0 && (
                <li><Link href="/streets">Browse all {config.CITY_NAME} streets →</Link></li>
              )}
            </ul>
          </div>
          <div className="rf-col">
            <h4>{config.CITY_NAME} neighbourhoods</h4>
            <ul>
              {FOOTER_NEIGHBOURHOODS.map((n) => (
                <li key={n}><Link href={`/neighbourhoods/${toFooterSlug(n)}`}>{n}</Link></li>
              ))}
            </ul>
          </div>
          <div className="rf-col">
            <h4>Quick links</h4>
            <ul>
              <li><Link href="/listings">Buy in {config.CITY_NAME}</Link></li>
              <li><Link href="/sell">Sell in {config.CITY_NAME}</Link></li>
              <li><Link href="/schools">Schools</Link></li>
              <li><Link href="/mosques">Mosques</Link></li>
              <li><Link href="/about">About</Link></li>
            </ul>
          </div>
        </div>
        <div className="rf-bottom">
          {config.realtor.name} · {BROKERAGE_SHORT_NAME} · {config.CITY_NAME} {config.CITY_PROVINCE} · <a href={`tel:${config.realtor.phoneE164}`}>{config.realtor.phone}</a>
        </div>
      </footer>

      {/* ═══ MOBILE STICKY CTA (visible below 900px via CSS) ═══ */}
      <div className="mobile-cta">
        <button
          className="mobile-cta-btn"
          onClick={() => document.getElementById("book-showing")?.scrollIntoView({ behavior: "smooth" })}
        >
          Book a showing →
        </button>
      </div>
    </div>
  );
}
