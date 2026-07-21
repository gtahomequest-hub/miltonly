// src/components/home/SearchBand.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconSearch } from './icons';

export function SearchBand() {
  const router = useRouter();
  const [q, setQ] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/listings?q=${encodeURIComponent(query)}` : '/listings');
  };

  return (
    /* 2026-07-21 Option B (approved mockup): the band is a titled section
       anchoring the light zone - sibling section-header pattern inherited
       verbatim (m-sechead / m-eyebrow / h2, The Market Read's classes).
       Routing untouched; #m-searchband id kept for the nav scroll-reveal. */
    <section className="m-searchband" id="m-searchband">
      <div className="m-wrap">
        <div className="m-sechead">
          <span className="m-eyebrow">Find your street</span>
          <h2>Search the encyclopedia</h2>
        </div>
        <form className="m-searchbox" onSubmit={submit}>
          <IconSearch />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a street, neighbourhood, or address…"
            aria-label="Search Milton streets, neighbourhoods, or listings"
          />
          <button type="submit">Search</button>
        </form>
        <div className="m-searchhint">
          One bar, two doors — <a href="/streets">find your street</a> for editorial depth, or{' '}
          <a href="/listings">explore listings</a> for live MLS.
        </div>
      </div>
    </section>
  );
}
