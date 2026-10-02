// src/components/home-design/HeroDesign.tsx
// MH-012, MH-013: the homepage hero, two layouts on one set of words and links (links.ts).
//
//   C · Doors      MH-012's pick, recoloured and matured: a navy band carrying the H1 and the search,
//                  and two doors lifted over it, Selling first. On a phone the two doors stay side by
//                  side, so both buttons are on the first screen, and each side's rows follow.
//   D · Four paths Selling and Buying are the two large doors, Selling a navy door and Buying a paper
//                  one; Investing is a smaller third door, planned; Renting is a quiet line. On a
//                  phone the two doors stack, Selling first, and the search follows them.
//
// The lead colour (`--b-lead`) is painted on the two lead-capture buttons only: Get my home's value
// and Book a showing. Every link carries data-hero-side and data-hero-intent; a planned row or door
// is drawn but is not a link. Options A and B (MH-012) stay viewable on MH-012's preview at c7fd3ee.
'use client';

import { HeroSearch } from './HeroSearch';
import {
  heroAttrs,
  investDoor,
  primaryOf,
  rentLine,
  rowsOf,
  SEARCH_INPUT_ID,
  type HeroCounts,
  type HeroLink,
} from './links';

export type HeroOption = 'c' | 'd';

type Side = 'sell' | 'buy';
const SIDE_NAME: Record<Side, string> = { sell: 'Selling', buy: 'Buying' };
const SIDE_NUM: Record<Side, string> = { sell: '01', buy: '02' };

function focusSearch(e: React.MouseEvent) {
  e.preventDefault();
  const input = document.getElementById(SEARCH_INPUT_ID) as HTMLInputElement | null;
  if (!input) return;
  input.scrollIntoView({ block: 'center', behavior: 'smooth' });
  input.focus({ preventScroll: true });
}

function sideNote(side: Side, c: HeroCounts) {
  return side === 'sell'
    ? 'Valued by hand, from comparable sales.'
    : `${c.onMarket.toLocaleString('en-CA')} homes for sale in Milton today.`;
}

function Cta({ l }: { l: HeroLink }) {
  if (l.target.kind !== 'page') return null;
  return (
    <a className="hd-btn hd-btn-lead" href={l.target.href} {...heroAttrs(l)}>
      {l.label}
    </a>
  );
}

function Planned() {
  return <span className="hd-tag">Planned</span>;
}

/** A row: label, detail, and either a link or a marked planned row that is not a link. */
function Row({ l, c }: { l: HeroLink; c: HeroCounts }) {
  const inner = (
    <>
      <span className="hd-row-text">
        <span className="hd-row-label">{l.label}</span>
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
    <a className="hd-row" href={l.target.href} {...heroAttrs(l)} onClick={l.target.kind === 'focus' ? focusSearch : undefined}>
      {inner}
    </a>
  );
}

function RentLine({ c }: { c: HeroCounts }) {
  const l = rentLine;
  if (l.target.kind !== 'page') return null;
  return (
    <p className="hd-rent">
      <span>{l.label}</span>
      <a href={l.target.href} {...heroAttrs(l)}>
        {l.detail(c)} <span aria-hidden="true">→</span>
      </a>
    </p>
  );
}

function DoorHead({ side, c, navy = false }: { side: Side; c: HeroCounts; navy?: boolean }) {
  const p = primaryOf(side);
  return (
    <div className={`hd-door-head hd-door-${side}${navy ? ' hd-on-navy' : ''}`}>
      <p className="hd-door-num">{SIDE_NUM[side]}</p>
      <h2 className="hd-door-h">{SIDE_NAME[side]}</h2>
      <p className="hd-door-note">{sideNote(side, c)}</p>
      <Cta l={p} />
      <p className="hd-cta-detail">{p.detail(c)}</p>
    </div>
  );
}

/** Option C keeps the investor as the buyer's planned row, as MH-012 drew it. */
const investorRow: HeroLink = {
  ...investDoor,
  role: 'row',
  label: 'Buying to rent it out',
  detail: () => 'Asking rents beside asking prices, by home type',
};

function DoorRows({ side, c, extra = [], navy = false }: { side: Side; c: HeroCounts; extra?: HeroLink[]; navy?: boolean }) {
  return (
    <div className={`hd-door-rows hd-door-rows-${side}${navy ? ' hd-on-navy' : ''}`}>
      <h3 className="hd-door-rows-h">{side === 'sell' ? 'More if you’re selling' : 'More if you’re buying'}</h3>
      <ul className="hd-rows">
        {[...rowsOf(side), ...extra].map((l) => (
          <li key={l.intent}>
            <Row l={l} c={c} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function InvestDoor({ c }: { c: HeroCounts }) {
  return (
    <div className="hd-invest" {...heroAttrs(investDoor)}>
      <p className="hd-door-num">03</p>
      <h2 className="hd-invest-h">{investDoor.label}</h2>
      <p className="hd-invest-p">{investDoor.detail(c)}</p>
      <Planned />
    </div>
  );
}

const H1_TEXT = 'Selling or buying a home in Milton?';
const TAIL_TEXT = 'Start on your side of the street.';

function OptionC({ c }: { c: HeroCounts }) {
  return (
    <>
      <div className="hd-band">
        <div className="hd-wrap hd-band-in">
          <div className="hd-band-title">
            <h1 className="hd-h1">{H1_TEXT}</h1>
            <p className="hd-tail">{TAIL_TEXT}</p>
          </div>
          <HeroSearch label="Find any Milton street or address" tone="dark" />
        </div>
      </div>
      <div className="hd-wrap hd-doors">
        <span className="hd-door-bg hd-door-bg-sell" aria-hidden="true" />
        <span className="hd-door-bg hd-door-bg-buy" aria-hidden="true" />
        <DoorHead side="sell" c={c} />
        <DoorHead side="buy" c={c} />
        <DoorRows side="sell" c={c} />
        <DoorRows side="buy" c={c} extra={[investorRow]} />
      </div>
      <div className="hd-wrap hd-c-rent">
        <RentLine c={c} />
      </div>
    </>
  );
}

function OptionD({ c }: { c: HeroCounts }) {
  return (
    <div className="hd-wrap">
      <div className="hd-d-grid">
        <h1 className="hd-h1 hd-d-title">{H1_TEXT}</h1>
        <p className="hd-tail hd-d-tail">{TAIL_TEXT}</p>
        <span className="hd-door-bg hd-d-bg-sell" aria-hidden="true" />
        <span className="hd-door-bg hd-d-bg-buy" aria-hidden="true" />
        <DoorHead side="sell" c={c} navy />
        <DoorHead side="buy" c={c} />
        <div className="hd-d-search">
          <HeroSearch label="Find any Milton street or address" tone="light" />
        </div>
        <DoorRows side="sell" c={c} navy />
        <DoorRows side="buy" c={c} />
        <InvestDoor c={c} />
        <div className="hd-d-rent">
          <RentLine c={c} />
        </div>
      </div>
    </div>
  );
}

export function HeroDesign({ option, counts }: { option: HeroOption; counts: HeroCounts }) {
  return (
    <section className={`hd hd-${option}`} data-hero-option={option} aria-label="Selling or buying in Milton">
      {option === 'c' ? <OptionC c={counts} /> : <OptionD c={counts} />}
    </section>
  );
}

export default HeroDesign;
