'use client';
// src/components/listings/v2/ResultsClient.tsx
// The interactive results island: filter rail + grid/map toggle + save hearts
// (UserProvider, same as the live grid) + booking modal (identical /api/leads
// payload + source string, so analytics continuity is preserved) + save-search
// (identical /api/auth/saved-searches payload) + pagination.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/components/UserProvider';
import { attributionPayload } from '@/lib/attribution';
import { config } from '@/lib/config';
import type { ListingCardData, ListingsQuery, ListingsV2Data } from './types';
import { ListingCard } from './ListingCard';
import { FiltersBar, buildHref } from './FiltersBar';
import { MapPanel } from './MapPanel';
import { titleCase, shortPrice } from './format';
import { BellIcon, CloseIcon } from './icons';

function pageHref(basePath: string, query: ListingsQuery, page: number): string {
  const base = buildHref(query);
  const sep = base === '?' ? '' : '&';
  return page <= 1 ? `${basePath}${base === '?' ? '' : base}` : `${basePath}${base}${sep}page=${page}`;
}

function pageList(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = Array.from(pages)
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }
  return out;
}

export function ResultsClient({ data, basePath }: { data: ListingsV2Data; basePath: string }) {
  const { query, listings, mapPins, totalCount, totalPages } = data;
  const router = useRouter();
  const { user, isListingSaved, saveListing, unsaveListing } = useUser();
  const [view, setView] = useState<'grid' | 'map'>('grid');
  const [toast, setToast] = useState('');
  const [booking, setBooking] = useState<ListingCardData | null>(null);
  const [searchSaved, setSearchSaved] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const handleSave = async (mls: string) => {
    if (!user) {
      router.push(`/signin?redirect=${encodeURIComponent(basePath)}`);
      return;
    }
    if (isListingSaved(mls)) {
      await unsaveListing(mls);
      showToast('Removed from saved homes');
    } else {
      await saveListing(mls);
      showToast('Saved — find it under your homes');
    }
  };

  const submitBooking = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!booking) return;
    const fd = new FormData(e.currentTarget);
    const name = (fd.get('name') as string)?.trim();
    const phone = (fd.get('phone') as string)?.trim();
    if (!name || !phone) {
      showToast('Please enter your name and phone');
      return;
    }
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: name,
          phone,
          source: 'listing-card-book',
          intent: 'buyer',
          street: booking.address,
          mlsNumber: booking.mlsNumber,
          ...attributionPayload(),
        }),
      });
      showToast(`Showing requested — ${config.realtor.name.split(' ')[0]} will call within the hour`);
      setBooking(null);
    } catch {
      showToast('Could not submit — please try again');
    }
  };

  const saveSearch = async () => {
    if (!user) {
      router.push(`/signin?redirect=${encodeURIComponent(basePath)}`);
      return;
    }
    const labels: string[] = [];
    if (query.type !== 'all') labels.push(titleCase(query.type));
    if (query.neighbourhood) labels.push(query.neighbourhood);
    if (query.beds != null) labels.push(`${query.beds}+ bd`);
    if (query.baths != null) labels.push(`${query.baths}+ ba`);
    if (query.min != null || query.max != null)
      labels.push(
        query.min != null && query.max != null
          ? `${shortPrice(query.min)}–${shortPrice(query.max)}`
          : query.min != null
            ? `from ${shortPrice(query.min)}`
            : `under ${shortPrice(query.max as number)}`,
      );
    try {
      const res = await fetch('/api/auth/saved-searches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: labels.length ? labels.join(' · ') : `All ${config.CITY_NAME} listings`,
          propertyType: query.type !== 'all' ? query.type : undefined,
          neighbourhood: query.neighbourhood || undefined,
          priceMin: query.min != null ? String(query.min) : undefined,
          priceMax: query.max != null ? String(query.max) : undefined,
          bedsMin: query.beds != null ? String(query.beds) : undefined,
          bathsMin: query.baths != null ? String(query.baths) : undefined,
          transactionType: query.status === 'rent' ? 'For Lease' : 'For Sale',
        }),
      });
      if (!res.ok) throw new Error('save failed');
      setSearchSaved(true);
      showToast('Search saved — we’ll email you new matches');
    } catch {
      showToast('Could not save this search — try again');
    }
  };

  const grid =
    listings.length === 0 ? (
      <div className="lv-empty">
        <h3>No homes match these filters</h3>
        <p>Loosen one filter — price band and neighbourhood are usually the tightest.</p>
        <Link href={basePath}>Clear all filters</Link>
      </div>
    ) : (
      <div className="lv-grid">
        {listings.map((l) => (
          <ListingCard
            key={l.mlsNumber}
            listing={l}
            saved={isListingSaved(l.mlsNumber)}
            onSave={handleSave}
            onBook={setBooking}
          />
        ))}
      </div>
    );

  return (
    <>
      <FiltersBar
        query={query}
        neighbourhoodOptions={data.neighbourhoodOptions}
        view={view}
        onViewChange={setView}
        basePath={basePath}
      />

      <div className="lv-wrap">
        <div className="lv-reshead">
          <span className="lv-rescount">
            <b>{totalCount.toLocaleString()}</b>
            home{totalCount === 1 ? '' : 's'}
            {query.status === 'rent' ? ' for rent' : query.status === 'sold' ? ' sold' : ' for sale'} in{' '}
            {query.neighbourhood ?? config.CITY_NAME}
          </span>
          <button
            type="button"
            className={`lv-savesearch${searchSaved ? ' lv-done' : ''}`}
            onClick={saveSearch}
            disabled={searchSaved}
          >
            <BellIcon />
            {searchSaved ? 'Search saved ✓' : 'Save this search'}
          </button>
        </div>

        {view === 'map' ? (
          <div className="lv-split">
            <div>{grid}</div>
            <div className="lv-mapcol">
              <MapPanel pins={mapPins} />
            </div>
          </div>
        ) : (
          grid
        )}

        {totalPages > 1 && view === 'grid' && (
          <nav className="lv-pager" aria-label="Results pages">
            {query.page > 1 && <Link href={pageHref(basePath, query, query.page - 1)}>← Prev</Link>}
            {pageList(query.page, totalPages).map((p, i) =>
              p === '…' ? (
                <span key={`e${i}`} className="lv-ell">
                  …
                </span>
              ) : p === query.page ? (
                <span key={p} className="lv-cur">
                  {p}
                </span>
              ) : (
                <Link key={p} href={pageHref(basePath, query, p)}>
                  {p}
                </Link>
              ),
            )}
            {query.page < totalPages && <Link href={pageHref(basePath, query, query.page + 1)}>Next →</Link>}
          </nav>
        )}
      </div>

      {/* booking modal */}
      {booking && (
        <div className="lv-veil" onClick={() => setBooking(null)}>
          <div className="lv-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Book a showing">
            <button type="button" className="lv-modal-x" aria-label="Close" onClick={() => setBooking(null)}>
              <CloseIcon />
            </button>
            <h3>Book a showing</h3>
            <p className="lv-modal-sub">{booking.displayAddress ? titleCase(booking.address) : 'Address on request'}</p>
            <p className="lv-modal-mls">MLS® {booking.mlsNumber}</p>
            <form onSubmit={submitBooking}>
              <input name="name" placeholder="Your name" autoComplete="name" />
              <input name="phone" type="tel" placeholder="Phone number" autoComplete="tel" />
              <button type="submit" className="lv-modal-go">
                Request this showing
              </button>
            </form>
            <p className="lv-modal-trust">
              {config.realtor.name.split(' ')[0]} confirms within the hour · no obligation
            </p>
          </div>
        </div>
      )}

      {toast && (
        <div className="lv-toast">
          <b>✓</b> {toast}
        </div>
      )}
    </>
  );
}
