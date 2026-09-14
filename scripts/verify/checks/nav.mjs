// THE MENU IS A SURFACE ON EVERY PAGE, AND IT IS THE ONLY ONE A VISITOR OPERATES.
//
// Every other check reads served HTML. The mega menu is the one element on the site whose
// defects live in what happens AFTER the HTML arrives: a panel that opens 149px off a 1024
// screen, a trigger that navigates when it should open, a keyboard that can reach the
// triggers and nothing behind them, a phone panel 66px tall. All four shipped, and the
// 2026-09-10 audit (scratchpad/reports/home-menu-audit.md) found them by driving a browser
// because nothing else could. So this check drives one too.
//
// TWO HALVES.
//
//   STATIC, over five page types. The served HTML must carry three <button> triggers with
//   honest aria, three panels present-and-hidden, a CTA in every panel, a strip in every
//   panel that differs from the other two, every figure in a stated format, every hub with
//   its count, and every href resolving 200 without a redirect hop. Read from the same nav
//   on /, /streets, a hub, a street page and /listings, because the nav is rendered by
//   twenty-odd server components and a regression in one of them is invisible on the others.
//
//   INTERACTIVE, in a real browser, at 380, 1024 and 1440, on / and /streets: hover opens
//   with intent and closes on leave; click toggles; Enter and ArrowDown open AND move focus
//   into the panel; Escape closes AND returns focus to the trigger; an outside click closes;
//   an open panel sits entirely inside the viewport and needs no internal scroll; no text
//   node inside it is below 14px; the Buy panel shows photographs; the phone panel fills the
//   viewport and its accordions carry the same live content and the same links as the
//   desktop band.
//
//   THE RAIL, at every width. Each menu's rail item must change the right-hand panel: on
//   hover with intent and on focus at 1024 and 1440, on a tap at 380. Every item's panel must
//   carry at least one live block (a figure, cards, hubs, posters, letters, an edition, a
//   strip, a form) and its CTA. No rail item may lead to an empty panel, and the first item
//   must be the one selected before anybody touches anything.
//
//   THE CHROME BEFORE HYDRATION (MH-006, MA-004 change 5). With JavaScript off, at 380 the
//   burger opens a menu carrying the search and every destination, and the search form lands
//   on the street it names; at 1440 the bar search does the same. The served HTML must carry
//   the bar search, the compact menu, the skip link and the nav's label.
//
//   THE PAGE IN THE CHROME (changes 6 and 10). On a street page the bar CTA carries the
//   street and the strips name it; on a hub the CTA is the hub's valuation page and the
//   Streets strip is that hub's streets; every rail item carries a sub-label.
//
// A parser that reaches nothing must fail on its own coverage. Every count below is asserted
// against the number of pages or widths it was supposed to read.
import { get } from '../lib/http.mjs';

const WIDTHS = [
  { w: 380, h: 780, mobile: true },
  { w: 1024, h: 768, mobile: false },
  { w: 1440, h: 900, mobile: false },
];
const MENUS = ['buy', 'streets', 'sell'];
const MENU_INDEX = { buy: '/listings', streets: '/streets', sell: '/sell' };
/** The rail, as the brief states it. Open houses are absent on purpose: see megaLive.ts. */
const ITEMS = {
  buy: ['new', 'changes', 'condos', 'freehold', 'rentals', 'alerts'],
  streets: ['search', 'hoods', 'video', 'az'],
  sell: ['worth', 'soldmtd', 'watch'],
};
/** What counts as live content inside an item's panel. A CTA alone does not. */
const LIVE_BLOCK = '[data-fig], .m-mega-cards a, .m-mega-hubs a, .m-mega-frames a, .m-mega-az a, .m-mega-edition, .m-mega-strip a, .m-mega-figs dd, form.m-mega-search';
const TYPE_FLOOR_PX = 14;
/** The fixed bar's height; the phone panel sits under it. */
const BAR_PX = 66;

/** The <nav> element's own markup. */
function navMarkup(html) {
  const open = html.indexOf('<nav');
  if (open === -1) return '';
  const close = html.indexOf('</nav>', open);
  return close === -1 ? '' : html.slice(open, close + 6);
}

/** One panel's markup, by id. */
function panelMarkup(nav, key) {
  const m = nav.match(new RegExp(`<section\\b[^>]*id="m-mega-${key}"[^>]*>`));
  if (!m) return null;
  const from = m.index;
  const close = nav.indexOf('</section>', from);
  return { tag: m[0], body: close === -1 ? '' : nav.slice(from, close + 10) };
}

const hrefsIn = (html) => [...html.matchAll(/<a\b[^>]*\bhref="(\/[^"#]*)"/g)].map((m) => m[1]);

/** Every data-fig inside a chunk: { fig, slug, value, text }. */
function figures(html) {
  const out = [];
  for (const m of html.matchAll(/<([a-z]+)\b[^>]*\bdata-fig="([^"]+)"[^>]*>/g)) {
    const tag = m[0];
    const slug = tag.match(/\bdata-slug="([^"]*)"/);
    const value = tag.match(/\bdata-value="([^"]*)"/);
    const from = m.index + tag.length;
    const close = html.indexOf(`</${m[1]}>`, from);
    const inner = close === -1 ? '' : html.slice(from, close);
    out.push({
      fig: m[2],
      slug: slug ? slug[1] : null,
      value: value ? value[1] : null,
      text: inner.replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    });
  }
  return out;
}

const INT = /^[\d,]{1,7}$/;
const MONEY = /^(\$\d{1,3}(,\d{3})+|—)$/;
const DAYS = /^(\d{1,3} days?|—)$/;
const PCT = /^(\d{2,3}\.\d%|—)$/;
/** Every menu figure's stated format. A `menu-` figure with no entry here is a finding: a
 *  figure nobody declared a format for is a figure nobody is checking. */
const FIG_FORMAT = {
  'menu-buy-active': INT,
  'menu-buy-new': INT,
  'menu-buy-new24': INT,
  'menu-buy-changes': INT,
  'menu-buy-condos': INT,
  'menu-buy-freehold': INT,
  'menu-buy-rentals': INT,
  'menu-streets-pages': INT,
  'menu-streets-filmed': INT,
  'menu-streets-hubs': INT,
  'menu-hub-active': INT,
  'menu-sell-typical': MONEY,
  'menu-sell-days': DAYS,
  'menu-sell-sta': PCT,
  'menu-sell-days-lead': DAYS,
  'menu-sell-sta-lead': PCT,
  'menu-sold-mtd': INT,
  'menu-sold-mtd-typical': MONEY,
  'menu-mw-sales': INT,
  'menu-mw-new': INT,
};

// ── the browser half ─────────────────────────────────────────────────────────────────────

async function launchBrowser() {
  let puppeteer;
  try {
    puppeteer = (await import('puppeteer')).default;
  } catch (e) {
    throw new Error(`puppeteer is not installed: ${e.message}`);
  }
  const opts = { headless: 'new', args: ['--no-sandbox'] };
  try {
    return await puppeteer.launch(opts);
  } catch (e) {
    const fallback = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    return puppeteer.launch({ ...opts, executablePath: fallback });
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** aria-expanded of a trigger and whether its panel is showing. */
const state = (page, key) =>
  page.evaluate((k) => {
    const t = document.querySelector(`.m-navtrigger[aria-controls="m-mega-${k}"]`);
    const p = document.getElementById(`m-mega-${k}`);
    const band = document.querySelector('.m-band');
    return {
      expanded: t ? t.getAttribute('aria-expanded') : null,
      shown: !!(p && !p.hidden && band && getComputedStyle(band).display !== 'none'),
      focusInside: !!(p && document.activeElement && p.contains(document.activeElement)),
      focusOnTrigger: document.activeElement === t,
    };
  }, key);

/** Geometry and type of an OPEN panel. */
const measure = (page, key) =>
  page.evaluate(
    (k, floor) => {
      const p = document.getElementById(`m-mega-${k}`);
      const band = document.querySelector('.m-band');
      const r = p.getBoundingClientRect();
      const small = [];
      const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        if (!n.textContent.trim()) continue;
        const el = n.parentElement;
        const px = parseFloat(getComputedStyle(el).fontSize);
        if (px < floor) small.push(`${el.className || el.tagName} "${n.textContent.trim().slice(0, 24)}" ${px}px`);
      }
      const imgs = [...p.querySelectorAll('img')].map((i) => ({ complete: i.complete, w: i.naturalWidth }));
      return {
        left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom),
        vw: innerWidth, vh: innerHeight,
        bandScroll: band.scrollHeight, bandClient: band.clientHeight,
        small, imgs,
        cta: !!p.querySelector('.m-mega-cta'),
        strip: p.querySelectorAll('.m-mega-strip a').length,
      };
    },
    key,
    TYPE_FLOOR_PX,
  );

async function driveDesktop(page, url, w, h, findings) {
  const tag = `${w} ${url}`;
  await page.setViewport({ width: w, height: h });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  const trigger = (k) => `.m-navtrigger[aria-controls="m-mega-${k}"]`;

  // hover with intent: resting on the trigger opens, leaving the nav closes
  const buy = await page.$(trigger('buy'));
  const box = await buy.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await sleep(400);
  let s = await state(page, 'buy');
  if (!(s.shown && s.expanded === 'true')) findings.push(`${tag}: hover did not open Buy (shown=${s.shown}, aria-expanded=${s.expanded})`);
  let m = await measure(page, 'buy');
  if (m.right > m.vw || m.left < 0 || m.bottom > m.vh) findings.push(`${tag}: Buy panel ${m.left}..${m.right} x ${m.top}..${m.bottom} exceeds the ${m.vw}x${m.vh} viewport`);
  if (m.bandScroll > m.bandClient + 1) findings.push(`${tag}: Buy panel needs an internal scroll (${m.bandScroll} > ${m.bandClient})`);
  if (m.small.length) findings.push(`${tag}: Buy text below ${TYPE_FLOOR_PX}px: ${m.small.slice(0, 3).join(' · ')}`);
  if (!m.cta) findings.push(`${tag}: Buy panel has no CTA`);
  if (m.strip === 0) findings.push(`${tag}: Buy panel has no strip`);
  await sleep(600); // lazy photographs
  m = await measure(page, 'buy');
  const loaded = m.imgs.filter((i) => i.complete && i.w > 0).length;
  if (m.imgs.length === 0) findings.push(`${tag}: Buy panel shows no photographs`);
  else if (loaded === 0) findings.push(`${tag}: Buy panel photographs did not load (${m.imgs.length} img, 0 loaded)`);
  await page.mouse.move(w / 2, h - 40);
  await sleep(500);
  s = await state(page, 'buy');
  if (s.shown) findings.push(`${tag}: leaving the nav did not close Buy`);

  // the rail, on every menu
  for (const key of MENUS) {
    await page.click(trigger(key));
    await sleep(250);
    s = await state(page, key);
    if (!s.shown) { findings.push(`${tag}: click did not open ${key} for the rail check`); continue; }
    await driveRail(page, tag, key, findings);
    await page.keyboard.press('Escape');
    await sleep(200);
    await page.mouse.move(w / 2, h - 40);
    await sleep(300);
  }

  // click toggles; a second click closes
  await page.click(trigger('streets'));
  await sleep(250);
  s = await state(page, 'streets');
  if (!s.shown) findings.push(`${tag}: click did not open Streets`);
  m = await measure(page, 'streets');
  if (m.right > m.vw || m.left < 0 || m.bottom > m.vh) findings.push(`${tag}: Streets panel ${m.left}..${m.right} x ${m.top}..${m.bottom} exceeds the ${m.vw}x${m.vh} viewport`);
  if (m.bandScroll > m.bandClient + 1) findings.push(`${tag}: Streets panel needs an internal scroll (${m.bandScroll} > ${m.bandClient})`);
  if (m.small.length) findings.push(`${tag}: Streets text below ${TYPE_FLOOR_PX}px: ${m.small.slice(0, 3).join(' · ')}`);
  if (!m.cta) findings.push(`${tag}: Streets panel has no CTA`);
  await page.click(trigger('streets'));
  await sleep(250);
  s = await state(page, 'streets');
  if (s.shown) findings.push(`${tag}: second click did not close Streets`);

  // outside click closes
  await page.click(trigger('sell'));
  await sleep(250);
  s = await state(page, 'sell');
  if (!s.shown) findings.push(`${tag}: click did not open Sell`);
  m = await measure(page, 'sell');
  if (m.right > m.vw || m.left < 0 || m.bottom > m.vh) findings.push(`${tag}: Sell panel ${m.left}..${m.right} x ${m.top}..${m.bottom} exceeds the ${m.vw}x${m.vh} viewport`);
  if (m.small.length) findings.push(`${tag}: Sell text below ${TYPE_FLOOR_PX}px: ${m.small.slice(0, 3).join(' · ')}`);
  if (!m.cta) findings.push(`${tag}: Sell panel has no CTA`);
  // a mousedown on the document body, outside the nav; a real click at a coordinate could
  // land on a page link and navigate away
  await page.evaluate(() => document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  await sleep(300);
  s = await state(page, 'sell');
  if (s.shown) findings.push(`${tag}: outside click did not close Sell`);

  // keyboard: Enter opens and enters; Escape closes and returns; ArrowDown opens and enters
  await page.mouse.move(w / 2, h - 40);
  await page.focus(trigger('buy'));
  await page.keyboard.press('Enter');
  await sleep(250);
  s = await state(page, 'buy');
  if (!(s.shown && s.expanded === 'true')) findings.push(`${tag}: Enter did not open Buy`);
  if (!s.focusInside) findings.push(`${tag}: Enter opened Buy but focus stayed outside the panel`);
  await page.keyboard.press('Tab');
  await sleep(100);
  s = await state(page, 'buy');
  if (!s.focusInside) findings.push(`${tag}: Tab inside Buy left the panel`);
  await page.keyboard.press('Escape');
  await sleep(250);
  s = await state(page, 'buy');
  if (s.shown) findings.push(`${tag}: Escape did not close Buy`);
  if (!s.focusOnTrigger) findings.push(`${tag}: Escape closed Buy but focus did not return to the trigger`);
  await page.keyboard.press('ArrowDown');
  await sleep(250);
  s = await state(page, 'buy');
  if (!(s.shown && s.focusInside)) findings.push(`${tag}: ArrowDown did not open Buy and enter it (shown=${s.shown}, inside=${s.focusInside})`);
  await page.keyboard.press('Escape');
  await sleep(200);
}

/** The rail: every item selects its own panel on hover with intent and on focus, and no
 *  item's panel is empty. Runs with the menu already open. */
async function driveRail(page, tag, key, findings) {
  const items = ITEMS[key];
  const read = (item) =>
    page.evaluate(
      (k, it, all, liveSel) => {
        const tab = document.getElementById(`m-tab-${k}-${it}`);
        const panel = document.getElementById(`m-item-${k}-${it}`);
        const band = document.querySelector('.m-band');
        const r = panel ? panel.getBoundingClientRect() : null;
        return {
          selected: tab ? tab.getAttribute('aria-selected') : null,
          shown: !!(panel && !panel.hidden),
          othersShown: all.filter((o) => o !== it && !document.getElementById(`m-item-${k}-${o}`)?.hidden),
          live: panel ? panel.querySelectorAll(liveSel).length : 0,
          cta: !!panel?.querySelector('.m-mega-cta'),
          bottom: r ? Math.round(r.bottom) : 0,
          right: r ? Math.round(r.right) : 0,
          vw: innerWidth,
          vh: innerHeight,
          bandScroll: band.scrollHeight,
          bandClient: band.clientHeight,
        };
      },
      key,
      item,
      items,
      LIVE_BLOCK,
    );
  // the first item is selected before anything is touched
  let s = await read(items[0]);
  if (s.selected !== 'true' || !s.shown) findings.push(`${tag}: ${key} opened on "${items[0]}" selected=${s.selected} shown=${s.shown}, expected the first item`);
  // hover with intent selects each in turn
  for (const item of items) {
    const tab = await page.$(`#m-tab-${key}-${item}`);
    if (!tab) { findings.push(`${tag}: ${key} has no rail item "${item}"`); continue; }
    const box = await tab.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await sleep(320);
    s = await read(item);
    if (s.selected !== 'true' || !s.shown) findings.push(`${tag}: hovering ${key}/${item} did not select it (aria-selected=${s.selected}, shown=${s.shown})`);
    if (s.othersShown.length) findings.push(`${tag}: ${key}/${item} selected but ${s.othersShown.join(',')} still shown`);
    if (s.live === 0) findings.push(`${tag}: ${key}/${item} panel has no live content`);
    if (!s.cta) findings.push(`${tag}: ${key}/${item} panel has no CTA`);
    if (s.bottom > s.vh || s.right > s.vw) findings.push(`${tag}: ${key}/${item} panel runs to ${s.right}x${s.bottom} in a ${s.vw}x${s.vh} viewport`);
    if (s.bandScroll > s.bandClient + 1) findings.push(`${tag}: ${key}/${item} needs an internal scroll (${s.bandScroll} > ${s.bandClient})`);
  }
  // focus selects: ArrowDown from the last item wraps to the first, then walks
  await page.focus(`#m-tab-${key}-${items[items.length - 1]}`);
  await page.keyboard.press('ArrowDown');
  await sleep(150);
  s = await read(items[0]);
  if (s.selected !== 'true' || !s.shown) findings.push(`${tag}: ArrowDown on ${key}'s last item did not focus-select the first`);
  if (items.length > 1) {
    await page.keyboard.press('ArrowDown');
    await sleep(150);
    s = await read(items[1]);
    if (s.selected !== 'true' || !s.shown) findings.push(`${tag}: ArrowDown did not focus-select ${key}/${items[1]}`);
  }
}

/** THE SCROLLED HOMEPAGE (MH-006, MA-004 defects 1 and 11). Once the hero's search band passes
 *  under the bar, the nav search slides in. Measured on production at 390 it took the row and
 *  pushed the CTA and the burger off-screen; at 1440 it replaced the triggers with three
 *  invisible buttons still in the Tab order. So, after a scroll: below 820 the search must not
 *  be in the bar and the CTA and burger must sit inside the viewport; between 820 and 1023 the
 *  search takes the triggers' place and the triggers must be `visibility: hidden`, so a Tab
 *  from the logo lands on something visible; at 1024 and up the triggers and the search must
 *  BOTH be visible, and the row must not overflow. */
const SCROLL_WIDTHS = [
  { w: 380, h: 780 },
  { w: 900, h: 800 },
  { w: 1024, h: 768 },
  { w: 1440, h: 900 },
];
async function driveHomeScroll(page, url, w, h, findings) {
  const tag = `${w} ${url} scrolled`;
  await page.setViewport({ width: w, height: h });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.evaluate(() => window.scrollTo(0, 1400));
  await sleep(500);
  const r = await page.evaluate(() => {
    const vis = (el) => {
      if (!el) return false;
      const cs = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0.5 && b.width > 0 && b.height > 0;
    };
    const inView = (el) => {
      if (!el) return false;
      const b = el.getBoundingClientRect();
      return b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight;
    };
    const wrap = document.querySelector('nav .m-wrap');
    const triggers = [...document.querySelectorAll('nav .m-navtrigger')];
    const search = document.querySelector('nav .m-navsearch');
    const cta = document.querySelector('nav .m-navcta');
    const burger = document.querySelector('nav .sn-burger');
    // an invisible trigger must not be focusable: focus it and see whether focus took
    const invisibleFocusable = triggers.filter((t) => {
      if (vis(t)) return false;
      t.focus();
      const took = document.activeElement === t;
      t.blur();
      return took;
    }).length;
    return {
      overflow: wrap ? wrap.scrollWidth > wrap.clientWidth + 1 : null,
      triggersVisible: triggers.filter(vis).length,
      searchVisible: vis(search),
      ctaInView: vis(cta) && inView(cta),
      burgerVisible: vis(burger),
      burgerInView: vis(burger) && inView(burger),
      invisibleFocusable,
      searchInput: search ? search.querySelector('input')?.getAttribute('aria-label') || search.querySelector('label')?.textContent || '' : '',
    };
  });
  if (r.overflow) findings.push(`${tag}: the bar row overflows its wrap`);
  if (r.invisibleFocusable) findings.push(`${tag}: ${r.invisibleFocusable} invisible trigger(s) still take focus`);
  if (!r.ctaInView) findings.push(`${tag}: the bar CTA is not inside the viewport`);
  if (w < 820) {
    if (r.searchVisible) findings.push(`${tag}: the scrolled-in search is in the bar below 820`);
    if (!r.burgerInView) findings.push(`${tag}: the burger is not inside the viewport`);
  } else if (w < 1024) {
    if (!r.searchVisible) findings.push(`${tag}: the search did not slide in`);
    if (r.triggersVisible) findings.push(`${tag}: ${r.triggersVisible} trigger(s) visible beside the search between 820 and 1023`);
  } else {
    if (!r.searchVisible) findings.push(`${tag}: the search did not slide in`);
    if (r.triggersVisible !== 3) findings.push(`${tag}: ${r.triggersVisible} of 3 triggers visible beside the search`);
    if (!r.searchInput) findings.push(`${tag}: the bar search input has no accessible name`);
  }
}

/** EVERY CTA, ON EVERY PAGE TYPE, AT 4.5:1 (MH-006, MA-004 defect 3). The panel CTA is one
 *  element with one rule, and on the street page it rendered white on bright green at 1.34:1
 *  because a page theme's `a { color: inherit }` tied with the nav's rule and won on order.
 *  Computed in the browser from the element's own colour and its own opaque background, on
 *  the bar CTA, every open panel's CTA at 1440, and every accordion CTA and the panel CTA at
 *  380. A rule that only one stylesheet order satisfies is a rule the next page breaks. */
const CTA_FLOOR = 4.5;
const CONTRAST_WIDTHS = [
  { w: 380, h: 780 },
  { w: 1440, h: 900 },
];
const NOSCRIPT_WIDTHS = [
  { w: 380, h: 780 },
  { w: 1440, h: 900 },
];
const CONTRAST_JS = `
  const lum = (r, g, b) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const rgb = (s) => { const m = s.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map(Number); return p.length === 4 && p[3] === 0 ? null : p; };
  const ratio = (fg, bg) => { const a = lum(...fg) + 0.05, b = lum(...bg) + 0.05; return a > b ? a / b : b / a; };
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c) return c; } return [255, 255, 255]; };
  const check = (el) => { const cs = getComputedStyle(el); const fg = rgb(cs.color) || [0, 0, 0]; return { text: el.textContent.trim().slice(0, 40), ratio: Math.round(ratio(fg, bgOf(el)) * 100) / 100, cls: el.className }; };
`;
async function driveContrast(page, url, w, h, findings) {
  const tag = `${w} ${url} contrast`;
  await page.setViewport({ width: w, height: h });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  const mobile = w < 820;
  if (mobile) {
    await page.click('.sn-burger');
    await sleep(400);
    await page.evaluate(() => { for (const d of document.querySelectorAll('.sn-panel details')) d.open = true; });
  } else {
    await page.click('.m-navtrigger[aria-controls="m-mega-buy"]');
    await sleep(250);
  }
  const rows = await page.evaluate(
    (js, isMobile) => {
      // eslint-disable-next-line no-new-func
      const check = new Function(`${js}; return check;`)();
      const sel = isMobile ? '.sn-panel .m-mega-cta, .sn-panel .sn-panel-cta, nav .m-navcta' : 'nav .m-navcta, .m-band .m-mega-cta';
      return [...document.querySelectorAll(sel)].map(check);
    },
    CONTRAST_JS,
    mobile,
  );
  if (rows.length < 3) findings.push(`${tag}: only ${rows.length} CTAs measured`);
  for (const r of rows) if (r.ratio < CTA_FLOOR) findings.push(`${tag}: "${r.text}" (${r.cls}) at ${r.ratio}:1`);
  if (mobile) await page.keyboard.press('Escape');
}

async function driveMobile(page, url, w, h, findings) {
  const tag = `${w} ${url}`;
  await page.setViewport({ width: w, height: h });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.click('.sn-burger');
  await sleep(400);
  const r = await page.evaluate(() => {
    const p = document.querySelector('.sn-panel');
    if (!p) return null;
    const b = p.getBoundingClientRect();
    return { top: Math.round(b.top), h: Math.round(b.height), w: Math.round(b.width), vw: innerWidth, vh: innerHeight, pos: getComputedStyle(p).position };
  });
  if (!r) { findings.push(`${tag}: burger did not open the panel`); return; }
  // under the 66px bar, not over it: the burger stays on screen as the close control
  if (r.pos !== 'fixed' || Math.abs(r.top - BAR_PX) > 2 || Math.abs(r.h - (r.vh - BAR_PX)) > 20 || r.w !== r.vw)
    findings.push(`${tag}: phone panel is ${r.w}x${r.h} at top ${r.top} (${r.pos}) in a ${r.vw}x${r.vh} viewport, expected under the ${BAR_PX}px bar`);
  const acc0 = await page.$('.sn-panel .sn-acc');
  if (!acc0) findings.push(`${tag}: the open phone panel did not swap the compact menu for the accordion`);

  // open every accordion and read the live content behind it
  const acc = await page.evaluate((floor) => {
    const out = { items: 0, leads: 0, cards: 0, cardImgs: 0, hubs: 0, figs: 0, ctas: 0, strips: 0, small: [] };
    for (const d of document.querySelectorAll('.sn-acc-item')) {
      d.open = true;
      out.items++;
    }
    const p = document.querySelector('.sn-panel');
    out.leads = p.querySelectorAll('.m-mega-lead').length;
    out.cards = p.querySelectorAll('.m-mega-cards a').length;
    out.cardImgs = p.querySelectorAll('.m-mega-cards img').length;
    out.hubs = p.querySelectorAll('.m-mega-hubs a').length;
    out.figs = p.querySelectorAll('.m-mega-figs dd[data-fig]').length;
    out.ctas = p.querySelectorAll('.m-mega-cta').length;
    out.strips = p.querySelectorAll('.m-mega-strip').length;
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (!n.textContent.trim()) continue;
      const px = parseFloat(getComputedStyle(n.parentElement).fontSize);
      if (px < floor) out.small.push(`${n.parentElement.className || n.parentElement.tagName} ${px}px`);
    }
    // the same links as the desktop band, which is in the DOM at every width
    const bandLinks = new Set([...document.querySelectorAll('.m-band a[href]')].map((a) => a.getAttribute('href')));
    const panelLinks = new Set([...p.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')));
    out.missing = [...bandLinks].filter((h) => !panelLinks.has(h));
    out.bandLinks = bandLinks.size;
    return out;
  }, TYPE_FLOOR_PX);
  if (acc.items !== 3) findings.push(`${tag}: ${acc.items} accordion items, expected 3`);

  // the rail on a phone: one <details> per item, the first open by default, a tap opens the
  // rest, and none is empty
  for (const key of MENUS) {
    const mk = MENUS.indexOf(key);
    for (const [k, item] of ITEMS[key].entries()) {
      const before = await page.evaluate((mi, idx) => {
        const menu = document.querySelectorAll('.sn-acc-item')[mi];
        const d = menu ? menu.querySelectorAll('.sn-item')[idx] : null;
        return d ? { open: d.open, label: d.querySelector('summary')?.textContent.trim() } : null;
      }, mk, k);
      if (!before) { findings.push(`${tag}: phone ${key} has no item #${k} (${item})`); continue; }
      if (k === 0 && !before.open) findings.push(`${tag}: phone ${key}'s first item "${before.label}" is not open by default`);
      if (k > 0 && before.open) findings.push(`${tag}: phone ${key}/${before.label} is open before being tapped`);
      if (k > 0) {
        const handle = await page.evaluateHandle((mi, idx) => document.querySelectorAll('.sn-acc-item')[mi].querySelectorAll('.sn-item')[idx].querySelector('summary'), mk, k);
        await handle.evaluate((el) => el.scrollIntoView({ block: 'center' }));
        await handle.click();
        await sleep(250);
      }
      const after = await page.evaluate((mi, idx, liveSel) => {
        const d = document.querySelectorAll('.sn-acc-item')[mi].querySelectorAll('.sn-item')[idx];
        return { open: d.open, live: d.querySelectorAll(liveSel).length, cta: !!d.querySelector('.m-mega-cta') };
      }, mk, k, LIVE_BLOCK);
      if (!after.open) findings.push(`${tag}: tapping phone ${key}/${item} did not open it`);
      if (after.live === 0) findings.push(`${tag}: phone ${key}/${item} has no live content`);
      if (!after.cta) findings.push(`${tag}: phone ${key}/${item} has no CTA`);
    }
  }
  if (acc.leads < 2) findings.push(`${tag}: phone accordions carry ${acc.leads} lead sentences`);
  if (acc.cards === 0) findings.push(`${tag}: phone Buy accordion has no listing cards`);
  if (acc.cardImgs === 0) findings.push(`${tag}: phone Buy accordion has no photographs`);
  if (acc.hubs === 0) findings.push(`${tag}: phone Streets accordion lists no neighbourhoods`);
  if (acc.figs !== 3) findings.push(`${tag}: phone Sell accordion has ${acc.figs} figures, expected 3`);
  if (acc.ctas < 3) findings.push(`${tag}: ${acc.ctas} CTAs across the phone accordions, expected 3`);
  if (acc.strips < 3) findings.push(`${tag}: ${acc.strips} strips across the phone accordions, expected 3`);
  if (acc.small.length) findings.push(`${tag}: phone text below ${TYPE_FLOOR_PX}px: ${acc.small.slice(0, 3).join(' · ')}`);
  if (acc.missing.length) findings.push(`${tag}: ${acc.missing.length} of ${acc.bandLinks} desktop links absent from the phone panel: ${acc.missing.slice(0, 4).join(' ')}`);

  await page.keyboard.press('Escape');
  await sleep(300);
  const still = await page.evaluate(() => {
    const d = document.querySelector('.sn-mobile');
    const p = document.querySelector('.sn-panel');
    return { open: d ? d.open : null, shown: !!(p && p.getBoundingClientRect().height > 0) };
  });
  if (still.open || still.shown) findings.push(`${tag}: Escape did not close the phone panel (open=${still.open}, shown=${still.shown})`);
}

/** THE CHROME WITH JAVASCRIPT OFF (MH-006, MA-004 change 5 and defect 6). Measured on
 *  production, the menu did not exist until hydration, four to ten seconds on a phone. Now
 *  the burger is a <summary> and the search is a real GET: with scripting disabled, a tap
 *  opens a menu with the search and every destination, and the search form lands on the
 *  street it names, at 380 through the panel and at 1440 through the bar. */
async function driveNoScript(page, url, w, h, streetSlug, findings) {
  const tag = `${w} ${url} no-js`;
  await page.setJavaScriptEnabled(false);
  try {
    await page.setViewport({ width: w, height: h });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    const mobile = w < 820;
    if (mobile) {
      await page.click('.sn-burger');
      await sleep(300);
      const r = await page.evaluate(() => {
        const d = document.querySelector('.sn-mobile');
        const p = document.querySelector('.sn-panel');
        const b = p ? p.getBoundingClientRect() : null;
        return {
          open: !!(d && d.open),
          shown: !!(b && b.height > 100 && b.width > 0),
          links: p ? p.querySelectorAll('a[href]').length : 0,
          search: !!p?.querySelector('form[action="/search"] input[name="q"]'),
          cta: !!p?.querySelector('.sn-panel-cta'),
        };
      });
      if (!r.open || !r.shown) findings.push(`${tag}: the burger did not open the panel without JavaScript (open=${r.open}, shown=${r.shown})`);
      if (r.links < 12) findings.push(`${tag}: the no-JS menu carries ${r.links} links, expected at least 12`);
      if (!r.search) findings.push(`${tag}: the no-JS menu has no search form posting to /search`);
      if (!r.cta) findings.push(`${tag}: the no-JS menu has no CTA`);
    }
    // the search: type the street's slug words and submit the form natively
    const input = mobile ? '.sn-panel form[action="/search"] input[name="q"]' : 'nav form.m-navsearch input[name="q"]';
    const el = await page.$(input);
    if (!el) { findings.push(`${tag}: no search input at ${input}`); return; }
    const q = streetSlug.replace(/-milton$/, '').replace(/-/g, ' ');
    await el.type(q);
    await Promise.all([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }), page.keyboard.press('Enter')]);
    const landed = new URL(page.url()).pathname;
    if (landed !== `/streets/${streetSlug}`) findings.push(`${tag}: searching "${q}" without JavaScript landed on ${landed}, expected /streets/${streetSlug}`);
  } catch (e) {
    findings.push(`${tag}: ${e.message.split('\n')[0]}`);
  } finally {
    await page.setJavaScriptEnabled(true);
  }
}

export default {
  id: 'nav',
  title: 'The menu opens, closes, fits, reads, and links, on every page type and at every width',
  wholeCorpusOnly: true,
  needsHubRecord: true,

  async finish(_rows, { base, slugs, hubRecord }) {
    const pages = ['/', '/streets', `/neighbourhoods/${hubRecord.publishedSlugs[0]}`, `/streets/${slugs[0]}`, '/listings'];
    const hubCount = hubRecord.publishedSlugs.length;

    // ── STATIC ─────────────────────────────────────────────────────────────────────
    const read = [];
    const nonButton = [], badAria = [], missingPanel = [], notHidden = [], noCta = [], noStrip = [], sameStrip = [];
    const badFig = [], hubMiss = [], redirectLinks = [], deadLinks = [], railBad = [], emptyItems = [];
    const chrome = [], contextBad = [], subMiss = [];
    const allHrefs = new Set();
    const hubSlug = hubRecord.publishedSlugs[0];
    for (const path of pages) {
      const r = await get(base + path);
      if (r.status !== 200) { read.push(`${path} -> ${r.status}`); continue; }
      const nav = navMarkup(r.body);
      read.push(`${path} ok`);

      // THE CHROME BEFORE HYDRATION, in the served HTML: the nav's label, the skip link, the
      // bar search as a real form, the phone menu as a <details> with a compact menu inside
      if (!/<nav\b[^>]*aria-label="/.test(nav)) chrome.push(`${path}: <nav> has no aria-label`);
      if (!/class="sn-skip"/.test(nav)) chrome.push(`${path}: no skip link`);
      if (!/<form\b[^>]*class="m-navsearch[^"]*"[^>]*action="\/search"[^>]*method="get"/.test(nav)) chrome.push(`${path}: the bar search is not a GET form to /search`);
      if (!/<details\b[^>]*class="sn-mobile"/.test(nav)) chrome.push(`${path}: the phone menu is not a <details>`);
      if (!/<summary\b[^>]*class="sn-burger"/.test(nav)) chrome.push(`${path}: the burger is not a <summary>`);
      const compactAt = nav.indexOf('class="sn-compact"');
      const compact = compactAt === -1 ? '' : nav.slice(compactAt, nav.indexOf('</details>', compactAt));
      if (!compact) chrome.push(`${path}: no compact menu in the served HTML`);
      else {
        if (hrefsIn(compact).length < 12) chrome.push(`${path}: the compact menu carries ${hrefsIn(compact).length} links`);
        if (!/action="\/search"/.test(compact)) chrome.push(`${path}: the compact menu has no search form`);
      }
      // /saved is a sign-in wall: it left the nav
      if (hrefsIn(nav).includes('/saved')) chrome.push(`${path}: the nav still links /saved`);

      // THE PAGE IN THE CHROME: the CTA and the strips follow the street or the hub
      const barCta = (nav.match(/<a\b[^>]*class="m-navcta"[^>]*href="([^"]+)"/) || [])[1] || '';
      const stripLabels = [...nav.matchAll(/<div class="m-mega-strip"><span class="m-mega-label">([^<]+)</g)].map((m) => m[1]);
      if (path.startsWith('/streets/')) {
        if (!barCta.startsWith('/sell?street=')) contextBad.push(`${path}: bar CTA is ${barCta || 'absent'}, expected /sell?street=`);
        if (!stripLabels.some((l) => /^(Streets that meet|Most sales in) /.test(l))) contextBad.push(`${path}: no strip names the street's neighbours or its hub (${stripLabels.join(' | ')})`);
      } else if (path.startsWith('/neighbourhoods/')) {
        if (barCta !== `/value/${hubSlug}`) contextBad.push(`${path}: bar CTA is ${barCta || 'absent'}, expected /value/${hubSlug}`);
        if (!stripLabels.some((l) => l.startsWith('Streets in '))) contextBad.push(`${path}: no strip is the hub's streets (${stripLabels.join(' | ')})`);
      } else if (barCta !== '/sell') contextBad.push(`${path}: bar CTA is ${barCta}, expected /sell`);
      // the rail reads at a glance: a sub-label on the tabs
      const tabs = (nav.match(/<button\b[^>]*role="tab"/g) || []).length;
      const subs = (nav.match(/class="m-mega-tabsub"/g) || []).length;
      if (subs < tabs - 1) subMiss.push(`${path}: ${subs} of ${tabs} rail tabs carry a sub-label`);
      const triggers = [...nav.matchAll(/<([a-z]+)\b[^>]*class="[^"]*m-navtrigger[^"]*"[^>]*>/g)];
      if (triggers.length !== 3) nonButton.push(`${path}: ${triggers.length} triggers`);
      for (const t of triggers) {
        if (t[1] !== 'button') nonButton.push(`${path}: trigger is <${t[1]}>`);
        if (!/aria-expanded="false"/.test(t[0]) || !/aria-controls="m-mega-(buy|streets|sell)"/.test(t[0])) badAria.push(`${path}: ${t[0].slice(0, 80)}`);
      }
      const stripSets = [];
      for (const key of MENUS) {
        const p = panelMarkup(nav, key);
        if (!p) { missingPanel.push(`${path}: ${key}`); continue; }
        if (!/\bhidden\b/.test(p.tag)) notHidden.push(`${path}: ${key}`);
        // the rail: one <button role="tab"> per item, exactly one selected, and one tabpanel
        // per item with all but one hidden and none empty
        const tabs = [...p.body.matchAll(/<button\b[^>]*role="tab"[^>]*>/g)].map((m) => m[0]);
        const selectedTabs = tabs.filter((tb) => /aria-selected="true"/.test(tb)).length;
        if (tabs.length !== ITEMS[key].length || selectedTabs !== 1) railBad.push(`${path}: ${key} has ${tabs.length} tabs (${selectedTabs} selected), expected ${ITEMS[key].length} with 1`);
        let shownPanels = 0;
        for (const item of ITEMS[key]) {
          const m = p.body.match(new RegExp(`<div\\b[^>]*id="m-item-${key}-${item}"[^>]*>`));
          if (!m) { railBad.push(`${path}: ${key}/${item} has no panel in the served HTML`); continue; }
          if (!/\bhidden\b/.test(m[0])) shownPanels++;
          const from = m.index;
          const to = p.body.indexOf('m-mega-cta', from);
          const body = to === -1 ? '' : p.body.slice(from, to);
          const live = /data-fig=|m-mega-cards|m-mega-hubs|m-mega-frames|m-mega-az"|m-mega-edition|m-mega-strip|m-mega-figs|m-mega-search/.test(body);
          if (!live) emptyItems.push(`${path}: ${key}/${item}`);
          if (to === -1) emptyItems.push(`${path}: ${key}/${item} has no CTA`);
        }
        if (shownPanels !== 1) railBad.push(`${path}: ${key} serves ${shownPanels} visible item panels, expected 1`);
        // every item carries its own CTA; at least one of them is the menu's index page
        const ctas = [...p.body.matchAll(/<a\b[^>]*class="[^"]*m-mega-cta[^"]*"[^>]*href="([^"]+)"/g)].map((m) => m[1].replace(/[?#].*$/, ''));
        const indexOk = ctas.includes(MENU_INDEX[key]) || (key === 'sell' && ctas.some((c) => c.startsWith('/value/')));
        if (!indexOk) noCta.push(`${path}: ${key} CTAs ${ctas.join(' ') || 'absent'}, none is ${MENU_INDEX[key]}`);
        const stripAt = p.body.indexOf('m-mega-strip');
        const strip = stripAt === -1 ? '' : p.body.slice(stripAt);
        const stripLinks = hrefsIn(strip).filter((h) => h.startsWith('/streets/'));
        if (stripLinks.length === 0) noStrip.push(`${path}: ${key}`);
        stripSets.push(stripLinks.join(' '));
        for (const h of hrefsIn(p.body)) allHrefs.add(h);
      }
      if (stripSets.length === 3 && (stripSets[0] === stripSets[1] || stripSets[1] === stripSets[2] || stripSets[0] === stripSets[2]))
        sameStrip.push(path);
      const figs = figures(nav);
      for (const f of figs) {
        if (!f.fig.startsWith('menu-')) continue;
        const fmt = FIG_FORMAT[f.fig];
        if (!fmt) { badFig.push(`${path}: ${f.fig} has no stated format`); continue; }
        if (!fmt.test(f.text)) badFig.push(`${path}: ${f.fig} "${f.text}"`);
        if (f.value !== null && f.value !== f.text) badFig.push(`${path}: ${f.fig} text "${f.text}" != data-value "${f.value}"`);
      }
      const hubs = figs.filter((f) => f.fig === 'menu-hub-active').length;
      if (hubs !== hubCount) hubMiss.push(`${path}: ${hubs} hub counts, expected ${hubCount}`);
      for (const bad of ['/map', '/book']) if (hrefsIn(nav).includes(bad)) deadLinks.push(`${path}: ${bad} is a redirect, not a destination`);
    }
    // every panel href resolves 200 with no hop, fetched once per unique href
    const hrefs = [...allHrefs];
    let i = 0;
    await Promise.all(Array.from({ length: 8 }, async () => {
      while (i < hrefs.length) {
        const h = hrefs[i++];
        const r = await get(base + h);
        if (r.status >= 300 && r.status < 400) redirectLinks.push(`${h} -> ${r.status}`);
        else if (r.status !== 200) deadLinks.push(`${h} -> ${r.status}`);
      }
    }));

    // ── INTERACTIVE ────────────────────────────────────────────────────────────────
    const findings = [];
    let runs = 0;
    let browserError = null;
    try {
      const browser = await launchBrowser();
      try {
        const page = await browser.newPage();
        for (const path of ['/', '/streets']) {
          for (const v of WIDTHS) {
            if (v.mobile) await driveMobile(page, base + path, v.w, v.h, findings);
            else await driveDesktop(page, base + path, v.w, v.h, findings);
            runs++;
          }
        }
        for (const v of SCROLL_WIDTHS) {
          await driveHomeScroll(page, base + '/', v.w, v.h, findings);
          runs++;
        }
        for (const path of pages) {
          for (const v of CONTRAST_WIDTHS) {
            await driveContrast(page, base + path, v.w, v.h, findings);
            runs++;
          }
        }
        for (const v of NOSCRIPT_WIDTHS) {
          await driveNoScript(page, base + '/streets', v.w, v.h, slugs[0], findings);
          runs++;
        }
      } finally {
        await browser.close();
      }
    } catch (e) {
      browserError = e.message;
    }
    const expectedRuns = 2 * WIDTHS.length + SCROLL_WIDTHS.length + pages.length * CONTRAST_WIDTHS.length + NOSCRIPT_WIDTHS.length;

    return {
      coverage: [
        ['page types read', read.join(' · ')],
        ['unique panel hrefs resolved', hrefs.length],
        ['browser runs (page × width)', `${runs} of ${expectedRuns}${browserError ? ` · browser: ${browserError}` : ''}`],
        ['published hubs (record)', hubCount],
      ],
      assertions: [
        ['page types read == requested', read.filter((x) => x.endsWith('ok')).length, pages.length],
        ['menu triggers rendered as <button> with aria', nonButton.length + badAria.length, 0],
        ['panels present in served HTML and closed with hidden', missingPanel.length + notHidden.length, 0],
        ['every panel carries its index CTA', noCta.length, 0],
        ['rail tabs and item panels served as stated (one selected, one visible)', railBad.length, 0],
        ['rail items whose served panel is empty', emptyItems.length, 0],
        ['every panel carries a strip', noStrip.length, 0],
        ['pages whose three strips are not all different', sameStrip.length, 0],
        ['menu figures in the wrong format', badFig.length, 0],
        ['pages missing a hub count', hubMiss.length, 0],
        ['panel hrefs that redirect', redirectLinks.length, 0],
        ['panel hrefs that fail', deadLinks.length, 0],
        ['served chrome lacks the label, the skip link, the bar search form, the <details> menu or its compact menu', chrome.length, 0],
        ['pages whose CTA or strips do not follow the street or the hub', contextBad.length, 0],
        ['pages whose rail tabs lack sub-labels', subMiss.length, 0],
        ['browser runs completed', runs, expectedRuns],
        ['interaction findings (hover, click, keyboard, rail, geometry, type, photos, phone, scrolled bar, CTA contrast, no-JS)', findings.length, 0],
      ],
      examples: [...chrome, ...contextBad, ...subMiss, 
        ...nonButton, ...badAria, ...missingPanel, ...notHidden, ...noCta, ...noStrip,
        ...sameStrip.map((p) => `identical strips on ${p}`),
        ...railBad, ...emptyItems, ...badFig, ...hubMiss, ...redirectLinks, ...deadLinks, ...findings,
      ],
    };
  },
};
