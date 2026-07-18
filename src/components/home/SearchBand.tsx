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
    <div className="m-searchband" id="m-searchband">
      <div className="m-wrap">
        <form className="m-searchbox" onSubmit={submit}>
          <IconSearch />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a street, neighbourhood, or homes for sale in Milton"
            aria-label="Search Milton streets, neighbourhoods, or listings"
          />
          <button type="submit">Search</button>
        </form>
        <div className="m-searchhint">
          One bar, two doors — <b>find your street</b> for editorial depth, or{' '}
          <b>explore listings</b> for live MLS.
        </div>
      </div>
    </div>
  );
}
