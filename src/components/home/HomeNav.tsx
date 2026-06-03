// src/components/home/HomeNav.tsx
'use client';

import { useEffect, useState } from 'react';
import { IconSearch } from './icons';

export function HomeNav() {
  const [searchVisible, setSearchVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const el = document.getElementById('m-hero-askbar');
      if (!el) return;
      // reveal nav search once the hero ask bar has scrolled up past the fixed nav
      const past = el.getBoundingClientRect().bottom < 70;
      setSearchVisible(past);
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

        <div className={`m-navsearch${searchVisible ? ' m-show' : ''}`} aria-hidden={!searchVisible}>
          <IconSearch />
          <input placeholder="Search a street or home…" tabIndex={searchVisible ? 0 : -1} />
        </div>

        <a className="m-navcta" href="#dual">
          What&apos;s my home worth?
        </a>
      </div>
    </nav>
  );
}
