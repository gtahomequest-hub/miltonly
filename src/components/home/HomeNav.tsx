// src/components/home/HomeNav.tsx
'use client';

import { useEffect, useState } from 'react';
import { IconSearch } from './icons';

export function HomeNav() {
  const [searchVisible, setSearchVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById('m-hero-askbar');
    if (!target) return;
    const obs = new IntersectionObserver(
      ([entry]) => setSearchVisible(!entry.isIntersecting),
      { rootMargin: '-66px 0px 0px 0px', threshold: 0 },
    );
    obs.observe(target);
    return () => obs.disconnect();
  }, []);

  return (
    <nav className="m-nav">
      <div className="m-wrap">
        <div className="m-logo">
          Milton<b>ly</b>
        </div>

        {/* default links — hidden once search appears */}
        <div className={`m-navlinks${searchVisible ? ' m-hidden' : ''}`}>
          <a href="#index">Neighbourhoods</a>
          <a href="#vip">Explore streets</a>
          <a href="#mls">Explore MLS</a>
          <a href="#market">Market</a>
        </div>

        {/* search — fades in on scroll, takes the centre */}
        <div className={`m-navsearch${searchVisible ? ' m-show' : ''}`} aria-hidden={!searchVisible}>
          <IconSearch />
          <input
            placeholder="Search a street or home…"
            tabIndex={searchVisible ? 0 : -1}
          />
        </div>

        <a className="m-navcta" href="#dual">
          What&apos;s my home worth?
        </a>
      </div>
    </nav>
  );
}
