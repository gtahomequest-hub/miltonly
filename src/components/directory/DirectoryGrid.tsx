"use client";

// src/components/directory/DirectoryGrid.tsx
// Reusable forest-v2 directory grid for the Wave 2 card-grid family. Owns the
// search + A-Z + neighbourhood-chip filtering and the forest card layout; the
// page supplies normalized DirectoryItem[]. Filter MECHANICS are a 1:1 port of
// the legacy StreetsGrid (search on name+extra, A-Z by first char with
// unavailable letters disabled, single-select chip with toggle-off, live
// result count) — only the styling changed.

import { useMemo, useState } from "react";
import Link from "next/link";
import type { DirectoryGridProps, DirectoryItem } from "./types";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function DirectoryCard({ item }: { item: DirectoryItem }) {
  return (
    <Link href={item.href} className="dir-card">
      <div className="dir-card-top">
        <div style={{ minWidth: 0 }}>
          <p className="dir-card-title">{item.name}</p>
          {item.subtitle && <p className="dir-card-sub">{item.subtitle}</p>}
        </div>
        {item.badges && item.badges.length > 0 && (
          <div className="dir-badges">
            {item.badges.map((b) => (
              <span key={b.label} className={`dir-badge ${b.tone ?? ""}`}>
                {b.label}
              </span>
            ))}
          </div>
        )}
      </div>
      {item.stat && (
        <>
          <p className="dir-card-stat">{item.stat}</p>
          {item.statLabel && <p className="dir-card-statlabel">{item.statLabel}</p>}
        </>
      )}
      {item.meta && item.meta.length > 0 && (
        <div className="dir-card-meta">
          {item.meta.map((m) => (
            <span key={m.label} className={`dir-meta ${m.tone ?? "muted"}`}>
              {m.label}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

export default function DirectoryGrid({
  items,
  groups,
  groupLabel = "Areas",
  groupAllLabel = "All areas",
  searchPlaceholder = "Search…",
  itemNoun = "result",
  enableAZ = true,
}: DirectoryGridProps) {
  const [query, setQuery] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const availableLetters = useMemo(
    () => new Set(items.map((s) => s.name.charAt(0).toUpperCase())),
    [items]
  );

  const filtered = useMemo(() => {
    let result = items;
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.searchExtra ?? "").toLowerCase().includes(q)
      );
    }
    if (activeLetter) {
      result = result.filter((s) => s.name.toUpperCase().startsWith(activeLetter));
    }
    if (activeGroup) {
      result = result.filter((s) => s.group === activeGroup);
    }
    return result;
  }, [items, query, activeLetter, activeGroup]);

  const n = filtered.length;

  return (
    <>
      <section className="dir-filters">
        <div className="dir-wrap">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="dir-search"
            aria-label={searchPlaceholder}
          />

          {enableAZ && (
            <div className="dir-az">
              <button
                type="button"
                onClick={() => setActiveLetter(null)}
                className={`dir-az-btn${!activeLetter ? " is-active" : ""}`}
              >
                All
              </button>
              {ALPHABET.map((letter) => {
                const available = availableLetters.has(letter);
                return (
                  <button
                    key={letter}
                    type="button"
                    disabled={!available}
                    onClick={() =>
                      available && setActiveLetter(activeLetter === letter ? null : letter)
                    }
                    className={`dir-az-btn${activeLetter === letter ? " is-active" : ""}`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          )}

          {groups && groups.length > 0 && (
            <div className="dir-chips">
              <span className="dir-chip-label">{groupLabel}</span>
              <button
                type="button"
                onClick={() => setActiveGroup(null)}
                className={`dir-chip${!activeGroup ? " is-active" : ""}`}
              >
                {groupAllLabel}
              </button>
              {groups.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setActiveGroup(activeGroup === g ? null : g)}
                  className={`dir-chip${activeGroup === g ? " is-active" : ""}`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="dir-results">
        <div className="dir-wrap">
          <p className="dir-count">
            Showing {n} {itemNoun}
            {n !== 1 ? "s" : ""}
            {activeLetter ? ` starting with ${activeLetter}` : ""}
            {activeGroup ? ` in ${activeGroup}` : ""}
          </p>
          <div className="dir-grid">
            {filtered.map((item) => (
              <DirectoryCard key={item.key} item={item} />
            ))}
            {n === 0 && <p className="dir-empty">No {itemNoun}s match your filters.</p>}
          </div>
        </div>
      </section>
    </>
  );
}
