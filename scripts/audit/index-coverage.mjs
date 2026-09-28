// MA-011. Index coverage of the sitemap's street pages, through the URL Inspection API, run once
// and report-only. One inspection per page against the property's 2,000-a-day quota; results are
// appended to a JSONL as they arrive, so a re-run resumes and never spends quota on a page twice.
//
//   node scripts/audit/index-coverage.mjs [--out=scratchpad/ma011] [--base=https://miltonly.com]
//
// Writes <out>/index-coverage.jsonl (the raw indexStatusResult per page), <out>/index-coverage.csv,
// and prints the counts by verdict, then the verdicts of the pages MC-048's baseline found with no
// impression (scratchpad/mc048/baseline/sitemap-join.csv). Credentials as the morning report reads
// them (gsc.mjs): nothing is printed.
import fs from 'node:fs';
import path from 'node:path';
import { REPO, CONFIG, redact } from './morning/lib.mjs';
import { token, gscCredentialSource } from './morning/sources/gsc.mjs';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const OUT = path.resolve(REPO, arg('out', 'scratchpad/ma011'));
const BASE = arg('base', 'https://miltonly.com').replace(/\/$/, '');
const JOIN = path.join(REPO, 'scratchpad', 'mc048', 'baseline', 'sitemap-join.csv');
fs.mkdirSync(OUT, { recursive: true });
const RAW = path.join(OUT, 'index-coverage.jsonl');

// The sitemap's street pages: /streets/<slug>, not the /streets index.
const locs = (x) => [...(x || '').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
let urls = locs(await (await fetch(`${BASE}/sitemap.xml`)).text());
if (urls.every((u) => /sitemap[^/]*\.xml$/.test(u))) { const kids = []; for (const u of urls) kids.push(...locs(await (await fetch(u)).text())); urls = kids; }
const streets = [...new Set(urls.filter((u) => /^https:\/\/[^/]+\/streets\/[^/?#]+$/.test(u)))].sort();
console.log(`sitemap: ${urls.length} urls, ${streets.length} street pages`);

const done = new Map();
if (fs.existsSync(RAW)) for (const l of fs.readFileSync(RAW, 'utf8').split('\n')) { if (!l.trim()) continue; const r = JSON.parse(l); if (!r.error) done.set(r.url, r); }
const todo = streets.filter((u) => !done.has(u)).slice(0, +arg('limit', Infinity));
console.log(`inspected before: ${done.size}; to inspect now: ${todo.length}; credential ${gscCredentialSource()}`);

const { access } = await token();
const H = { authorization: `Bearer ${access}`, 'content-type': 'application/json' };
let n = 0, errors = 0; const t0 = Date.now();
async function inspect(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const r = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', { method: 'POST', headers: H, body: JSON.stringify({ inspectionUrl: url, siteUrl: CONFIG.gscProperty, languageCode: 'en-US' }) });
    if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 2000 * (attempt + 1) ** 2)); continue; }
    const j = await r.json().catch(() => null);
    if (!r.ok) return { url, error: `${r.status} ${redact(JSON.stringify(j?.error?.message ?? j)).slice(0, 160)}` };
    return { url, at: new Date().toISOString(), result: j.inspectionResult?.indexStatusResult ?? null, link: j.inspectionResult?.inspectionResultLink ?? null };
  }
  return { url, error: 'retries exhausted (429 or 5xx)' };
}
const q = todo.slice();
await Promise.all(Array.from({ length: 4 }, async () => {
  while (q.length) {
    const u = q.shift();
    const rec = await inspect(u);
    fs.appendFileSync(RAW, JSON.stringify(rec) + '\n');
    if (rec.error) { errors++; if (errors <= 5) console.log(`error ${u}: ${rec.error}`); if (/^40[13]/.test(rec.error)) { q.length = 0; } }
    else done.set(u, rec);
    if (++n % 50 === 0) console.log(`${n}/${todo.length} in ${Math.round((Date.now() - t0) / 1000)} s`);
    await new Promise((s) => setTimeout(s, 350)); // about 11 a second across 4 workers, under 600 a minute
  }
}));
console.log(`inspected now: ${n} (${errors} errors) in ${Math.round((Date.now() - t0) / 1000)} s`);

// Verdicts.
const category = (s) => {
  const c = s?.coverageState || '';
  if (/^Submitted and indexed$|^Indexed, not submitted in sitemap$/i.test(c)) return 'indexed';
  if (/^Crawled - currently not indexed$/i.test(c)) return 'crawled not indexed';
  if (/^Discovered - currently not indexed$/i.test(c)) return 'discovered not indexed';
  return 'other';
};
const join = new Map();
if (fs.existsSync(JOIN)) {
  const [h, ...rows] = fs.readFileSync(JOIN, 'utf8').trim().split(/\r?\n/).map((l) => l.split(','));
  for (const r of rows) { const o = Object.fromEntries(h.map((k, i) => [k, r[i]])); if (o.in_sitemap === 'true') join.set(o.page, o); }
}
const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const cols = ['page', 'category', 'verdict', 'coverageState', 'indexingState', 'robotsTxtState', 'pageFetchState', 'crawledAs', 'lastCrawlTime', 'googleCanonical', 'userCanonical', 'sitemap', 'referringUrls', 'impressions_28d_to_0926', 'clicks_28d_to_0926', 'is_placeholder_0927', 'error'];
const lines = [cols.join(',')];
const counts = {}, states = {}, zero = {}, zeroStates = {};
let zeroN = 0, inBaseline = 0;
for (const u of streets) {
  const rec = done.get(u); const s = rec?.result; const j = join.get(u);
  const cat = rec ? category(s) : 'not inspected';
  counts[cat] = (counts[cat] || 0) + 1;
  const st = s?.coverageState || (rec ? '(no coverageState)' : '(not inspected)'); states[st] = (states[st] || 0) + 1;
  if (j) { inBaseline++; if (+j.impressions === 0) { zeroN++; zero[cat] = (zero[cat] || 0) + 1; zeroStates[st] = (zeroStates[st] || 0) + 1; } }
  lines.push([u, cat, s?.verdict, s?.coverageState, s?.indexingState, s?.robotsTxtState, s?.pageFetchState, s?.crawledAs, s?.lastCrawlTime, s?.googleCanonical, s?.userCanonical, (s?.sitemap || []).join(' '), (s?.referringUrls || []).length, j?.impressions, j?.clicks, j?.is_placeholder, rec?.error].map(esc).join(','));
}
fs.writeFileSync(path.join(OUT, 'index-coverage.csv'), lines.join('\n') + '\n');
const fmt = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k}: ${v}`).join('\n');
console.log(`\n${streets.length} sitemap street pages, by verdict:\n${fmt(counts)}\nby coverageState:\n${fmt(states)}`);
console.log(`\nMC-048 baseline: ${inBaseline} of today's pages are in sitemap-join.csv; ${zeroN} had no impression in the 28 days to 2026-09-26. Their verdicts:\n${fmt(zero)}\nby coverageState:\n${fmt(zeroStates)}`);
fs.writeFileSync(path.join(OUT, 'index-coverage-summary.json'), JSON.stringify({ at: new Date().toISOString(), base: BASE, streets: streets.length, counts, states, baseline: { inBaseline, zeroImpression: zeroN, zero, zeroStates } }, null, 1));
