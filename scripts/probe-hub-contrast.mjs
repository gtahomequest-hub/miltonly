// Usage: node scripts/probe-hub-contrast.mjs [BASE] [slug,slug,...]
// Hub stat tiles: measure the rendered colour of every figure against the colour actually
// painted behind it, at 380 and 1440, on a sample of hubs across both tiers.
import puppeteer from 'puppeteer';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'https://miltonly.com';
const SLUGS = process.argv[3] ? process.argv[3].split(',') : ['timberlea', 'beaty', 'moffat', 'milton-north'];

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => { const L1 = lum(a), L2 = lum(b); const hi = Math.max(L1, L2), lo = Math.min(L1, L2); return (hi + 0.05) / (lo + 0.05); };
const rgb = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { rgb: [p[0], p[1], p[2]], a: p.length > 3 ? p[3] : 1 }; };
const flatten = (fg, bg) => (fg.a >= 1 ? fg.rgb : fg.rgb.map((c, i) => c * fg.a + bg[i] * (1 - fg.a)));

const b = await puppeteer.launch({ headless: 'new', executablePath: CHROME, args: ['--no-sandbox'] });
for (const w of [380, 1440]) {
  for (const slug of SLUGS) {
    const pg = await b.newPage();
    await pg.setViewport({ width: w, height: 900 });
    await pg.goto(`${BASE}/neighbourhoods/${slug}`, { waitUntil: 'networkidle2', timeout: 60000 });
    const rows = await pg.evaluate(() => {
      // Walk up for the first ancestor that actually paints a background.
      const painted = (el) => {
        let n = el;
        while (n && n !== document.documentElement) {
          const c = getComputedStyle(n).backgroundColor;
          const m = c.match(/rgba?\(([^)]+)\)/);
          if (m) { const p = m[1].split(',').map(Number); if (p.length < 4 || p[3] > 0.99) return c; }
          n = n.parentElement;
        }
        return getComputedStyle(document.body).backgroundColor;
      };
      const sel = ['.h-hs .h-n', '.h-hs .h-l', '.h-gi-v', '.h-gi-l', '.hh-fact-v', '.hh-fact-l', '.hh-fact-b'];
      const out = [];
      for (const s of sel) {
        for (const el of document.querySelectorAll(s)) {
          const cs = getComputedStyle(el);
          out.push({ sel: s, text: (el.textContent || '').trim().slice(0, 18), color: cs.color, bg: painted(el), px: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight, 10) || 400 });
        }
      }
      return out;
    });
    for (const r of rows) {
      const f = rgb(r.color), g = rgb(r.bg);
      if (!f || !g) continue;
      const cr = ratio(flatten(f, g.rgb), g.rgb);
      // WCAG large text: 24px, or 18.66px at bold weight.
      const need = r.px >= 24 || (r.px >= 18.66 && r.weight >= 700) ? 3 : 4.5;
      if (cr < 4.5) console.log(`${w}px ${slug} ${r.sel} "${r.text}" ${r.px}px color=${r.color} on ${r.bg} => ${cr.toFixed(2)}:1 ${cr < need ? 'FAIL' : 'large-text-ok'}`);
    }
    await pg.close();
  }
}
await b.close();
console.log('done');
