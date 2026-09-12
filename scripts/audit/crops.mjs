#!/usr/bin/env node
// MA-001. Section crops at the phone width for visual review: each named selector is screenshotted
// on its own so a 20-screen page can be read one block at a time.
//
//   BASE=https://miltonly.com node scripts/audit/crops.mjs <slug> [selector ...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.BASE || '').replace(/\/$/, '');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const [slug, ...sels] = process.argv.slice(2);
const OUT = path.join(HERE, '..', '..', 'scratchpad', 'audit', 'MA-001', 'crops');
fs.mkdirSync(OUT, { recursive: true });
const DEFAULT = ['.s-glance', '.s-side', '.s-geo', '.s-types', '.s-market-grid', '.s-records', '.s-commute', '.s-inv', '.s-addr-lad', '.s-addr-cta', '.s-ctx', '.s-faq', '.s-final', '.s-areacx', '.s-video', '.s-min-trust', '.s-placeholder'];
const wanted = sels.length ? sels : DEFAULT;
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const browser = await puppeteer.launch({ headless: true, executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setUserAgent(MOBILE_UA);
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(`${BASE}/streets/${slug}`, { waitUntil: 'load', timeout: 120000 });
await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } scrollTo(0, 0); });
await new Promise((r) => setTimeout(r, 800));
for (const sel of wanted) {
  const el = await page.$(sel);
  if (!el) { console.log(`${sel}: absent`); continue; }
  const box = await el.boundingBox();
  if (!box) { console.log(`${sel}: no box`); continue; }
  const file = path.join(OUT, `${slug}.${sel.replace(/[^a-z0-9-]/gi, '')}.png`);
  const h = Math.min(box.height, 2400);
  await page.screenshot({ path: file, clip: { x: 0, y: box.y, width: 390, height: h }, captureBeyondViewport: true });
  console.log(`${sel}: ${Math.round(box.height)}px tall -> ${path.basename(file)}`);
}
await browser.close();
