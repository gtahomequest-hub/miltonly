"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const modes = ["Street vs Street", "Neighbourhood vs Neighbourhood", "Building vs Building"];
const dims = ["Avg price", "Growth trend", "Days on market", "Sold vs ask %", "Price/sqft", "School rating", "GO walk time", "Rental yield", "Inventory", "Owner ratio"];

type Tab = "compare" | "street" | "condo";
type Suggestion = { name: string; slug: string };

function useAutocomplete(type: string) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [show, setShow] = useState(false);
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback((q: string) => {
    setQuery(q);
    setSelected(null);
    if (q.length < 2) { setResults([]); setShow(false); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/autocomplete?q=${encodeURIComponent(q)}&type=${type}`);
        const data = await res.json();
        setResults(data);
        setShow(data.length > 0);
      } catch { setResults([]); }
    }, 200);
  }, [type]);

  const pick = useCallback((item: Suggestion) => {
    setQuery(item.name);
    setSelected(item);
    setShow(false);
  }, []);

  const close = useCallback(() => setTimeout(() => setShow(false), 150), []);

  return { query, results, show, selected, search, pick, close, setShow };
}

function AutocompleteInput({ ac, placeholder, label }: {
  ac: ReturnType<typeof useAutocomplete>;
  placeholder: string;
  label?: string;
}) {
  return (
    <div className="relative">
      {label && (
        <label className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.08em] mb-1.5 block">
          {label}
        </label>
      )}
      <input
        type="text"
        value={ac.query}
        onChange={(e) => ac.search(e.target.value)}
        onFocus={() => ac.results.length > 0 && ac.setShow(true)}
        onBlur={ac.close}
        placeholder={placeholder}
        className="w-full bg-[#07111f] border-[1.5px] border-[#334155] rounded-lg px-3 py-3 text-[13px] text-white placeholder:text-[#64748b] outline-none focus:border-[#f59e0b] transition-colors"
      />
      {ac.show && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[#0c1e35] border border-[#334155] rounded-lg overflow-hidden z-20 shadow-xl">
          {ac.results.map((r) => (
            <button
              key={r.slug}
              onMouseDown={() => ac.pick(r)}
              className="w-full text-left px-3 py-2.5 text-[13px] text-[#cbd5e1] hover:bg-[#1e3a5f] hover:text-white transition-colors border-b border-[#1e3a5f] last:border-0"
            >
              {r.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function IntelligenceCentre() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("compare");
  const [activeMode, setActiveMode] = useState(modes[0]);

  const acType = activeMode.includes("Street") ? "street" : activeMode.includes("Neighbourhood") ? "neighbourhood" : "condo";
  const leftAc = useAutocomplete(acType);
  const rightAc = useAutocomplete(acType);
  const streetAc = useAutocomplete("street");
  const condoAc = useAutocomplete("condo");

  // Reset inputs when mode changes
  useEffect(() => {
    leftAc.search("");
    rightAc.search("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMode]);

  const handleStreetExplore = () => {
    if (streetAc.selected) {
      router.push(`/streets/${streetAc.selected.slug}`);
    } else if (streetAc.query.length > 0) {
      router.push("/streets");
    } else {
      router.push("/streets");
    }
  };

  const handleCondoExplore = () => {
    if (condoAc.selected) {
      router.push(`/condos/${condoAc.selected.slug}`);
    } else {
      router.push("/condos");
    }
  };

  return (
    <section className="bg-[#07111f] px-5 sm:px-11 py-12">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-[10px] font-bold text-[#f59e0b] uppercase tracking-[0.14em] mb-2">
            Milton Intelligence Centre
          </p>
          <h2 className="text-[24px] sm:text-[28px] font-extrabold text-white tracking-[-0.3px] mb-2">
            Data no other Milton site has
          </h2>
          <p className="text-[14px] text-[#94a3b8] max-w-lg mx-auto">
            Compare streets, neighbourhoods and buildings across 10 data dimensions. Updated daily from TREB.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-1 mb-6">
          {([
            { key: "compare" as Tab, label: "Compare" },
            { key: "street" as Tab, label: "Street Search" },
            { key: "condo" as Tab, label: "Condo Search" },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`text-[12px] font-semibold px-5 py-2 rounded-full border transition-all ${
                activeTab === tab.key
                  ? "bg-[#f59e0b] border-[#f59e0b] text-[#07111f]"
                  : "border-[#334155] text-[#cbd5e1] hover:text-white hover:border-[#64748b]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Card */}
        <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-2xl p-6 sm:p-8">
          {activeTab === "compare" && (
            <>
              {/* Mode pills */}
              <div className="flex flex-wrap gap-2 mb-6">
                {modes.map((m) => (
                  <button
                    key={m}
                    onClick={() => setActiveMode(m)}
                    className={`text-[11px] font-medium px-3.5 py-1.5 rounded-full border transition-all ${
                      activeMode === m
                        ? "bg-[rgba(245,158,11,0.15)] border-[#f59e0b] text-[#f59e0b] font-bold"
                        : "bg-[#07111f] border-[#334155] text-[#94a3b8] hover:text-white hover:border-[#64748b]"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {/* Inputs with autocomplete */}
              <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-3 items-end mb-5">
                <AutocompleteInput
                  ac={leftAc}
                  label="Left side"
                  placeholder={activeMode.includes("Street") ? "e.g. Laurier Ave" : activeMode.includes("Neighbourhood") ? "e.g. Willmott" : "e.g. Bronte Condos"}
                />
                <span className="hidden sm:block text-[12px] text-[#64748b] font-bold pb-3">vs</span>
                <AutocompleteInput
                  ac={rightAc}
                  label="Right side"
                  placeholder={activeMode.includes("Street") ? "e.g. Derry Rd" : activeMode.includes("Neighbourhood") ? "e.g. Coates" : "e.g. Ivy Ridge"}
                />
              </div>

              {/* CTA */}
              <Link href="/compare" className="block w-full bg-[#f59e0b] text-[#07111f] text-[14px] font-extrabold rounded-xl py-3.5 mb-5 hover:bg-[#eab308] transition-colors text-center">
                Compare Now
              </Link>

              {/* Dimensions */}
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider font-semibold mb-2">Dimensions compared</p>
              <div className="flex flex-wrap gap-1.5">
                {dims.map((d) => (
                  <span key={d} className="text-[10px] font-medium text-[#94a3b8] bg-[#07111f] border border-[#334155] rounded-full px-2.5 py-1">
                    {d}
                  </span>
                ))}
              </div>
            </>
          )}

          {activeTab === "street" && (
            <>
              <p className="text-[13px] text-[#94a3b8] mb-4">
                Search any Milton street for sold prices, trends, and market data.
              </p>
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <AutocompleteInput
                    ac={streetAc}
                    placeholder="Type any Milton street name"
                  />
                </div>
                <button
                  onClick={handleStreetExplore}
                  className="bg-[#f59e0b] text-[#07111f] text-[13px] font-extrabold px-5 py-3 rounded-lg shrink-0 hover:bg-[#eab308] transition-colors"
                >
                  Explore
                </button>
              </div>
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider font-semibold mb-2">Popular streets</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { name: "Derry Rd", slug: "derry-road-milton" },
                  { name: "Main St E", slug: "main-street-milton" },
                  { name: "Scott Blvd", slug: "scott-boulevard-milton" },
                  { name: "Savoline Blvd", slug: "savoline-boulevard-milton" },
                  { name: "Laurier Ave", slug: "laurier-avenue-milton" },
                  { name: "Ferguson Dr", slug: "ferguson-drive-milton" },
                ].map((s) => (
                  <Link
                    key={s.slug}
                    href={`/streets/${s.slug}`}
                    className="text-[11px] text-[#cbd5e1] bg-[#07111f] border border-[#334155] rounded-full px-3 py-1 hover:border-[#f59e0b] hover:text-[#f59e0b] transition-colors"
                  >
                    {s.name}
                  </Link>
                ))}
              </div>
            </>
          )}

          {activeTab === "condo" && (
            <>
              <p className="text-[13px] text-[#94a3b8] mb-4">
                Search any Milton condo building for prices, rental yields, and maintenance fees.
              </p>
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <AutocompleteInput
                    ac={condoAc}
                    placeholder="Type a condo building name or address"
                  />
                </div>
                <button
                  onClick={handleCondoExplore}
                  className="bg-[#f59e0b] text-[#07111f] text-[13px] font-extrabold px-5 py-3 rounded-lg shrink-0 hover:bg-[#eab308] transition-colors"
                >
                  Explore
                </button>
              </div>
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider font-semibold mb-2">Popular buildings</p>
              <div className="flex flex-wrap gap-1.5">
                {["Bronte Condos", "Main Street Lofts", "Milton Garden", "Ivy Ridge", "Thompson Towers"].map((c) => (
                  <Link
                    key={c}
                    href={`/condos/${c.toLowerCase().replace(/\s+/g, "-")}`}
                    className="text-[11px] text-[#cbd5e1] bg-[#07111f] border border-[#334155] rounded-full px-3 py-1 hover:border-[#f59e0b] hover:text-[#f59e0b] transition-colors"
                  >
                    {c}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
