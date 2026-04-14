"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { MosqueType } from "@/lib/mosques";

interface MosqueWithCount {
  slug: string;
  name: string;
  address: string;
  affiliation: string;
  type: MosqueType;
  services: string[];
  neighbourhood: string;
  notes: string | null;
  activeListings: number;
}

const typeLabels: Record<MosqueType, string> = {
  masjid: "Masjid",
  musalla: "Musalla",
  centre: "Centre",
};

const typeBadgeStyles: Record<MosqueType, string> = {
  masjid: "bg-[#dbeafe] text-[#1e40af]",
  musalla: "bg-[#fef3c7] text-[#92400e]",
  centre: "bg-[#f0fdf4] text-[#15803d]",
};

export default function MosquesGrid({ mosques }: { mosques: MosqueWithCount[] }) {
  const [typeFilter, setTypeFilter] = useState<MosqueType | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    let result = mosques;
    if (typeFilter !== "all") result = result.filter((m) => m.type === typeFilter);
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.affiliation.toLowerCase().includes(q) ||
          m.address.toLowerCase().includes(q)
      );
    }
    return result;
  }, [mosques, typeFilter, query]);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Search */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name, affiliation, or address..."
        className="w-full max-w-md mb-5 px-4 py-3 text-[13px] bg-white border border-[#e2e8f0] rounded-xl outline-none focus:border-[#f59e0b] transition-colors"
      />

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(["all", "masjid", "musalla", "centre"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all ${
              typeFilter === t
                ? "bg-[#07111f] border-[#07111f] text-[#f59e0b]"
                : "border-[#e2e8f0] text-[#64748b] hover:text-[#475569]"
            }`}
          >
            {t === "all" ? "All locations" : t === "masjid" ? "Masjids" : t === "musalla" ? "Musallas" : "Centres"}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-[11px] text-[#94a3b8] mb-4">
        Showing {filtered.length} location{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Cards grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((m) => (
          <Link
            key={m.slug}
            href={`/mosques/${m.slug}`}
            className="bg-white rounded-xl border border-[#e2e8f0] p-5 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-[14px] font-bold text-[#07111f] group-hover:text-[#2563eb] transition-colors leading-snug">
                {m.name}
              </p>
              <span className={`shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full ${typeBadgeStyles[m.type]}`}>
                {typeLabels[m.type].toUpperCase()}
              </span>
            </div>

            <p className="text-[11px] text-[#94a3b8] mb-1">{m.address}</p>

            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] text-[#64748b]">{m.affiliation}</span>
            </div>

            {m.services.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {m.services.slice(0, 4).map((s) => (
                  <span key={s} className="text-[9px] font-semibold bg-[#f1f5f9] text-[#475569] px-1.5 py-0.5 rounded">
                    {s}
                  </span>
                ))}
                {m.services.length > 4 && (
                  <span className="text-[9px] text-[#94a3b8]">+{m.services.length - 4} more</span>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 pt-3 border-t border-[#f1f5f9]">
              {m.activeListings > 0 ? (
                <span className="text-[11px] font-semibold text-[#22c55e]">
                  {m.activeListings} homes for sale nearby
                </span>
              ) : (
                <span className="text-[11px] text-[#94a3b8]">
                  View nearby listings
                </span>
              )}
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="text-[13px] text-[#94a3b8] col-span-full text-center py-8">
            No locations match your filters
          </p>
        )}
      </div>
    </div>
  );
}
