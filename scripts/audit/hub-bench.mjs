#!/usr/bin/env node
// MA-005. Benchmark captures: the neighbourhood or area pages of Zolo, HouseSigma, Realtor.ca and
// Rightmove, at 1440 and 390, read-only. Records the head, H1, first-screen text, forms and CTAs in
// the first screen, page height, and a screenshot of each. Sites that refuse automation are recorded
// as refused; nothing is retried or worked around.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', '..', 'scratchpad', 'audit', 'MA-005', 'bench');
fs.mkdirSync(OUT, { recursive: true });

const SITES = [
  { key: 'zolo-timberlea', url: 'https://www.zolo.ca/milton-real-estate/timberlea' },
  { key: 'zolo-milton', url: 'https://www.zolo.ca/milton-real-estate' },
  { key: 'housesigma-timberlea', url: 'https://housesigma.com/on/milton-real-estate/timberlea-real-estate/' },
  { key: 'housesigma-milton', url: 'https://housesigma.com/on/milton-real-estate/' },
  { key: 'realtor-milton', url: 'https://www.realtor.ca/on/milton/real-estate' },
  { key: 'rightmove-beeston', url: 'https://www.rightmove.co.uk/house-prices/beeston.html' },
  { key: 'rightmove-beeston-sale', url: 'https://www.rightmove.co.uk/property-for-sale/Beeston.html' },
  { key: 'rightmove-ng9', url: 'https://www.rightmove.co.uk/house-prices/ng9.html' },
];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const MUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
const out = {};
for (const s of SITES) {
  out[s.key] = { url: s.url };
  for (const [w, vp, ua] of [[1440, { width: 1440, height: 900 }, UA], [390, { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, MUA]]) {
    const page = await browser.newPage();
    await page.setUserAgent(ua);
    await page.setViewport(vp);
    let rec;
    try {
      const resp = await page.goto(s.url, { waitUntil: 'networkidle2', timeout: 60000 });
      await new Promise((r) => setTimeout(r, 2500));
      rec = await page.evaluate((vh) => {
        const txt = (el) => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
        const q = (sel) => Array.from(document.querySelectorAll(sel));
        const visible = (el) => { const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
        const fold = [];
        for (const el of q('body *')) { if (!visible(el)) continue; const b = el.getBoundingClientRect(); if (b.top + scrollY >= vh) continue; const own = Array.from(el.childNodes).filter((c) => c.nodeType === 3).map((c) => c.textContent.trim()).filter(Boolean).join(' '); if (own) fold.push(own); }
        const inFold = (el) => el.getBoundingClientRect().top + scrollY < vh;
        return {
          title: document.title, description: document.querySelector('meta[name="description"]')?.content ?? null,
          h1: q('h1').map(txt), h2: q('h2').filter(visible).map(txt).slice(0, 30),
          foldText: fold.join(' | ').slice(0, 1500),
          foldForms: q('form').filter(visible).filter(inFold).map((f) => ({ inputs: q('input:not([type=hidden]),select').filter((i) => f.contains(i) && visible(i)).map((i) => i.placeholder || i.name || i.type), button: txt(f.querySelector('button')) })),
          foldButtons: q('a,button').filter(visible).filter(inFold).map(txt).filter((t) => /value|estimate|worth|alert|sign|register|contact|agent|subscribe|watch|save|sold|call|email|free/i.test(t)).slice(0, 20),
          formsTotal: q('form').filter(visible).length,
          screens: +(document.documentElement.scrollHeight / vh).toFixed(1),
          jsonld: q('script[type="application/ld+json"]').map((x) => { try { const j = JSON.parse(x.textContent); return Array.isArray(j) ? j.map((y) => y['@type']) : (j['@graph'] ? j['@graph'].map((y) => y['@type']) : j['@type']); } catch { return 'bad'; } }),
          words: txt(document.body).split(' ').length,
          blocked: /access denied|verify you are human|captcha|robot|blocked/i.test(txt(document.body).slice(0, 2000)),
        };
      }, vp.height);
      rec.status = resp?.status();
      await page.screenshot({ path: path.join(OUT, `${s.key}.${w}.fold.png`), fullPage: false });
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } scrollTo(0, 0); });
      await page.screenshot({ path: path.join(OUT, `${s.key}.${w}.png`), fullPage: true }).catch(() => {});
    } catch (e) { rec = { error: e.message }; }
    out[s.key][w] = rec;
    console.log(`${s.key} ${w} ${rec.status ?? ''} ${rec.error ? 'ERR ' + rec.error.slice(0, 80) : ''} blocked=${rec.blocked} screens=${rec.screens} | ${rec.title} | h1=${JSON.stringify(rec.h1)} | foldForms=${JSON.stringify(rec.foldForms)} | foldButtons=${JSON.stringify(rec.foldButtons)}`);
    await page.close();
  }
}
fs.writeFileSync(path.join(OUT, 'bench.json'), JSON.stringify(out, null, 1));
await browser.close();
