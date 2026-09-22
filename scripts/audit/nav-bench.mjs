#!/usr/bin/env node
// MA-004. Benchmark captures: the header of each comparison site at 1440 with its first menu open,
// and at 390 with its mobile menu open, plus a count of what the server HTML puts in the header and
// footer. Read-only; nothing is submitted.
//
//   node scripts/audit/nav-bench.mjs [--out=<dir>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = (process.argv.find((a) => a.startsWith('--out=')) || '').slice(6) || path.join(HERE, '..', '..', 'scratchpad', 'audit', 'MA-004', 'bench');
fs.mkdirSync(OUT, { recursive: true });

const SITES = [
  { key: 'homesly', url: 'https://www.homesly.ca/', trigger: 'header button, header [aria-haspopup], nav button', burger: 'header button[aria-label*="enu" i], button[aria-label*="enu" i]' },
  { key: 'rightmove', url: 'https://www.rightmove.co.uk/', trigger: 'header a[href*="house-prices"], header button, nav [aria-haspopup]', burger: 'button[aria-label*="enu" i], [data-testid*="menu" i]' },
  { key: 'zoopla', url: 'https://www.zoopla.co.uk/', trigger: 'header [aria-haspopup], header button, nav button', burger: 'button[aria-label*="enu" i], [data-testid*="menu" i]' },
  { key: 'airbnb', url: 'https://www.airbnb.ca/', trigger: 'header [aria-haspopup="menu"], header button[aria-expanded]', burger: 'button[aria-label*="enu" i], button[aria-label*="rofile" i]' },
];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const MUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
const out = {};
for (const s of SITES) {
  const rec = { url: s.url };
  for (const [w, vp, ua] of [[1440, { width: 1440, height: 900 }, UA], [390, { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, MUA]]) {
    const page = await browser.newPage();
    await page.setViewport(vp); await page.setUserAgent(ua);
    try {
      const res = await page.goto(s.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await new Promise((r) => setTimeout(r, 4000));
      // dismiss a consent dialog if one is in the way
      await page.evaluate(() => { for (const b of document.querySelectorAll('button')) { if (/accept|agree|got it|allow all/i.test(b.textContent || '')) { b.click(); break; } } });
      await new Promise((r) => setTimeout(r, 800));
      const info = await page.evaluate(() => {
        const q = (sel, root = document) => Array.from(root.querySelectorAll(sel));
        const txt = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
        const header = document.querySelector('header') || document.querySelector('nav');
        const footer = document.querySelector('footer');
        const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        return {
          status: null, title: document.title,
          header: header ? { tag: header.tagName, h: Math.round(header.getBoundingClientRect().height), position: getComputedStyle(header).position, links: q('a[href]', header).length, visibleLinks: q('a[href]', header).filter(vis).length, buttons: q('button', header).filter(vis).map((b) => txt(b) || b.getAttribute('aria-label')).slice(0, 20), texts: q('a[href]', header).filter(vis).map((a) => txt(a) || a.getAttribute('aria-label')).slice(0, 30), search: !!header.querySelector('input, [role="search"], form') } : null,
          footer: footer ? { h: Math.round(footer.getBoundingClientRect().height), links: q('a[href]', footer).length, headings: q('h1,h2,h3,h4,h5,h6,summary', footer).map(txt).slice(0, 30), forms: q('form', footer).length, top: Math.round(footer.getBoundingClientRect().top + scrollY), docH: document.documentElement.scrollHeight } : null,
          totalLinks: q('a[href]').length,
          jsonldTypes: q('script[type="application/ld+json"]').map((x) => { try { const j = JSON.parse(x.textContent); const t = []; const walk = (o) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk); if (o['@type']) t.push(String(o['@type'])); Object.values(o).forEach(walk); }; walk(j); return t; } catch { return []; } }).flat().filter((v, i, a) => a.indexOf(v) === i),
        };
      });
      info.status = res?.status();
      rec[w] = info;
      await page.screenshot({ path: path.join(OUT, `${s.key}.${w}.closed.png`), clip: { x: 0, y: 0, width: vp.width, height: Math.min(vp.height, w === 390 ? 844 : 160) } });
      const sel = w === 390 ? s.burger : s.trigger;
      const el = await page.$(sel);
      if (el) {
        const b = await el.boundingBox();
        if (b) {
          if (w === 390) await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
          else { await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await new Promise((r) => setTimeout(r, 700)); await el.click().catch(() => null); }
          await new Promise((r) => setTimeout(r, 1200));
          rec[w].opened = { sel, text: await el.evaluate((e) => (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40)) };
          rec[w].openedLinks = await page.evaluate(() => Array.from(document.querySelectorAll('a[href]')).filter((a) => { const r = a.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top >= 0 && r.top < innerHeight; }).length);
          await page.screenshot({ path: path.join(OUT, `${s.key}.${w}.open.png`), fullPage: false });
        }
      }
    } catch (e) { rec[w] = { error: String(e).split('\n')[0] }; }
    await page.close();
  }
  out[s.key] = rec;
  console.log(s.key, JSON.stringify(rec).slice(0, 900));
}
await browser.close();
fs.writeFileSync(path.join(OUT, 'bench.json'), JSON.stringify(out, null, 2));
