'use client';

// THE LADDER'S TRACK, WITH A WAY IN (MH-005, MA-001 change 8).
//
// On a phone the ladder was a wall of dots: Main Street's ran 3,291 px with 365 marks failing
// the target-size audit, cross-street labels truncated to nothing, and no way to type a house
// number. Now, at every width, a house-number field sits above the track; typing 1350 scrolls
// the track to #1350 and highlights it, or names the nearest number when there is no 1350. On a
// phone the track becomes one column in number order, each address a 44px row with its detail
// beside it and the cross streets as named rows in sequence, inside a box no taller than the
// screen; a street with more addresses than fit is collapsed behind the field and a "Show all"
// button. Desktop keeps the spine.
//
// A CLIENT COMPONENT ON PURPOSE. The App Router inlines the RSC payload, so a server-rendered
// mark was paid for twice in the HTML: once as markup, once as a JSON element. Here the payload
// carries this component's props, a tuple per address, and the markup once; on the longest
// street that is the difference between 64 KB and 221 KB of address list.
//
// THE MARKUP CONTRACT IS UNCHANGED: one element per address, `id` the bare house number, the
// detail in one `data-d`, a live listing as a <span> with two real links. The prebuild guard
// (scripts/test-address-anchors.ts) reads these back out of the render. The live link names
// the listing brokerage after the status word (MC-036, PropTx item 7: a status word is a
// listing view), in the link's own style; a mark without a live listing pays nothing for it.
import { useRef, useState } from 'react';

/** [number, top, even, labelled, detail, active], active being [href, brokerage] or null */
export type MarkTuple = [number, number, 0 | 1, 0 | 1, string, [string, string | null] | null];
/** [name, href, top, fraction] */
export type TickTuple = [string, string | null, number, number];
/** A cross street placed between the marks it falls among, in number order. */
type Row = { kind: 'mark'; m: MarkTuple } | { kind: 'tick'; t: TickTuple };

/** Above this many addresses the phone collapses the track behind the field. */
export const COLLAPSE_ABOVE = 60;

export function LadderTrack({
  height,
  low,
  high,
  marks,
  ticks,
  fractions,
}: {
  height: number;
  low: number;
  high: number;
  marks: MarkTuple[];
  ticks: TickTuple[];
  /** each mark's true fraction, in the same order as `marks`, for interleaving the ticks */
  fractions: number[];
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [hit, setHit] = useState<number | null>(null);
  const [note, setNote] = useState<string>('');
  const collapsed = marks.length > COLLAPSE_ABOVE;

  // number order, with each cross street inserted before the first mark past its fraction
  const rows: Row[] = [];
  let ti = 0;
  const sortedTicks = [...ticks].sort((a, b) => a[3] - b[3]);
  marks.forEach((m, i) => {
    while (ti < sortedTicks.length && sortedTicks[ti][3] <= fractions[i]) rows.push({ kind: 'tick', t: sortedTicks[ti++] });
    rows.push({ kind: 'mark', m });
  });
  while (ti < sortedTicks.length) rows.push({ kind: 'tick', t: sortedTicks[ti++] });

  const find = (raw: string) => {
    const n = parseInt(raw.replace(/\D/g, ''), 10);
    if (!Number.isFinite(n)) {
      setHit(null);
      setNote('');
      return;
    }
    const numbers = marks.map((m) => m[0]);
    let target = numbers.includes(n) ? n : null;
    if (target === null) {
      let best = numbers[0];
      for (const x of numbers) if (Math.abs(x - n) < Math.abs(best - n)) best = x;
      target = best;
      setNote(`No ${n} on this street. The nearest is ${best}.`);
    } else {
      setNote('');
    }
    setOpen(true);
    setHit(target);
    // after the track has opened. On a phone the track is its own scroll box, so it is scrolled
    // directly (scrollIntoView would drag the page as well); on desktop the mark sits in a
    // fixed-height track and the page scrolls to it.
    window.setTimeout(() => {
      const track = trackRef.current;
      const el = track?.querySelector<HTMLElement>(`[id="${target}"]`);
      if (!track || !el) return;
      if (track.scrollHeight > track.clientHeight + 1) {
        track.scrollTop = Math.max(0, el.offsetTop - track.clientHeight / 2 + el.offsetHeight / 2);
      } else {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }, 60);
  };

  return (
    <>
      {/* the label wraps the field: the only ids inside this section are house numbers, which the
          anchor guard and the deep-link contract both depend on */}
      <div className="s-addr-find">
        <label className="s-addr-find-l">
          <span>Find a house number</span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder={`${low} to ${high}`}
            autoComplete="off"
            onChange={(e) => find(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                find((e.target as HTMLInputElement).value);
              }
            }}
          />
        </label>
        <div className="s-addr-find-row">
          {collapsed && (
            <button type="button" className="s-addr-showall" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
              {open ? 'Hide the list' : `Show all ${marks.length} addresses`}
            </button>
          )}
        </div>
        {note ? <div className="s-addr-find-note">{note}</div> : null}
      </div>

      <div
        ref={trackRef}
        className={`s-addr-lad${collapsed ? ' s-addr-collapsed' : ''}${open ? ' s-addr-open' : ''}`}
        style={{ ['--lad-h' as string]: `${height}px` }}
      >
        <div className="s-addr-spine" aria-hidden="true" />
        <span className="s-addr-end s-addr-end-lo">{low}</span>
        <span className="s-addr-end s-addr-end-hi">{high}</span>

        {rows.map((r) => {
          if (r.kind === 'tick') {
            const [name, href, top] = r.t;
            return (
              <div className="s-addr-tick" key={`t-${name}-${top}`} style={{ top }}>
                {/* the full name, on the tick; the title carries it where the desktop rule truncates */}
                <span className="s-addr-tick-l" title={name}>
                  {href ? <a href={href}>{name}</a> : name}
                </span>
              </div>
            );
          }
          const [number, top, even, labelled, detail, active] = r.m;
          const cls = `s-m${even ? ' s-e' : ''}${labelled ? '' : ' s-q'}${hit === number ? ' s-hit' : ''}`;
          // A live listing needs a real link, which CSS generated content cannot hold. Only
          // these marks pay for a detail element; every other address is one tag.
          return active ? (
            <span key={number} id={String(number)} className={`${cls} s-on`} style={{ top }}>
              <a href={`#${number}`}>{number}</a>
              <span className="s-d">
                {detail}
                <a className="s-lv" href={active[0]}>
                  {active[1] ? `Listed now by ${active[1]}` : 'Listed now'}
                </a>
              </span>
            </span>
          ) : (
            <a key={number} id={String(number)} className={cls} data-d={detail} style={{ top }} href={`#${number}`}>
              {number}
            </a>
          );
        })}
      </div>
    </>
  );
}

export default LadderTrack;
