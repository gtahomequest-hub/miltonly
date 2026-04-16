"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Board, Level } from "@/lib/schools";

interface SchoolWithCount {
  slug: string;
  name: string;
  board: Board;
  level: Level;
  boardName: string;
  grades: string;
  neighbourhood: string;
  notes: string | null;
  fraserScore: string | null;
  activeListings: number;
}

export default function SchoolsGrid({ schools }: { schools: SchoolWithCount[] }) {
  const [boardFilter, setBoardFilter] = useState<Board | "all">("all");
  const [levelFilter, setLevelFilter] = useState<Level | "all">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    let result = schools;
    if (boardFilter !== "all") result = result.filter((s) => s.board === boardFilter);
    if (levelFilter !== "all") result = result.filter((s) => s.level === levelFilter);
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.neighbourhood.toLowerCase().includes(q)
      );
    }
    return result;
  }, [schools, boardFilter, levelFilter, query]);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Search */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search schools by name or neighbourhood..."
        className="w-full max-w-md mb-5 px-4 py-3 text-[13px] bg-white border border-[#e2e8f0] rounded-xl outline-none focus:border-[#f59e0b] transition-colors"
      />

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-6">
        {/* Board filters */}
        {(["all", "public", "catholic"] as const).map((b) => (
          <button
            key={b}
            onClick={() => setBoardFilter(b)}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all ${
              boardFilter === b
                ? "bg-[#07111f] border-[#07111f] text-[#f59e0b]"
                : "border-[#e2e8f0] text-[#64748b] hover:text-[#475569]"
            }`}
          >
            {b === "all" ? "All boards" : b === "public" ? "Public (HDSB)" : "Catholic (HCDSB)"}
          </button>
        ))}

        <span className="w-px h-6 bg-[#e2e8f0] self-center" />

        {/* Level filters */}
        {(["all", "elementary", "secondary"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLevelFilter(l)}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-full border transition-all ${
              levelFilter === l
                ? "bg-[#07111f] border-[#07111f] text-[#f59e0b]"
                : "border-[#e2e8f0] text-[#64748b] hover:text-[#475569]"
            }`}
          >
            {l === "all" ? "All levels" : l.charAt(0).toUpperCase() + l.slice(1)}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-[11px] font-medium text-[#94a3b8] mb-4">
        Showing {filtered.length} school{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* School cards grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((s) => (
          <Link
            key={s.slug}
            href={`/schools/${s.slug}`}
            className="bg-white rounded-xl border border-[#e2e8f0] p-5 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="text-[14px] font-bold text-[#07111f] group-hover:text-[#2563eb] transition-colors leading-snug">
                {s.name}
              </p>
              <span
                className={`shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-full ${
                  s.board === "public"
                    ? "bg-[#dbeafe] text-[#1e40af]"
                    : "bg-[#fef3c7] text-[#92400e]"
                }`}
              >
                {s.board === "public" ? "PUBLIC" : "CATHOLIC"}
              </span>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] text-[#94a3b8]">{s.grades}</span>
              <span className="text-[11px] text-[#94a3b8]">&middot;</span>
              <span className="text-[11px] text-[#94a3b8]">{s.neighbourhood}</span>
              {s.fraserScore && (
                <>
                  <span className="text-[11px] text-[#94a3b8]">&middot;</span>
                  <span className="text-[10px] font-bold text-[#15803d] bg-[#f0fdf4] px-1.5 py-0.5 rounded">
                    Fraser {s.fraserScore}/10
                  </span>
                </>
              )}
            </div>

            {s.notes && (
              <p className="text-[11px] text-[#64748b] mb-3 leading-relaxed">{s.notes}</p>
            )}

            <div className="flex items-center gap-3 pt-3 border-t border-[#f1f5f9]">
              {s.activeListings > 0 ? (
                <span className="text-[11px] font-semibold text-[#22c55e]">
                  {s.activeListings} homes for sale nearby
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
            No schools match your filters
          </p>
        )}
      </div>
    </div>
  );
}
