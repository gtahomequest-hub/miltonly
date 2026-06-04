// src/components/home/HomeNav.tsx
'use client';

import { useEffect, useState } from 'react';
import { IconSearch } from './icons';

export function HomeNav() {
  const [searchVisible, setSearchVisible] = useState(false);

  useEffect(() => {
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
  }, []);

  return (
    <nav className="m-nav">
      <div className="m-wrap">
        <div className="m-logo">
          Milton<b>ly</b>
        </div>

        <div className={`m-navlinks${searchVisible ? ' m-hidden' : ''}`}>
          <a href="#index">Neighbourhoods</a>
          <a href="#vip">Explore streets</a>
          <a href="#mls">Explore MLS</a>
          <a href="#market">Market</a>
        </div>

        {/* mirrors the hero ask bar: white pill, green lead circle, green go */}
        <div className={`m-navsearch${searchVisible ? ' m-show' : ''}`} aria-hidden={!searchVisible}>
          <span className="m-navsearch-lead">
            <IconSearch />
          </span>
          <input placeholder="Search a street or home…" tabIndex={searchVisible ? 0 : -1} />
          <button className="m-navsearch-go" aria-label="Search" tabIndex={searchVisible ? 0 : -1}>
            →
          </button>
        </div>

        <a className="m-navcta" href="#dual">
          What&apos;s my home worth?
        </a>
      </div>
    </nav>
  );
}
