// src/components/nav/SiteNav.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import './site-nav.css';
import { IconSearch } from '../home/icons';

type Variant = 'home' | 'page';

// Homepage links. Desktop renders these as mega-menu triggers (see MEGA_PANELS);
// the `href` is the mobile-panel destination and the desktop fallback. "Explore
// MLS" now points at /listings (the old #mls anchor died with the MLS section).
const HOME_LINKS = [
  { href: '/neighbourhoods', label: 'Neighbourhoods' },
  { href: '/streets', label: 'Explore streets' },
  { href: '/listings', label: 'Explore MLS' },
  { href: '/sold', label: 'Market' },
];

// Cross-page links for every other forest page — real routes only.
const PAGE_LINKS = [
  { href: '/neighbourhoods', label: 'Neighbourhoods' },
  { href: '/streets', label: 'Explore streets' },
  { href: '/listings', label: 'Explore MLS' },
  { href: '/sold', label: 'Market' },
];

// Desktop mega-menu panels, keyed by nav label (real routes only). Modelled on
// the FiltersBar click-popover pattern (click to open, outside-click / Esc to
// close). V1: home variant only — page-variant rollout is a later pass.
const MEGA_PANELS: Record<string, { href: string; label: string }[]> = {
  Neighbourhoods: [
    { href: '/neighbourhoods', label: 'All neighbourhoods' },
    { href: '/condos', label: 'Condo buildings' },
    { href: '/schools', label: 'Schools' },
    { href: '/mosques', label: 'Mosques' },
    { href: '/map', label: 'Map view' },
  ],
  'Explore streets': [
    { href: '/streets', label: 'All streets' },
    { href: '/map', label: 'Street map' },
    { href: '/sold', label: 'Recent sales' },
  ],
  'Explore MLS': [
    { href: '/listings', label: 'Homes for sale' },
    { href: '/rentals', label: 'For rent' },
    { href: '/sold', label: 'Recently sold' },
    { href: '/compare', label: 'Compare' },
    { href: '/exclusive', label: 'Exclusive listings' },
  ],
  Market: [
    { href: '/sold', label: 'Sold data & trends' },
    { href: '/freehold', label: 'Freehold market' },
    { href: '/condos', label: 'Condo market' },
  ],
};

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
 *
 * Mobile (<=820px): both variants hide the inline links and render the sn-*
 * hamburger + full-screen panel (self-contained classes in site-nav.css, shared
 * by both variants; the existing .m-nav / .site-nav cascades are untouched).
 */
export function SiteNav({ variant = 'page' }: { variant?: Variant }) {
  const isHome = variant === 'home';
  const router = useRouter();
  const [searchVisible, setSearchVisible] = useState(false);
  const [navQuery, setNavQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState<string | null>(null);
  const [megaLeft, setMegaLeft] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const navLinksRef = useRef<HTMLDivElement>(null);

  const toggleMega = (label: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (megaOpen === label) {
      setMegaOpen(null);
      return;
    }
    setMegaLeft(e.currentTarget.getBoundingClientRect().left);
    setMegaOpen(label);
  };

  // Mega-menu dismissal: outside-click, Esc, and scroll/resize (fixed panels
  // would otherwise drift from their trigger).
  useEffect(() => {
    if (!megaOpen) return;
    const close = () => setMegaOpen(null);
    const onDown = (e: MouseEvent) => {
      if (navLinksRef.current && !navLinksRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, { passive: true });
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close);
      window.removeEventListener('resize', close);
    };
  }, [megaOpen]);

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

  // Mobile panel: body scroll lock + ESC close + focus trap while open.
  useEffect(() => {
    if (!menuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [],
      );
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        burgerRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab') return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const links = isHome ? HOME_LINKS : PAGE_LINKS;
  const ctaHref = isHome ? '#dual' : '/sell';

  return (
    <nav className={isHome ? 'm-nav' : 'site-nav'}>
      <div className="m-wrap">
        <a className="m-logo" href="/" aria-label="Miltonly home">
          Milton<b>ly</b>
        </a>

        <div
          ref={navLinksRef}
          className={`m-navlinks${isHome && searchVisible ? ' m-hidden' : ''}`}
        >
          {links.map((l) => {
            const panel = isHome ? MEGA_PANELS[l.label] : undefined;
            if (!panel) {
              return (
                <a key={l.label} href={l.href}>
                  {l.label}
                </a>
              );
            }
            const open = megaOpen === l.label;
            return (
              <div key={l.label} className="m-navitem">
                <button
                  type="button"
                  className={`m-navtrigger${open ? ' m-open' : ''}`}
                  aria-haspopup="true"
                  aria-expanded={open}
                  onClick={(e) => toggleMega(l.label, e)}
                >
                  {l.label}
                  <span className="m-caret" aria-hidden="true">
                    ▾
                  </span>
                </button>
                {open && (
                  <div className="m-megapanel" style={{ left: megaLeft }} role="menu">
                    {panel.map((p) => (
                      <a
                        key={p.href + p.label}
                        href={p.href}
                        role="menuitem"
                        onClick={() => setMegaOpen(null)}
                      >
                        {p.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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

        <button
          ref={burgerRef}
          className="sn-burger"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {menuOpen && (
        <div className="sn-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="Site menu">
          <div className="sn-panel-head">
            <a className="m-logo" href="/" aria-label="Miltonly home" onClick={() => setMenuOpen(false)}>
              Milton<b>ly</b>
            </a>
            <button
              className="sn-close"
              aria-label="Close menu"
              onClick={() => {
                setMenuOpen(false);
                burgerRef.current?.focus();
              }}
            >
              ×
            </button>
          </div>
          <div className="sn-panel-links">
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)}>
                {l.label}
              </a>
            ))}
          </div>
          <a className="sn-panel-cta" href={ctaHref} onClick={() => setMenuOpen(false)}>
            What&apos;s my home worth?
          </a>
        </div>
      )}
    </nav>
  );
}

export default SiteNav;
