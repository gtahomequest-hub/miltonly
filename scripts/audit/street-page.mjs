#!/usr/bin/env node
// MA-001. Read-only audit of the street page on a live host, with Puppeteer.
//
//   BASE=https://miltonly.com node scripts/audit/street-page.mjs [--out=<dir>] [--only=slug,slug]
//
// For each street in streets.json, at 1440x900 and at 390x844 (iPhone-class, DPR 3, touch, mobile
// UA), it records everything the report needs: head tags, headings, JSON-LD, links, images, video,
// every CTA and form with its document position against the fold, section positions, tap targets,
// font floors, horizontal overflow, above-the-fold text, and a full-page screenshot. It never
// submits a form and never edits anything. Output is one JSON per street per width plus the shots.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.BASE || '').replace(/\/$/, '');
if (!BASE) { console.error('BASE is required'); process.exit(2); }
const OUT = (process.argv.find((a) => a.startsWith('--out=')) || '').slice(6) || path.join(HERE, '..', '..', 'scratchpad', 'audit', 'MA-001');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });

const STREETS = JSON.parse(fs.readFileSync(path.join(HERE, 'streets.json'), 'utf8')).filter((s) => !only.length || only.includes(s.slug));

const VIEWPORTS = {
  desktop: { width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  mobile: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// Everything measured inside the page. Runs in the browser; keep it dependency-free.
function inspect(viewportHeight) {
  const abs = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top + scrollY), left: Math.round(r.left + scrollX), w: Math.round(r.width), h: Math.round(r.height) }; };
  const txt = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const q = (s, root = document) => Array.from(root.querySelectorAll(s));
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const empty = () => document.createElement('i');

  const head = {
    title: document.title,
    titleLen: document.title.length,
    description: document.querySelector('meta[name="description"]')?.content ?? null,
    canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
    robots: document.querySelector('meta[name="robots"]')?.content ?? null,
    ogTitle: document.querySelector('meta[property="og:title"]')?.content ?? null,
    ogImage: document.querySelector('meta[property="og:image"]')?.content ?? null,
    ogType: document.querySelector('meta[property="og:type"]')?.content ?? null,
    viewport: document.querySelector('meta[name="viewport"]')?.content ?? null,
    lang: document.documentElement.lang || null,
    hreflang: q('link[rel="alternate"][hreflang]').map((l) => l.hreflang),
  };
  head.descriptionLen = head.description ? head.description.length : 0;

  const headings = q('h1,h2,h3,h4,h5,h6').map((h) => ({ level: Number(h.tagName[1]), text: txt(h).slice(0, 140), top: abs(h).top, hidden: !visible(h) }));

  const jsonld = q('script[type="application/ld+json"]').map((s) => {
    try { return { ok: true, json: JSON.parse(s.textContent) }; } catch (e) { return { ok: false, error: String(e), raw: s.textContent.slice(0, 300) }; }
  });

  const origin = location.origin;
  const anchors = q('a[href]').map((a) => ({ href: a.href, text: txt(a).slice(0, 80), top: abs(a).top, w: abs(a).w, h: abs(a).h, visible: visible(a), rel: a.rel, target: a.target }));
  const internal = anchors.filter((a) => a.href.startsWith(origin));
  const external = anchors.filter((a) => !a.href.startsWith(origin) && /^https?:/.test(a.href));
  const linksOut = {
    total: anchors.length,
    internal: internal.length,
    internalUnique: new Set(internal.map((a) => a.href.split('#')[0])).size,
    external: external.length,
    externalHosts: [...new Set(external.map((a) => new URL(a.href).host))],
    emptyText: anchors.filter((a) => !a.text).length,
    byPath: Object.entries(internal.reduce((m, a) => { const p = new URL(a.href).pathname.split('/').slice(0, 2).join('/'); m[p] = (m[p] || 0) + 1; return m; }, {})),
    listingLinks: internal.filter((a) => /\/listings\/|\/listing\//.test(a.href)).map((a) => ({ href: a.href, top: a.top, text: a.text })),
  };

  const images = q('img').map((i) => ({ src: (i.currentSrc || i.src || '').slice(0, 160), alt: i.getAttribute('alt'), hasAlt: i.hasAttribute('alt'), w: i.width, h: i.height, natural: [i.naturalWidth, i.naturalHeight], loading: i.loading, top: abs(i).top }));
  const bgImages = q('[style*="background-image"]').map((e) => ({ cls: e.className, top: abs(e).top, style: e.getAttribute('style').slice(0, 160) }));

  const videos = q('video').map((v) => ({ preload: v.getAttribute('preload'), autoplay: v.autoplay, controls: v.controls, muted: v.muted, playsInline: v.playsInline, poster: v.poster, src: v.currentSrc || q('source', v)[0]?.src, readyState: v.readyState, networkState: v.networkState, top: abs(v).top, w: abs(v).w, h: abs(v).h, caption: txt(v.closest('figure')?.querySelector('figcaption') || empty()) }));

  // CTAs: every link or button that reads as an action, and every form.
  const ctaSel = 'a.s-b1, a.s-b2, .s-inline-cta a, .s-contact-prompt a, .s-side-cta a, .s-fcard a, button, [role="button"], a[href="/sell"], a[href^="/sell"], a[href^="/buy"], a[href^="/contact"], a[href*="value"], a[href^="tel:"], a[href^="mailto:"], a[href^="sms:"], .s-pill, .s-listing';
  const seen = new Set();
  const ctas = q(ctaSel).filter((e) => { if (seen.has(e)) return false; seen.add(e); return true; }).map((e) => {
    const b = abs(e);
    const container = e.closest('section, header, aside, .s-side-cta, .s-inline-cta, .s-fcard, nav, footer');
    return { tag: e.tagName.toLowerCase(), text: txt(e).slice(0, 90), href: e.getAttribute('href'), type: e.getAttribute('type'), top: b.top, h: b.h, w: b.w, visible: visible(e), screens: +(b.top / viewportHeight).toFixed(2), container: container ? (container.className || container.tagName).toString().slice(0, 60) : null, containerHeading: container ? txt(container.querySelector('h1,h2,h3,h4') || empty()).slice(0, 80) : null };
  }).filter((c) => c.visible);
  const forms = q('form').map((f) => ({ action: f.getAttribute('action'), method: f.getAttribute('method'), top: abs(f).top, screens: +(abs(f).top / viewportHeight).toFixed(2), inputs: q('input,select,textarea', f).filter((i) => i.type !== 'hidden' && visible(i)).map((i) => ({ type: i.type, name: i.name, placeholder: i.placeholder, ariaLabel: i.getAttribute('aria-label'), labelled: !!(i.labels && i.labels.length) || !!i.getAttribute('aria-label'), h: abs(i).h, w: abs(i).w })), button: txt(f.querySelector('button[type="submit"],button:not([type]),input[type="submit"]') || empty()), heading: txt(f.closest('.s-fcard, section, div')?.querySelector('h2,h3,h4') || empty()), body: txt(f.closest('.s-fcard, section')?.querySelector('p') || empty()).slice(0, 200), fine: txt(f.querySelector('.s-alert-fine, small') || empty()) }));

  // Sections and their scroll depth.
  const sections = q('header.s-hero, section, .s-glance, aside, footer, .s-side-card, .s-side-cta, .s-inline-cta, nav').filter(visible).map((s) => {
    const b = abs(s);
    return { tag: s.tagName.toLowerCase(), cls: (s.className || '').toString().slice(0, 50), heading: txt(s.querySelector('h1,h2,h3,h4') || empty()).slice(0, 100), top: b.top, h: b.h, screens: +(b.top / viewportHeight).toFixed(2) };
  }).sort((a, b) => a.top - b.top);

  // Tap targets: interactive elements under 44px in either dimension, or under 24px.
  const tapTargets = q('a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], summary').filter(visible).map((e) => ({ tag: e.tagName.toLowerCase(), text: txt(e).slice(0, 50), href: e.getAttribute('href'), ...abs(e) }));
  const smallTaps = tapTargets.filter((t) => t.h < 44 || t.w < 44);
  const tinyTaps = tapTargets.filter((t) => t.h < 24 || t.w < 24);

  // Font floors: visible text nodes under 12px, with the class of their element.
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

  // Contrast: text colour against the nearest opaque ancestor background, WCAG AA thresholds.
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

  // Above the fold at scroll 0: the text the searcher lands on.
  const foldText = [];
  for (const el of q('body *')) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.top + scrollY >= viewportHeight) continue;
    const own = Array.from(el.childNodes).filter((c) => c.nodeType === 3).map((c) => c.textContent.trim()).filter(Boolean).join(' ');
    if (own) foldText.push(own);
  }

  // The address ladder and the road facts on this width.
  const ladder = document.querySelector('.s-addr, [class*="addr"]');
  const ladderInfo = ladder ? { ...abs(ladder), cls: ladder.className, ticks: q('[class*="addr-tick"], [id]', ladder).length, overflowX: ladder.scrollWidth > ladder.clientWidth, sample: txt(ladder).slice(0, 240) } : null;
  const geo = document.querySelector('.s-geo');
  const geoInfo = geo ? { ...abs(geo), rows: q('.s-geo-fact', geo).map((r) => txt(r)), note: txt(geo.querySelector('.s-near-note') || empty()) } : null;

  const silent = q('.s-silent').filter(visible).map((e) => ({ text: txt(e).slice(0, 80), top: abs(e).top, ctx: txt(e.parentElement).slice(0, 100) }));

  return {
    url: location.href,
    head, headings, jsonld, linksOut, images, bgImages, videos, ctas, forms, sections,
    tapTargets: { total: tapTargets.length, under44: smallTaps.length, under24: tinyTaps.length, under44Sample: smallTaps.slice(0, 40), under24Sample: tinyTaps.slice(0, 20) },
    fontIssues, contrast, foldText, ladder: ladderInfo, geo: geoInfo, silent,
    docHeight: document.documentElement.scrollHeight, docWidth: document.documentElement.scrollWidth, innerWidth, viewportHeight,
    screens: +(document.documentElement.scrollHeight / viewportHeight).toFixed(1),
    wordCount: txt(document.body).split(' ').length,
    heroText: txt(document.querySelector('.s-hero') || empty()).slice(0, 1200),
    sectionText: q('.s-prose-sec, .s-areacx-card, .s-msum, .s-faq-item, .s-type-intro, .s-side-cta, .s-fcard, .s-placeholder, .s-min-body, .s-min-lead').map((s) => ({ id: s.id || s.className, text: txt(s).slice(0, 900) })),
  };
}

async function auditOne(browser, street, vpName) {
  const vp = VIEWPORTS[vpName];
  const page = await browser.newPage();
  if (vpName === 'mobile') await page.setUserAgent(MOBILE_UA);
  await page.setViewport(vp);
  await page.setCacheEnabled(false);
  const requests = [];
  page.on('response', (r) => { try { requests.push({ url: r.url(), status: r.status(), type: r.request().resourceType(), len: Number(r.headers()['content-length'] || 0), ct: r.headers()['content-type'] || '' }); } catch {} });
  const url = `${BASE}/streets/${street.slug}`;
  const t0 = Date.now();
  const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  const status = resp?.status();
  const ttLoad = Date.now() - t0;
  const xRobots = resp?.headers()['x-robots-tag'] ?? null;
  const cache = resp?.headers()['x-vercel-cache'] ?? null;
  // Web vitals in-lab: LCP and CLS via PerformanceObserver buffered entries.
  const vitals = await page.evaluate(() => new Promise((res) => {
    const out = { lcp: null, cls: 0, lcpElement: null };
    try {
      new PerformanceObserver((l) => { for (const e of l.getEntries()) { out.lcp = Math.round(e.startTime); out.lcpElement = (e.element && (e.element.className || e.element.tagName)) ? String(e.element.className || e.element.tagName).slice(0, 60) : null; } }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) out.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    } catch {}
    setTimeout(() => res({ ...out, cls: +out.cls.toFixed(4) }), 800);
  }));
  const data = await page.evaluate(inspect, vp.height);
  // Scroll the whole page so lazy things load, then take the shots.
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); });
  await new Promise((r) => setTimeout(r, 500));
  const shot = path.join(OUT, 'shots', `${street.slug}.${vpName}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  const foldShot = path.join(OUT, 'shots', `${street.slug}.${vpName}.fold.png`);
  await page.screenshot({ path: foldShot, fullPage: false });
  const bytes = requests.reduce((m, r) => { m[r.type] = (m[r.type] || 0) + r.len; return m; }, {});
  const media = requests.filter((r) => r.type === 'media' || /\.mp4|\.webm/.test(r.url)).map((r) => ({ url: r.url, status: r.status, len: r.len }));
  const failed = requests.filter((r) => r.status >= 400).map((r) => ({ url: r.url.slice(0, 140), status: r.status }));
  const out = { slug: street.slug, shape: street.shape, viewport: vpName, status, ttLoad, xRobots, cache, vitals, requests: { count: requests.length, bytesByType: bytes, media, failed }, ...data, shot };
  fs.writeFileSync(path.join(OUT, `${street.slug}.${vpName}.json`), JSON.stringify(out, null, 1));
  await page.close();
  return out;
}

// The puppeteer cache on this machine holds no chrome.exe; the installed Chrome is used, overridable.
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await puppeteer.launch({ headless: true, executablePath: CHROME, args: ['--no-sandbox'] });
const summary = [];
for (const street of STREETS) {
  for (const vpName of ['desktop', 'mobile']) {
    try {
      const r = await auditOne(browser, street, vpName);
      const firstCta = r.ctas.filter((c) => c.tag !== 'button' || c.text)[0];
      summary.push({ slug: street.slug, vp: vpName, status: r.status, ttLoad: r.ttLoad, lcp: r.vitals.lcp, cls: r.vitals.cls, screens: r.screens, h1: r.headings.filter((h) => h.level === 1).length, jsonld: r.jsonld.length, jsonldBad: r.jsonld.filter((j) => !j.ok).length, linksOut: r.linksOut.internalUnique, imgNoAlt: r.images.filter((i) => !i.hasAlt).length, ctas: r.ctas.length, forms: r.forms.length, firstCta: firstCta ? `${firstCta.text} @${firstCta.screens}` : null, under44: r.tapTargets.under44, fontIssues: r.fontIssues.length, contrast: r.contrast.length, overflowX: r.docWidth > r.innerWidth, videos: r.videos.length });
      console.log(`${street.slug} ${vpName} ${r.status} lcp=${r.vitals.lcp} cls=${r.vitals.cls} screens=${r.screens} ctas=${r.ctas.length} forms=${r.forms.length} first=${firstCta ? firstCta.screens : '-'} under44=${r.tapTargets.under44} contrast=${r.contrast.length} fonts=${r.fontIssues.length} overflow=${r.docWidth > r.innerWidth}`);
    } catch (e) {
      console.log(`${street.slug} ${vpName} FAILED ${e.message}`);
      summary.push({ slug: street.slug, vp: vpName, error: e.message });
    }
  }
}
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 1));
await browser.close();
console.log(`written to ${OUT}`);
