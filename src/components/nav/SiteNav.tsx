'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import './site-nav.css';
import { IconSearch } from '../home/icons';
import { resolveHeroHref } from '@/lib/heroSearchClient';
import type { MegaLive, MegaStrip } from './megaTypes';

type Variant = 'home' | 'page';
type MenuKey = 'buy' | 'streets' | 'sell';

// ─────────────────────────────────────────────────────────────────────────────
// THREE MENUS, ONE BAND, AND WHY THE MARKUP IS SHAPED THE WAY IT IS
//
// The nav this replaces (2026-09-10 audit, scratchpad/reports/home-menu-audit.md) had a
// trigger that was also a link, so a click that missed the panel navigated away; no hover;
// no keyboard path into any panel; a panel anchored to its trigger that ran 149px off a
// 1024 viewport; and a phone menu 66px tall. Four rules govern this file now:
//
//   1. EVERY MENU LINK IS AN <a href> AND IS ALWAYS IN THE DOM. The three panels are
//      server-rendered inside the band and closed with the `hidden` attribute, never by not
//      existing. A closed panel is invisible to a reader and fully present to a crawler.
//      Measured before this rule existed: the nav contributed zero links to any page.
//   2. THE TRIGGER IS A <button>. It opens a panel; it goes nowhere. Each panel's index page
//      (/listings, /streets, /sell) is the panel's own CTA, so the destination is still one
//      crawlable click away and no gesture can navigate by accident.
//   3. ONE FULL-BLEED BAND. The panels do not hang off their triggers; they open in the same
//      place under the bar, spanning the content column, capped at the viewport height. A
//      panel that no longer depends on where its trigger sits cannot overflow the screen.
//   4. HOVER WITH INTENT, CLICK, AND A FULL KEYBOARD PATH. A mouse opens a panel after a
//      short pause and closes it when it leaves the nav; a click toggles; Enter, Space and
//      ArrowDown open and move focus INTO the panel; Escape closes and returns focus to the
//      trigger; Tab out of the panel closes it; outside click, scroll and resize close it.
//
// Below 820px the triggers and the band are hidden and the burger opens a full-viewport
// panel carrying the SAME live content as native <details> accordions.
// ─────────────────────────────────────────────────────────────────────────────

export interface MenuDef {
  key: MenuKey;
  label: string;
  /** the panel's own destination: its index page, rendered as the panel's CTA */
  href: string;
  cta: string;
  /** the intents rail */
  rail: { href: string; label: string }[];
}

// Two links left this rail on 2026-09-11: `/map` (a redirect to /streets, which is already
// here) and `/book` (a redirect to /about, which is already here). A nav link is a
// destination, not a hop.
const MENUS: MenuDef[] = [
  {
    key: 'buy',
    label: 'Buy',
    href: '/listings',
    cta: 'See every home for sale',
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
    cta: 'Browse every street page',
    rail: [
      { href: '/streets', label: 'All streets' },
      { href: '/neighbourhoods', label: 'Neighbourhoods' },
      { href: '/guides', label: 'Guides' },
      { href: '/schools', label: 'Schools' },
      { href: '/mosques', label: 'Mosques' },
      { href: '/condos-guide', label: 'Condo buying guide' },
    ],
  },
  {
    key: 'sell',
    label: 'Sell',
    href: '/sell',
    cta: 'What is my home worth?',
    rail: [
      { href: '/sell', label: 'What is my home worth' },
      { href: '/sold', label: 'Sold data and trends' },
      { href: '/market-watch', label: 'Market watch' },
      { href: '/freehold', label: 'Freehold market' },
      { href: '/condos', label: 'Condo market' },
      { href: '/about', label: 'About Aamir' },
    ],
  },
];

const HOVER_OPEN_MS = 120;
const HOVER_CLOSE_MS = 220;
const MOBILE_MAX = 820;

// ── shared pieces ─────────────────────────────────────────────────────────────

/** The street search: the fastest way to any Milton street, from any page. Same
 *  entity-first resolver as the hero, so one search behaviour sitewide. */
function StreetSearch({ id, compact }: { id: string; compact?: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(await resolveHeroHref(q));
  };
  return (
    <form className={`m-mega-search${compact ? ' m-mega-search-compact' : ''}`} onSubmit={submit} role="search">
      <label htmlFor={id} className="m-mega-label">
        Find your street
      </label>
      <div className="m-mega-searchrow">
        <span className="m-mega-searchlead" aria-hidden="true">
          <IconSearch />
        </span>
        <input
          id={id}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Street, address or neighbourhood"
          autoComplete="off"
        />
        <button type="submit" className="m-mega-searchgo">
          Go
        </button>
      </div>
    </form>
  );
}

/** One strip: a labelled row of street links, each with the count that ranked it. */
function Strip({ strip, onNavigate }: { strip?: MegaStrip; onNavigate?: () => void }) {
  if (!strip?.items.length) return null;
  return (
    <div className="m-mega-strip">
      <span className="m-mega-label">{strip.label}</span>
      <ul>
        {strip.items.map((s) => (
          <li key={s.slug}>
            <a href={`/streets/${s.slug}`} onClick={onNavigate}>
              {s.name}
              <span className="m-mega-stripnote">{s.note}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Rail({ menu, onNavigate }: { menu: MenuDef; onNavigate?: () => void }) {
  return (
    <div className="m-mega-rail">
      <span className="m-mega-label">{menu.label}</span>
      {menu.rail.map((r) => (
        <a key={r.href + r.label} href={r.href} onClick={onNavigate}>
          {r.label}
        </a>
      ))}
    </div>
  );
}

/** THE ONE TRUE THING. Every panel opens with a sentence built from live figures, not a
 *  list of links. The figures inside it carry data-fig so the battery can read them. */
function Lead({ menu, live }: { menu: MenuDef; live?: MegaLive }) {
  if (menu.key === 'buy' && live?.buy) {
    const b = live.buy;
    return (
      <p className="m-mega-lead">
        <b data-fig="menu-buy-active" data-value={b.active}>{b.active}</b> homes for sale in Milton,{' '}
        <b data-fig="menu-buy-new" data-value={b.newThisWeek}>{b.newThisWeek}</b> new this week.
      </p>
    );
  }
  if (menu.key === 'streets' && live?.streets) {
    const s = live.streets;
    return (
      <p className="m-mega-lead">
        <b data-fig="menu-streets-pages" data-value={s.pages}>{s.pages}</b> Milton streets with their own page,{' '}
        <b data-fig="menu-streets-filmed" data-value={s.filmed}>{s.filmed}</b> filmed end to end.
      </p>
    );
  }
  if (menu.key === 'sell' && live?.sell?.lead) {
    return <p className="m-mega-lead">{live.sell.lead}</p>;
  }
  return null;
}

/** The live content of one panel. Absent data renders nothing: a panel is never padded
 *  with a placeholder, because an empty state that looks like content is worse than a rail. */
function Live({ menu, live, onNavigate }: { menu: MenuDef; live?: MegaLive; onNavigate?: () => void }) {
  if (!live) return null;

  if (menu.key === 'buy' && live.buy) {
    return (
      <ul className="m-mega-cards">
        {live.buy.listings.map((l) => (
          <li key={l.mlsNumber}>
            <a href={`/listings/${l.mlsNumber}`} onClick={onNavigate}>
              <span className="m-mega-photo">
                {l.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.photo} alt="" loading="lazy" width={240} height={150} />
                ) : (
                  <span className="m-mega-nophoto">Photos coming soon</span>
                )}
              </span>
              <span className="m-mega-price">{l.price}</span>
              <span className="m-mega-meta">
                {l.beds} bd · {l.baths} ba{l.dom ? ` · ${l.dom}` : ''}
              </span>
              <span className="m-mega-sub">{l.address}</span>
              {l.hub ? <span className="m-mega-hub">{l.hub}</span> : null}
            </a>
          </li>
        ))}
      </ul>
    );
  }

  if (menu.key === 'streets' && live.streets) {
    const s = live.streets;
    return (
      <div className="m-mega-streets">
        <div className="m-mega-hubs">
          <span className="m-mega-label">Neighbourhoods, with homes listed now</span>
          <ul>
            {s.hubs.map((h) => (
              <li key={h.slug}>
                <a href={`/neighbourhoods/${h.slug}`} onClick={onNavigate}>
                  {h.name}
                  <span className="m-mega-count" data-fig="menu-hub-active" data-slug={h.slug} data-value={h.active}>
                    {h.active}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        {s.videos.length > 0 ? (
          <ul className="m-mega-frames">
            {s.videos.map((v) => (
              <li key={v.slug}>
                <a href={`/streets/${v.slug}`} onClick={onNavigate}>
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
        ) : null}
      </div>
    );
  }

  if (menu.key === 'sell' && live.sell) {
    // NO FORMATTING HERE, DELIBERATELY. Every value arrives as a display string built by
    // composeMegaLive with the same helpers the Board uses. A renderer that cannot format
    // cannot misformat. Each figure states its OWN window and sample; the three do not
    // share one.
    return (
      <>
        <dl className="m-mega-figs">
        {live.sell.figures.map((f) => (
          <div key={f.key}>
            <dt>{f.label}</dt>
            <dd data-fig={`menu-sell-${f.key}`} data-value={f.value}>
              {f.value}
            </dd>
            <dd className="m-mega-figwin">
              {f.window} · {f.sample}
            </dd>
          </div>
        ))}
        </dl>
        <p className="m-mega-note">
          A grounded valuation reads the comparable sales on your street and in your neighbourhood, not an
          algorithm&apos;s guess.
        </p>
      </>
    );
  }

  return null;
}

function stripFor(menu: MenuDef, live?: MegaLive): MegaStrip | undefined {
  if (!live) return undefined;
  return menu.key === 'buy' ? live.buy?.strip : menu.key === 'streets' ? live.streets?.strip : live.sell?.strip;
}

// ── the component ─────────────────────────────────────────────────────────────

export function SiteNav({ variant = 'page', live }: { variant?: Variant; live?: MegaLive }) {
  const isHome = variant === 'home';
  const router = useRouter();
  const [searchVisible, setSearchVisible] = useState(false);
  const [navQuery, setNavQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState<MenuKey | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const triggerRefs = useRef<Record<MenuKey, HTMLButtonElement | null>>({ buy: null, streets: null, sell: null });
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  // Set when a panel is opened from the keyboard, so the open effect moves focus into it.
  // A hover-opened panel must not steal focus from wherever the user is typing.
  const focusIntoPanel = useRef(false);

  const clearTimers = useCallback(() => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);

  const closeMega = useCallback(
    (restoreFocus = false) => {
      clearTimers();
      if (restoreFocus && megaOpen) triggerRefs.current[megaOpen]?.focus();
      setMegaOpen(null);
    },
    [clearTimers, megaOpen],
  );

  const scheduleClose = useCallback(() => {
    if (openTimer.current) window.clearTimeout(openTimer.current);
    openTimer.current = null;
    if (closeTimer.current) return;
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null;
      setMegaOpen(null);
    }, HOVER_CLOSE_MS);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }, []);

  // HOVER WITH INTENT. A mouse resting on a trigger for 120ms opens it; a mouse that merely
  // crosses the bar on its way somewhere else opens nothing. Pointer type is checked so a
  // finger never opens a panel it did not tap.
  const onTriggerPointerEnter = (key: MenuKey) => (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    cancelClose();
    if (openTimer.current) window.clearTimeout(openTimer.current);
    openTimer.current = window.setTimeout(() => {
      openTimer.current = null;
      focusIntoPanel.current = false;
      setMegaOpen(key);
    }, HOVER_OPEN_MS);
  };

  // One handler for the whole nav: the pointer is either over a trigger or the band (keep
  // open) or over something else in the bar, such as the logo or the CTA (start closing).
  const onNavPointerOver = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    const t = e.target as HTMLElement;
    if (t.closest('.m-navtrigger') || t.closest('.m-band')) cancelClose();
    else if (megaOpen) scheduleClose();
  };
  const onNavPointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    if (megaOpen || openTimer.current) scheduleClose();
  };

  const onTriggerClick = (key: MenuKey) => () => {
    clearTimers();
    focusIntoPanel.current = false;
    setMegaOpen((cur) => (cur === key ? null : key));
  };

  // THE KEYBOARD PATH. Enter and Space are the button's native click. ArrowDown opens and
  // enters; ArrowLeft/Right walk the triggers (and switch an open panel); Escape closes and
  // returns focus to the trigger. Handled on the nav so Escape works from inside a panel.
  const onTriggerKeyDown = (key: MenuKey, index: number) => (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || ((e.key === 'Enter' || e.key === ' ') && megaOpen !== key)) {
      e.preventDefault();
      clearTimers();
      focusIntoPanel.current = true;
      setMegaOpen(key);
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const next = MENUS[(index + (e.key === 'ArrowRight' ? 1 : MENUS.length - 1)) % MENUS.length];
      triggerRefs.current[next.key]?.focus();
      if (megaOpen) {
        focusIntoPanel.current = false;
        setMegaOpen(next.key);
      }
    }
  };
  const onNavKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && megaOpen) {
      e.preventDefault();
      closeMega(true);
    }
  };
  // Tab past the last link in a panel, or Shift+Tab before its first, lands outside the
  // nav; the panel closes rather than staying open over a page the user has moved on to.
  const onNavBlur = (e: React.FocusEvent) => {
    const next = e.relatedTarget as Node | null;
    if (megaOpen && next && navRef.current && !navRef.current.contains(next)) closeMega(false);
  };

  useEffect(() => {
    if (!megaOpen || !focusIntoPanel.current) return;
    focusIntoPanel.current = false;
    const first = bandRef.current?.querySelector<HTMLElement>(`#m-mega-${megaOpen} a[href], #m-mega-${megaOpen} input, #m-mega-${megaOpen} button`);
    first?.focus();
  }, [megaOpen]);

  // Dismissal: outside click, scroll and resize (a fixed nav's panel would otherwise hang
  // over a scrolled page). Escape is handled on the nav above.
  useEffect(() => {
    if (!megaOpen) return;
    const close = () => closeMega(false);
    const onDown = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', close, { passive: true });
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', close);
      window.removeEventListener('resize', close);
    };
  }, [megaOpen, closeMega]);

  useEffect(() => clearTimers, [clearTimers]);

  const submitNavSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    // Same entity-first resolver as the hero — one search behaviour sitewide.
    router.push(await resolveHeroHref(navQuery));
  };

  useEffect(() => {
    if (!isHome) return; // page variant has no scroll-reveal dependency
    const onScroll = () => {
      const anchor = document.getElementById('m-searchband') || document.getElementById('m-hero-askbar');
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
      Array.from(panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), summary, input') ?? []);
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
    const onResize = () => {
      if (window.innerWidth > MOBILE_MAX) setMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [menuOpen]);

  const ctaHref = '/sell';
  const closeMobile = () => setMenuOpen(false);

  return (
    <nav
      ref={navRef}
      className={isHome ? 'm-nav' : 'site-nav'}
      onPointerOver={onNavPointerOver}
      onPointerLeave={onNavPointerLeave}
      onKeyDown={onNavKeyDown}
      onBlur={onNavBlur}
    >
      <div className="m-wrap">
        <a className="m-logo" href="/" aria-label="Miltonly home">
          Milton<b>ly</b>
        </a>

        <div className={`m-navlinks${isHome && searchVisible ? ' m-hidden' : ''}`}>
          {MENUS.map((m, i) => {
            const open = megaOpen === m.key;
            return (
              <button
                key={m.key}
                ref={(el) => {
                  triggerRefs.current[m.key] = el;
                }}
                type="button"
                className={`m-navtrigger${open ? ' m-open' : ''}`}
                aria-haspopup="true"
                aria-expanded={open}
                aria-controls={`m-mega-${m.key}`}
                onPointerEnter={onTriggerPointerEnter(m.key)}
                onClick={onTriggerClick(m.key)}
                onKeyDown={onTriggerKeyDown(m.key, i)}
              >
                {m.label}
                <span className="m-caret" aria-hidden="true">
                  ▾
                </span>
              </button>
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
            <button type="submit" className="m-navsearch-go" aria-label="Search" tabIndex={searchVisible ? 0 : -1}>
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

      {/* THE BAND. One full-bleed strip under the bar; every panel is always inside it and
          closed with `hidden`. It is capped at the viewport height and scrolls inside itself
          rather than past the screen. */}
      <div ref={bandRef} className={`m-band${megaOpen ? ' m-band-open' : ''}`}>
        {MENUS.map((m) => (
          <section
            key={m.key}
            className="m-mega"
            id={`m-mega-${m.key}`}
            aria-label={`${m.label} menu`}
            hidden={megaOpen !== m.key}
          >
            <div className="m-mega-in">
              <div className="m-mega-body">
                <Rail menu={m} />
                <div className="m-mega-main">
                  <Lead menu={m} live={live} />
                  {m.key === 'streets' ? <StreetSearch id="m-mega-street-search" /> : null}
                  <Live menu={m} live={live} />
                </div>
              </div>
              <div className="m-mega-foot">
                <Strip strip={stripFor(m, live)} />
                <a className="m-mega-cta" href={m.href}>
                  {m.cta}
                  <span aria-hidden="true"> →</span>
                </a>
              </div>
            </div>
          </section>
        ))}
      </div>

      {menuOpen && (
        <div className="sn-panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="Site menu">
          <div className="sn-panel-head">
            <a className="m-logo" href="/" aria-label="Miltonly home" onClick={closeMobile}>
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
          <StreetSearch id="sn-street-search" compact />
          {/* Native <details>: an accordion that opens with no JavaScript and stays
              usable at 380px, where a popover cannot be. Each carries the SAME live
              content as its desktop panel: the lead, the rail, the cards or figures,
              the strip and the CTA. */}
          <div className="sn-acc">
            {MENUS.map((m) => (
              <details key={m.key} className="sn-acc-item">
                <summary>{m.label}</summary>
                <div className="sn-acc-body">
                  <Lead menu={m} live={live} />
                  <div className="sn-acc-rail">
                    {m.rail.map((r) => (
                      <a key={r.href + r.label} href={r.href} onClick={closeMobile}>
                        {r.label}
                      </a>
                    ))}
                  </div>
                  <Live menu={m} live={live} onNavigate={closeMobile} />
                  <Strip strip={stripFor(m, live)} onNavigate={closeMobile} />
                  <a className="m-mega-cta" href={m.href} onClick={closeMobile}>
                    {m.cta}
                    <span aria-hidden="true"> →</span>
                  </a>
                </div>
              </details>
            ))}
          </div>
          <a className="sn-panel-cta" href={ctaHref} onClick={closeMobile}>
            What&apos;s my home worth?
          </a>
        </div>
      )}
    </nav>
  );
}

export default SiteNav;
