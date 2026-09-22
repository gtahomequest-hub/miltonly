#!/usr/bin/env node
// MA-005. Read-only audit of the neighbourhood hub page on a live host, with Puppeteer.
//
//   BASE=https://miltonly.com node scripts/audit/hub-page.mjs [--out=<dir>] [--only=slug,slug]
//
// The MA-001 street harness, pointed at /neighbourhoods/<slug> and taught the hub's own classes:
// the intent squares, the glance facts, the filmstrip, the ladder (row heights, basis wrap, screens
// occupied), the compare rows, the FAQ details, the sibling cards and the two closing CTA cards.
// Never submits a form, never edits anything. One JSON per hub per width plus the shots.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.BASE || '').replace(/\/$/, '');
if (!BASE) { console.error('BASE is required'); process.exit(2); }
const OUT = (process.argv.find((a) => a.startsWith('--out=')) || '').slice(6) || path.join(HERE, '..', '..', 'scratchpad', 'audit', 'MA-005');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
const HUBS = JSON.parse(fs.readFileSync(path.join(HERE, 'hubs.json'), 'utf8')).filter((s) => !only.length || only.includes(s.slug));

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  mobile: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function inspect(viewportHeight) {
  const abs = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top + scrollY), left: Math.round(r.left + scrollX), w: Math.round(r.width), h: Math.round(r.height) }; };
  const txt = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const q = (s, root = document) => Array.from(root.querySelectorAll(s));
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const empty = () => document.createElement('i');
  const fsz = (el) => parseFloat(getComputedStyle(el).fontSize);

  const head = {
    title: document.title, titleLen: document.title.length,
    description: document.querySelector('meta[name="description"]')?.content ?? null,
    canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
    robots: document.querySelector('meta[name="robots"]')?.content ?? null,
    ogTitle: document.querySelector('meta[property="og:title"]')?.content ?? null,
    ogDescription: document.querySelector('meta[property="og:description"]')?.content ?? null,
    ogImage: document.querySelector('meta[property="og:image"]')?.content ?? null,
    ogType: document.querySelector('meta[property="og:type"]')?.content ?? null,
    twitterCard: document.querySelector('meta[name="twitter:card"]')?.content ?? null,
    viewport: document.querySelector('meta[name="viewport"]')?.content ?? null,
    lang: document.documentElement.lang || null,
  };
  head.descriptionLen = head.description ? head.description.length : 0;

  const headings = q('h1,h2,h3,h4,h5,h6').map((h) => ({ level: Number(h.tagName[1]), text: txt(h).slice(0, 140), top: abs(h).top, hidden: !visible(h), fs: fsz(h) }));
  const jsonld = q('script[type="application/ld+json"]').map((s) => { try { return { ok: true, json: JSON.parse(s.textContent) }; } catch (e) { return { ok: false, error: String(e), raw: s.textContent.slice(0, 300) }; } });

  const origin = location.origin;
  const anchors = q('a[href]').map((a) => ({ href: a.href, text: txt(a).slice(0, 80), top: abs(a).top, w: abs(a).w, h: abs(a).h, visible: visible(a), inNav: !!a.closest('nav:not(.hh-crumb), header:not(.hh-hero)'), inFooter: !!a.closest('footer') }));
  const internal = anchors.filter((a) => a.href.startsWith(origin));
  const body = internal.filter((a) => !a.inNav && !a.inFooter);
  const external = anchors.filter((a) => !a.href.startsWith(origin) && /^https?:/.test(a.href));
  const linksOut = {
    total: anchors.length, internal: internal.length, internalUnique: new Set(internal.map((a) => a.href.split('#')[0])).size,
    bodyInternal: body.length, bodyUnique: new Set(body.map((a) => a.href.split('#')[0])).size,
    external: external.length, externalHosts: [...new Set(external.map((a) => new URL(a.href).host))],
    emptyText: anchors.filter((a) => !a.text).length,
    byPath: Object.entries(body.reduce((m, a) => { const p = new URL(a.href).pathname.split('/').slice(0, 2).join('/'); m[p] = (m[p] || 0) + 1; return m; }, {})),
    fragments: [...new Set(anchors.filter((a) => a.href.includes('#')).map((a) => a.href.slice(a.href.indexOf('#'))))],
    fragmentsMissing: [...new Set(anchors.filter((a) => a.href.includes('#') && a.href.split('#')[0] === location.href.split('#')[0]).map((a) => a.href.slice(a.href.indexOf('#') + 1)))].filter((id) => id && !document.getElementById(id)),
  };

  const images = q('img').map((i) => ({ src: (i.currentSrc || i.src || '').slice(0, 160), alt: i.getAttribute('alt'), hasAlt: i.hasAttribute('alt'), w: i.width, h: i.height, natural: [i.naturalWidth, i.naturalHeight], loading: i.loading, top: abs(i).top }));

  // The hub's own parts.
  const crumb = document.querySelector('.hh-crumb');
  const hero = document.querySelector('.hh-hero');
  const heroInfo = hero ? { ...abs(hero), h1: txt(hero.querySelector('h1') || empty()), h1fs: hero.querySelector('h1') ? fsz(hero.querySelector('h1')) : null, lede: txt(hero.querySelector('.hh-lede') || empty()), ledeFs: hero.querySelector('.hh-lede') ? fsz(hero.querySelector('.hh-lede')) : null, crumb: crumb ? txt(crumb) : null, bg: getComputedStyle(hero).backgroundColor } : null;
  const intents = q('.hh-intent').map((a) => ({ label: txt(a.querySelector('.hh-intent-l') || empty()), sub: txt(a.querySelector('.hh-intent-s') || empty()), href: a.getAttribute('href'), ...abs(a), screens: +(abs(a).top / viewportHeight).toFixed(2), subFs: a.querySelector('.hh-intent-s') ? fsz(a.querySelector('.hh-intent-s')) : null, visible: visible(a) }));
  const facts = q('.hh-fact').map((f) => ({ tag: f.tagName.toLowerCase(), href: f.getAttribute('href'), value: txt(f.querySelector('.hh-fact-v') || empty()), label: txt(f.querySelector('.hh-fact-l') || empty()), basis: txt(f.querySelector('.hh-fact-b') || empty()), ...abs(f), screens: +(abs(f).top / viewportHeight).toFixed(2), valueFs: f.querySelector('.hh-fact-v') ? fsz(f.querySelector('.hh-fact-v')) : null, basisFs: f.querySelector('.hh-fact-b') ? fsz(f.querySelector('.hh-fact-b')) : null }));
  const film = q('.hh-filmstrip li').map((li) => ({ name: txt(li.querySelector('.hh-framename') || empty()), date: txt(li.querySelector('.hh-framedate') || empty()), href: li.querySelector('a')?.getAttribute('href'), img: li.querySelector('img')?.currentSrc?.slice(0, 120), natural: li.querySelector('img') ? [li.querySelector('img').naturalWidth, li.querySelector('img').naturalHeight] : null, ...abs(li) }));
  const filmstrip = document.querySelector('.hh-filmstrip');
  const filmInfo = filmstrip ? { ...abs(filmstrip), overflowX: filmstrip.scrollWidth > filmstrip.clientWidth + 2, scrollWidth: filmstrip.scrollWidth, items: film.length, visibleItems: film.filter((f) => f.left + f.w <= innerWidth).length } : null;
  const ladderEl = document.querySelector('.hh-ladder');
  const rows = q('.hh-ladder > li').map((li, i) => {
    const a = li.querySelector('a');
    const name = li.querySelector('.hh-ladname'), price = li.querySelector('.hh-ladprice'), basis = li.querySelector('.hh-ladbasis'), sales = li.querySelector('.hh-ladsales'), bar = li.querySelector('.hh-ladbar'), rank = li.querySelector('.hh-ladrank');
    return { i: i + 1, name: txt(name), href: a?.getAttribute('href'), sales: txt(sales), price: txt(price), silent: !!li.querySelector('.hh-ladsilent'), basis: txt(basis), filmed: !!li.querySelector('.hh-ladfilm'), ...abs(li),
      nameFs: name ? fsz(name) : null, priceFs: price ? fsz(price) : null, basisFs: basis ? fsz(basis) : null, salesFs: sales ? fsz(sales) : null, rankFs: rank ? fsz(rank) : null,
      basisLines: basis ? Math.round(abs(basis).h / (parseFloat(getComputedStyle(basis).lineHeight) || fsz(basis) * 1.3)) : null, barVisible: bar ? visible(bar) : false, barW: bar ? abs(bar).w : 0,
      priceLeft: price ? abs(price).left : null, nameLeft: name ? abs(name).left : null, basisColor: basis ? getComputedStyle(basis).color : null };
  });
  const ladder = ladderEl ? { ...abs(ladderEl), rows: rows.length, silent: rows.filter((r) => r.silent).length, filmed: rows.filter((r) => r.filmed).length, screens: +(abs(ladderEl).h / viewportHeight).toFixed(1), rowHmin: Math.min(...rows.map((r) => r.h)), rowHmax: Math.max(...rows.map((r) => r.h)), rowHavg: Math.round(rows.reduce((s, r) => s + r.h, 0) / Math.max(rows.length, 1)), overflowX: ladderEl.scrollWidth > ladderEl.clientWidth + 2, sample: rows.slice(0, 3), silentSample: rows.filter((r) => r.silent).slice(0, 2), sortedBySales: rows.every((r, i) => i === 0 || parseInt(rows[i - 1].sales) >= parseInt(r.sales)), allRows: rows.map((r) => ({ i: r.i, name: r.name, sales: r.sales, price: r.price, silent: r.silent, filmed: r.filmed, h: r.h, basisLines: r.basisLines })) } : null;
  const compare = q('.hh-comparerow').map((r) => ({ label: txt(r.querySelector('.hh-comparel') || empty()).slice(0, 200), value: txt(r.querySelector('.hh-comparev') || empty()), milton: txt(r.querySelector('.hh-comparem') || empty()), delta: txt(r.querySelector('.hh-compared') || empty()), ...abs(r), basisFs: r.querySelector('.hh-compareb') ? fsz(r.querySelector('.hh-compareb')) : null }));
  const market = document.querySelector('.hh-market');
  const marketInfo = market ? { ...abs(market), standfirst: txt(market.querySelector('.hh-headmain p') || empty()), paras: q('.hh-prose p', market).map((p) => txt(p).slice(0, 400)), source: txt(market.querySelector('.hh-source') || empty()), sourceFs: market.querySelector('.hh-source') ? fsz(market.querySelector('.hh-source')) : null, compare } : null;
  const overview = q('.hh-overview .hh-prose p').map((p) => txt(p));
  const schools = q('.hh-schoollist li').map((li) => ({ name: txt(li.querySelector('.hh-schoolname') || empty()), meta: txt(li.querySelector('.hh-schoolmeta') || empty()), href: li.querySelector('a')?.getAttribute('href'), ...abs(li) }));
  const condos = q('.hh-condolist li').map((li) => ({ name: txt(li.querySelector('.hh-condoname') || empty()), meta: txt(li.querySelector('.hh-condoaddr') || empty()), href: li.querySelector('a')?.getAttribute('href'), ...abs(li) }));
  const faqs = q('.hh-faqlist details').map((d) => ({ q: txt(d.querySelector('summary') || empty()), a: txt(d.querySelector('p') || empty()).slice(0, 500), open: d.open, ...abs(d), summaryH: abs(d.querySelector('summary')).h }));
  const guidesEl = q('section, div').find((s) => /guide/i.test(s.className || '') && s.querySelector('a[href^="/guides"]'));
  const guides = guidesEl ? { cls: guidesEl.className, ...abs(guidesEl), heading: txt(guidesEl.querySelector('h2,h3') || empty()), links: q('a[href^="/guides"]', guidesEl).map((a) => ({ text: txt(a).slice(0, 80), href: a.getAttribute('href') })) } : null;
  const siblings = q('.hh-sib').map((a) => ({ name: txt(a.querySelector('.hh-sibname') || empty()), dist: txt(a.querySelector('.hh-sibdist') || empty()), price: txt(a.querySelector('.hh-sibprice') || empty()), basis: txt(a.querySelector('.hh-sibbasis') || empty()), href: a.getAttribute('href'), ...abs(a) }));
  const ctaCards = q('.hh-ctacard').map((c) => ({ heading: txt(c.querySelector('h3') || empty()), body: txt(c.querySelector('p') || empty()), button: txt(c.querySelector('a') || empty()), href: c.querySelector('a')?.getAttribute('href'), ...abs(c), screens: +(abs(c).top / viewportHeight).toFixed(2), btn: c.querySelector('a') ? { ...abs(c.querySelector('a')), color: getComputedStyle(c.querySelector('a')).color, bg: getComputedStyle(c.querySelector('a')).backgroundColor, fs: fsz(c.querySelector('a')) } : null }));

  // Every CTA on the page: anything that reads as an action, with where it sits and where it goes.
  const ctaSel = '.hh-intent, .hh-ctacard a, .hh-headaction, .hh-fact[href], button, [role="button"], a[href^="/sell"], a[href^="/value"], a[href^="/buy"], a[href^="/contact"], a[href^="/brief"], a[href^="/alerts"], a[href^="tel:"], a[href^="mailto:"], a[href^="sms:"], form a, form button';
  const seen = new Set();
  const ctas = q(ctaSel).filter((e) => { if (seen.has(e)) return false; seen.add(e); return true; }).map((e) => {
    const b = abs(e);
    const container = e.closest('section, header, aside, nav, footer, form');
    return { tag: e.tagName.toLowerCase(), cls: (e.className || '').toString().slice(0, 40), text: txt(e).slice(0, 90), href: e.getAttribute('href'), type: e.getAttribute('type'), top: b.top, h: b.h, w: b.w, visible: visible(e), screens: +(b.top / viewportHeight).toFixed(2), container: container ? (container.className || container.tagName).toString().slice(0, 60) : null, containerHeading: container ? txt(container.querySelector('h1,h2,h3,h4') || empty()).slice(0, 80) : null, fs: fsz(e), color: getComputedStyle(e).color, bg: getComputedStyle(e).backgroundColor };
  }).filter((c) => c.visible);
  const forms = q('form').map((f) => ({ action: f.getAttribute('action'), method: f.getAttribute('method'), top: abs(f).top, screens: +(abs(f).top / viewportHeight).toFixed(2), inputs: q('input,select,textarea', f).filter((i) => i.type !== 'hidden' && visible(i)).map((i) => ({ type: i.type, name: i.name, placeholder: i.placeholder, ariaLabel: i.getAttribute('aria-label'), labelled: !!(i.labels && i.labels.length) || !!i.getAttribute('aria-label'), h: abs(i).h, w: abs(i).w })), hidden: q('input[type="hidden"]', f).map((i) => ({ name: i.name, value: String(i.value).slice(0, 80) })), button: txt(f.querySelector('button[type="submit"],button:not([type]),input[type="submit"]') || empty()), heading: txt(f.closest('section, div, footer')?.querySelector('h2,h3,h4') || empty()), body: txt(f.closest('section, footer')?.querySelector('p') || empty()).slice(0, 200), fine: txt(f.querySelector('small, [class*="fine"], [class*="note"]') || empty()), inFooter: !!f.closest('footer') }));

  const sections = q('header.hh-hero, section, footer, nav').filter(visible).map((s) => {
    const b = abs(s);
    return { tag: s.tagName.toLowerCase(), id: s.id || null, cls: (s.className || '').toString().slice(0, 50), heading: txt(s.querySelector('h1,h2,h3,h4') || empty()).slice(0, 100), top: b.top, h: b.h, screens: +(b.top / viewportHeight).toFixed(2), tall: +(b.h / viewportHeight).toFixed(1) };
  }).sort((a, b) => a.top - b.top);

  const tapTargets = q('a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], summary').filter(visible).map((e) => ({ tag: e.tagName.toLowerCase(), cls: (e.className || '').toString().slice(0, 30), text: txt(e).slice(0, 50), href: e.getAttribute('href'), ...abs(e) }));
  const smallTaps = tapTargets.filter((t) => t.h < 44 || t.w < 44);
  const tinyTaps = tapTargets.filter((t) => t.h < 24 || t.w < 24);

  const fontIssues = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const perClass = new Map();
  let n;
  while ((n = walker.nextNode())) {
    if (!n.textContent.trim()) continue;
    const el = n.parentElement; if (!el || !visible(el)) continue;
    const cs = getComputedStyle(el);
    const fs = parseFloat(cs.fontSize);
    if (fs < 12) {
      const key = (el.className || el.tagName).toString().slice(0, 40);
      const cur = perClass.get(key) || { key, fs, count: 0, sample: n.textContent.trim().slice(0, 60), color: cs.color, top: abs(el).top };
      cur.count++; perClass.set(key, cur);
    }
  }
  perClass.forEach((v) => fontIssues.push(v));

  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = '1'] = m[1].split(',').map((x) => parseFloat(x)); return { r, g, b, a }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = (el) => { let e = el; while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0.9) return c; e = e.parentElement; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const contrast = [];
  const seenC = new Set();
  for (const el of q('body *')) {
    if (!visible(el)) continue;
    const own = Array.from(el.childNodes).some((c) => c.nodeType === 3 && c.textContent.trim());
    if (!own) continue;
    const cs = getComputedStyle(el);
    const fg = parse(cs.color); if (!fg) continue;
    if (fg.a < 0.1) continue;
    const bg = bgOf(el);
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const fs = parseFloat(cs.fontSize); const bold = parseInt(cs.fontWeight) >= 700;
    const large = fs >= 24 || (fs >= 18.66 && bold);
    const need = large ? 3 : 4.5;
    if (ratio < need) {
      const key = (el.className || el.tagName).toString().slice(0, 40);
      if (seenC.has(key)) continue; seenC.add(key);
      contrast.push({ key, ratio: +ratio.toFixed(2), need, fs, fg: cs.color, bg: `rgb(${bg.r},${bg.g},${bg.b})`, sample: txt(el).slice(0, 60), top: abs(el).top });
    }
  }

  const foldText = [];
  for (const el of q('body *')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.top + scrollY >= viewportHeight) continue;
    const own = Array.from(el.childNodes).filter((c) => c.nodeType === 3).map((c) => c.textContent.trim()).filter(Boolean).join(' ');
    if (own) foldText.push(own);
  }

  return {
    url: location.href, head, headings, jsonld, linksOut, images,
    hero: heroInfo, intents, facts, film, filmInfo, ladder, overview, market: marketInfo, schools, condos, faqs, guides, siblings, ctaCards, ctas, forms, sections,
    tapTargets: { total: tapTargets.length, under44: smallTaps.length, under24: tinyTaps.length, under44Sample: smallTaps.slice(0, 40), under24Sample: tinyTaps.slice(0, 20) },
    fontIssues, contrast, foldText,
    docHeight: document.documentElement.scrollHeight, docWidth: document.documentElement.scrollWidth, innerWidth, viewportHeight,
    screens: +(document.documentElement.scrollHeight / viewportHeight).toFixed(1),
    wordCount: txt(document.body).split(' ').length,
    bodyText: txt(document.querySelector('.hub-v2') || document.body).slice(0, 12000),
  };
}

async function auditOne(browser, hub, vpName) {
  const vp = VIEWPORTS[vpName];
  const page = await browser.newPage();
  if (vpName === 'mobile') await page.setUserAgent(MOBILE_UA);
  await page.setViewport(vp);
  await page.setCacheEnabled(false);
  const requests = [];
  page.on('response', (r) => { try { requests.push({ url: r.url(), status: r.status(), type: r.request().resourceType(), len: Number(r.headers()['content-length'] || 0), ct: r.headers()['content-type'] || '' }); } catch {} });
  const url = `${BASE}/neighbourhoods/${hub.slug}`;
  const t0 = Date.now();
  const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  const status = resp?.status();
  const ttLoad = Date.now() - t0;
  const xRobots = resp?.headers()['x-robots-tag'] ?? null;
  const cache = resp?.headers()['x-vercel-cache'] ?? null;
  const vitals = await page.evaluate(() => new Promise((res) => {
    const out = { lcp: null, cls: 0, lcpElement: null };
    try {
      new PerformanceObserver((l) => { for (const e of l.getEntries()) { out.lcp = Math.round(e.startTime); out.lcpElement = (e.element && (e.element.className || e.element.tagName)) ? String(e.element.className || e.element.tagName).slice(0, 60) : null; } }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) out.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    } catch {}
    setTimeout(() => res({ ...out, cls: +out.cls.toFixed(4) }), 800);
  }));
  const data = await page.evaluate(inspect, vp.height);
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); });
  await new Promise((r) => setTimeout(r, 500));
  const shot = path.join(OUT, 'shots', `${hub.slug}.${vpName}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  await page.screenshot({ path: path.join(OUT, 'shots', `${hub.slug}.${vpName}.fold.png`), fullPage: false });
  // The ladder alone, so its legibility on a phone can be read from a crop.
  const lad = await page.$('.hh-ladder');
  if (lad) { try { await lad.screenshot({ path: path.join(OUT, 'shots', `${hub.slug}.${vpName}.ladder.png`) }); } catch {} }
  const bytes = requests.reduce((m, r) => { m[r.type] = (m[r.type] || 0) + r.len; return m; }, {});
  const failed = requests.filter((r) => r.status >= 400).map((r) => ({ url: r.url.slice(0, 140), status: r.status }));
  const out = { slug: hub.slug, shape: hub.shape, viewport: vpName, status, ttLoad, xRobots, cache, vitals, requests: { count: requests.length, bytesByType: bytes, failed }, ...data, shot };
  fs.writeFileSync(path.join(OUT, `${hub.slug}.${vpName}.json`), JSON.stringify(out, null, 1));
  await page.close();
  return out;
}

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ headless: true, executablePath: CHROME, args: ['--no-sandbox'] });
const summary = [];
for (const hub of HUBS) {
  for (const vpName of ['desktop', 'mobile']) {
    try {
      const r = await auditOne(browser, hub, vpName);
      const firstSeller = r.ctas.find((c) => /value|sell/.test(c.href || ''));
      summary.push({ slug: hub.slug, vp: vpName, status: r.status, cache: r.cache, ttLoad: r.ttLoad, lcp: r.vitals.lcp, cls: r.vitals.cls, screens: r.screens, h1: r.headings.filter((h) => h.level === 1).length, jsonld: r.jsonld.length, bodyUnique: r.linksOut.bodyUnique, ctas: r.ctas.length, forms: r.forms.length, firstSeller: firstSeller ? `${firstSeller.text} @${firstSeller.screens}` : null, ladderRows: r.ladder?.rows, ladderScreens: r.ladder?.screens, under44: r.tapTargets.under44, fontIssues: r.fontIssues.length, contrast: r.contrast.length, overflowX: r.docWidth > r.innerWidth });
      console.log(`${hub.slug} ${vpName} ${r.status} ${r.cache} lcp=${r.vitals.lcp} cls=${r.vitals.cls} screens=${r.screens} ladder=${r.ladder?.rows}rows/${r.ladder?.screens}scr ctas=${r.ctas.length} forms=${r.forms.length} seller=${firstSeller ? firstSeller.screens : '-'} under44=${r.tapTargets.under44} contrast=${r.contrast.length} fonts=${r.fontIssues.length} overflow=${r.docWidth > r.innerWidth}`);
    } catch (e) {
      console.log(`${hub.slug} ${vpName} FAILED ${e.message}`);
      summary.push({ slug: hub.slug, vp: vpName, error: e.message });
    }
  }
}
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 1));
await browser.close();
console.log(`written to ${OUT}`);
