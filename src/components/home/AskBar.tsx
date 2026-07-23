// src/components/home/AskBar.tsx
'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconSpark, IconSearch, IconPin, IconRoad, IconBuilding } from './icons';
import { resolveHeroHref } from '@/lib/heroSearchClient';
import type { HeroIndexEntry } from '@/lib/heroIndex';

interface Props {
  examples: string[];
}

const GROUP_ORDER = ['neighbourhood', 'street', 'condo'] as const;
const GROUP_LABEL: Record<string, string> = {
  neighbourhood: 'NEIGHBOURHOODS',
  street: 'STREETS',
  condo: 'CONDO BUILDINGS',
};
const hrefFor = (e: HeroIndexEntry) =>
  `/${e.type === 'neighbourhood' ? 'neighbourhoods' : e.type === 'street' ? 'streets' : 'condos'}/${e.slug}`;

function EntityIcon({ type }: { type: HeroIndexEntry['type'] }) {
  if (type === 'neighbourhood') return <IconPin />;
  if (type === 'street') return <IconRoad />;
  return <IconBuilding />;
}

// Bold the matched substring in the display name.
function boldMatch(name: string, q: string) {
  const i = name.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0 || !q) return name;
  return (
    <>
      {name.slice(0, i)}
      <b>{name.slice(i, i + q.length)}</b>
      {name.slice(i + q.length)}
    </>
  );
}

// Match the query against the index. Group order (neighbourhood → street → condo)
// enforces the resolver's collision rule (a bare neighbourhood name ranks above a
// same-named street). Up to 8 results total.
function computeResults(index: HeroIndexEntry[], raw: string): HeroIndexEntry[] {
  const ql = raw.trim().toLowerCase();
  if (ql.length < 2) return [];
  const scored: { e: HeroIndexEntry; s: number }[] = [];
  for (const e of index) {
    const nl = e.name.toLowerCase();
    let s = 0;
    if (nl === ql) s = 4;
    else if (nl.startsWith(ql)) s = 3;
    else if (nl.split(/[^a-z0-9]+/).some((t) => t.startsWith(ql))) s = 2;
    else if (nl.includes(ql)) s = 1;
    if (s) scored.push({ e, s });
  }
  scored.sort((a, b) => b.s - a.s || a.e.name.length - b.e.name.length || a.e.name.localeCompare(b.e.name));
  const byGroup: Record<string, HeroIndexEntry[]> = { neighbourhood: [], street: [], condo: [] };
  for (const { e } of scored) byGroup[e.type].push(e);
  const out: HeroIndexEntry[] = [];
  for (const g of GROUP_ORDER) for (const e of byGroup[g]) if (out.length < 8) out.push(e);
  return out;
}

export function AskBar({ examples }: Props) {
  const router = useRouter();
  const RESTING_PLACEHOLDER = 'Type any Milton street, condo, or neighbourhood';
  const [placeholder, setPlaceholder] = useState(RESTING_PLACEHOLDER);
  const [value, setValue] = useState('');
  const [index, setIndex] = useState<HeroIndexEntry[] | null>(null);
  const [results, setResults] = useState<HeroIndexEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1); // highlighted option; -1 = none
  const stopped = useRef(false);
  const submitting = useRef(false);
  const fetched = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const hasText = value.trim().length > 0;
  const total = results.length + 1; // + fallback row (index === results.length)

  // Lazy-load the index once (first focus/keystroke).
  const loadIndex = () => {
    if (fetched.current) return;
    fetched.current = true;
    fetch('/api/hero-index')
      .then((r) => r.json())
      .then((d) => setIndex(Array.isArray(d.index) ? d.index : []))
      .catch(() => setIndex([]));
  };

  // Debounced (~150ms) result computation; dropdown opens at 2+ chars (never dead).
  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      setActive(-1);
      return;
    }
    const t = setTimeout(() => {
      setResults(index ? computeResults(index, q) : []);
      setOpen(true);
      setActive(-1);
    }, 150);
    return () => clearTimeout(t);
  }, [value, index]);

  // Outside-click closes.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Placeholder typewriter (unchanged).
  useEffect(() => {
    if (!examples || examples.length === 0) return;
    let idx = 0, char = 0, deleting = false;
    stopped.current = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (stopped.current) return;
      const full = examples[idx % examples.length];
      if (!deleting) {
        char += 1;
        setPlaceholder(full.slice(0, char));
        if (char >= full.length) { deleting = true; timer = setTimeout(tick, 1700); return; }
        timer = setTimeout(tick, 52);
      } else {
        char -= 1;
        setPlaceholder(full.slice(0, char));
        if (char <= 0) { deleting = false; idx += 1; timer = setTimeout(tick, 350); return; }
        timer = setTimeout(tick, 26);
      }
    };
    timer = setTimeout(tick, 500);
    return () => clearTimeout(timer);
  }, [examples]);

  const stopTypewriter = () => { stopped.current = true; setPlaceholder(RESTING_PLACEHOLDER); };

  const go = (href: string) => { setOpen(false); router.push(href); };
  const selectFallback = () => go(`/listings?q=${encodeURIComponent(value.trim())}`);

  // Bare submit (no highlight) routes through the server resolver — the single
  // source of truth, so submit can never diverge from the suggestions.
  const submitRaw = async () => {
    const q = value.trim();
    if (!q) { router.push('/listings'); return; }
    if (submitting.current) return;
    submitting.current = true;
    try { go(await resolveHeroHref(q)); } finally { submitting.current = false; }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open && value.trim().length >= 2) setOpen(true);
      setActive((a) => Math.min(a + 1, total - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && active >= 0 && active < results.length) go(hrefFor(results[active]));
      else if (open && active === results.length) selectFallback();
      else submitRaw();
    } else if (e.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  const activeId = active >= 0 ? `hero-opt-${active}` : undefined;

  return (
    <div className="m-askwrap" ref={wrapRef}>
      <form
        className="m-askbar"
        id="m-hero-askbar"
        role="search"
        onSubmit={(e) => { e.preventDefault(); submitRaw(); }}
      >
        <span className="m-lead">
          <IconSpark />
        </span>
        <input
          value={value}
          placeholder={placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls="hero-listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          autoComplete="off"
          onFocus={() => { stopTypewriter(); loadIndex(); }}
          onKeyDown={onKeyDown}
          onChange={(e) => { stopped.current = true; loadIndex(); setValue(e.target.value); }}
          aria-label="Search a Milton street, condo, or neighbourhood"
        />
        <button type="submit" className={`m-go${hasText ? ' m-go-live' : ''}`} aria-label="Search">
          →
        </button>
      </form>

      {open && (
        <ul className="m-acdrop" id="hero-listbox" role="listbox" aria-label="Suggestions">
          {results.map((e, i) => {
            const header = i === 0 || results[i - 1].type !== e.type;
            return (
              <Fragment key={e.type + e.slug}>
                {header && (
                  <li className="m-acgroup" role="presentation">
                    {GROUP_LABEL[e.type]}
                  </li>
                )}
                <li
                  id={`hero-opt-${i}`}
                  role="option"
                  aria-selected={active === i}
                  className={`m-acrow${active === i ? ' m-acactive' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(ev) => { ev.preventDefault(); go(hrefFor(e)); }}
                >
                  <span className="m-acicon"><EntityIcon type={e.type} /></span>
                  <span className="m-actext">
                    <span className="m-acname">{boldMatch(e.name, value.trim())}</span>
                    <span className="m-acsec">{e.secondary}</span>
                  </span>
                </li>
              </Fragment>
            );
          })}
          <li
            id={`hero-opt-${results.length}`}
            role="option"
            aria-selected={active === results.length}
            className={`m-acrow m-acfallback${active === results.length ? ' m-acactive' : ''}`}
            onMouseEnter={() => setActive(results.length)}
            onMouseDown={(ev) => { ev.preventDefault(); selectFallback(); }}
          >
            <span className="m-acicon"><IconSearch /></span>
            <span className="m-actext">
              <span className="m-acname">Search listings for &ldquo;{value.trim()}&rdquo;</span>
            </span>
          </li>
        </ul>
      )}
    </div>
  );
}
