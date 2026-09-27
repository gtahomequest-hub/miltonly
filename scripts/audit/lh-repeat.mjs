#!/usr/bin/env node
// MA-009. Lighthouse N times over the same pages, with the nightly's exact flags, recording the
// spread of every metric plus what the run attributes the blocking time to. A single Lighthouse
// score is one sample of a noisy process; this prints min, median, max and the range so a move
// can be told from the noise it sits in.
//
//   BASE=https://miltonly.com LH_BIN=<cli.js> node scripts/audit/lh-repeat.mjs --runs=3 --pages=a,b,c
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.BASE || 'https://miltonly.com').replace(/\/$/, '');
const LH = process.env.LH_BIN;
if (!LH || !fs.existsSync(LH)) { console.error('LH_BIN is required'); process.exit(2); }
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = (process.argv.find((a) => a.startsWith('--out=')) || '').slice(6) || path.join(HERE, '..', '..', 'scratchpad', 'audit', 'MA-009');
const runs = Number((process.argv.find((a) => a.startsWith('--runs=')) || '').slice(7)) || 3;
// Paths are given WITHOUT a leading slash ("home" for the homepage): Git Bash rewrites a leading
// slash in an argument into a Windows path, which silently pointed run 1 at C:/Program Files/Git/...
const pages = (process.argv.find((a) => a.startsWith('--pages=')) || '').slice(8).split(',').filter(Boolean)
  .map((p) => (p === 'home' ? '' : `/${p.replace(/^\/+|\/+$/g, '')}`));
fs.mkdirSync(OUT, { recursive: true });

const rows = [];
for (const p of pages) {
  for (let i = 1; i <= runs; i++) {
    const file = path.join(OUT, `${p.replace(/\W+/g, '-') || 'home'}.${i}.json`);
    const args = [LH, `${BASE}${p}`, '--output=json', `--output-path=${file}`, '--quiet',
      '--chrome-flags=--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage',
      '--only-categories=performance,seo,accessibility,best-practices', '--form-factor=mobile', '--screenEmulation.mobile',
      '--screenEmulation.width=390', '--screenEmulation.height=844', '--screenEmulation.deviceScaleFactor=3', '--max-wait-for-load=45000'];
    let row = { page: p, run: i };
    try {
      execFileSync('node', args, { env: { ...process.env, CHROME_PATH: CHROME }, timeout: 180000, stdio: 'pipe', maxBuffer: 64e6 });
      const r = JSON.parse(fs.readFileSync(file, 'utf8'));
      const a = r.audits;
      const kb = (n) => Math.round((n || 0) / 1024);
      const items = a['network-requests']?.details?.items || [];
      const byType = {};
      for (const it of items) { const k = it.resourceType || '?'; byType[k] = byType[k] || { n: 0, kb: 0 }; byType[k].n++; byType[k].kb += kb(it.transferSize); }
      const third = (a['third-party-summary']?.details?.items || []).map((x) => ({ entity: typeof x.entity === 'string' ? x.entity : x.entity?.text, kb: kb(x.transferSize), blockMs: Math.round(x.blockingTime || 0), mainMs: Math.round(x.mainThreadTime || 0) }));
      const boot = (a['bootup-time']?.details?.items || []).slice(0, 6).map((x) => ({ url: String(x.url).replace(BASE, '').slice(0, 70), totalMs: Math.round(x.total || 0), evalMs: Math.round(x.scripting || 0) }));
      const main = (a['mainthread-work-breakdown']?.details?.items || []).map((x) => ({ group: x.groupLabel, ms: Math.round(x.duration || 0) }));
      const lcpPhases = (a['largest-contentful-paint-element']?.details?.items || [])[1]?.items?.map((x) => ({ phase: x.phase, ms: Math.round(x.timing) })) || [];
      row = { ...row,
        perf: Math.round((r.categories.performance?.score ?? 0) * 100),
        lcp: Math.round(a['largest-contentful-paint']?.numericValue ?? 0),
        fcp: Math.round(a['first-contentful-paint']?.numericValue ?? 0),
        tbt: Math.round(a['total-blocking-time']?.numericValue ?? 0),
        cls: +(a['cumulative-layout-shift']?.numericValue ?? 0).toFixed(3),
        si: Math.round(a['speed-index']?.numericValue ?? 0),
        ttfb: Math.round(a['server-response-time']?.numericValue ?? 0),
        totalKb: kb(a['total-byte-weight']?.numericValue),
        scriptKb: byType.Script?.kb ?? 0, scriptN: byType.Script?.n ?? 0,
        imageKb: byType.Image?.kb ?? 0, fontKb: byType.Font?.kb ?? 0, docKb: byType.Document?.kb ?? 0,
        domElements: Number((a['dom-size']?.details?.items || []).find((x) => /elements/i.test(x.statistic || ''))?.value?.value ?? a['dom-size']?.numericValue ?? 0),
        lcpElement: a['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet?.slice(0, 80) ?? null,
        lcpPhases, third, boot, main,
        cacheState: items.find((x) => x.url === `${BASE}${p}` || x.url === `${BASE}${p}/`)?.responseHeaders?.find?.((h) => /x-vercel-cache/i.test(h.name))?.value ?? null,
      };
      console.log(`${p || '/'} run ${i}: perf ${row.perf} lcp ${row.lcp} fcp ${row.fcp} tbt ${row.tbt} si ${row.si} kb ${row.totalKb} script ${row.scriptKb}KB/${row.scriptN} dom ${row.domElements}`);
    } catch (e) {
      row.error = String(e.message).slice(0, 160);
      console.log(`${p || '/'} run ${i}: FAILED ${row.error}`);
    }
    rows.push(row);
  }
}
fs.writeFileSync(path.join(OUT, 'repeat.json'), JSON.stringify(rows, null, 1));

// The spread, per page.
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2); };
console.log('\npage                              metric   min    med    max   range');
for (const p of pages) {
  const set = rows.filter((r) => r.page === p && !r.error);
  if (!set.length) { console.log(`${(p || '/').padEnd(34)} no successful run`); continue; }
  for (const k of ['perf', 'lcp', 'tbt', 'fcp', 'si', 'totalKb', 'scriptKb', 'domElements']) {
    const v = set.map((r) => r[k]);
    console.log(`${(p || '/').padEnd(34)}${k.padEnd(9)}${String(Math.min(...v)).padStart(5)}${String(med(v)).padStart(7)}${String(Math.max(...v)).padStart(7)}${String(Math.max(...v) - Math.min(...v)).padStart(8)}`);
  }
}
console.log(`\nwritten to ${OUT}`);
