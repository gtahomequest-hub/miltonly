// ML-012 evidence: on a real served host, (1) the contrast of the four card fields (beds, baths,
// parking, "/ month") plus a sweep of every visible text node under .rentals-page whose contrast
// is under 3:1, and (2) the street links from the rental cards on the four views: how many cards,
// how many carry a street link, how many render with none, and the status of every distinct link
// (fetched with redirect: manual, so a 301 is reported as a 301, not as its target).
//   node scratchpad/ml012/measure.mjs <base> <label>
import fs from 'node:fs';
import puppeteer from 'puppeteer';
const BASE = (process.argv[2] || '').replace(/\/$/, '');
const LABEL = process.argv[3] || 'run';
if (!BASE) { console.error('usage: node measure.mjs <base> <label>'); process.exit(2); }
const VIEWS = ['/rentals', '/rent', '/rentals?neighbourhood=timberlea', '/rentals?neighbourhood=harrison'];
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const browser = await puppeteer.launch({ headless: true, executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.setUserAgent('miltonly-verify ml012');
const result = { base: BASE, label: LABEL, views: {}, contrast: null, sweep: null, servedCommit: null };
try { result.servedCommit = (await (await fetch(`${BASE}/api/build`)).json()).commit; } catch (e) { result.servedCommit = `error: ${e.message}`; }

// Contrast helpers run inside the page: the effective background is every ancestor's background
// colour composited in document order over white; an alpha colour is composited over what is
// beneath it. A background image (the card photo) is reported but not composited.
function installHelpers() {
  const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const over = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const effBg = (el) => {
    let bg = { r: 255, g: 255, b: 255, a: 1 }; const chain = []; let hasImage = false;
    let n = el;
    while (n && n.nodeType === 1) { const cs = getComputedStyle(n); const c = parse(cs.backgroundColor); if (cs.backgroundImage !== 'none') hasImage = true; chain.unshift(c); n = n.parentElement; }
    for (const c of chain) { if (c && c.a > 0) bg = c.a >= 1 ? c : over(c, bg); }
    return { bg, hasImage };
  };
  window.__ml012 = {
    measure(el) {
      const cs = getComputedStyle(el); const fg = parse(cs.color); const { bg, hasImage } = effBg(el); const fgc = fg.a < 1 ? over(fg, bg) : fg;
      return { color: cs.color, fg: hex(fgc), bg: hex(bg), ratio: Math.round(ratio(fgc, bg) * 100) / 100, fontSize: cs.fontSize, overImage: hasImage, text: (el.textContent || '').trim().slice(0, 40) };
    },
  };
}

async function openView(v) {
  const r = await page.goto(`${BASE}${v}`, { waitUntil: 'networkidle2', timeout: 90000 });
  await page.evaluate(installHelpers);
  return r ? r.status() : 0;
}

// (1) contrast on /rentals: the four fields on the first card that carries each, then the sweep.
{
  const status = await openView('/rentals');
  const fields = await page.evaluate(() => {
    const m = window.__ml012; const cards = [...document.querySelectorAll('.rentals-page .lcard')]; if (!cards.length) return { error: 'no .lcard' };
    const out = {}; const first = (sel, test) => { for (const c of cards) { for (const el of c.querySelectorAll(sel)) if (!test || test(el)) return el; } return null; };
    const beds = first('.lspecs span', (e) => /bed/.test(e.textContent)); if (beds) out.beds = m.measure(beds);
    const baths = first('.lspecs span', (e) => /bath/.test(e.textContent)); if (baths) out.baths = m.measure(baths);
    const park = first('.lspecs span', (e) => /park/.test(e.textContent)); if (park) out.parking = m.measure(park);
    const month = first('.lprice > span', (e) => /month/.test(e.textContent)); if (month) out.month = m.measure(month);
    const sep = first('.lcard-links .sep'); if (sep) out.sep = m.measure(sep);
    return out;
  });
  const sweep = await page.evaluate(() => {
    const m = window.__ml012; const seen = new Map();
    const root = document.querySelector('.rentals-page') || document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      const t = n.textContent.trim(); if (!t) continue; const el = n.parentElement; if (!el) continue;
      if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
      const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
      const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
      const meas = m.measure(el);
      if (meas.ratio >= 4.5) continue;
      const cls = typeof el.className === 'string' ? el.className : el.tagName;
      const key = cls + '|' + meas.color + '|' + meas.bg;
      const cur = seen.get(key); if (cur) { cur.count++; continue; }
      const chain = []; let p = el; while (p && p !== root && chain.length < 4) { if (typeof p.className === 'string' && p.className.trim()) chain.push(p.className.trim().split(/\s+/)[0]); p = p.parentElement; }
      seen.set(key, { selector: chain.join(' < ') || el.tagName, ...meas, count: 1 });
    }
    return [...seen.values()].sort((a, b) => a.ratio - b.ratio);
  });
  result.contrast = { status, fields };
  result.sweep = sweep;
  // The other consumers the review named: on the first render, then through the wizard's steps
  // (the Back link sits on steps 2 and 3, the consent fine print on step 3).
  const one = (sel) => page.evaluate((s) => { const el = document.querySelector(s); return el ? window.__ml012.measure(el) : null; }, sel);
  const placeholder = (sel) => page.evaluate((s) => {
    const el = document.querySelector(s); if (!el) return null; const cs = getComputedStyle(el, '::placeholder'); const base = window.__ml012.measure(el);
    const fake = document.createElement('span'); fake.style.color = cs.color; el.parentElement.appendChild(fake); const meas = window.__ml012.measure(fake); fake.remove();
    return { ...meas, color: cs.color, text: el.getAttribute('placeholder') || '', bg: base.bg };
  }, sel);
  const extras = {};
  extras['q-of (wizard step 1)'] = await one('.rentals-page .q-of');
  extras['ra-label'] = await one('.rentals-page .ra-label');
  extras['ra-count'] = await one('.rentals-page .ra-count');
  extras['bc-sub'] = await one('.rentals-page .bc-sub');
  extras['bc-trust'] = await one('.rentals-page .bc-trust');
  extras['as-fine'] = await one('.rentals-page .as-fine');
  extras['sinput placeholder'] = await placeholder('.rentals-page .sinput');
  extras['mls line'] = await page.evaluate(() => { const el = [...document.querySelectorAll('.rentals-page .lcard .lbody div')].find((d) => /^MLS/.test(d.textContent.trim())); return el ? window.__ml012.measure(el) : null; });
  try {
    await page.click('.rentals-page .wiz-step.active .opt-tile');
    await new Promise((r) => setTimeout(r, 900));
    extras['back-lnk (wizard step 2)'] = await one('.rentals-page .wiz-step.active .back-lnk');
    await page.click('.rentals-page .wiz-step.active .opt-tile, .rentals-page .wiz-step.active .prio-tile, .rentals-page .wiz-step.active .time-tile');
    await new Promise((r) => setTimeout(r, 900));
    extras['submit-note (wizard step 3)'] = await one('.rentals-page .wiz-step.active .submit-note');
    extras['back-lnk (wizard step 3)'] = await one('.rentals-page .wiz-step.active .back-lnk');
  } catch (e) { extras.wizardError = e.message; }
  result.extras = extras;
}

// (2) the street links on the four views
const linkStatus = new Map();
for (const v of VIEWS) {
  const status = await openView(v);
  const d = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.rentals-page .lcard')];
    const links = []; let withLink = 0, withoutLink = 0, withheld = 0, plainStreet = 0;
    for (const c of cards) {
      const a = c.querySelector('.lcard-links a[href^="/streets/"]');
      if (a) { withLink++; links.push(a.getAttribute('href')); } else { withoutLink++; }
      if (c.querySelector('.lcard-links .street-plain')) plainStreet++;
      if (/Address on request/.test((c.querySelector('.laddr') || {}).textContent || '')) withheld++;
    }
    return { cards: cards.length, withLink, withoutLink, withheld, plainStreet, links };
  });
  result.views[v] = { status, ...d };
}
const distinct = [...new Set(Object.values(result.views).flatMap((v) => v.links))];
for (const href of distinct) {
  try {
    const r = await fetch(`${BASE}${href}`, { redirect: 'manual', headers: { 'user-agent': 'miltonly-verify ml012' } });
    linkStatus.set(href, { status: r.status, location: r.headers.get('location') || null });
  } catch (e) { linkStatus.set(href, { status: 0, error: e.message }); }
}
for (const d of Object.values(result.views)) {
  d.linkStatuses = {}; for (const h of d.links) d.linkStatuses[h] = linkStatus.get(h);
  d.count404 = d.links.filter((h) => linkStatus.get(h)?.status === 404).length;
  d.count3xx = d.links.filter((h) => [301, 302, 307, 308].includes(linkStatus.get(h)?.status)).length;
  d.count200 = d.links.filter((h) => linkStatus.get(h)?.status === 200).length;
}
result.distinctLinks = distinct.length;
await browser.close();
fs.mkdirSync('scratchpad/ml012', { recursive: true });
fs.writeFileSync(`scratchpad/ml012/measure-${LABEL}.json`, JSON.stringify(result, null, 1));
console.log(`served commit: ${result.servedCommit}`);
console.log('contrast fields:', JSON.stringify(result.contrast.fields));
console.log('extras:'); for (const [k, v] of Object.entries(result.extras)) console.log(`  ${k}: ${v && v.ratio !== undefined ? `${v.ratio}:1  ${v.fg} on ${v.bg}  "${v.text}"` : JSON.stringify(v)}`);
console.log(`sweep (<4.5:1, visible on first render): ${result.sweep.length} groups`);
for (const s of result.sweep.slice(0, 40)) console.log(`  ${s.ratio}:1  ${s.fg} on ${s.bg}${s.overImage ? ' (image)' : ''}  ${s.fontSize}  x${s.count}  ${s.selector}  "${s.text}"`);
for (const [v, d] of Object.entries(result.views)) console.log(`${v}: HTTP ${d.status}, cards ${d.cards}, with street link ${d.withLink}, without ${d.withoutLink} (withheld ${d.withheld}, plain street text ${d.plainStreet}); links 404 ${d.count404}, 3xx ${d.count3xx}, 200 ${d.count200}`);
console.log(`distinct street links: ${distinct.length}`);
