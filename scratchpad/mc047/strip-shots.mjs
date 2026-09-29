// MC-047: the registrant strip, measured in a real browser at four widths.
// usage: node scratchpad/mc047/strip-shots.mjs <base> <outdir> <path> [<path> ...]
// For each page and width: the strip's font size, whether either name is clipped (scrollWidth
// past clientWidth), the strip's box, and whether the first heading or the page's first content
// sits below the fixed nav (not hidden under it). Saves a top-of-page screenshot of each.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const [base, out, ...paths] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const WIDTHS = [360, 390, 800, 1024, 1280];
const opts = { headless: 'new', args: ['--no-sandbox'] };
const browser = await puppeteer.launch(opts).catch(() => puppeteer.launch({ ...opts, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe' }));
const rows = [];
for (const p of paths) {
  for (const w of WIDTHS) {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: 900 });
    await page.goto(base + p, { waitUntil: 'networkidle2', timeout: 90000 }).catch(() => {});
    const m = await page.evaluate(() => {
      const strip = document.querySelector('[data-registrant]');
      if (!strip) return { strip: false };
      const cs = getComputedStyle(strip.querySelector('[data-registrant-name]') || strip);
      const r = strip.getBoundingClientRect();
      const clipped = [...strip.querySelectorAll('span')].some((s) => s.getBoundingClientRect().right > window.innerWidth + 0.5 || s.getBoundingClientRect().left < -0.5);
      const nav = strip.closest('nav, header');
      const navBottom = nav ? nav.getBoundingClientRect().bottom : r.bottom;
      const fixed = nav ? getComputedStyle(nav).position === 'fixed' : false;
      // the first visible heading or content block after the nav
      const h = document.querySelector('main h1, h1');
      const hTop = h ? h.getBoundingClientRect().top + window.scrollY : null;
      return { strip: true, font: parseFloat(cs.fontSize), stripH: Math.round(r.height), stripTop: Math.round(r.top), clipped, navBottom: Math.round(navBottom), fixed, h1Top: hTop == null ? null : Math.round(hTop), docOverflow: document.documentElement.scrollWidth > window.innerWidth };
    });
    const file = path.join(out, `${p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'}-${w}.png`);
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: w, height: 260 } });
    rows.push({ path: p, width: w, ...m });
    await page.close();
  }
}
await browser.close();
let bad = 0;
for (const r of rows) {
  const problems = [];
  if (!r.strip) problems.push('NO STRIP');
  else {
    if (r.font < 14) problems.push(`font ${r.font}px`);
    if (r.clipped) problems.push('a name is clipped');
    if (r.docOverflow) problems.push('page scrolls sideways');
    if (r.fixed && r.h1Top != null && r.h1Top < r.navBottom) problems.push(`h1 at ${r.h1Top} under the nav (bottom ${r.navBottom})`);
  }
  if (problems.length) bad++;
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${r.path} @${r.width}: font ${r.font}px, strip ${r.stripH}px, nav bottom ${r.navBottom}, h1 ${r.h1Top}${problems.length ? ' :: ' + problems.join('; ') : ''}`);
}
console.log(`${rows.length} views, ${bad} with a problem`);
process.exit(bad ? 1 : 0);
