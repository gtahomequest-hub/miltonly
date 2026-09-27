#!/usr/bin/env node
// MA-004. Read-only audit of the header, mega menu and footer on a live host, with Puppeteer.
//
//   BASE=https://miltonly.com node scripts/audit/nav-footer.mjs [--out=<dir>] [--only=key,key] [--widths=1440,1024,390]
//
// For each page in nav-pages.json, at 1440x900, 1024x768 and 390x844 (iPhone-class, DPR 3, touch,
// mobile UA), it records: the bar (height, position, fonts, contrast, targets), every link the header
// and footer serve, the menu's open behaviour on hover, click, keyboard and touch (time to open, panel
// fit, layout shift, focus order, Escape, outside click, scroll), every rail item's panel (opening
// sentence, figures, cards, links, CTA, forms), the 390 accordion, the footer (position, links, fonts,
// contrast, targets, forms), and the daily-brief form's submission with the request INTERCEPTED AND
// ABORTED so no lead is written. Output is one JSON per page per width plus screenshots.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.BASE || '').replace(/\/$/, '');
if (!BASE) { console.error('BASE is required'); process.exit(2); }
const OUT = (process.argv.find((a) => a.startsWith('--out=')) || '').slice(6) || path.join(HERE, '..', '..', 'scratchpad', 'audit', 'MA-004');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const widths = ((process.argv.find((a) => a.startsWith('--widths=')) || '').slice(9) || '1440,1024,390').split(',').map(Number);
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });

const PAGES = JSON.parse(fs.readFileSync(path.join(HERE, 'nav-pages.json'), 'utf8')).filter((p) => !only.length || only.includes(p.key));

const VIEWPORTS = {
  1440: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  1024: { width: 1024, height: 768, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  390: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// ── in-page helpers, injected once per page load ─────────────────────────────────────────
const HELPERS = `
  window.__a = (() => {
    const abs = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top + scrollY), left: Math.round(r.left + scrollX), w: Math.round(r.width), h: Math.round(r.height), vtop: Math.round(r.top), vleft: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom) }; };
    const txt = (el) => (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
    const q = (s, root = document) => Array.from(root.querySelectorAll(s));
    const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden]'); };
    const parseRgb = (s) => { const m = s && s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
    const firstGradientStop = (bi) => { const m = bi && bi.match(/rgba?\\([^)]+\\)/); return m ? parseRgb(m[0]) : null; };
    const effectiveBg = (el) => {
      let e = el; const stack = [];
      while (e && e !== document.documentElement) {
        const cs = getComputedStyle(e);
        const c = parseRgb(cs.backgroundColor);
        const g = cs.backgroundImage && cs.backgroundImage !== 'none' ? firstGradientStop(cs.backgroundImage) : null;
        if (g) { stack.push({ ...g, a: 1 }); break; }
        if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; }
        e = e.parentElement;
      }
      if (!stack.length || stack[stack.length - 1].a < 1) stack.push({ r: 255, g: 255, b: 255, a: 1 });
      let out = stack[stack.length - 1];
      for (let i = stack.length - 2; i >= 0; i--) { const c = stack[i]; out = { r: c.r * c.a + out.r * (1 - c.a), g: c.g * c.a + out.g * (1 - c.a), b: c.b * c.a + out.b * (1 - c.a), a: 1 }; }
      return out;
    };
    const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
    const contrast = (fg, bg) => { const a = lum(fg), b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
    const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
    // every element with a direct text node inside root: font size, weight, colour, effective bg, contrast
    const textNodes = (root) => {
      const out = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let n; const seen = new Set();
      while ((n = walker.nextNode())) {
        const t = n.textContent.replace(/\\s+/g, ' ').trim();
        if (!t) continue;
        const el = n.parentElement; if (!el || seen.has(el) || !visible(el)) continue;
        seen.add(el);
        const cs = getComputedStyle(el);
        const fg0 = parseRgb(cs.color) || { r: 0, g: 0, b: 0, a: 1 };
        const bg = effectiveBg(el);
        const fg = fg0.a < 1 ? { r: fg0.r * fg0.a + bg.r * (1 - fg0.a), g: fg0.g * fg0.a + bg.g * (1 - fg0.a), b: fg0.b * fg0.a + bg.b * (1 - fg0.a) } : fg0;
        const size = parseFloat(cs.fontSize);
        const weight = parseInt(cs.fontWeight, 10) || 400;
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        const ratio = contrast(fg, bg);
        out.push({ text: t.slice(0, 80), tag: el.tagName.toLowerCase(), cls: (el.className && String(el.className).slice(0, 60)) || '', size, weight, color: hex(fg), bg: hex(bg), ratio: Math.round(ratio * 100) / 100, aa: ratio >= (large ? 3 : 4.5), ...abs(el) });
      }
      return out;
    };
    const links = (root) => q('a[href]', root).map((a) => ({ href: a.getAttribute('href'), abs: a.href, text: txt(a).slice(0, 100) || (a.getAttribute('aria-label') || '') , ariaLabel: a.getAttribute('aria-label'), rel: a.getAttribute('rel'), target: a.getAttribute('target'), visible: visible(a), inHidden: !!a.closest('[hidden]'), ...abs(a) }));
    const targets = (root) => q('a[href], button, summary, input, [role="tab"]', root).filter(visible).map((el) => ({ tag: el.tagName.toLowerCase(), text: (txt(el) || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').slice(0, 60), cls: (el.className && String(el.className).slice(0, 50)) || '', ...abs(el) }));
    const focusables = (root) => q('a[href], button:not([disabled]), summary, input, select, textarea, [tabindex]', root).filter((el) => visible(el) && el.tabIndex >= 0);
    const desc = (el) => el ? ({ tag: el.tagName.toLowerCase(), id: el.id || '', cls: (el.className && String(el.className).slice(0, 50)) || '', text: (txt(el) || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').slice(0, 60), inNav: !!el.closest('nav, header'), inBand: !!el.closest('.m-band, .sn-panel') }) : null;
    return { abs, txt, q, visible, textNodes, links, targets, focusables, desc, effectiveBg, hex };
  })();
`;

async function inject(page) { await page.evaluate(HELPERS); }

function navRootSelector() {
  return 'nav.site-nav, nav.m-nav, header.sticky';
}

// ── static read: bar, links, fonts, targets, footer ─────────────────────────────────────
async function readStatic(page, vw) {
  return page.evaluate((vw) => {
    const A = window.__a;
    const nav = document.querySelector('nav.site-nav, nav.m-nav');
    const navy = document.querySelector('header.sticky');
    const roots = [nav, navy].filter(Boolean);
    const bar = roots.map((r) => {
      const cs = getComputedStyle(r);
      const inner = r.querySelector('.m-wrap') || r.firstElementChild;
      return { kind: r.classList.contains('site-nav') || r.classList.contains('m-nav') ? 'forest' : 'navy', position: cs.position, zIndex: cs.zIndex, top: cs.top, ...A.abs(inner || r), outer: A.abs(r), bg: A.hex(A.effectiveBg(inner || r)) };
    });
    const paint = performance.getEntriesByType('paint').reduce((m, e) => ({ ...m, [e.name]: Math.round(e.startTime) }), {});
    const navT = performance.getEntriesByType('navigation')[0];
    const timing = navT ? { ttfb: Math.round(navT.responseStart), domContentLoaded: Math.round(navT.domContentLoadedEventEnd), load: Math.round(navT.loadEventEnd), transferSize: navT.transferSize, encodedBodySize: navT.encodedBodySize, decodedBodySize: navT.decodedBodySize } : null;
    const footer = document.querySelector('footer');
    const docH = document.documentElement.scrollHeight;
    const allLinks = A.q('a[href]');
    const navLinks = roots.flatMap((r) => A.links(r));
    const footerLinks = footer ? A.links(footer) : [];
    const ctas = roots.flatMap((r) => A.q('a, button', r).filter(A.visible).map((el) => ({ tag: el.tagName.toLowerCase(), text: A.txt(el).slice(0, 60), href: el.getAttribute('href'), cls: (el.className && String(el.className).slice(0, 50)) || '', ...A.abs(el) })));
    const forms = A.q('form').map((f) => ({ cls: String(f.className).slice(0, 50), role: f.getAttribute('role'), inNav: !!f.closest('nav, header'), inFooter: !!f.closest('footer'), inHidden: !!f.closest('[hidden]'), inputs: A.q('input', f).map((i) => ({ type: i.type, name: i.name, placeholder: i.placeholder, required: i.required, labelled: !!(i.id && document.querySelector('label[for="' + i.id + '"]')) || !!i.getAttribute('aria-label') })), submit: A.txt(f.querySelector('button[type="submit"]') || document.createElement('i')), visible: A.visible(f), ...A.abs(f) }));
    const jsonld = A.q('script[type="application/ld+json"]').map((s) => { try { return JSON.parse(s.textContent); } catch { return null; } });
    const types = []; const walk = (o) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk); if (o['@type']) types.push(String(o['@type'])); Object.values(o).forEach(walk); }; walk(jsonld);
    const heads = A.q('h1,h2,h3,h4,h5,h6').filter((h) => h.closest('nav, header.sticky, footer')).map((h) => ({ level: Number(h.tagName[1]), text: A.txt(h).slice(0, 80), where: h.closest('footer') ? 'footer' : 'header' }));
    const skip = A.q('a[href^="#"]').find((a) => /skip/i.test(A.txt(a)));
    return {
      bar, timing, paint, docH, vw,
      counts: { allLinks: allLinks.length, allUnique: new Set(allLinks.map((a) => a.href)).size, navLinks: navLinks.length, navUnique: new Set(navLinks.map((a) => a.abs)).size, footerLinks: footerLinks.length, footerUnique: new Set(footerLinks.map((a) => a.abs)).size },
      navLinks, footerLinks, ctas, forms, jsonldTypes: [...new Set(types)], chromeHeadings: heads,
      footer: footer ? { ...A.abs(footer), bg: A.hex(A.effectiveBg(footer)), screens: Math.round((A.abs(footer).top / vw.height) * 10) / 10, text: A.textNodes(footer), targets: A.targets(footer), headings: A.q('h1,h2,h3,h4,h5,h6,p.uppercase, .m-fhoods h4, .m-fcol h4', footer).map((h) => ({ tag: h.tagName.toLowerCase(), text: A.txt(h).slice(0, 60) })) } : null,
      navText: roots.flatMap((r) => A.textNodes(r)),
      navTargets: roots.flatMap((r) => A.targets(r)),
      skipLink: !!skip,
      navTags: A.q('nav').map((n) => ({ cls: String(n.className).slice(0, 40), label: n.getAttribute('aria-label') })),
      headerTags: A.q('header').map((n) => ({ cls: String(n.className).slice(0, 40) })),
      footerTags: A.q('footer').length,
    };
  }, vw);
}

// ── hydration: when the trigger button gets a React fiber ───────────────────────────────
async function waitHydrated(page, sel, timeout = 20000) {
  return page.evaluate(async (sel, timeout) => {
    const t0 = performance.now();
    const isHyd = () => { const el = document.querySelector(sel); return !!el && Object.keys(el).some((k) => k.startsWith('__reactFiber')); };
    while (performance.now() - t0 < timeout) { if (isHyd()) return Math.round(performance.now()); await new Promise((r) => setTimeout(r, 25)); }
    return -1;
  }, sel, timeout);
}

async function awaitAttr(page, sel, attr, value, timeout = 3000) {
  return page.evaluate((sel, attr, value, timeout) => new Promise((res) => {
    const el = document.querySelector(sel); if (!el) return res({ ok: false, ms: -1 });
    const t0 = performance.now();
    if (el.getAttribute(attr) === value) return res({ ok: true, ms: 0 });
    const mo = new MutationObserver(() => { if (el.getAttribute(attr) === value) { mo.disconnect(); res({ ok: true, ms: Math.round(performance.now() - t0) }); } });
    mo.observe(el, { attributes: true });
    setTimeout(() => { mo.disconnect(); res({ ok: el.getAttribute(attr) === value, ms: -1 }); }, timeout);
  }), sel, attr, value, timeout);
}

async function panelState(page, key) {
  return page.evaluate((key) => {
    const A = window.__a;
    const sec = document.getElementById(`m-mega-${key}`); if (!sec) return null;
    const band = document.querySelector('.m-band');
    const open = !sec.hidden;
    const r = A.abs(sec); const b = band ? A.abs(band) : null;
    const main = sec.querySelector('.m-mega-main');
    const inner = sec.querySelector('.m-mega-in');
    const bandCs = band ? getComputedStyle(band) : null;
    const overflowX = document.documentElement.scrollWidth > innerWidth;
    const selTab = sec.querySelector('[role="tab"][aria-selected="true"]');
    const selPanel = sec.querySelector('[role="tabpanel"]:not([hidden])');
    const lead = selPanel && selPanel.querySelector('.m-mega-lead');
    return {
      open, rect: r, band: b, bandMaxH: bandCs ? bandCs.maxHeight : null, bandOverflowY: bandCs ? bandCs.overflowY : null, bandPos: bandCs ? bandCs.position : null,
      fitsBelow: b ? b.bottom <= innerHeight : null, fitsRight: b ? b.right <= innerWidth : null, overflowX,
      innerScroll: inner ? { sh: inner.scrollHeight, ch: inner.clientHeight } : null, bandScroll: band ? { sh: band.scrollHeight, ch: band.clientHeight } : null,
      selected: selTab ? A.txt(selTab) : null,
      lead: lead ? { text: A.txt(lead), isBlurb: lead.classList.contains('m-mega-blurb'), figs: A.q('[data-fig]', lead).map((f) => f.dataset.fig) } : null,
      text: A.textNodes(sec), targets: A.targets(sec), links: A.links(sec).filter((l) => l.visible),
      tabs: A.q('[role="tab"]', sec).map((t) => ({ text: A.txt(t), sel: t.getAttribute('aria-selected') === 'true', ...A.abs(t) })),
    };
  }, key);
}

async function itemDetail(page, key) {
  return page.evaluate((key) => {
    const A = window.__a;
    const sec = document.getElementById(`m-mega-${key}`); if (!sec) return null;
    const p = sec.querySelector('[role="tabpanel"]:not([hidden])'); if (!p) return null;
    const lead = p.querySelector('.m-mega-lead');
    const cta = p.querySelector('.m-mega-cta');
    const main = sec.querySelector('.m-mega-main');
    return {
      tab: A.txt(sec.querySelector('[role="tab"][aria-selected="true"]') || document.createElement('i')),
      lead: lead ? A.txt(lead) : null, isBlurb: !!(lead && lead.classList.contains('m-mega-blurb')),
      figures: A.q('.m-mega-figs > div', p).map((d) => A.txt(d)),
      cards: A.q('.m-mega-cards li', p).map((li) => ({ text: A.txt(li).slice(0, 120), href: li.querySelector('a')?.getAttribute('href'), img: !!li.querySelector('img'), imgSrc: li.querySelector('img')?.currentSrc?.slice(0, 120) || null, imgNatural: li.querySelector('img') ? [li.querySelector('img').naturalWidth, li.querySelector('img').naturalHeight] : null })),
      hubs: A.q('.m-mega-hubs li a', p).map((a) => ({ text: A.txt(a), href: a.getAttribute('href') })),
      videos: A.q('.m-mega-frames li a', p).map((a) => ({ text: A.txt(a), href: a.getAttribute('href') })),
      letters: A.q('.m-mega-az li', p).map((li) => ({ text: A.txt(li), link: !!li.querySelector('a'), href: li.querySelector('a')?.getAttribute('href') })),
      strip: p.querySelector('.m-mega-strip') ? { label: A.txt(p.querySelector('.m-mega-strip .m-mega-label')), items: A.q('.m-mega-strip li a', p).map((a) => ({ text: A.txt(a), href: a.getAttribute('href') })) } : null,
      edition: p.querySelector('.m-mega-edition') ? A.txt(p.querySelector('.m-mega-edition')) : null,
      note: p.querySelector('.m-mega-note') ? A.txt(p.querySelector('.m-mega-note')) : null,
      forms: A.q('form', p).map((f) => ({ label: A.txt(f.querySelector('label') || document.createElement('i')), placeholder: f.querySelector('input')?.placeholder, submit: A.txt(f.querySelector('button[type="submit"]') || document.createElement('i')) })),
      cta: cta ? { text: A.txt(cta), href: cta.getAttribute('href'), ...A.abs(cta) } : null,
      links: A.q('a[href]', p).length,
      panelRect: A.abs(p), mainScroll: main ? { sh: main.scrollHeight, ch: main.clientHeight } : null,
      ctaBelowFold: cta ? A.abs(cta).bottom > innerHeight : null,
      foot: A.q('.m-mega-foot a', sec).map((a) => ({ text: A.txt(a), href: a.getAttribute('href') })),
    };
  }, key);
}

async function layoutShiftStart(page) {
  await page.evaluate(() => {
    window.__cls = 0; window.__clsEntries = [];
    try { window.__po = new PerformanceObserver((l) => { for (const e of l.getEntries()) { if (!e.hadRecentInput) { window.__cls += e.value; window.__clsEntries.push({ v: e.value, t: Math.round(e.startTime) }); } } }); window.__po.observe({ type: 'layout-shift', buffered: false }); } catch {}
    const h1 = document.querySelector('main, h1, .s-hero, .m-hero, .hh-hero, article');
    window.__mark = h1 ? h1.getBoundingClientRect().top + scrollY : null;
    window.__docH = document.documentElement.scrollHeight;
  });
}
async function layoutShiftEnd(page) {
  return page.evaluate(() => {
    const h1 = document.querySelector('main, h1, .s-hero, .m-hero, .hh-hero, article');
    const now = h1 ? h1.getBoundingClientRect().top + scrollY : null;
    return { cls: Math.round((window.__cls || 0) * 1000) / 1000, entries: window.__clsEntries || [], markBefore: window.__mark, markAfter: now, shifted: window.__mark !== null && now !== null && Math.abs(now - window.__mark) > 1, docHBefore: window.__docH, docHAfter: document.documentElement.scrollHeight };
  });
}

async function focusDesc(page) { return page.evaluate(() => window.__a.desc(document.activeElement)); }

async function centre(page, sel) {
  const el = await page.$(sel); if (!el) return null;
  const b = await el.boundingBox(); if (!b) return null;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2, el };
}


// Reach an element the way a keyboard user does: click a neutral spot, then Tab until it has focus.
async function tabTo(page, sel, max = 12) {
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 250));
  // start from the logo, the first focusable in the bar, so every Tab is a real keystroke from there
  await page.evaluate(() => { const l = document.querySelector('nav .m-logo, header.sticky a[href="/"]'); if (l) l.focus(); });
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate((s) => document.activeElement === document.querySelector(s), sel)) return i + 1;
  }
  return -1;
}

// ── desktop menu behaviour ───────────────────────────────────────────────────────────────
async function desktopMenu(page, tag, shots) {
  const out = { present: false };
  const hasTrig = await page.$('.m-navtrigger');
  if (!hasTrig) return out;
  out.present = true;
  out.hydratedAt = await waitHydrated(page, '.m-navtrigger');
  const keys = await page.$$eval('.m-navtrigger', (els) => els.map((e) => e.getAttribute('aria-controls').replace('m-mega-', '')));
  out.menus = {};

  // 1. hover intent: a quick pass across the first trigger must not open it
  {
    const c = await centre(page, `.m-navtrigger[aria-controls="m-mega-${keys[0]}"]`);
    await page.mouse.move(c.x - 200, c.y + 200);
    await page.mouse.move(c.x, c.y, { steps: 2 });
    await page.mouse.move(c.x + 300, c.y + 400, { steps: 2 });
    await new Promise((r) => setTimeout(r, 400));
    out.passThroughOpened = await page.$eval(`.m-navtrigger[aria-controls="m-mega-${keys[0]}"]`, (e) => e.getAttribute('aria-expanded') === 'true');
    await page.mouse.move(5, 700);
    await new Promise((r) => setTimeout(r, 400));
  }

  for (const key of keys) {
    const m = {};
    const trig = `.m-navtrigger[aria-controls="m-mega-${key}"]`;
    // 2. hover opens
    const c = await centre(page, trig);
    await layoutShiftStart(page);
    await page.mouse.move(c.x, c.y - 300);
    await page.mouse.move(c.x, c.y);
    const t0 = Date.now();
    m.hover = await awaitAttr(page, trig, 'aria-expanded', 'true', 2000);
    m.hover.wall = Date.now() - t0;
    await new Promise((r) => setTimeout(r, 350));
    m.shift = await layoutShiftEnd(page);
    m.panel = await panelState(page, key);
    m.focusAfterHover = await focusDesc(page);
    await page.screenshot({ path: path.join(shots, `${tag}.menu-${key}.png`) });
    // 3. each rail item, selected by click
    m.items = [];
    const tabs = await page.$$(`#m-mega-${key} [role="tab"]`);
    for (const tb of tabs) {
      await tb.click();
      await new Promise((r) => setTimeout(r, 250));
      const d = await itemDetail(page, key);
      m.items.push(d);
      const label = (d && d.tab || 'x').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      await page.screenshot({ path: path.join(shots, `${tag}.menu-${key}.${label}.png`) });
    }
    // 4. mouse leaves the nav: closes after the grace period?
    await page.mouse.move(c.x, c.y + 600);
    await page.mouse.move(700, 700);
    const l0 = Date.now();
    m.leaveClose = await awaitAttr(page, trig, 'aria-expanded', 'false', 2000);
    m.leaveClose.wall = Date.now() - l0;
    if (!m.leaveClose.ok) { await page.keyboard.press('Escape'); await new Promise((r) => setTimeout(r, 200)); }
    // 5. click toggles
    await page.mouse.move(5, 700); await new Promise((r) => setTimeout(r, 300));
    await page.click(trig);
    m.clickOpen = await awaitAttr(page, trig, 'aria-expanded', 'true', 1500);
    await page.click(trig);
    m.clickClose = await awaitAttr(page, trig, 'aria-expanded', 'false', 1500);
    // 6. outside click closes
    await page.click(trig); await awaitAttr(page, trig, 'aria-expanded', 'true', 1500);
    await page.mouse.click(700, 800);
    m.outsideClose = await awaitAttr(page, trig, 'aria-expanded', 'false', 1500);
    await page.mouse.move(5, 700); await new Promise((r) => setTimeout(r, 300));
    // 7. keyboard: Tab to the trigger, Enter opens and moves focus in; Escape closes and returns focus
    m.tabsToTrigger = await tabTo(page, trig);
    await page.keyboard.press('Enter');
    m.enterOpen = await awaitAttr(page, trig, 'aria-expanded', 'true', 1500);
    await new Promise((r) => setTimeout(r, 150));
    m.focusAfterEnter = await focusDesc(page);
    await page.keyboard.press('Escape');
    m.escapeClose = await awaitAttr(page, trig, 'aria-expanded', 'false', 1500);
    m.focusAfterEscape = await focusDesc(page);
    // reopen and walk Tab through the panel, recording where focus goes and when it leaves
    await page.keyboard.press('Enter'); await awaitAttr(page, trig, 'aria-expanded', 'true', 1500);
    await new Promise((r) => setTimeout(r, 150));
    m.tabOrder = [];
    for (let i = 0; i < 70; i++) {
      await page.keyboard.press('Tab');
      const d = await focusDesc(page);
      const open = await page.$eval(trig, (e) => e.getAttribute('aria-expanded') === 'true');
      m.tabOrder.push({ ...d, open });
      if (!d || !d.inNav) break;
    }
    m.tabStepsInsidePanel = m.tabOrder.filter((t) => t.inBand).length;
    m.closedWhenFocusLeft = m.tabOrder.length ? !m.tabOrder[m.tabOrder.length - 1].open : null;
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.keyboard.press('Escape'); await new Promise((r) => setTimeout(r, 200));
    // 8. scroll closes
    await page.click(trig); await awaitAttr(page, trig, 'aria-expanded', 'true', 1500);
    await page.evaluate(() => window.scrollBy(0, 120));
    m.scrollClose = await awaitAttr(page, trig, 'aria-expanded', 'false', 1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.mouse.move(5, 700); await new Promise((r) => setTimeout(r, 300));
    out.menus[key] = m;
  }
  // 9. two triggers: ArrowRight from an open menu switches
  {
    const t1 = `.m-navtrigger[aria-controls="m-mega-${keys[0]}"]`;
    const t2 = `.m-navtrigger[aria-controls="m-mega-${keys[1]}"]`;
    await page.mouse.move(5, 300); await new Promise((r) => setTimeout(r, 300));
    await page.click(t1); await awaitAttr(page, t1, 'aria-expanded', 'true', 1500); // a click leaves focus on the trigger
    out.focusBeforeArrowRight = await focusDesc(page);
    await page.keyboard.press('ArrowRight');
    out.arrowRightSwitches = (await awaitAttr(page, t2, 'aria-expanded', 'true', 1500)).ok;
    await page.keyboard.press('Escape'); await new Promise((r) => setTimeout(r, 200));
  }
  // 10. scrolled 1200px: are the triggers still visible, hoverable and in the tab order?
  {
    await page.evaluate(() => window.scrollTo(0, 1200)); await new Promise((r) => setTimeout(r, 500));
    const trig = `.m-navtrigger[aria-controls="m-mega-${keys[0]}"]`;
    out.scrolled = await page.evaluate((s) => { const A = window.__a; const el = document.querySelector(s); const cs = getComputedStyle(el); const nav = el.closest('nav'); return { opacity: cs.opacity, pointerEvents: cs.pointerEvents, visible: A.visible(el) && cs.opacity !== '0', navPosition: getComputedStyle(nav).position, navTop: Math.round(nav.getBoundingClientRect().top), search: (() => { const f = document.querySelector('.m-navsearch'); return f ? { shown: f.classList.contains('m-show'), ariaHidden: f.getAttribute('aria-hidden') } : null; })() }; }, trig);
    const c = await centre(page, trig);
    if (c) { await page.mouse.move(c.x, c.y - 200); await page.mouse.move(c.x, c.y); out.scrolled.hoverOpens = (await awaitAttr(page, trig, 'aria-expanded', 'true', 1000)).ok; await page.mouse.move(700, 800); await new Promise((r) => setTimeout(r, 400)); }
    await page.evaluate(() => { const l = document.querySelector('nav .m-logo'); if (l) l.focus(); });
    out.scrolled.tabOrder = [];
    for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); const d = await page.evaluate(() => { const A = window.__a; const e = document.activeElement; const cs = e ? getComputedStyle(e) : null; return { ...A.desc(e), opacity: cs ? cs.opacity : null }; }); out.scrolled.tabOrder.push(d); }
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.scrollTo(0, 0)); await new Promise((r) => setTimeout(r, 400));
  }
  // 11. the bar's own CTA and search: what is in the tab order before the first trigger
  out.tabOrderFromTop = await page.evaluate(() => {
    const A = window.__a; const nav = document.querySelector('nav.site-nav, nav.m-nav, header.sticky'); if (!nav) return [];
    return A.focusables(nav).filter((el) => !el.closest('.m-band, .sn-panel')).map((el) => A.desc(el));
  });
  return out;
}

// ── mobile menu behaviour (390) ──────────────────────────────────────────────────────────
async function mobileMenu(page, tag, shots) {
  const out = { present: false };
  const forest = await page.$('.sn-burger');
  const navy = await page.$('header.sticky button[aria-label="Menu"]');
  const burger = forest ? '.sn-burger' : navy ? 'header.sticky button[aria-label="Menu"]' : null;
  if (!burger) return out;
  out.present = true; out.kind = forest ? 'forest' : 'navy';
  out.hydratedAt = await waitHydrated(page, burger);
  out.burgerRect = await page.$eval(burger, (e) => window.__a.abs(e));
  out.burgerLabel = await page.$eval(burger, (e) => e.getAttribute('aria-label'));
  await layoutShiftStart(page);
  const c = await centre(page, burger);
  const t0 = Date.now();
  await page.touchscreen.tap(c.x, c.y);
  if (forest) {
    out.open = await awaitAttr(page, burger, 'aria-expanded', 'true', 2000);
    await page.waitForSelector('.sn-panel', { timeout: 2000 }).catch(() => null);
  } else {
    await new Promise((r) => setTimeout(r, 300));
    out.open = { ok: !!(await page.$('header.sticky .lg\\:hidden.border-t')), ms: -1 };
  }
  out.open.wall = Date.now() - t0;
  await new Promise((r) => setTimeout(r, 400));
  out.shift = await layoutShiftEnd(page);
  out.state = await page.evaluate((forest) => {
    const A = window.__a;
    const panel = forest ? document.querySelector('.sn-panel') : document.querySelector('header.sticky .lg\\:hidden.border-t');
    if (!panel) return null;
    const cs = getComputedStyle(panel);
    return {
      rect: A.abs(panel), position: cs.position, overflowY: cs.overflowY, scroll: { sh: panel.scrollHeight, ch: panel.clientHeight }, bodyOverflow: document.body.style.overflow,
      role: panel.getAttribute('role'), modal: panel.getAttribute('aria-modal'),
      focus: A.desc(document.activeElement),
      overflowX: document.documentElement.scrollWidth > innerWidth,
      details: A.q('details', panel).map((d) => ({ cls: d.className, open: d.open, summary: A.txt(d.querySelector('summary')), ...A.abs(d.querySelector('summary')) })),
      text: A.textNodes(panel), targets: A.targets(panel), links: A.links(panel).filter((l) => l.visible).length, linksAll: A.links(panel).length,
      forms: A.q('form', panel).map((f) => ({ label: A.txt(f.querySelector('label') || document.createElement('i')), placeholder: f.querySelector('input')?.placeholder, submit: A.txt(f.querySelector('button[type="submit"]') || document.createElement('i')), visible: A.visible(f), ...A.abs(f) })),
      cta: (() => { const a = panel.querySelector('.sn-panel-cta, a.bg-\\[\\#f59e0b\\]'); return a ? { text: A.txt(a), href: a.getAttribute('href'), ...A.abs(a), belowFold: A.abs(a).bottom > innerHeight } : null; })(),
      firstScreenText: A.textNodes(panel).filter((t) => t.vtop < innerHeight).map((t) => t.text).slice(0, 30),
      visibleLinksFirstScreen: A.links(panel).filter((l) => l.visible && l.vtop >= 0 && l.bottom <= innerHeight).length,
    };
  }, !!forest);
  await page.screenshot({ path: path.join(shots, `${tag}.mobile-menu.png`) });
  if (forest) {
    // open each top-level menu (details) and record what the reader sees
    out.menus = [];
    const summaries = await page.$$('.sn-acc > details > summary');
    for (let i = 0; i < summaries.length; i++) {
      const s = summaries[i];
      await s.evaluate((el) => el.scrollIntoView({ block: 'start' }));
      const b = await s.boundingBox();
      if (b) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await new Promise((r) => setTimeout(r, 300));
      const d = await page.evaluate((i) => {
        const A = window.__a;
        const det = document.querySelectorAll('.sn-acc > details')[i];
        const body = det.querySelector('.sn-acc-body');
        const items = A.q(':scope > details', body).map((it) => ({ label: A.txt(it.querySelector('summary')), open: it.open, h: A.abs(it).h, sumRect: A.abs(it.querySelector('summary')), lead: (() => { const l = it.querySelector('.m-mega-lead'); return l ? A.txt(l) : null; })(), isBlurb: !!it.querySelector('.m-mega-blurb'), cards: it.querySelectorAll('.m-mega-cards li').length, links: it.querySelectorAll('a[href]').length, cta: (() => { const a = it.querySelector('.m-mega-cta'); return a ? { text: A.txt(a), href: a.getAttribute('href') } : null; })() }));
        return { label: A.txt(det.querySelector('summary')), open: det.open, bodyH: A.abs(body).h, items, more: A.q('.m-mega-more a', body).map((a) => A.txt(a)), panelScroll: { sh: document.querySelector('.sn-panel').scrollHeight, ch: document.querySelector('.sn-panel').clientHeight } };
      }, i);
      out.menus.push(d);
      await page.screenshot({ path: path.join(shots, `${tag}.mobile-menu-${i}.png`) });
      // close it again so the next measures alone
      if (b) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await new Promise((r) => setTimeout(r, 200));
    }
    await page.evaluate(() => document.querySelector('.sn-panel').scrollTo(0, 0));
    // focus trap: Tab from the last focusable wraps to the first
    out.trap = await page.evaluate(async () => {
      const A = window.__a; const panel = document.querySelector('.sn-panel');
      const f = A.focusables(panel); if (!f.length) return null;
      f[f.length - 1].focus();
      return { count: f.length, last: A.desc(f[f.length - 1]) };
    });
    await page.keyboard.press('Tab');
    out.trap.afterTabFromLast = await focusDesc(page);
    // Escape closes and returns focus to the burger
    await page.keyboard.press('Escape');
    out.escapeClose = await awaitAttr(page, burger, 'aria-expanded', 'false', 1500);
    out.focusAfterEscape = await focusDesc(page);
    out.bodyOverflowAfter = await page.evaluate(() => document.body.style.overflow);
  } else {
    // navy: tap outside, Escape
    await page.keyboard.press('Escape'); await new Promise((r) => setTimeout(r, 200));
    out.escapeCloses = !(await page.$('header.sticky .lg\\:hidden.border-t'));
    if (!out.escapeCloses) { await page.touchscreen.tap(200, 700); await new Promise((r) => setTimeout(r, 200)); out.outsideTapCloses = !(await page.$('header.sticky .lg\\:hidden.border-t')); }
    if (await page.$('header.sticky .lg\\:hidden.border-t')) { const c2 = await centre(page, burger); await page.touchscreen.tap(c2.x, c2.y); }
  }
  return out;
}

// ── the brief form, intercepted ──────────────────────────────────────────────────────────
async function briefForm(page, vw) {
  // The desktop panel's form or the mobile accordion's form. The POST is caught and aborted.
  const out = {};
  const formSel = vw.isMobile ? '.sn-panel form.m-mega-search:has(input[type="email"])' : '#m-mega-buy form.m-mega-search:has(input[type="email"])';
  let captured = null;
  const handler = (req) => {
    if (req.method() === 'POST' && /\/api\/leads\/create/.test(req.url())) { captured = { url: req.url(), body: req.postData() }; req.abort(); return; }
    if (req.isInterceptResolutionHandled()) return;
    req.continue();
  };
  await page.setRequestInterception(true);
  page.on('request', handler);
  try {
    if (vw.isMobile) {
      const c = await centre(page, '.sn-burger'); if (!c) return { present: false };
      await page.touchscreen.tap(c.x, c.y); await new Promise((r) => setTimeout(r, 400));
      const alerts = await page.$$('.sn-acc > details');
      // open Buy, then the Alerts item
      const buySum = await page.$('.sn-acc > details:nth-of-type(1) > summary'); if (buySum) { await buySum.evaluate((el) => { el.parentElement.open = true; }); }
      await page.evaluate(() => { const its = document.querySelectorAll('.sn-acc > details:nth-of-type(1) .sn-item'); its.forEach((d) => { if (/alerts/i.test(d.querySelector('summary').textContent)) d.open = true; }); });
      await new Promise((r) => setTimeout(r, 200));
    } else {
      const trig = '.m-navtrigger[aria-controls="m-mega-buy"]'; if (!(await page.$(trig))) return { present: false };
      await page.click(trig); await awaitAttr(page, trig, 'aria-expanded', 'true', 1500);
      const tab = await page.$('#m-tab-buy-alerts'); if (tab) await tab.click();
      await new Promise((r) => setTimeout(r, 250));
    }
    const form = await page.$(formSel);
    if (!form) return { present: false, formSel };
    out.present = true;
    out.rect = await form.evaluate((f) => window.__a.abs(f));
    out.belowFold = out.rect.bottom > vw.height;
    const input = await form.$('input[type="email"]');
    await input.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await input.click({ clickCount: 3 });
    await input.type('audit-ma004@example.invalid');
    const btn = await form.$('button[type="submit"]');
    await btn.click();
    await new Promise((r) => setTimeout(r, 1200));
    out.captured = captured ? { url: captured.url, body: (() => { try { return JSON.parse(captured.body); } catch { return captured.body; } })() } : null;
    out.after = await page.evaluate((sel) => { const A = window.__a; const f = document.querySelector(sel); const ok = document.querySelector('.m-mega-ok'); return { formStill: !!f, ok: ok ? A.txt(ok) : null, note: (() => { const n = (f || document).querySelector('.m-mega-note'); return n ? A.txt(n) : null; })() }; }, formSel);
  } finally {
    page.off('request', handler);
    await page.setRequestInterception(false);
    await page.keyboard.press('Escape').catch(() => {});
  }
  return out;
}

// ── main ─────────────────────────────────────────────────────────────────────────────────
const browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const summary = [];
try {
  for (const p of PAGES) {
    for (const w of widths) {
      const vw = VIEWPORTS[w];
      const tag = `${p.key}.${w}`;
      const page = await browser.newPage();
      await page.setViewport(vw);
      if (vw.isMobile) await page.setUserAgent(MOBILE_UA);
      const rec = { key: p.key, type: p.type, url: BASE + p.path, width: w, at: new Date().toISOString() };
      try {
        const t0 = Date.now();
        const res = await page.goto(BASE + p.path, { waitUntil: 'networkidle2', timeout: 90000 });
        rec.status = res?.status(); rec.wall = Date.now() - t0;
        rec.headers = { cache: res?.headers()['x-vercel-cache'], matched: res?.headers()['x-matched-path'] };
        await inject(page);
        rec.static = await readStatic(page, vw);
        rec.hydratedAt = await waitHydrated(page, '.m-navtrigger, .sn-burger, header.sticky button');
        await page.screenshot({ path: path.join(OUT, 'shots', `${tag}.bar.png`), clip: { x: 0, y: 0, width: vw.width, height: Math.min(140, vw.height) } });
        if (rec.static.footer) {
          await page.evaluate(() => document.querySelector('footer').scrollIntoView({ block: 'start' }));
          await new Promise((r) => setTimeout(r, 500));
          const fb = await page.$eval('footer', (f) => f.getBoundingClientRect().height);
          await page.screenshot({ path: path.join(OUT, 'shots', `${tag}.footer.png`), clip: { x: 0, y: 0, width: vw.width, height: Math.min(Math.round(fb) + 40, 4000) }, captureBeyondViewport: true }).catch(() => null);
          await page.evaluate(() => window.scrollTo(0, 0));
          await new Promise((r) => setTimeout(r, 300));
        }
        if (vw.isMobile) rec.mobile = await mobileMenu(page, tag, path.join(OUT, 'shots'));
        else rec.desktop = await desktopMenu(page, tag, path.join(OUT, 'shots'));
        // the brief form, on a fresh load so the interception is clean
        await page.goto(BASE + p.path, { waitUntil: 'networkidle2', timeout: 90000 });
        await inject(page); await waitHydrated(page, '.m-navtrigger, .sn-burger, header.sticky button');
        rec.brief = await briefForm(page, vw);
      } catch (e) {
        rec.error = String(e && e.stack || e);
      }
      fs.writeFileSync(path.join(OUT, `${tag}.json`), JSON.stringify(rec, null, 2));
      const s = rec.static || {};
      const line = `${tag.padEnd(14)} ${rec.status} ${String(rec.wall).padStart(5)}ms ttfb ${s.timing?.ttfb ?? '-'} fcp ${s.paint?.['first-contentful-paint'] ?? '-'} hyd ${rec.hydratedAt} bar ${s.bar?.map((b) => `${b.kind}:${b.h}px/${b.position}`).join(',') ?? '-'} nav ${s.counts?.navLinks}/${s.counts?.navUnique} foot ${s.counts?.footerLinks}/${s.counts?.footerUnique} all ${s.counts?.allLinks} footerTop ${s.footer ? s.footer.screens + 'scr' : 'none'}${rec.error ? ' ERROR ' + rec.error.split('\n')[0] : ''}`;
      console.log(line); summary.push(line);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(OUT, 'summary.txt'), summary.join('\n') + '\n');
