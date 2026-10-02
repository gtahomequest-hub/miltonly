// src/components/home-design/HeroDesign.tsx
// MH-012: three hero layouts on one set of words and links (links.ts).
//
//   A · Road       the two sides face each other across a drawn street, MH-011's road turned
//                  upright; the search crosses the top. On a phone the sides become two lanes,
//                  Buying and Selling, one tap apart.
//   B · Sentences  "I'm buying" and "I'm selling", each finished by its rows, on two grounds:
//                  forest for the buyer, cream for the seller. On a phone they stack, and two
//                  chips under the heading jump to either side.
//   C · Doors      one card per side, each opening on its single next step; on a phone the two
//                  doors stay side by side, so both next steps are on the first screen with no
//                  tap, and each side's other rows follow below.
//
// #00ff80 is painted on the two lead-capture buttons only: Book a showing, Get my home's value.
// Every link carries data-hero-side and data-hero-intent; a planned row is drawn but is not a link.
'use client';

import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { HeroSearch } from './HeroSearch';
import { hdVars } from './tokens';
import {
  heroAttrs,
  primaryOf,
  rentLine,
  rowsOf,
  SEARCH_INPUT_ID,
  type HeroCounts,
  type HeroLink,
} from './links';

export type HeroOption = 'a' | 'b' | 'c';

const SIDE_NAME: Record<'buy' | 'sell', string> = { buy: 'Buying', sell: 'Selling' };

function focusSearch(e: React.MouseEvent) {
  e.preventDefault();
  const input = document.getElementById(SEARCH_INPUT_ID) as HTMLInputElement | null;
  if (!input) return;
  input.scrollIntoView({ block: 'center', behavior: 'smooth' });
  input.focus({ preventScroll: true });
}

function sideNote(side: 'buy' | 'sell', c: HeroCounts) {
  return side === 'buy'
    ? `${c.onMarket.toLocaleString('en-CA')} homes for sale in Milton today`
    : 'Valued by hand, from comparable sales';
}

function H1() {
  return (
    <h1 className="hd-h1">
      <span className="hd-h1-lead">Buying or selling a home in Milton?</span>{' '}
      <span className="hd-h1-tail">Start on your side of the street.</span>
    </h1>
  );
}

function Cta({ l }: { l: HeroLink }) {
  if (l.target.kind !== 'page') return null;
  return (
    <a className="hd-btn hd-btn-cta" href={l.target.href} {...heroAttrs(l)}>
      {l.label}
    </a>
  );
}

function Planned() {
  return <span className="hd-tag">Planned</span>;
}

/** A row for options A and C: label, detail, and either a link or a marked planned row. */
function Row({ l, c }: { l: HeroLink; c: HeroCounts }) {
  const inner = (
    <>
      <span className="hd-row-text">
        <span className="hd-row-label">
          {l.label}
          {l.badge && <span className="hd-badge">{l.badge(c)}</span>}
        </span>
        <span className="hd-row-detail">{l.detail(c)}</span>
      </span>
      {l.target.kind === 'planned' ? <Planned /> : <span className="hd-row-go" aria-hidden="true">→</span>}
    </>
  );
  if (l.target.kind === 'planned') {
    return (
      <div className="hd-row is-planned" {...heroAttrs(l)}>
        {inner}
      </div>
    );
  }
  return (
    <a
      className="hd-row"
      href={l.target.href}
      {...heroAttrs(l)}
      onClick={l.target.kind === 'focus' ? focusSearch : undefined}
    >
      {inner}
    </a>
  );
}

function RentLine({ c }: { c: HeroCounts }) {
  const l = rentLine;
  if (l.target.kind !== 'page') return null;
  return (
    <p className="hd-rent">
      <span className="hd-rent-q">{l.label}</span>{' '}
      <a href={l.target.href} {...heroAttrs(l)}>
        {l.detail(c)} <span aria-hidden="true">→</span>
      </a>
    </p>
  );
}

// ── A · Road ─────────────────────────────────────────────────────────────────────────────────

function RoadSide({ side, c, active }: { side: 'buy' | 'sell'; c: HeroCounts; active: boolean }) {
  const p = primaryOf(side);
  return (
    <div
      className={`hd-side hd-side-${side}${active ? ' is-active' : ''}`}
      id={`hd-panel-${side}`}
      role="tabpanel"
      aria-labelledby={`hd-tab-${side}`}
    >
      <h2 className="hd-side-h">{SIDE_NAME[side]}</h2>
      <p className="hd-side-note">{sideNote(side, c)}</p>
      <Cta l={p} />
      <p className="hd-cta-detail">{p.detail(c)}</p>
      <ul className="hd-rows">
        {rowsOf(side).map((l) => (
          <li key={l.intent}>
            <Row l={l} c={c} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function OptionRoad({ c }: { c: HeroCounts }) {
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({});
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = tab === 'buy' ? 'sell' : 'buy';
    setTab(next);
    tabs.current[next]?.focus();
  };
  return (
    <>
      <div className="hd-top">
        <div className="hd-wrap">
          <H1 />
          <HeroSearch label="Find any Milton street or address" tone="dark" />
        </div>
      </div>
      <div className="hd-street">
        <div className="hd-wrap">
          <div className="hd-tabs" role="tablist" aria-label="Your side" onKeyDown={onKey}>
            {(['buy', 'sell'] as const).map((s) => (
              <button
                key={s}
                ref={(el) => {
                  tabs.current[s] = el;
                }}
                type="button"
                role="tab"
                id={`hd-tab-${s}`}
                aria-selected={tab === s}
                aria-controls={`hd-panel-${s}`}
                tabIndex={tab === s ? 0 : -1}
                className={`hd-tab hd-tab-${s}`}
                data-hero-side={s}
                data-hero-intent="side-tab"
                onClick={() => setTab(s)}
              >
                {SIDE_NAME[s]}
              </button>
            ))}
          </div>
          <div className="hd-a-grid">
            <RoadSide side="buy" c={c} active={tab === 'buy'} />
            <div className="hd-road" aria-hidden="true" />
            <RoadSide side="sell" c={c} active={tab === 'sell'} />
          </div>
          <RentLine c={c} />
        </div>
      </div>
    </>
  );
}

// ── B · Sentences ────────────────────────────────────────────────────────────────────────────

function SayRow({ l }: { l: HeroLink }) {
  const end = <span className="hd-say-end">…{l.sentence}.</span>;
  if (l.target.kind === 'planned') {
    return (
      <div className="hd-say-row is-planned" {...heroAttrs(l)}>
        {end}
        <span className="hd-say-go">
          {l.action} <Planned />
        </span>
      </div>
    );
  }
  return (
    <a
      className="hd-say-row"
      href={l.target.href}
      {...heroAttrs(l)}
      onClick={l.target.kind === 'focus' ? focusSearch : undefined}
    >
      {end}
      <span className="hd-say-go">
        {l.action} <span aria-hidden="true">→</span>
      </span>
    </a>
  );
}

function Half({ side, c }: { side: 'buy' | 'sell'; c: HeroCounts }) {
  const p = primaryOf(side);
  return (
    <div className={`hd-half hd-half-${side}`} id={`hd-b-${side}`}>
      <div className="hd-half-in">
        <h2 className="hd-say">{side === 'buy' ? 'I’m buying' : 'I’m selling'}</h2>
        <ul className="hd-says">
          <li className="hd-say-primary">
            <span className="hd-say-end">…{p.sentence}.</span>
            <Cta l={p} />
            <span className="hd-cta-detail">{p.detail(c)}</span>
          </li>
          {rowsOf(side).map((l) => (
            <li key={l.intent}>
              <SayRow l={l} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function OptionSentences({ c }: { c: HeroCounts }) {
  return (
    <>
      <div className="hd-top hd-b-top">
        <div className="hd-wrap">
          <H1 />
          <nav className="hd-jump" aria-label="Jump to your side">
            {(['buy', 'sell'] as const).map((s) => (
              <a key={s} href={`#hd-b-${s}`} className={`hd-jump-${s}`} data-hero-side={s} data-hero-intent="jump-to-side">
                {s === 'buy' ? 'I’m buying' : 'I’m selling'} <span aria-hidden="true">↓</span>
              </a>
            ))}
          </nav>
          <HeroSearch label="Or start with a street or an address" tone="dark" />
        </div>
      </div>
      <div className="hd-split">
        <Half side="buy" c={c} />
        <Half side="sell" c={c} />
      </div>
      <div className="hd-wrap hd-b-rent">
        <RentLine c={c} />
      </div>
    </>
  );
}

// ── C · Doors ────────────────────────────────────────────────────────────────────────────────

function DoorHead({ side, c }: { side: 'buy' | 'sell'; c: HeroCounts }) {
  const p = primaryOf(side);
  return (
    <div className={`hd-door-head hd-door-${side}`}>
      <h2 className="hd-door-h">{SIDE_NAME[side]}</h2>
      <p className="hd-door-note">{sideNote(side, c)}</p>
      <p className="hd-door-step">Your next step</p>
      <Cta l={p} />
      <p className="hd-cta-detail">{p.detail(c)}</p>
    </div>
  );
}

function DoorRows({ side, c }: { side: 'buy' | 'sell'; c: HeroCounts }) {
  return (
    <div className={`hd-door-rows hd-door-rows-${side}`}>
      <h3 className="hd-door-rows-h">{side === 'buy' ? 'More if you’re buying' : 'More if you’re selling'}</h3>
      <ul className="hd-rows">
        {rowsOf(side).map((l) => (
          <li key={l.intent}>
            <Row l={l} c={c} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function OptionDoors({ c }: { c: HeroCounts }) {
  return (
    <>
      <div className="hd-top hd-c-band">
        <div className="hd-wrap">
          <H1 />
          <HeroSearch label="Find any Milton street or address" tone="dark" />
        </div>
      </div>
      <div className="hd-wrap hd-doors">
        <span className="hd-door-bg hd-door-bg-buy" aria-hidden="true" />
        <span className="hd-door-bg hd-door-bg-sell" aria-hidden="true" />
        <DoorHead side="buy" c={c} />
        <DoorHead side="sell" c={c} />
        <DoorRows side="buy" c={c} />
        <DoorRows side="sell" c={c} />
      </div>
      <div className="hd-wrap hd-c-rent">
        <RentLine c={c} />
      </div>
    </>
  );
}

export function HeroDesign({ option, counts }: { option: HeroOption; counts: HeroCounts }) {
  return (
    <section
      className={`hd hd-${option}`}
      data-hero-option={option}
      aria-label="Buying or selling in Milton"
      style={hdVars() as CSSProperties}
    >
      {option === 'a' && <OptionRoad c={counts} />}
      {option === 'b' && <OptionSentences c={counts} />}
      {option === 'c' && <OptionDoors c={counts} />}
    </section>
  );
}

export default HeroDesign;
