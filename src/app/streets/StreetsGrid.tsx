"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { formatPriceFull } from "@/lib/format";
import { config } from "@/lib/config";

interface Street {
  slug: string;
  name: string;
  neighbourhood: string;
  count: number;
  activeCount: number;
  avgPrice: number;
  hasPage: boolean;
  isNew: boolean;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export default function StreetsGrid({
  streets,
  neighbourhoods,
}: {
  streets: Street[];
  neighbourhoods: string[];
}) {
  const [query, setQuery] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [activeHood, setActiveHood] = useState<string | null>(null);
  const [alertEmail, setAlertEmail] = useState("");
  const [alertSubmitted, setAlertSubmitted] = useState(false);

  const filtered = useMemo(() => {
    let result = streets;
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.neighbourhood.toLowerCase().includes(q)
      );
    }
    if (activeLetter) {
      result = result.filter((s) =>
        s.name.toUpperCase().startsWith(activeLetter)
      );
    }
    if (activeHood) {
      result = result.filter((s) => s.neighbourhood === activeHood);
    }
    return result;
  }, [streets, query, activeLetter, activeHood]);

  // Which letters actually have streets
  const availableLetters = useMemo(() => {
    const letters = new Set(streets.map((s) => s.name.charAt(0).toUpperCase()));
    return letters;
  }, [streets]);

  const handleAlertSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!alertEmail) return;
    setAlertSubmitted(true);
    setAlertEmail("");
  };

  return (
    <>
      {/* Lead capture banner */}
      <div className="bg-[#07111f] rounded-2xl p-5 sm:p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold text-[#f8f9fb] mb-1">
              Get street price alerts
            </p>
            <p className="text-[12px] text-[#94a3b8]">
              Be the first to know when a home lists on any {config.CITY_NAME} street.
            </p>
          </div>
          {alertSubmitted ? (
            <p className="text-[13px] font-bold text-[#f59e0b] shrink-0">
              You&apos;re in. We&apos;ll email you.
            </p>
          ) : (
            <form onSubmit={handleAlertSubmit} className="flex gap-2 shrink-0">
              <input
                type="email"
                value={alertEmail}
                onChange={(e) => setAlertEmail(e.target.value)}
                placeholder="Your email"
                required
                className="w-48 px-3 py-2.5 text-[12px] bg-[#0c1e35] border border-[#1e3a5f] text-[#f8f9fb] placeholder:text-[#64748b] rounded-lg outline-none focus:border-[#f59e0b]"
              />
              <button
                type="submit"
                className="bg-[#f59e0b] text-[#07111f] text-[12px] font-bold px-4 py-2.5 rounded-lg shrink-0 hover:bg-[#eab308] transition-colors"
              >
                Alert me
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search streets by name or neighbourhood..."
        className="w-full max-w-md mb-5 px-4 py-3 text-[13px] bg-white border border-[#e2e8f0] rounded-xl outline-none focus:border-[#f59e0b] transition-colors"
      />

      {/* A-Z alphabet filter */}
      <div className="flex flex-wrap gap-1 mb-4">
        <button
          onClick={() => setActiveLetter(null)}
          className={`text-[11px] font-bold w-7 h-7 rounded-md flex items-center justify-center transition-all ${
            !activeLetter
              ? "bg-[#07111f] text-[#f59e0b]"
              : "bg-white border border-[#e2e8f0] text-[#64748b] hover:text-[#07111f]"
          }`}
        >
          All
        </button>
        {ALPHABET.map((letter) => {
          const available = availableLetters.has(letter);
          return (
            <button
              key={letter}
              onClick={() => available && setActiveLetter(activeLetter === letter ? null : letter)}
              disabled={!available}
              className={`text-[11px] font-bold w-7 h-7 rounded-md flex items-center justify-center transition-all ${
                activeLetter === letter
                  ? "bg-[#07111f] text-[#f59e0b]"
                  : available
                  ? "bg-white border border-[#e2e8f0] text-[#64748b] hover:text-[#07111f] hover:border-[#07111f]"
                  : "bg-[#f8f9fb] text-[#d1d5db] cursor-default"
              }`}
            >
              {letter}
            </button>
          );
        })}
      </div>

      {/* Neighbourhood filter chips */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        <button
          onClick={() => setActiveHood(null)}
          className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all ${
            !activeHood
              ? "bg-[#07111f] border-[#07111f] text-[#f59e0b]"
              : "border-[#e2e8f0] text-[#64748b] hover:text-[#475569]"
          }`}
        >
          All areas
        </button>
        {neighbourhoods.slice(0, 15).map((hood) => (
          <button
            key={hood}
            onClick={() => setActiveHood(activeHood === hood ? null : hood)}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all ${
              activeHood === hood
                ? "bg-[#07111f] border-[#07111f] text-[#f59e0b]"
                : "border-[#e2e8f0] text-[#64748b] hover:text-[#475569]"
            }`}
          >
            {hood}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-[11px] text-[#94a3b8] mb-4">
        Showing {filtered.length} street{filtered.length !== 1 ? "s" : ""}
        {activeLetter ? ` starting with ${activeLetter}` : ""}
        {activeHood ? ` in ${activeHood}` : ""}
      </p>

      {/* Street cards grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((s) => (
          <Link
            key={s.slug}
            href={`/streets/${s.slug}`}
            className="bg-white rounded-xl border border-[#e2e8f0] p-4 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-[#07111f] group-hover:text-[#2563eb] transition-colors truncate">
                  {s.name}
                </p>
                <p className="text-[11px] text-[#94a3b8] mt-0.5 truncate">
                  {s.neighbourhood}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {s.isNew && (
                  <span className="text-[9px] font-bold text-white bg-[#22c55e] rounded-full px-1.5 py-0.5">
                    NEW
                  </span>
                )}
                {s.activeCount >= 5 && (
                  <span className="text-[9px] font-extrabold text-[#07111f] bg-[#f59e0b] rounded-full px-2 py-0.5">
                    VIP HUB
                  </span>
                )}
              </div>
            </div>
            <p className="text-[18px] font-extrabold text-[#07111f]">
              {formatPriceFull(s.avgPrice)}
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[10px] text-[#94a3b8]">
                {s.count} listings
              </span>
              {s.activeCount > 0 && (
                <span className="text-[10px] text-[#22c55e] font-semibold">
                  {s.activeCount} active
                </span>
              )}
              {s.hasPage && (
                <span className="text-[10px] text-[#f59e0b] font-semibold">
                  Full report
                </span>
              )}
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="text-[13px] text-[#94a3b8] col-span-full text-center py-8">
            No streets match your filters
          </p>
        )}
      </div>
    </>
  );
}
