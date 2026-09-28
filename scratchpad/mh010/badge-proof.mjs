// MH-010 proof for .pl-badge: the audit's inspect() (fonts under 12 px at 390 px) plus a direct read
// of every .pl-badge's computed font-size, text colour and effective backdrop, with the WCAG contrast
// ratio of the text against the tint composited over the nearest opaque ancestor background.
//   CHROME_PATH=<chrome> BASE=https://<host> node scratchpad/mh010/badge-proof.mjs
import { launch, inspect } from '../../scripts/audit/nightly/browser.mjs';
const BASE = (process.env.BASE || '').replace(/\/$/, '');
if (!BASE) { console.error('BASE required'); process.exit(2); }
const PAGES = ['/schools', '/schools/chris-hadfield-ps', '/schools/irma-coulson-ps', '/mosques', '/mosques/icna-milton', '/mosques/milton-musalla'];
const browser = await launch();
let small = 0; let low = 0; let badges = 0;
try {
  for (const p of PAGES) {
    const url = `${BASE}${p}`;
    const r = await inspect(browser, url);
    const badgeFonts = r.fonts.filter((f) => /pl-badge/.test(f.key));
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36 miltonly-audit/mh010-proof');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    const rows = await page.evaluate(() => {
      const parse = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const a = m[1].split(',').map((x) => parseFloat(x)); return { r: a[0], g: a[1], b: a[2], a: a.length > 3 ? a[3] : 1 }; };
      const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
      const over = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
      const backdrop = (el) => { let e = el.parentElement; while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a >= 1) return { c, el: e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : '') }; e = e.parentElement; } return { c: { r: 255, g: 255, b: 255, a: 1 }, el: 'default' }; };
      const hex = (c) => '#' + [c.r, c.g, c.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
      const out = [];
      for (const el of document.querySelectorAll('.pl-badge')) {
        const cs = getComputedStyle(el);
        const text = parse(cs.color); const tint = parse(cs.backgroundColor); const bd = backdrop(el);
        const bg = tint && tint.a < 1 ? over(tint, bd.c) : (tint || bd.c);
        const l1 = lum(text), l2 = lum(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        out.push({ label: el.textContent.trim().slice(0, 24), tone: [...el.classList].filter((c) => c !== 'pl-badge').join('.') || '(none)', fontSize: cs.fontSize, color: hex(text), backdrop: `${hex(bg)} (tint over ${bd.el})`, ratio: +ratio.toFixed(2) });
      }
      return out;
    });
    await page.close();
    badges += rows.length;
    const lows = rows.filter((x) => x.ratio < 4.5);
    low += lows.length; small += badgeFonts.reduce((n, f) => n + f.count, 0);
    console.log(`${p} · HTTP ${r.status} · ${rows.length} badges · audit fonts<12px on .pl-badge: ${badgeFonts.map((f) => `${f.key} ${f.fs}px x${f.count}`).join(', ') || 'none'} · all fonts<12px: ${r.fonts.reduce((n, f) => n + f.count, 0)} nodes`);
    const seen = new Set();
    for (const x of rows) { const k = `${x.tone}|${x.fontSize}|${x.color}|${x.backdrop}`; if (seen.has(k)) continue; seen.add(k); console.log(`   ${x.tone} "${x.label}" ${x.fontSize} ${x.color} on ${x.backdrop} · contrast ${x.ratio}:1${x.ratio < 4.5 ? ' LOW' : ''}`); }
  }
} finally { await browser.close(); }
console.log(`TOTAL ${badges} badges · ${small} badge text nodes under 12px (audit rule) · ${low} badges under 4.5:1`);
