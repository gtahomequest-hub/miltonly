// src/components/home-design/HeroSearch.tsx
// MH-012: the hero's street and address search. It is AskBar's behaviour on new markup: the same
// lazy /api/hero-index for suggestions, the same grouping (a neighbourhood ranks above a street of
// the same name), and the same /api/hero-search resolver on a bare submit, which sends a civic
// address to its street page at that number. Only the words and the look are new. AskBar itself
// is untouched; the live homepage keeps it.
//
// The form keeps AskBar's id, m-hero-askbar, because SiteNav's home variant reveals its bar search
// once that element has scrolled under the bar.
'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconSearch, IconPin, IconRoad, IconBuilding } from '@/components/home/icons';
import { resolveHeroHref } from '@/lib/heroSearchClient';
import type { HeroIndexEntry } from '@/lib/heroIndex';
import { SEARCH_INPUT_ID } from './links';

const GROUP_ORDER = ['neighbourhood', 'street', 'condo'] as const;
const GROUP_LABEL: Record<string, string> = {
  neighbourhood: 'Neighbourhoods',
  street: 'Streets',
  condo: 'Condo buildings',
};
const hrefFor = (e: HeroIndexEntry) =>
  `/${e.type === 'neighbourhood' ? 'neighbourhoods' : e.type === 'street' ? 'streets' : 'condos'}/${e.slug}`;

function EntityIcon({ type }: { type: HeroIndexEntry['type'] }) {
  if (type === 'neighbourhood') return <IconPin />;
  if (type === 'street') return <IconRoad />;
  return <IconBuilding />;
}

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

// AskBar's scoring, verbatim: exact, prefix, word prefix, substring; group order enforced.
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

export function HeroSearch({ label, tone }: { label: string; tone: 'dark' | 'light' }) {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [index, setIndex] = useState<HeroIndexEntry[] | null>(null);
  const [results, setResults] = useState<HeroIndexEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const submitting = useRef(false);
  const fetched = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const total = results.length + 1;

  const loadIndex = () => {
    if (fetched.current) return;
    fetched.current = true;
    fetch('/api/hero-index')
      .then((r) => r.json())
      .then((d) => setIndex(Array.isArray(d.index) ? d.index : []))
      .catch(() => setIndex([]));
  };

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

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  const selectFallback = () => go(`/listings?q=${encodeURIComponent(value.trim())}`);
  const submitRaw = async () => {
    const q = value.trim();
    if (!q) {
      document.getElementById(SEARCH_INPUT_ID)?.focus();
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    try {
      go(await resolveHeroHref(q));
    } finally {
      submitting.current = false;
    }
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

  const activeId = active >= 0 ? `hd-opt-${active}` : undefined;

  return (
    <div className={`hd-search hd-search-${tone}`} ref={wrapRef}>
      <label className="hd-search-label" htmlFor={SEARCH_INPUT_ID}>
        {label}
      </label>
      <div className="hd-search-box">
        <form
          id="m-hero-askbar"
          className="hd-search-field"
          role="search"
          data-hero-side="both"
          data-hero-intent="address-search"
          onSubmit={(e) => {
            e.preventDefault();
            submitRaw();
          }}
        >
          <span className="hd-search-ic" aria-hidden="true">
            <IconSearch />
          </span>
          <input
            id={SEARCH_INPUT_ID}
            type="text"
            inputMode="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="Street or address"
            value={value}
            role="combobox"
            aria-expanded={open}
            aria-controls="hd-listbox"
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            onFocus={loadIndex}
            onChange={(e) => {
              loadIndex();
              setValue(e.target.value);
            }}
            onKeyDown={onKeyDown}
          />
          <button type="submit" className="hd-search-go" data-hero-side="both" data-hero-intent="address-search">
            Go
          </button>
        </form>
        {open && (
          <ul className="hd-drop" id="hd-listbox" role="listbox" aria-label="Suggestions">
            {results.map((e, i) => {
              const header = i === 0 || results[i - 1].type !== e.type;
              return (
                <Fragment key={e.type + e.slug}>
                  {header && (
                    <li className="hd-drop-group" role="presentation">
                      {GROUP_LABEL[e.type]}
                    </li>
                  )}
                  <li
                    id={`hd-opt-${i}`}
                    role="option"
                    aria-selected={active === i}
                    className={`hd-drop-row${active === i ? ' is-active' : ''}`}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(ev) => {
                      ev.preventDefault();
                      go(hrefFor(e));
                    }}
                  >
                    <span className="hd-drop-ic" aria-hidden="true">
                      <EntityIcon type={e.type} />
                    </span>
                    <span className="hd-drop-name">{boldMatch(e.name, value.trim())}</span>
                  </li>
                </Fragment>
              );
            })}
            <li
              id={`hd-opt-${results.length}`}
              role="option"
              aria-selected={active === results.length}
              className={`hd-drop-row hd-drop-fallback${active === results.length ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(results.length)}
              onMouseDown={(ev) => {
                ev.preventDefault();
                selectFallback();
              }}
            >
              <span className="hd-drop-ic" aria-hidden="true">
                <IconSearch />
              </span>
              <span className="hd-drop-name">Search listings for &ldquo;{value.trim()}&rdquo;</span>
            </li>
          </ul>
        )}
      </div>
      <p className="hd-search-hint">An address opens its street page at that number.</p>
    </div>
  );
}

export default HeroSearch;
