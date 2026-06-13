'use client';
// src/components/listings/v2/FiltersBar.tsx
// The sticky filter rail. Desktop: pill triggers with popover panels; mobile:
// horizontal pills collapse into an "All filters" bottom-sheet drawer. Every
// control writes the LIVE URL param contract (type/status/min/max/beds/baths/
// neighbourhood/q/sort/page) via router.push — the server re-queries on
// navigation, exactly like today's GET form. No client-side filtering.

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ListingsQuery, ListingsSort, ListingsType } from './types';
import { shortPrice } from './format';
import { ChevronIcon, CloseIcon, CheckIcon, FilterIcon, GridIcon, MapIcon } from './icons';

const TYPE_OPTIONS: { value: ListingsType; label: string }[] = [
  { value: 'all', label: 'Any type' },
  { value: 'detached', label: 'Detached' },
  { value: 'semi', label: 'Semi' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'condo', label: 'Condo' },
];

const MIN_PRESETS = [500_000, 700_000, 900_000, 1_100_000];
const MAX_PRESETS = [800_000, 1_000_000, 1_300_000, 2_000_000];

function buildHref(q: ListingsQuery): string {
  const p = new URLSearchParams();
  if (q.status !== 'active') p.set('status', q.status);
  if (q.type !== 'all') p.set('type', q.type);
  if (q.min != null) p.set('min', String(q.min));
  if (q.max != null) p.set('max', String(q.max));
  if (q.beds != null) p.set('beds', String(q.beds));
  if (q.baths != null) p.set('baths', String(q.baths));
  if (q.neighbourhood) p.set('neighbourhood', q.neighbourhood);
  if (q.q) p.set('q', q.q);
  if (q.sort !== 'newest') p.set('sort', q.sort);
  // page intentionally reset on every filter change
  const s = p.toString();
  return s ? `?${s}` : '?';
}

type PopId = 'price' | 'beds' | 'baths' | 'type' | 'hood' | null;

export interface FiltersBarProps {
  query: ListingsQuery;
  neighbourhoodOptions: string[];
  /** current results view; rendered in the rail so it stays visible while scrolling */
  view: 'grid' | 'map';
  onViewChange: (v: 'grid' | 'map') => void;
  /** the route the params apply to ('/listings' live, the preview route in design review) */
  basePath: string;
}

export function FiltersBar({ query, neighbourhoodOptions, view, onViewChange, basePath }: FiltersBarProps) {
  const router = useRouter();
  const [open, setOpen] = useState<PopId>(null);
  const [drawer, setDrawer] = useState(false);
  // local price inputs (applied on "Apply", not per keystroke)
  const [minLocal, setMinLocal] = useState(query.min != null ? String(query.min) : '');
  const [maxLocal, setMaxLocal] = useState(query.max != null ? String(query.max) : '');
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMinLocal(query.min != null ? String(query.min) : '');
    setMaxLocal(query.max != null ? String(query.max) : '');
  }, [query.min, query.max]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (railRef.current && !railRef.current.contains(e.target as Node)) setOpen(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const push = (next: Partial<ListingsQuery>) => {
    router.push(`${basePath}${buildHref({ ...query, ...next, page: 1 })}`, { scroll: false });
    setOpen(null);
  };

  const applyPrice = () => {
    push({
      min: minLocal ? parseInt(minLocal, 10) || null : null,
      max: maxLocal ? parseInt(maxLocal, 10) || null : null,
    });
  };

  const priceLabel =
    query.min != null && query.max != null
      ? `${shortPrice(query.min)}–${shortPrice(query.max)}`
      : query.min != null
        ? `${shortPrice(query.min)}+`
        : query.max != null
          ? `Under ${shortPrice(query.max)}`
          : 'Price';
  const typeLabel = query.type === 'all' ? 'Type' : TYPE_OPTIONS.find((t) => t.value === query.type)?.label ?? 'Type';

  const chips: { label: string; clear: Partial<ListingsQuery> }[] = [];
  if (query.q) chips.push({ label: `“${query.q}”`, clear: { q: null } });
  if (query.type !== 'all') chips.push({ label: typeLabel, clear: { type: 'all' } });
  if (query.min != null || query.max != null) chips.push({ label: priceLabel, clear: { min: null, max: null } });
  if (query.beds != null) chips.push({ label: `${query.beds}+ beds`, clear: { beds: null } });
  if (query.baths != null) chips.push({ label: `${query.baths}+ baths`, clear: { baths: null } });
  if (query.neighbourhood) chips.push({ label: query.neighbourhood, clear: { neighbourhood: null } });

  const segRow = (
    label: string,
    options: (number | null)[],
    current: number | null,
    key: 'beds' | 'baths',
  ) => (
    <div>
      <div className="lv-pop-l">{label}</div>
      <div className="lv-seg">
        {options.map((o) => (
          <button
            key={String(o)}
            type="button"
            className={current === o ? 'lv-on' : ''}
            onClick={() => push(key === 'beds' ? { beds: o } : { baths: o })}
          >
            {o == null ? 'Any' : `${o}+`}
          </button>
        ))}
      </div>
    </div>
  );

  const pricePanel = (
    <>
      <div className="lv-pop-l">Price range</div>
      <div className="lv-pricegrid">
        <input
          inputMode="numeric"
          placeholder="No min"
          value={minLocal}
          onChange={(e) => setMinLocal(e.target.value.replace(/\D/g, ''))}
          aria-label="Minimum price"
        />
        <span>to</span>
        <input
          inputMode="numeric"
          placeholder="No max"
          value={maxLocal}
          onChange={(e) => setMaxLocal(e.target.value.replace(/\D/g, ''))}
          aria-label="Maximum price"
        />
      </div>
      <div className="lv-presets">
        {MIN_PRESETS.map((p) => (
          <button key={`mn${p}`} type="button" onClick={() => setMinLocal(String(p))}>
            {shortPrice(p)}+
          </button>
        ))}
        {MAX_PRESETS.map((p) => (
          <button key={`mx${p}`} type="button" onClick={() => setMaxLocal(String(p))}>
            &lt;{shortPrice(p)}
          </button>
        ))}
      </div>
      <div className="lv-pop-actions">
        <button
          type="button"
          className="lv-pop-clear"
          onClick={() => {
            setMinLocal('');
            setMaxLocal('');
            push({ min: null, max: null });
          }}
        >
          Clear
        </button>
        <button type="button" className="lv-pop-apply" onClick={applyPrice}>
          Apply
        </button>
      </div>
    </>
  );

  const hoodPanel = (
    <>
      <div className="lv-pop-l">Neighbourhood</div>
      <div className="lv-hoodlist">
        <button
          type="button"
          className={!query.neighbourhood ? 'lv-on' : ''}
          onClick={() => push({ neighbourhood: null })}
        >
          All of Milton {!query.neighbourhood && <CheckIcon />}
        </button>
        {neighbourhoodOptions.map((n) => (
          <button
            key={n}
            type="button"
            className={query.neighbourhood === n ? 'lv-on' : ''}
            onClick={() => push({ neighbourhood: n })}
          >
            {n} {query.neighbourhood === n && <CheckIcon />}
          </button>
        ))}
      </div>
    </>
  );

  const typePanel = (
    <>
      <div className="lv-pop-l">Property type</div>
      <div className="lv-seg">
        {TYPE_OPTIONS.map((t) => (
          <button
            key={t.value}
            type="button"
            className={query.type === t.value ? 'lv-on' : ''}
            onClick={() => push({ type: t.value })}
          >
            {t.label}
          </button>
        ))}
      </div>
    </>
  );

  const pill = (id: Exclude<PopId, null>, label: string, active: boolean, panel: React.ReactNode) => (
    <div className={`lv-fpill${open === id ? ' lv-open' : ''}`}>
      <button
        type="button"
        className={active ? 'lv-active' : ''}
        aria-expanded={open === id}
        onClick={() => setOpen(open === id ? null : id)}
      >
        {label}
        <ChevronIcon />
      </button>
      {open === id && <div className="lv-pop">{panel}</div>}
    </div>
  );

  return (
    <div className="lv-rail" ref={railRef}>
      <div className="lv-wrap">
        <div className="lv-rail-row">
          <button type="button" className="lv-allfilters" onClick={() => setDrawer(true)}>
            <FilterIcon />
            Filters{chips.length > 0 ? ` · ${chips.length}` : ''}
          </button>

          <div className="lv-pills">
            {pill('price', priceLabel, query.min != null || query.max != null, pricePanel)}
            {pill('beds', query.beds != null ? `${query.beds}+ beds` : 'Beds', query.beds != null,
              segRow('Bedrooms (or more)', [null, 1, 2, 3, 4, 5], query.beds, 'beds'))}
            {pill('baths', query.baths != null ? `${query.baths}+ baths` : 'Baths', query.baths != null,
              segRow('Bathrooms (or more)', [null, 1, 2, 3], query.baths, 'baths'))}
            {pill('type', typeLabel, query.type !== 'all', typePanel)}
            {pill('hood', query.neighbourhood ?? 'Neighbourhood', !!query.neighbourhood, hoodPanel)}
          </div>

          <div className="lv-rail-right">
            <label className="lv-sort">
              Sort
              <select
                value={query.sort}
                onChange={(e) => push({ sort: e.target.value as ListingsSort })}
                aria-label="Sort listings"
              >
                <option value="newest">Newest</option>
                <option value="price_asc">Price: low to high</option>
                <option value="price_desc">Price: high to low</option>
              </select>
            </label>
            <div className="lv-viewtoggle" role="tablist" aria-label="Results view">
              <button type="button" className={view === 'grid' ? 'lv-on' : ''} onClick={() => onViewChange('grid')}>
                <GridIcon />
                Grid
              </button>
              <button type="button" className={view === 'map' ? 'lv-on' : ''} onClick={() => onViewChange('map')}>
                <MapIcon />
                Map
              </button>
            </div>
          </div>
        </div>

        {chips.length > 0 && (
          <div className="lv-chips">
            {chips.map((c) => (
              <span key={c.label} className="lv-chip">
                {c.label}
                <button type="button" aria-label={`Remove ${c.label} filter`} onClick={() => push(c.clear)}>
                  <CloseIcon />
                </button>
              </span>
            ))}
            <button
              type="button"
              className="lv-clearall"
              onClick={() =>
                push({ type: 'all', min: null, max: null, beds: null, baths: null, neighbourhood: null, q: null })
              }
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* mobile drawer */}
      {drawer && (
        <>
          <div className="lv-drawer-veil" onClick={() => setDrawer(false)} />
          <div className="lv-drawer" role="dialog" aria-label="All filters">
            <div className="lv-drawer-head">
              <h3>Filters</h3>
              <button type="button" onClick={() => setDrawer(false)} aria-label="Close filters">
                <CloseIcon />
              </button>
            </div>
            <section>{pricePanel}</section>
            <section>{segRow('Bedrooms (or more)', [null, 1, 2, 3, 4, 5], query.beds, 'beds')}</section>
            <section>{segRow('Bathrooms (or more)', [null, 1, 2, 3], query.baths, 'baths')}</section>
            <section>{typePanel}</section>
            <section>{hoodPanel}</section>
            <section>
              <div className="lv-pop-l">Sort</div>
              <div className="lv-seg">
                {(['newest', 'price_asc', 'price_desc'] as ListingsSort[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={query.sort === s ? 'lv-on' : ''}
                    onClick={() => push({ sort: s })}
                  >
                    {s === 'newest' ? 'Newest' : s === 'price_asc' ? 'Price ↑' : 'Price ↓'}
                  </button>
                ))}
              </div>
            </section>
            <button type="button" className="lv-drawer-apply" onClick={() => setDrawer(false)}>
              Show results
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export { buildHref };
