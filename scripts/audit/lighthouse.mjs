#!/usr/bin/env node
// MA-001. Lighthouse over the audit streets, mobile (slow 4G, Moto G class) and desktop presets.
//
//   BASE=https://miltonly.com LH_BIN=<path to lighthouse cli.js> node scripts/audit/lighthouse.mjs [--only=slug]
//
// Lighthouse is not a repo dependency; LH_BIN points at an installed copy (the audit installs one in
// the session scratchpad). Full reports land next to the Puppeteer output; the summary keeps the
// scores and the five metrics the report cites.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.BASE || '').replace(/\/$/, '');
const LH = process.env.LH_BIN;
if (!BASE || !LH) { console.error('BASE and LH_BIN are required'); process.exit(2); }
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = (process.argv.find((a) => a.startsWith('--out=')) || '').slice(6) || path.join(HERE, '..', '..', 'scratchpad', 'audit', 'MA-001', 'lh');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });
const STREETS = JSON.parse(fs.readFileSync(path.join(HERE, 'streets.json'), 'utf8')).filter((s) => !only.length || only.includes(s.slug));

const rows = [];
for (const s of STREETS) {
  for (const preset of ['mobile', 'desktop']) {
    const file = path.join(OUT, `${s.slug}.${preset}.json`);
    const args = [LH, `${BASE}/streets/${s.slug}`, '--output=json', `--output-path=${file}`, '--quiet',
      `--chrome-flags=--headless=new --no-sandbox`, '--only-categories=performance,seo,accessibility,best-practices'];
    if (preset === 'desktop') args.push('--preset=desktop');
    else args.push('--form-factor=mobile', '--screenEmulation.mobile', '--screenEmulation.width=390', '--screenEmulation.height=844', '--screenEmulation.deviceScaleFactor=3');
    try {
      execFileSync('node', args, { stdio: 'pipe', env: { ...process.env, CHROME_PATH: CHROME }, timeout: 240000 });
      const r = JSON.parse(fs.readFileSync(file, 'utf8'));
      const a = r.audits;
      const row = {
        slug: s.slug, preset,
        perf: Math.round((r.categories.performance?.score ?? 0) * 100),
        seo: Math.round((r.categories.seo?.score ?? 0) * 100),
        a11y: Math.round((r.categories.accessibility?.score ?? 0) * 100),
        bp: Math.round((r.categories['best-practices']?.score ?? 0) * 100),
        lcp: Math.round(a['largest-contentful-paint']?.numericValue ?? 0),
        cls: +(a['cumulative-layout-shift']?.numericValue ?? 0).toFixed(3),
        tbt: Math.round(a['total-blocking-time']?.numericValue ?? 0),
        fcp: Math.round(a['first-contentful-paint']?.numericValue ?? 0),
        si: Math.round(a['speed-index']?.numericValue ?? 0),
        ttfb: Math.round(a['server-response-time']?.numericValue ?? 0),
        lcpElement: a['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.snippet?.slice(0, 120) ?? null,
        totalBytes: Math.round((a['total-byte-weight']?.numericValue ?? 0) / 1024),
        unusedJs: Math.round((a['unused-javascript']?.details?.overallSavingsBytes ?? 0) / 1024),
        failingSeo: Object.values(a).filter((x) => r.categories.seo.auditRefs.some((ref) => ref.id === x.id) && x.score !== null && x.score < 1).map((x) => x.id),
        failingA11y: Object.values(a).filter((x) => r.categories.accessibility.auditRefs.some((ref) => ref.id === x.id) && x.score !== null && x.score < 1).map((x) => `${x.id}(${x.details?.items?.length ?? '?'})`),
        failingBp: Object.values(a).filter((x) => r.categories['best-practices'].auditRefs.some((ref) => ref.id === x.id) && x.score !== null && x.score < 1).map((x) => x.id),
        tapTargets: a['target-size']?.details?.items?.length ?? null,
        contrastItems: a['color-contrast']?.details?.items?.map((i) => i.node?.selector).slice(0, 12) ?? null,
        headingOrder: a['heading-order']?.score,
        renderBlocking: a['render-blocking-resources']?.details?.items?.map((i) => ({ url: i.url.slice(-60), ms: i.wastedMs })) ?? [],
      };
      rows.push(row);
      console.log(`${s.slug} ${preset} perf=${row.perf} seo=${row.seo} a11y=${row.a11y} bp=${row.bp} lcp=${row.lcp} cls=${row.cls} tbt=${row.tbt} ttfb=${row.ttfb} kb=${row.totalBytes}`);
    } catch (e) {
      console.log(`${s.slug} ${preset} FAILED ${String(e.message).slice(0, 200)}`);
      rows.push({ slug: s.slug, preset, error: String(e.message).slice(0, 300) });
    }
  }
}
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(rows, null, 1));
console.log(`written to ${OUT}`);
