'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import './site-nav.css';
import { IconSearch } from '../home/icons';
import { resolveHeroHref } from '@/lib/heroSearchClient';
import { postLead, honeypotInputProps, HONEYPOT_WRAPPER_STYLE } from '@/lib/postLeadClient';
import type { LeadSegment, MegaItemContent, MegaLive, MegaStrip, MenuKey } from './megaTypes';

type Variant = 'home' | 'page';

// ─────────────────────────────────────────────────────────────────────────────
// THREE MENUS, ONE BAND, A RAIL THAT DRIVES THE PANEL, AND WHY THE MARKUP IS SHAPED SO
//
// The nav this replaces (2026-09-10 audit, scratchpad/reports/home-menu-audit.md) had a
// trigger that was also a link, so a click that missed the panel navigated away; no hover;
// no keyboard path into any panel; a panel anchored to its trigger that ran 149px off a
// 1024 viewport; and a phone menu 66px tall. Five rules govern this file now:
//
//   1. EVERY DESTINATION IS AN <a href> AND IS ALWAYS IN THE DOM. The three panels are
//      server-rendered inside the band and closed with the `hidden` attribute, never by not
//      existing; every rail item's panel is likewise rendered and hidden, one visible. A
//      closed panel is invisible to a reader and fully present to a crawler.
//   2. THE TRIGGER IS A <button>, AND SO IS EVERY RAIL ITEM. A trigger opens a menu; a rail
//      item selects a panel. Neither goes anywhere. Each panel's destination is its own CTA,
//      one crawlable click away, so no gesture can navigate by accident.
//   3. ONE FULL-BLEED BAND under the bar, spanning the content column, capped at the
//      viewport height. A panel that does not depend on where its trigger sits cannot
//      overflow the screen.
//   4. HOVER WITH INTENT, CLICK, AND A FULL KEYBOARD PATH. A mouse opens a menu after a
//      short pause and closes it when it leaves the nav; a click toggles; Enter, Space and
//      ArrowDown open and move focus INTO the panel; Escape closes and returns focus to the
//      trigger; Tab out of the panel closes it; outside click, scroll and resize close it.
//   5. THE RAIL IS A TABLIST. Resting a mouse on an item for the same 120ms selects its
//      panel; so does focusing it (Tab, ArrowUp/Down, Home/End) and so does a click. The
//      first item is selected by default, so a panel never opens onto nothing.
//
// Below 820px the triggers and the band are hidden and the burger opens a full-viewport
// panel: one <details> per menu, and inside it one <details> per rail item, the first open,
// each carrying the SAME live content as its desktop panel.
// ─────────────────────────────────────────────────────────────────────────────

export interface ItemDef {
  key: string;
  label: string;
  /** the panel's destination, rendered as its CTA */
  href: string;
  cta: string;
  /** one true sentence with no figure in it, shown only when no live lead arrived */
  blurb: string;
  /** the street search form belongs in this panel */
  search?: boolean;
  /** the daily-brief signup belongs in this panel */
  brief?: boolean;
}

export interface MenuDef {
  key: MenuKey;
  label: string;
  /** the menu's index page; at least one item's CTA points here */
  href: string;
  items: ItemDef[];
  /** destinations the rail no longer names, kept in the foot so the link graph keeps them */
  more: { href: string; label: string }[];
}

// Two links left this menu on 2026-09-11: `/map` (a redirect to /streets) and `/book` (a
// redirect to /about). A nav link is a destination, not a hop. Open houses are not a rail
// item because the feed carries no open-house field: see src/lib/megaLive.ts.
const MENUS: MenuDef[] = [
  {
    key: 'buy',
    label: 'Buy',
    href: '/listings',
    items: [
      { key: 'new', label: 'New today', href: '/listings', cta: 'See every home for sale', blurb: 'Every home for sale in Milton, newest first.' },
      { key: 'changes', label: 'Price changes', href: '/listings', cta: 'See every home for sale', blurb: 'Listings whose asking price moved, most recent change first.' },
      { key: 'condos', label: 'Condos', href: '/condos', cta: 'Every condo building', blurb: 'Condo apartments and condo townhouses, building by building.' },
      { key: 'freehold', label: 'Freehold', href: '/freehold', cta: 'The freehold market', blurb: 'Detached, semi-detached and freehold townhomes: no condo corporation, no fee.' },
      { key: 'rentals', label: 'Rentals', href: '/rentals', cta: 'Every home for rent', blurb: 'Homes for rent in Milton, available now.' },
      { key: 'alerts', label: 'Alerts', href: '/saved', cta: 'Saved listings and alerts', blurb: 'What listed, what sold and what moved on price, each weekday morning.', brief: true },
    ],
    more: [
      { href: '/sold', label: 'Recently sold' },
      { href: '/potl', label: 'POTL and freehold condos' },
      { href: '/compare', label: 'Compare' },
      { href: '/exclusive', label: 'Exclusive listings' },
    ],
  },
  {
    key: 'streets',
    label: 'Streets',
    href: '/streets',
    items: [
      { key: 'hoods', label: 'By neighbourhood', href: '/neighbourhoods', cta: 'Every neighbourhood', blurb: 'Every published neighbourhood, with the homes listed in it now.' },
      { key: 'video', label: 'With video', href: '/streets', cta: 'Browse every street page', blurb: 'Streets filmed end to end, by day and overnight.' },
      { key: 'az', label: 'A to Z', href: '/streets', cta: 'Browse every street page', blurb: 'Every street page, alphabetically.' },
      { key: 'search', label: 'Address search', href: '/streets', cta: 'Browse every street page', blurb: 'Type a street, an address or a neighbourhood and land on its page.', search: true },
    ],
    more: [
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
    items: [
      { key: 'worth', label: "What's it worth", href: '/sell', cta: 'What is my home worth?', blurb: 'A grounded valuation from the comparable sales on your street and in your neighbourhood.' },
      { key: 'soldmtd', label: 'Sold this month', href: '/sold', cta: 'Sold data and trends', blurb: 'What has closed in Milton so far this month.' },
      { key: 'watch', label: 'Market watch', href: '/market-watch', cta: 'Every weekly edition', blurb: 'The weekly edition: sales, new listings and activity by neighbourhood.' },
    ],
    more: [
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
function StreetSearch({ id }: { id: string }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    router.push(await resolveHeroHref(q));
  };
  return (
    <form className="m-mega-search" onSubmit={submit} role="search">
      <label htmlFor={id} className="m-mega-label">
        Find your street
      </label>
      <div className="m-mega-searchrow">
        <span className="m-mega-searchlead" aria-hidden="true">
          <IconSearch />
        </span>
        <input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Street, address or neighbourhood" autoComplete="off" />
        <button type="submit" className="m-mega-searchgo">
          Go
        </button>
      </div>
    </form>
  );
}

/** The daily-brief signup, through the one lead helper every form on the site uses. Source
 *  "daily-brief", the same as the homepage's and /sell's forms, so one list, one sender. */
function BriefSignup({ id }: { id: string }) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'ok' | 'error'>('idle');
  const [email, setEmail] = useState('');
  const [honey, setHoney] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === 'submitting') return;
    setStatus('submitting');
    const ok = await postLead({ source: 'daily-brief', intent: 'buy', email, notes: 'Daily brief signup (menu)', honeypot: honey });
    setStatus(ok ? 'ok' : 'error');
  };
  if (status === 'ok') {
    return <p className="m-mega-note m-mega-ok">You are on the list. Your first brief lands the next weekday morning.</p>;
  }
  return (
    <form className="m-mega-search" onSubmit={submit}>
      <label htmlFor={id} className="m-mega-label">
        The Milton daily brief
      </label>
      <div className="m-mega-searchrow">
        <input id={id} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" autoComplete="email" />
        <button type="submit" className="m-mega-searchgo" disabled={status === 'submitting'}>
          {status === 'submitting' ? '…' : 'Send me the brief'}
        </button>
      </div>
      {/* Honeypot. A person never sees it; a bot fills it and the row is silently dropped. */}
      <div style={HONEYPOT_WRAPPER_STYLE} aria-hidden="true">
        <label>
          Company website
          <input {...honeypotInputProps} type="text" value={honey} onChange={(e) => setHoney(e.target.value)} />
        </label>
      </div>
      {status === 'error' ? <p className="m-mega-note">Something went wrong. Please try again.</p> : null}
      <p className="m-mega-fine">Miltonly emails only. No account, unsubscribe anytime.</p>
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

/** THE ONE TRUE THING. A panel opens with a sentence built from live figures, not a list of
 *  links. The figures inside it carry data-fig so the battery can read them. */
function Lead({ segments, blurb }: { segments?: LeadSegment[]; blurb: string }) {
  if (!segments?.length) return <p className="m-mega-lead m-mega-blurb">{blurb}</p>;
  return (
    <p className="m-mega-lead">
      {segments.map((s, k) =>
        s.fig ? (
          <b key={k} data-fig={s.fig} data-value={s.text}>
            {s.text}
          </b>
        ) : (
          <span key={k}>{s.text}</span>
        ),
      )}
    </p>
  );
}

/** One rail item's panel: the lead, then every live block it carries, then its CTA. Absent
 *  data renders nothing: a panel is never padded with a placeholder. */
function ItemBody({
  menu,
  item,
  content,
  idPrefix,
  onNavigate,
}: {
  menu: MenuDef;
  item: ItemDef;
  content?: MegaItemContent;
  idPrefix: string;
  onNavigate?: () => void;
}) {
  const c = content;
  return (
    <>
      <Lead segments={c?.lead} blurb={item.blurb} />
      {item.search ? <StreetSearch id={`${idPrefix}-search-${menu.key}-${item.key}`} /> : null}
      {item.brief ? <BriefSignup id={`${idPrefix}-brief-${menu.key}-${item.key}`} /> : null}

      {c?.figures?.length ? (
        // NO FORMATTING HERE, DELIBERATELY. Every value arrives as a display string built by
        // composeMegaLive with the same helpers the Board uses. A renderer that cannot format
        // cannot misformat. Each figure states its OWN window and sample.
        <dl className="m-mega-figs">
          {c.figures.map((f) => (
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
      ) : null}

      {c?.cards?.length ? (
        <ul className="m-mega-cards">
          {c.cards.map((l) => (
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
                <span className="m-mega-price">
                  {l.price}
                  {l.priorPrice ? <s className="m-mega-prior">{l.priorPrice}</s> : null}
                </span>
                {l.change ? <span className="m-mega-change">{l.change}</span> : null}
                <span className="m-mega-meta">
                  {l.beds} bd · {l.baths} ba{l.dom ? ` · ${l.dom}` : ''}
                </span>
                <span className="m-mega-sub">{l.address}</span>
                {l.hub ? <span className="m-mega-hub">{l.hub}</span> : null}
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {c?.hubs?.length ? (
        <div className="m-mega-hubs">
          <span className="m-mega-label">Neighbourhoods, with homes listed now</span>
          <ul>
            {c.hubs.map((h) => (
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
      ) : null}

      {c?.videos?.length ? (
        <ul className="m-mega-frames">
          {c.videos.map((v) => (
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

      {c?.letters?.length ? (
        <ul className="m-mega-az" aria-label="Streets by first letter">
          {c.letters.map((l) => (
            <li key={l.letter}>
              {l.href ? (
                <a href={l.href} onClick={onNavigate}>
                  <b>{l.letter}</b>
                  <span>{l.count}</span>
                </a>
              ) : (
                <span className="m-mega-az-off" aria-label={`${l.letter}: no street pages`}>
                  <b>{l.letter}</b>
                  <span>{l.count}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {c?.edition ? (
        <div className="m-mega-edition">
          <span className="m-mega-label">{c.edition.label}</span>
          <p>{c.edition.summary}</p>
          <a href={c.edition.href} onClick={onNavigate}>
            Read the edition<span aria-hidden="true"> →</span>
          </a>
        </div>
      ) : null}

      <Strip strip={c?.strip} onNavigate={onNavigate} />
      {c?.note ? <p className="m-mega-note">{c.note}</p> : null}
      <a className="m-mega-cta" href={item.href} onClick={onNavigate}>
        {item.cta}
        <span aria-hidden="true"> →</span>
      </a>
    </>
  );
}

// ── the component ─────────────────────────────────────────────────────────────

const firstItems = (): Record<MenuKey, string> => ({ buy: MENUS[0].items[0].key, streets: MENUS[1].items[0].key, sell: MENUS[2].items[0].key });

export function SiteNav({ variant = 'page', live }: { variant?: Variant; live?: MegaLive }) {
  const isHome = variant === 'home';
  const router = useRouter();
  const [searchVisible, setSearchVisible] = useState(false);
  const [navQuery, setNavQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState<MenuKey | null>(null);
  // The selected rail item per menu. The first is selected by default, server and client
  // alike, so a panel never opens onto nothing and the served HTML shows one item's content.
  const [selected, setSelected] = useState<Record<MenuKey, string>>(firstItems);
  const navRef = useRef<HTMLElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const triggerRefs = useRef<Record<MenuKey, HTMLButtonElement | null>>({ buy: null, streets: null, sell: null });
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const railTimer = useRef<number | null>(null);
  // Set when a panel is opened from the keyboard, so the open effect moves focus into it.
  // A hover-opened panel must not steal focus from wherever the user is typing.
  const focusIntoPanel = useRef(false);

  const clearTimers = useCallback(() => {
    for (const t of [openTimer, closeTimer, railTimer]) {
      if (t.current) window.clearTimeout(t.current);
      t.current = null;
    }
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

  // THE RAIL. Selecting is idempotent and cheap, so hover-with-intent, focus and click all
  // call the same setter; only the mouse waits 120ms, because only the mouse passes by.
  const select = useCallback((menu: MenuKey, item: string) => {
    if (railTimer.current) window.clearTimeout(railTimer.current);
    railTimer.current = null;
    setSelected((cur) => (cur[menu] === item ? cur : { ...cur, [menu]: item }));
  }, []);
  const onRailPointerEnter = (menu: MenuKey, item: string) => (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    if (railTimer.current) window.clearTimeout(railTimer.current);
    railTimer.current = window.setTimeout(() => {
      railTimer.current = null;
      setSelected((cur) => (cur[menu] === item ? cur : { ...cur, [menu]: item }));
    }, HOVER_OPEN_MS);
  };
  const onRailPointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return;
    if (railTimer.current) window.clearTimeout(railTimer.current);
    railTimer.current = null;
  };
  const onRailKeyDown = (menu: MenuDef, index: number) => (e: React.KeyboardEvent) => {
    const n = menu.items.length;
    let to: number | null = null;
    if (e.key === 'ArrowDown') to = (index + 1) % n;
    else if (e.key === 'ArrowUp') to = (index + n - 1) % n;
    else if (e.key === 'Home') to = 0;
    else if (e.key === 'End') to = n - 1;
    if (to === null) return;
    e.preventDefault();
    const el = bandRef.current?.querySelector<HTMLElement>(`#m-tab-${menu.key}-${menu.items[to].key}`);
    el?.focus(); // focusing selects
  };

  useEffect(() => {
    if (!megaOpen || !focusIntoPanel.current) return;
    focusIntoPanel.current = false;
    const first = bandRef.current?.querySelector<HTMLElement>(`#m-mega-${megaOpen} [role="tab"][tabindex="0"], #m-mega-${megaOpen} a[href]`);
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
    // Same entity-first resolver as the hero: one search behaviour sitewide.
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
  const contentOf = (m: MenuDef, item: ItemDef): MegaItemContent | undefined => live?.[m.key]?.[item.key];

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
          <form className={`m-navsearch${searchVisible ? ' m-show' : ''}`} aria-hidden={!searchVisible} onSubmit={submitNavSearch}>
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

      {/* THE BAND. One full-bleed strip under the bar; every menu panel is always inside it
          and closed with `hidden`, and inside each, every rail item's panel likewise, one
          visible. It is capped at the viewport height and scrolls inside itself rather than
          past the screen. */}
      <div ref={bandRef} className={`m-band${megaOpen ? ' m-band-open' : ''}`}>
        {MENUS.map((m) => (
          <section key={m.key} className="m-mega" id={`m-mega-${m.key}`} aria-label={`${m.label} menu`} hidden={megaOpen !== m.key}>
            <div className="m-mega-in">
              <div className="m-mega-body">
                <div className="m-mega-rail" role="tablist" aria-orientation="vertical" aria-label={m.label} onPointerLeave={onRailPointerLeave}>
                  <span className="m-mega-label">{m.label}</span>
                  {m.items.map((it, k) => {
                    const sel = selected[m.key] === it.key;
                    return (
                      <button
                        key={it.key}
                        type="button"
                        role="tab"
                        id={`m-tab-${m.key}-${it.key}`}
                        className={`m-mega-tab${sel ? ' m-sel' : ''}`}
                        aria-selected={sel}
                        aria-controls={`m-item-${m.key}-${it.key}`}
                        tabIndex={sel ? 0 : -1}
                        onPointerEnter={onRailPointerEnter(m.key, it.key)}
                        onFocus={() => select(m.key, it.key)}
                        onClick={() => select(m.key, it.key)}
                        onKeyDown={onRailKeyDown(m, k)}
                      >
                        {it.label}
                      </button>
                    );
                  })}
                </div>
                <div className="m-mega-main">
                  {m.items.map((it) => (
                    <div
                      key={it.key}
                      role="tabpanel"
                      id={`m-item-${m.key}-${it.key}`}
                      aria-labelledby={`m-tab-${m.key}-${it.key}`}
                      className="m-item"
                      hidden={selected[m.key] !== it.key}
                    >
                      <ItemBody menu={m} item={it} content={contentOf(m, it)} idPrefix="m" />
                    </div>
                  ))}
                </div>
              </div>
              <div className="m-mega-foot">
                <span className="m-mega-label">Also</span>
                <ul className="m-mega-more">
                  {m.more.map((r) => (
                    <li key={r.href}>
                      <a href={r.href}>{r.label}</a>
                    </li>
                  ))}
                </ul>
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
          <StreetSearch id="sn-street-search" />
          {/* Native <details>: an accordion that opens with no JavaScript and stays usable at
              380px, where a popover cannot be. One per menu; inside it one per rail item, the
              first open, each carrying the SAME live content as its desktop panel. A tap on
              an item opens that item's content inline. */}
          <div className="sn-acc">
            {MENUS.map((m) => (
              <details key={m.key} className="sn-acc-item">
                <summary>{m.label}</summary>
                <div className="sn-acc-body">
                  {m.items.map((it, k) => (
                    <details key={it.key} className="sn-item" open={k === 0}>
                      <summary>{it.label}</summary>
                      <div className="sn-item-body">
                        <ItemBody menu={m} item={it} content={contentOf(m, it)} idPrefix="sn" onNavigate={closeMobile} />
                      </div>
                    </details>
                  ))}
                  <ul className="m-mega-more">
                    {m.more.map((r) => (
                      <li key={r.href}>
                        <a href={r.href} onClick={closeMobile}>
                          {r.label}
                        </a>
                      </li>
                    ))}
                  </ul>
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
