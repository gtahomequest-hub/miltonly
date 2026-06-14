"use client";

// src/components/places/PlaceGrid.tsx
// Shared client filter-grid for /mosques + /schools. Generalizes the legacy
// SchoolsGrid (search + board + level) and MosquesGrid (search + type) into a
// search box + N chip groups over a forest card grid. Filter MECHANICS port the
// legacy behavior 1:1 (substring search on name+neighbourhood; per-group
// single-select with an "all" reset) — only the styling is forest.

import { useMemo, useState } from "react";
import Link from "next/link";
import type { PlaceCard, PlaceFilterGroup } from "./types";

function Card({ item }: { item: PlaceCard }) {
  return (
    <Link href={item.href} className="pl-card">
      <div className="pl-card-top">
        <p className="pl-card-name">{item.name}</p>
        {item.badge && <span className={`pl-badge ${item.badge.tone ?? ""}`}>{item.badge.label}</span>}
      </div>
      {(item.metaParts?.length || item.fraser) && (
        <div className="pl-card-meta">
          {item.metaParts?.map((m) => (
            <span key={m}>{m}</span>
          ))}
          {item.fraser && <span className="pl-card-fraser">Fraser {item.fraser}/10</span>}
        </div>
      )}
      {item.note && <p className="pl-card-note">{item.note}</p>}
      {item.footer && (
        <div className={`pl-card-foot${item.footerActive ? " active" : ""}`}>{item.footer}</div>
      )}
    </Link>
  );
}

export default function PlaceGrid({
  items,
  filterGroups = [],
  searchPlaceholder,
  itemNoun,
}: {
  items: PlaceCard[];
  filterGroups?: PlaceFilterGroup[];
  searchPlaceholder: string;
  itemNoun: string;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({}); // key -> value ("all" or absent = all)

  const filtered = useMemo(() => {
    let result = items;
    if (query) {
      const q = query.toLowerCase();
      result = result.filter((s) => s.searchText.includes(q));
    }
    for (const g of filterGroups) {
      const sel = selected[g.key];
      if (sel && sel !== "all") result = result.filter((s) => s.filters?.[g.key] === sel);
    }
    return result;
  }, [items, query, selected, filterGroups]);

  const n = filtered.length;

  return (
    <div className="pl-wrap">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        className="pl-search"
        aria-label={searchPlaceholder}
      />

      {filterGroups.map((g, gi) => (
        <div className="pl-filterrow" key={g.key}>
          {gi > 0 && <span className="pl-divider" aria-hidden />}
          <button
            type="button"
            onClick={() => setSelected((s) => ({ ...s, [g.key]: "all" }))}
            className={`pl-chip${!selected[g.key] || selected[g.key] === "all" ? " is-active" : ""}`}
          >
            {g.allLabel}
          </button>
          {g.options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() =>
                setSelected((s) => ({ ...s, [g.key]: s[g.key] === o.value ? "all" : o.value }))
              }
              className={`pl-chip${selected[g.key] === o.value ? " is-active" : ""}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      ))}

      <p className="pl-count">
        Showing {n} {itemNoun}
        {n !== 1 ? "s" : ""}
      </p>

      <div className="pl-grid">
        {filtered.map((item) => (
          <Card key={item.slug} item={item} />
        ))}
        {n === 0 && <p className="pl-empty">No {itemNoun}s match your filters.</p>}
      </div>
    </div>
  );
}
