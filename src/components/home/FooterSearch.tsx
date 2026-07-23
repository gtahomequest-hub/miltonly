// src/components/home/FooterSearch.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { resolveHeroHref } from '@/lib/heroSearchClient';

// The footer search well — routes through the same entity-first resolver as the
// hero (street/condo/neighbourhood -> intent -> /listings?q=). One behaviour
// sitewide. Client component so HomeFooter can stay a server component.
export function FooterSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    router.push(await resolveHeroHref(q));
  };

  return (
    <form className="m-fsearch" onSubmit={submit} role="search">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        type="search"
        placeholder="Find a street, condo building, or neighbourhood"
        aria-label="Find a street, condo building, or neighbourhood"
      />
      <button type="submit" aria-label="Search">
        →
      </button>
    </form>
  );
}

export default FooterSearch;
