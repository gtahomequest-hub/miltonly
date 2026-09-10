'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import './site-nav.css';
import { IconSearch } from '../home/icons';
import { resolveHeroHref } from '@/lib/heroSearchClient';
import type { MegaLive } from './megaTypes';

type Variant = 'home' | 'page';

// ─────────────────────────────────────────────────────────────────────────────
// THREE MENUS, AND WHY THE MARKUP IS SHAPED THE WAY IT IS
//
// The nav this replaces emitted ZERO crawlable links. Its four items were <button>
// elements and their panels were mounted behind `{open && …}`, so the served HTML
// carried no href for any of them. Measured on production 2026-09-10: the homepage
// shipped 24 unique internal links, all of them from the footer, the four hero pills
// and one Board CTA. The nav — the one element on every page of the site — contributed
// nothing to the link graph at all.
//
// So two rules govern this file now:
//
//   1. EVERY MENU LINK IS AN <a href> AND IS ALWAYS IN THE DOM. Panels are rendered on
//      the server, closed with the `hidden` attribute rather than by not existing. A
//      closed panel is invisible to a reader and fully present to a crawler.
//   2. THE PANEL IS PROGRESSIVE ENHANCEMENT. Each trigger is itself an anchor pointing
//      at that menu's index page. With JavaScript, a desktop click opens the panel
//      instead of navigating. Without it, or on a narrow screen, the click navigates to
//      a real page. Nothing here is reachable only through an event handler.
//
// Below 820px the inline links hide and the hamburger panel renders the same three
// menus as native <details> accordions, which need no JavaScript to open and behave
// correctly at 380px.
// ─────────────────────────────────────────────────────────────────────────────

export interface MenuDef {
  key: 'buy' | 'streets' | 'sell';
  label: string;
  /** where the trigger goes when the panel is not opened: a real index page */
  href: string;
  /** the intents rail */
  rail: { href: string; label: string }[];
}

const MENUS: MenuDef[] = [
  {
    key: 'buy',
    label: 'Buy',
    href: '/listings',
    rail: [
      { href: '/listings', label: 'Homes for sale' },
      { href: '/rentals', label: 'For rent' },
      { href: '/sold', label: 'Recently sold' },
      { href: '/condos', label: 'Condo buildings' },
      { href: '/freehold', label: 'Freehold homes' },
      { href: '/potl', label: 'POTL and freehold condos' },
      { href: '/compare', label: 'Compare' },
      { href: '/exclusive', label: 'Exclusive listings' },
    ],
  },
  {
    key: 'streets',
    label: 'Streets',
    href: '/streets',
    rail: [
      { href: '/streets', label: 'All streets' },
      { href: '/neighbourhoods', label: 'Neighbourhoods' },
      { href: '/map', label: 'Street map' },
      { href: '/schools', label: 'Schools' },
      { href: '/mosques', label: 'Mosques' },
      { href: '/condos-guide', label: 'Condo buying guide' },
    ],
  },
  {
    key: 'sell',
    label: 'Sell',
    href: '/sell',
    rail: [
      { href: '/sell', label: 'What is my home worth' },
      { href: '/sold', label: 'Sold data and trends' },
      { href: '/freehold', label: 'Freehold market' },
      { href: '/condos', label: 'Condo market' },
      { href: '/about', label: 'About Aamir' },
      { href: '/book', label: 'Book a call' },
    ],
  },
];

const money = (n: number) => `$${n.toLocaleString('en-CA')}`;

/** The live right panel. Absent data renders nothing: a panel is never padded with a
 *  placeholder, because an empty state that looks like content is worse than a rail. */
function MegaLivePanel({ menu, live }: { menu: MenuDef; live?: MegaLive }) {
  if (!live) return null;

  if (menu.key === 'buy' && live.buy) {
    const b = live.buy;
    return (
      <div className="m-mega-live">
        <p className="m-mega-lead">
          <b>{b.activeCount}</b> on the market today
          {b.newThisWeek > 0 ? <> · <b>{b.newThisWeek}</b> new this week</> : null}
        </p>
        <ul className="m-mega-cards">
          {b.listings.map((l) => (
            <li key={l.mlsNumber}>
              <a href={`/listings/${l.mlsNumber}`}>
                <span className="m-mega-price">{money(l.price)}</span>
                <span className="m-mega-sub">{l.address}</span>
              </a>
            </li>
          ))}
        </ul>
        <a className="m-mega-more" href="/listings">
          All listings
        </a>
      </div>
    );
  }

  if (menu.key === 'streets' && live.streets) {
    const s = live.streets;
    return (
      <div className="m-mega-live">
        <p className="m-mega-lead">
          <b>{s.videoCount}</b> streets filmed end to end
        </p>
        <ul className="m-mega-frames">
          {s.videos.map((v) => (
            <li key={v.slug}>
              <a href={`/streets/${v.slug}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.poster} alt="" loading="lazy" width={160} height={90} />
                <span className="m-mega-sub">
                  {v.name}
                  {v.variant === 'night' ? ' · overnight' : ''}
                </span>
              </a>
            </li>
          ))}
        </ul>
        <a className="m-mega-more" href="/streets">
          All streets
        </a>
      </div>
    );
  }

  if (menu.key === 'sell' && live.sell) {
    const s = live.sell;
    return (
      <div className="m-mega-live">
        <p className="m-mega-lead">Milton, {s.window}</p>
        <dl className="m-mega-figs">
          {s.typical !== null && (
            <div>
              <dt>Typical price</dt>
              <dd>{money(s.typical)}</dd>
            </div>
          )}
          {s.daysToSell !== null && (
            <div>
              <dt>Days to sell</dt>
              <dd>{s.daysToSell}</dd>
            </div>
          )}
          {s.soldToAsk !== null && (
            <div>
              <dt>Sold to ask</dt>
              <dd>{s.soldToAsk}%</dd>
            </div>
          )}
        </dl>
        <a className="m-mega-more" href="/sell">
          Get a grounded valuation
        </a>
      </div>
    );
  }

  return null;
}

/** In-demand streets, shared by all three menus. Reads VIP + rank, surfaced only. */
function InDemandStrip({ live }: { live?: MegaLive }) {
  if (!live?.inDemandStreets?.length) return null;
  return (
    <div className="m-mega-strip">
      <span className="m-mega-striplabel">In demand</span>
      {live.inDemandStreets.map((s) => (
        <a key={s.slug} href={`/streets/${s.slug}`}>
          {s.name}
        </a>
      ))}
    </div>
  );
}

export function SiteNav({ variant = 'page', live }: { variant?: Variant; live?: MegaLive }) {
  const isHome = variant === 'home';
  const router = useRouter();
  const [searchVisible, setSearchVisible] = useState(false);
  const [navQuery, setNavQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const navLinksRef = useRef<HTMLDivElement>(null);

  // The desktop-only intercept. Below the breakpoint the trigger stays a plain link,
  // which is the whole point: the panel is an enhancement, not the only route in.
  const onTriggerClick = (key: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (typeof window !== 'undefined' && window.innerWidth <= 820) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setMegaOpen((cur) => (cur === key ? null : key));
  };

  // Dismissal: outside click, Esc, scroll and resize (a fixed nav's panel would
  // otherwise hang over a scrolled page).
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

  const submitNavSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    // Same entity-first resolver as the hero — one search behaviour sitewide.
    router.push(await resolveHeroHref(navQuery));
  };

  useEffect(() => {
    if (!isHome) return; // page variant has no scroll-reveal dependency
    const onScroll = () => {
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

  // Mobile panel: body scroll lock + Esc close + focus trap while open.
  useEffect(() => {
    if (!menuOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), summary') ?? [],
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

  const ctaHref = '/sell';

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
          {MENUS.map((m) => {
            const open = megaOpen === m.key;
            return (
              <div key={m.key} className="m-navitem">
                <a
                  className={`m-navtrigger${open ? ' m-open' : ''}`}
                  href={m.href}
                  aria-haspopup="true"
                  aria-expanded={open}
                  aria-controls={`m-mega-${m.key}`}
                  onClick={onTriggerClick(m.key)}
                >
                  {m.label}
                  <span className="m-caret" aria-hidden="true">
                    ▾
                  </span>
                </a>
                {/* Always rendered. `hidden` closes it; it is never absent. */}
                <div className="m-mega" id={`m-mega-${m.key}`} hidden={!open}>
                  <div className="m-mega-body">
                    <div className="m-mega-rail">
                      <span className="m-mega-raillabel">{m.label}</span>
                      {m.rail.map((r) => (
                        <a key={r.href + r.label} href={r.href}>
                          {r.label}
                        </a>
                      ))}
                    </div>
                    <MegaLivePanel menu={m} live={live} />
                  </div>
                  <InDemandStrip live={live} />
                </div>
              </div>
            );
          })}
        </div>

        {isHome && (
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
              placeholder="Street, address, or neighbourhood…"
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
          {/* Native <details>: an accordion that opens with no JavaScript and stays
              usable at 380px, where a popover cannot be. */}
          <div className="sn-acc">
            {MENUS.map((m) => (
              <details key={m.key} className="sn-acc-item">
                <summary>{m.label}</summary>
                <div className="sn-acc-body">
                  {m.rail.map((r) => (
                    <a key={r.href + r.label} href={r.href} onClick={() => setMenuOpen(false)}>
                      {r.label}
                    </a>
                  ))}
                </div>
              </details>
            ))}
            {live?.inDemandStreets?.length ? (
              <details className="sn-acc-item">
                <summary>In-demand streets</summary>
                <div className="sn-acc-body">
                  {live.inDemandStreets.map((s) => (
                    <a key={s.slug} href={`/streets/${s.slug}`} onClick={() => setMenuOpen(false)}>
                      {s.name}
                    </a>
                  ))}
                </div>
              </details>
            ) : null}
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
