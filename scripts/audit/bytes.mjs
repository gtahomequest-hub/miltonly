#!/usr/bin/env node
// MA-001. What a phone actually downloads on a street page: bytes on the wire per resource type,
// measured through CDP (Network.loadingFinished.encodedDataLength), not Content-Length, at the
// mobile viewport with cache disabled. Optional slow-4G throttling to see what the video does on
// cellular.
//
//   BASE=https://miltonly.com node scripts/audit/bytes.mjs scott-boulevard-milton main-street-milton [--throttle]
import puppeteer from 'puppeteer';

const BASE = (process.env.BASE || '').replace(/\/$/, '');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const slugs = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const throttle = process.argv.includes('--throttle');
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const browser = await puppeteer.launch({ headless: true, executablePath: CHROME, args: ['--no-sandbox'] });
for (const slug of slugs) {
  const page = await browser.newPage();
  await page.setUserAgent(MOBILE_UA);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await page.setCacheEnabled(false);
  const cdp = await page.createCDPSession();
  await cdp.send('Network.enable');
  if (throttle) await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
  const byId = new Map();
  const wire = new Map();
  cdp.on('Network.responseReceived', (e) => byId.set(e.requestId, { url: e.response.url, type: e.type, status: e.response.status, mime: e.response.mimeType }));
  cdp.on('Network.loadingFinished', (e) => { const r = byId.get(e.requestId); if (r) wire.set(e.requestId, { ...r, bytes: e.encodedDataLength }); });
  cdp.on('Network.loadingFailed', (e) => { const r = byId.get(e.requestId); if (r) wire.set(e.requestId, { ...r, bytes: 0, failed: e.errorText }); });
  const t0 = Date.now();
  await page.goto(`${BASE}/streets/${slug}`, { waitUntil: 'networkidle0', timeout: 120000 });
  const ttLoad = Date.now() - t0;
  // Scroll to the bottom so anything lazy actually loads, then let the network settle.
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } });
  await new Promise((r) => setTimeout(r, 4000));
  const rows = [...wire.values()];
  const byType = {};
  for (const r of rows) { byType[r.type] = (byType[r.type] || 0) + r.bytes; }
  const total = rows.reduce((a, r) => a + r.bytes, 0);
  console.log(`\n${slug} ${throttle ? '(slow 4G)' : ''} load ${ttLoad}ms total ${(total / 1048576).toFixed(2)} MB over ${rows.length} requests`);
  for (const [t, b] of Object.entries(byType).sort((a, b) => b[1] - a[1])) console.log(`  ${t.padEnd(10)} ${(b / 1048576).toFixed(2)} MB`);
  const big = rows.filter((r) => r.bytes > 200000).sort((a, b) => b.bytes - a.bytes).slice(0, 12);
  for (const r of big) console.log(`  ${(r.bytes / 1048576).toFixed(2)} MB ${r.type} ${r.status} ${r.url.slice(0, 110)}`);
  const media = rows.filter((r) => r.type === 'Media' || /\.mp4/.test(r.url));
  for (const r of media) console.log(`  media ${r.status} ${(r.bytes / 1048576).toFixed(2)} MB ${r.url.slice(-60)} ${r.failed || ''}`);
  await page.close();
}
await browser.close();
