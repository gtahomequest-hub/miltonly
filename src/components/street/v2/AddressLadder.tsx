// src/components/street/v2/AddressLadder.tsx
// QUEUE item 3 — the address ladder.
//
// NOT A TABLE AND NOT A LISTING LIST. Every portal answers a house-number query with a card that
// disappears the day the listing does. This answers it with the street's own permanent structure:
// a spine standing for the roadway, odd numbers down one side and even down the other, each civic
// address a mark placed where it actually sits between the low-number end and the high, and the
// cross streets drawn across it in the order you would meet them. It is true whether or not
// anything is for sale, which is the point.
//
// SERVER-RENDERED, NO CLIENT JS. Every address is an <a href="#<number>"> onto its own id, so a
// deep link, a tap and a keyboard focus all resolve through :target / :focus-within / :hover in
// CSS. That keeps the anchor working with scripting off, which is the state Googlebot indexes in.
//
// ONE ELEMENT PER ADDRESS. The detail line lives in a single `data-d` attribute and is drawn by
// CSS `content: attr(data-d)` on interaction, so an address costs one tag instead of six. That is
// not micro-optimisation: the App Router inlines the RSC flight payload, so every element and
// every prop is paid for TWICE in the served HTML, and the longest street in Milton carries 387
// of them. The static words around the value ("nearest cross street") were dropped from the
// attribute and moved into the legend, where they are written once instead of 387 times.
//
// A mark carrying a live listing is the exception and renders a real detail element, because a
// link cannot live inside CSS generated content. It omits `data-d`, and the CSS draws the
// generated popup only for marks that have one.
//
// WHAT IT MAY NOT SHOW is enforced upstream in src/lib/streetAddresses.ts: no sold price, no sold
// date, no owner, no historical listing, no per-address coordinate. Signal green (--s-green) is
// reserved here for the "listed now" mark and appears nowhere else in the section.
import type { StreetV2Data } from './types';
import type { AddressMark, AddressCrossTick } from '@/lib/streetAddresses';
import { STREET_ADDRESS_SOURCE_PULLED } from '@/lib/town/addresses';

/** vertical room a number label needs before it touches its neighbour */
const LABEL_GAP = 22;
/** vertical room a bare dot needs — a dense arterial degrades to dots, not to collisions */
const DOT_GAP = 7;

interface PlacedMark {
  mark: AddressMark;
  y: number;
  labelled: boolean;
}

/**
 * Place the marks. Ideal position is the true fraction; where two addresses would land on top of
 * each other the later one is pushed down by the minimum it needs, so the drawn ORDER is always
 * the true order and the drawn SPACING is the true spacing wherever there is room for it.
 */
function placeSide(marks: AddressMark[], h0: number): PlacedMark[] {
  const out: PlacedMark[] = [];
  let lastLabelY = -Infinity;
  let prevY = -Infinity;
  let prevLabelled = false;
  for (const mark of marks) {
    const ideal = mark.fraction * h0;
    const labelled = ideal - lastLabelY >= LABEL_GAP;
    if (labelled) lastLabelY = ideal;
    const gap = labelled || prevLabelled ? LABEL_GAP : DOT_GAP;
    const y = prevY === -Infinity ? ideal : Math.max(ideal, prevY + gap);
    out.push({ mark, y, labelled });
    prevY = y;
    prevLabelled = labelled;
  }
  return out;
}

/** Map a cross street's fraction onto the same curve the marks were pushed along. */
function tickPlacer(placed: PlacedMark[], h0: number, height: number) {
  const sorted = [...placed].sort((a, b) => a.mark.fraction - b.mark.fraction);
  let running = 0;
  const curve = sorted.map((p) => {
    running = Math.max(running, p.y);
    return { f: p.mark.fraction, y: running };
  });
  return (f: number): number => {
    if (curve.length === 0) return f * h0;
    if (f <= curve[0].f) return curve[0].y;
    for (let i = 1; i < curve.length; i++) {
      if (f <= curve[i].f) {
        const span = curve[i].f - curve[i - 1].f;
        const t = span <= 0 ? 0 : (f - curve[i - 1].f) / span;
        return curve[i - 1].y + t * (curve[i].y - curve[i - 1].y);
      }
    }
    return Math.min(height, curve[curve.length - 1].y);
  };
}

/** The one detail line, written once per address into `data-d` (or into the element a live
 *  listing forces). Deliberately terse: the legend above the ladder names the fields, so the
 *  words that would otherwise repeat 387 times are written once in the legend instead. */
function detailOf(m: AddressMark): string {
  return [
    `${m.fraction.toFixed(2)} along`,
    `${m.side} side`,
    m.crossStreet ?? '',
    m.form ?? '',
  ]
    .filter(Boolean)
    .join(' · ');
}

export function StreetAddresses({ data }: { data: StreetV2Data }) {
  const ladder = data.addresses;
  if (!ladder || ladder.marks.length === 0) return null;

  const odd = ladder.marks.filter((m) => m.side === 'odd');
  const even = ladder.marks.filter((m) => m.side === 'even');
  const h0 = Math.max(320, Math.min(900, ladder.marks.length * 14));
  const placedOdd = placeSide(odd, h0);
  const placedEven = placeSide(even, h0);
  const placed = [...placedOdd, ...placedEven];
  const height = Math.round(Math.max(h0, ...placed.map((p) => p.y)) + 28);
  const tickY = tickPlacer(placed, h0, height);
  // Placement is per side; DOM ORDER IS BY HOUSE NUMBER, so the reading order, the screen-reader
  // order and the ItemList order are the same sequence. Position is absolute, so the two are
  // independent.
  const byNumber = new Map(placed.map((p) => [p.mark.number, p]));
  const inOrder = ladder.marks.map((m) => byNumber.get(m.number)!);

  return (
    <section className="s-block s-addr" id="addresses">
      <div className="s-wrap">
        <div className="s-sechead">
          <span className="s-eyebrow">Address ladder</span>
          <h2>Addresses on {data.name}</h2>
        </div>

        <p className="s-addr-sum">{ladder.summary}</p>

        <div className="s-addr-key">
          <span className="s-addr-k">
            <i className="s-addr-kd" /> odd numbers left, even right
          </span>
          <span className="s-addr-k">
            open a mark for position, side, nearest cross street and form
          </span>
          {ladder.crossStreets.length > 0 && (
            <span className="s-addr-k">
              <i className="s-addr-kt" /> cross street
            </span>
          )}
          {ladder.activeCount > 0 && (
            <span className="s-addr-k">
              <i className="s-addr-kd s-addr-live-dot" /> listed now
            </span>
          )}
        </div>

        <div className="s-addr-lad" style={{ height }}>
          <div className="s-addr-spine" aria-hidden="true" />
          <span className="s-addr-end s-addr-end-lo">{ladder.low}</span>
          <span className="s-addr-end s-addr-end-hi">{ladder.high}</span>

          {ladder.crossStreets.map((c: AddressCrossTick) => (
            <div className="s-addr-tick" key={c.slug} style={{ top: Math.round(tickY(c.fraction)) }}>
              <span className="s-addr-tick-l">
                {c.href ? <a href={c.href}>{c.name}</a> : c.name}
              </span>
            </div>
          ))}

          {inOrder.map(({ mark, y, labelled }) => {
            const cls = `s-m${mark.side === 'even' ? ' s-e' : ''}${labelled ? '' : ' s-q'}`;
            const top = Math.round(y);
            const detail = detailOf(mark);
            // A live listing needs a real link, which CSS generated content cannot hold. Only
            // these marks pay for a detail element; every other address is one tag.
            return mark.active ? (
              <span key={mark.number} id={String(mark.number)} className={`${cls} s-on`} style={{ top }}>
                <a href={`#${mark.number}`}>{mark.number}</a>
                <span className="s-d">
                  {detail}
                  <a className="s-lv" href={mark.active.href}>
                    Listed now
                  </a>
                </span>
              </span>
            ) : (
              <a
                key={mark.number}
                id={String(mark.number)}
                className={cls}
                data-d={detail}
                style={{ top }}
                href={`#${mark.number}`}
              >
                {mark.number}
              </a>
            );
          })}
        </div>

        <p className="s-addr-src">
          Civic addresses from the Town of Milton address layer, pulled {STREET_ADDRESS_SOURCE_PULLED},
          under the Open Government Licence. Positions are relative to the ends of the street, not
          survey coordinates. Building form is shown only where a listing for that address supplied
          one. No sale price and no sale date is shown for any single address.
        </p>
      </div>
    </section>
  );
}

export default StreetAddresses;
