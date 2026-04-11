"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPriceFull } from "@/lib/format";

interface Street {
  slug: string;
  name: string;
  neighbourhood: string;
  count: number;
  avgPrice: number;
}

export default function StreetsGrid({ streets }: { streets: Street[] }) {
  const [query, setQuery] = useState("");

  const filtered = query
    ? streets.filter((s) =>
        s.name.toLowerCase().includes(query.toLowerCase()) ||
        s.neighbourhood.toLowerCase().includes(query.toLowerCase())
      )
    : streets;

  return (
    <>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search streets..."
        className="w-full max-w-md mb-6 px-4 py-3 text-[13px] bg-white border border-[#e2e8f0] rounded-xl outline-none focus:border-[#f59e0b] transition-colors"
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((s) => (
          <Link
            key={s.slug}
            href={`/streets/${s.slug}`}
            className="bg-white rounded-xl border border-[#e2e8f0] p-4 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-[#07111f] group-hover:text-[#2563eb] transition-colors truncate">
                  {s.name}
                </p>
                <p className="text-[11px] text-[#94a3b8] mt-0.5 truncate">{s.neighbourhood.replace(/^\d+\s*-\s*\w+\s+/, "")}</p>
              </div>
              <span className="text-[11px] font-bold text-[#475569] bg-[#f8fafc] rounded-full px-2 py-0.5 shrink-0">
                {s.count}
              </span>
            </div>
            <p className="text-[16px] font-extrabold text-[#07111f] mt-2">
              {formatPriceFull(s.avgPrice)}
            </p>
            <p className="text-[10px] text-[#94a3b8] mt-0.5">avg price · {s.count} listings</p>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="text-[13px] text-[#94a3b8] col-span-full text-center py-8">No streets match &quot;{query}&quot;</p>
        )}
      </div>
    </>
  );
}
