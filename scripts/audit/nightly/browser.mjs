// MA-002. The browser half of the nightly audit: the checks that need layout.
//
// Puppeteer resolves from AUDIT_DEPS (a lean install of puppeteer-core, the GitHub runner) or from
// the repo's own devDependency (a local run). Chrome is the installed browser on either host;
// CHROME_PATH overrides. Lighthouse is the CLI at LH_BIN or <AUDIT_DEPS>/node_modules/lighthouse.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';

const DEPS = process.env.AUDIT_DEPS ? path.resolve(process.env.AUDIT_DEPS) : null;
export const CHROME = process.env.CHROME_PATH
  || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p));
export const LH_BIN = process.env.LH_BIN || (DEPS && path.join(DEPS, 'node_modules', 'lighthouse', 'cli', 'index.js'));

export async function launch() {
  const req = createRequire(DEPS ? path.join(DEPS, 'package.json') : import.meta.url);
  let puppeteer;
  try { puppeteer = req(DEPS ? 'puppeteer-core' : 'puppeteer'); } catch { puppeteer = req(DEPS ? 'puppeteer' : 'puppeteer-core'); }
  if (!CHROME) throw new Error('no Chrome found; set CHROME_PATH');
  return puppeteer.launch({ headless: true, executablePath: CHROME, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
}

// Fonts under 12 px and horizontal overflow at 390 px, plus the DOM's ids so a same-page anchor
// the raw HTML called dead can be cleared when a client component created the target.
export async function inspect(browser, url, { timeout = 30000 } = {}) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.setUserAgent('Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36 miltonly-audit/nightly');
    await page.setRequestInterception(true);
    page.on('request', (r) => { if (r.resourceType() === 'media') r.abort(); else r.continue(); });
    const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));
    const r = await page.evaluate(() => {
      const visible = (el) => { const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
      const innerWidth = window.innerWidth;
      const docWidth = document.documentElement.scrollWidth;
      let culprit = null;
      if (docWidth > innerWidth) {
        let best = null;
        for (const el of document.querySelectorAll('body *')) {
          if (!visible(el)) continue;
          const b = el.getBoundingClientRect();
          if (b.right > innerWidth + 1 && (!best || b.right > best.right)) best = { right: Math.round(b.right), el };
        }
        if (best) culprit = `${best.el.tagName.toLowerCase()}${best.el.className && typeof best.el.className === 'string' ? '.' + best.el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''} right=${best.right}px`;
      }
      const fonts = new Map();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        if (!n.textContent.trim()) continue;
        const el = n.parentElement; if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName) || !visible(el)) continue;
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs < 12) {
          const key = `${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : ''}`;
          const cur = fonts.get(key) || { key, fs: +fs.toFixed(1), count: 0, sample: n.textContent.trim().slice(0, 40) };
          cur.count++; fonts.set(key, cur);
        }
      }
      const ids = new Set(); for (const el of document.querySelectorAll('[id]')) ids.add(el.id);
      return { innerWidth, docWidth, culprit, fonts: [...fonts.values()], ids: [...ids] };
    });
    return { status: resp ? resp.status() : null, ...r };
  } finally { await page.close().catch(() => {}); }
}

// One Lighthouse mobile run. Returns the scores and metrics the report keeps; the JSON goes to
// `outFile` (a temp dir, never the repo).
export function lighthouse(url, outFile, { timeout = 150000 } = {}) {
  if (!LH_BIN || !fs.existsSync(LH_BIN)) return Promise.resolve({ error: `no lighthouse at ${LH_BIN || '(unset)'}` });
  const args = [LH_BIN, url, '--output=json', `--output-path=${outFile}`, '--quiet', `--chrome-flags=--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage`,
    '--only-categories=performance,seo,accessibility,best-practices', '--form-factor=mobile', '--screenEmulation.mobile',
    '--screenEmulation.width=390', '--screenEmulation.height=844', '--screenEmulation.deviceScaleFactor=3', '--max-wait-for-load=45000'];
  return new Promise((resolve) => {
    execFile('node', args, { env: { ...process.env, CHROME_PATH: CHROME }, timeout, maxBuffer: 64 * 1024 * 1024 }, (err) => {
      try {
        const r = JSON.parse(fs.readFileSync(outFile, 'utf8'));
        const a = r.audits; const c = r.categories;
        const s = (k) => c[k]?.score == null ? null : Math.round(c[k].score * 100);
        const failing = (k) => Object.values(a).filter((x) => c[k].auditRefs.some((ref) => ref.id === x.id && ref.weight > 0) && x.score !== null && x.score < 1).map((x) => x.id).sort();
        resolve({ perf: s('performance'), seo: s('seo'), a11y: s('accessibility'), bp: s('best-practices'),
          lcp: Math.round(a['largest-contentful-paint']?.numericValue ?? 0), cls: +(a['cumulative-layout-shift']?.numericValue ?? 0).toFixed(3),
          tbt: Math.round(a['total-blocking-time']?.numericValue ?? 0), ttfb: Math.round(a['server-response-time']?.numericValue ?? 0),
          kb: Math.round((a['total-byte-weight']?.numericValue ?? 0) / 1024), failing: { seo: failing('seo'), a11y: failing('accessibility'), bp: failing('best-practices') },
          runtimeError: r.runtimeError?.code || null });
      } catch (e) { resolve({ error: (err && err.killed) ? 'timeout' : (err?.message || e.message).split('\n')[0].slice(0, 160) }); }
    });
  });
}
