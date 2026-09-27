#!/usr/bin/env node
// MA-004. Lighthouse over the five nav-audit page types, mobile and desktop, keeping the audits
// that speak to the header, menu and footer: crawlable anchors, link names, tap targets, contrast,
// heading order, plus the four scores and the fold metrics for context.
//
//   BASE=https://miltonly.com LH_BIN=<path to lighthouse cli/index.js> node scripts/audit/nav-lighthouse.mjs [--only=key]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.BASE || '').replace(/\/$/, '');
const LH = process.env.LH_BIN;
if (!BASE || !LH) { console.error('BASE and LH_BIN are required'); process.exit(2); }
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = (process.argv.find((a) => a.startsWith('--out=')) || '').slice(6) || path.join(HERE, '..', '..', 'scratchpad', 'audit', 'MA-004', 'lh');
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });
const PAGES = JSON.parse(fs.readFileSync(path.join(HERE, 'nav-pages.json'), 'utf8')).filter((p) => !only.length || only.includes(p.key));

const NAV_SEL = /site-nav|m-nav|m-band|m-mega|sn-panel|sn-acc|header|footer|m-footer|m-f[a-z]+|m-navcta|m-logo|shrink-0|lg:hidden/;
const rows = [];
for (const p of PAGES) {
  for (const preset of ['mobile', 'desktop']) {
    const file = path.join(OUT, `${p.key}.${preset}.json`);
    const args = [LH, BASE + p.path, '--output=json', `--output-path=${file}`, '--quiet', '--chrome-flags=--headless=new --no-sandbox', '--only-categories=performance,seo,accessibility,best-practices'];
    if (preset === 'desktop') args.push('--preset=desktop');
    else args.push('--form-factor=mobile', '--screenEmulation.mobile', '--screenEmulation.width=390', '--screenEmulation.height=844', '--screenEmulation.deviceScaleFactor=3');
    try {
      execFileSync('node', args, { stdio: 'pipe', env: { ...process.env, CHROME_PATH: CHROME }, timeout: 300000 });
      const r = JSON.parse(fs.readFileSync(file, 'utf8'));
      const a = r.audits;
      const items = (id) => (a[id]?.details?.items || []);
      const chrome = (id) => items(id).filter((it) => NAV_SEL.test(JSON.stringify(it.node?.selector || it.node?.snippet || '')));
      const row = {
        key: p.key, preset,
        perf: Math.round((r.categories.performance?.score ?? 0) * 100), seo: Math.round((r.categories.seo?.score ?? 0) * 100), a11y: Math.round((r.categories.accessibility?.score ?? 0) * 100), bp: Math.round((r.categories['best-practices']?.score ?? 0) * 100),
        lcp: a['largest-contentful-paint']?.numericValue, lcpEl: a['largest-contentful-paint-element']?.details?.items?.[0]?.items?.[0]?.node?.selector || null, cls: a['cumulative-layout-shift']?.numericValue, tbt: a['total-blocking-time']?.numericValue, fcp: a['first-contentful-paint']?.numericValue,
        crawlable: a['crawlable-anchors']?.score, crawlableItems: items('crawlable-anchors').length,
        linkName: a['link-name']?.score, linkNameItems: items('link-name').map((i) => i.node?.snippet?.slice(0, 120)),
        targetSize: a['target-size']?.score, targetItems: items('target-size').length, targetChrome: chrome('target-size').map((i) => i.node?.selector?.slice(-80)),
        tapTargets: a['tap-targets']?.score, tapItems: items('tap-targets').length,
        contrast: a['color-contrast']?.score, contrastItems: items('color-contrast').length, contrastChrome: chrome('color-contrast').map((i) => i.node?.snippet?.slice(0, 120)),
        headingOrder: a['heading-order']?.score, landmarks: a['landmark-one-main']?.score, dupIds: a['duplicate-id-aria']?.score, ariaAllowed: a['aria-allowed-role']?.score, ariaValid: a['aria-valid-attr-value']?.score, bypass: a['bypass']?.score, listItems: a['list']?.score, listItemsN: items('list').length,
        fontSize: a['font-size']?.score, legible: a['font-size']?.displayValue,
        interactiveRoles: a['aria-required-children']?.score, buttonName: a['button-name']?.score, buttonNameItems: items('button-name').map((i) => i.node?.snippet?.slice(0, 100)),
        a11yFails: Object.values(a).filter((x) => x.score !== null && x.score < 1 && r.categories.accessibility.auditRefs.some((ref) => ref.id === x.id)).map((x) => x.id),
        seoFails: Object.values(a).filter((x) => x.score !== null && x.score < 1 && r.categories.seo.auditRefs.some((ref) => ref.id === x.id)).map((x) => x.id),
      };
      rows.push(row);
      console.log(`${p.key.padEnd(8)} ${preset.padEnd(7)} perf ${row.perf} seo ${row.seo} a11y ${row.a11y} bp ${row.bp} | LCP ${Math.round(row.lcp)} ${row.lcpEl} CLS ${row.cls?.toFixed(3)} TBT ${Math.round(row.tbt)} | crawlable ${row.crawlable} (${row.crawlableItems}) linkName ${row.linkName} target ${row.targetSize} (${row.targetItems}, chrome ${row.targetChrome.length}) contrast ${row.contrast} (${row.contrastItems}, chrome ${row.contrastChrome.length}) headings ${row.headingOrder} bypass ${row.bypass} list ${row.listItems} | a11y fails: ${row.a11yFails.join(',')} | seo fails: ${row.seoFails.join(',')}`);
    } catch (e) {
      console.log(`${p.key} ${preset} FAILED ${String(e).split('\n')[0]}`);
      rows.push({ key: p.key, preset, error: String(e) });
    }
  }
}
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(rows, null, 2));
