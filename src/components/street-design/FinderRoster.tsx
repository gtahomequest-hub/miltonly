"use client";
// src/components/street-design/FinderRoster.tsx
// MH-011: the finder and the roster share one piece of state, the number the reader typed, so
// they are one client island. The finder answers against the Town's address list (here, the
// fictional 42); the roster lays every address out on its side of the street, with the road
// between the two columns, and marks the row the finder found.

import { useRef, useState } from "react";
import type { Home } from "./data";
import { money, monthLabel } from "./data";

type Props = {
  street: string;
  homes: Home[];
  windowStart: string;
  registered: boolean;
  initial?: string;
};

export default function FinderRoster({ street, homes, windowStart, registered, initial = "" }: Props) {
  const [value, setValue] = useState(initial);
  const rowRefs = useRef<Record<number, HTMLLIElement | null>>({});

  const trimmed = value.trim();
  const n = /^\d{1,5}$/.test(trimmed) ? Number(trimmed) : NaN;
  const match = homes.find((h) => h.number === n) ?? null;
  const state: "empty" | "match" | "none" = trimmed === "" ? "empty" : match ? "match" : "none";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (match) rowRefs.current[match.number]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const evens = homes.filter((h) => h.number % 2 === 0);
  const odds = homes.filter((h) => h.number % 2 === 1);
  const signin = `/signin?redirect=${encodeURIComponent("/design-preview/street")}`;

  function row(h: Home) {
    const found = match?.number === h.number;
    const address = `${h.number} ${street}`;
    return (
      <li
        key={h.number}
        ref={(el) => {
          rowRefs.current[h.number] = el;
        }}
        className={`sd-row${found ? " is-found" : ""}`}
        aria-current={found ? "true" : undefined}
        data-number={h.number}
      >
        <span className="sd-row-head">
          <span className="sd-row-num">{h.number}</span>
          <span className="sd-row-type">{h.type}</span>
          {h.forSale ? <span className="sd-tag">For sale</span> : null}
        </span>
        <span className="sd-row-body">
          {registered ? (
            h.sale ? (
              <span className="sd-row-sale">
                Sold {monthLabel(h.sale.month)} · <strong>{money(h.sale.price)}</strong>
              </span>
            ) : (
              <span className="sd-row-quiet">No sale recorded since {windowStart}</span>
            )
          ) : (
            <a className="sd-row-gate" href={signin} rel="nofollow" aria-label={`History of ${address}, sign in`}>
              History · sign in
            </a>
          )}
          {registered && found ? (
            <a className="sd-row-own" href="#actions">
              Is this your home? Get its report
            </a>
          ) : null}
        </span>
      </li>
    );
  }

  return (
    <>
      <section className="sd-finder" aria-labelledby="sd-finder-h">
        <h2 id="sd-finder-h" className="sd-finder-h">
          Find your address on {street}
        </h2>
        <form className="sd-finder-form" onSubmit={onSubmit} role="search">
          <label htmlFor="sd-finder-input" className="sd-finder-label">
            House number
          </label>
          <div className="sd-finder-field">
            <input
              id="sd-finder-input"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 12"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <span className="sd-finder-suffix" aria-hidden="true">
              {street}
            </span>
            <button type="submit" className="sd-btn sd-btn-quiet">
              Find
            </button>
          </div>
        </form>
        <div className="sd-finder-result" aria-live="polite">
          {state === "match" && match ? (
            <div className="sd-finder-actions">
              <a className="sd-btn sd-btn-cta" href="#actions">
                Get the home report for {match.number} {street}
              </a>
              <a className="sd-btn sd-btn-line" href="#actions">
                Ask about this address
              </a>
            </div>
          ) : null}
          {state === "none" ? (
            <p className="sd-finder-none">No such address on {street} in the Town&rsquo;s records.</p>
          ) : null}
          {state === "empty" ? (
            <p className="sd-finder-hint">{homes.length} addresses, numbered 1 to {homes.length}, from the Town of Milton&rsquo;s address list.</p>
          ) : null}
        </div>
      </section>

      <section className="sd-section sd-roster" id="roster" aria-labelledby="sd-roster-h">
        <header className="sd-sec-head">
          <p className="sd-eyebrow">Every address</p>
          <h2 id="sd-roster-h">The {homes.length} homes on {street}</h2>
          <p className="sd-sec-sub">
            {registered
              ? `Each row shows its last sale since ${windowStart}, or that none was recorded.`
              : "Each row opens its sold history for registered readers. Registering is free."}
          </p>
        </header>
        <div className="sd-road-wrap">
          <div className="sd-side">
            <h3 className="sd-side-h">Even side</h3>
            <ol className="sd-rows">{evens.map(row)}</ol>
          </div>
          <div className="sd-road" aria-hidden="true">
            <span className="sd-road-name">{street}</span>
          </div>
          <div className="sd-side">
            <h3 className="sd-side-h">Odd side</h3>
            <ol className="sd-rows">{odds.map(row)}</ol>
          </div>
        </div>
      </section>
    </>
  );
}
