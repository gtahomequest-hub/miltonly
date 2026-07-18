// src/components/nav/SiteNav.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import './site-nav.css';
import { IconSearch } from '../home/icons';

type Variant = 'home' | 'page';

// Homepage scroll-to-section anchors (the sections only exist on "/").
const HOME_LINKS = [
  { href: '#index', label: 'Neighbourhoods' },
  { href: '#vip', label: 'Explore streets' },
  { href: '#mls', label: 'Explore MLS' },
  { href: '#market', label: 'Market' },
];

// Cross-page links for every other forest page — real routes only.
const PAGE_LINKS = [
  { href: '/neighbourhoods', label: 'Neighbourhoods' },
  { href: '/streets', label: 'Explore streets' },
  { href: '/listings', label: 'Explore MLS' },
  { href: '/sold', label: 'Market' },
];

/**
 * The shared forest nav bar.
 *
 * variant="home": renders class="m-nav" with the homepage's hash anchors, the
 *   #dual CTA, and the scroll-reveal search tied to #m-searchband. It is styled
 *   ENTIRELY by the untouched `.home-v2 .m-nav*` block in home-theme.css — this
 *   file's CSS targets `.site-nav` only and never touches `.m-nav`, so the live
 *   homepage cascade is unchanged.
 * variant="page": renders class="site-nav" (styled by site-nav.css, self-contained
 *   forest palette) with cross-page links and NO scroll-reveal — the search
 *   anchors don't exist off the homepage.
 */
export function SiteNav({ variant = 'page' }: { variant?: Variant }) {
  const isHome = variant === 'home';
  const router = useRouter();
  const [searchVisible, setSearchVisible] = useState(false);
  const [navQuery, setNavQuery] = useState('');

  const submitNavSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = navQuery.trim();
    router.push(q ? `/listings?q=${encodeURIComponent(q)}` : '/listings');
  };

  useEffect(() => {
    if (!isHome) return; // page variant has no scroll-reveal dependency
    const onScroll = () => {
      // reveal nav search only after the page's main search band has scrolled
      // up past the fixed nav (fallback to the hero ask bar if band absent)
      const anchor =
        document.getElementById('m-searchband') ||
        document.getElementById('m-hero-askbar');
      if (!anchor) return;
      setSearchVisible(anchor.getBoundingClientRect().bottom < 70);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [isHome]);

  const links = isHome ? HOME_LINKS : PAGE_LINKS;
  const ctaHref = isHome ? '#dual' : '/sell';

  return (
    <nav className={isHome ? 'm-nav' : 'site-nav'}>
      <div className="m-wrap">
        <div className="m-logo">
          Milton<b>ly</b>
        </div>

        <div className={`m-navlinks${isHome && searchVisible ? ' m-hidden' : ''}`}>
          {links.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </div>

        {isHome && (
          /* mirrors the hero ask bar: white pill, green lead circle, green go */
          <form
            className={`m-navsearch${searchVisible ? ' m-show' : ''}`}
            aria-hidden={!searchVisible}
            onSubmit={submitNavSearch}
          >
            <span className="m-navsearch-lead">
              <IconSearch />
            </span>
            <input
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              placeholder="Search a street or home…"
              tabIndex={searchVisible ? 0 : -1}
            />
            <button
              type="submit"
              className="m-navsearch-go"
              aria-label="Search"
              tabIndex={searchVisible ? 0 : -1}
            >
              →
            </button>
          </form>
        )}

        <a className="m-navcta" href={ctaHref}>
          What&apos;s my home worth?
        </a>
      </div>
    </nav>
  );
}

export default SiteNav;
