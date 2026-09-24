#!/usr/bin/env node
// MC-042 scratch: a read-only reproduction of the nightly's link-unpublished rule
// (scripts/audit/nightly/run.mjs sections 1 and 5), importing the audit's own link extractor
// (checks.mjs pageFindings) so nothing under scripts/audit/ is edited. HTTP GETs only.
// No email, no state.json, no write under scratchpad/audit/nightly/.
//
//   node link-unpublished-repro.mjs [--mode=light|always] [--out=<file.json>]
//     light  : referrers = /streets + every `from` page on the open link-unpublished findings in
//              scratchpad/audit/nightly/state.json; targets = discovered off-sitemap entity links
//              from those referrers + all open link-unpublished targets.
//     always : referrers = light set + every sitemap page outside /streets/ and /listings/ (the
//              nightly's "always" set) + the ten audit streets; targets = every discovered
//              off-sitemap link (no 32 cap) + all open link-unpublished targets.
import fs from 'node:fs';
import path from 'node:path';
import { pageFindings } from 'file:///D:/miltonly/scripts/audit/nightly/checks.mjs';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const BASE = 'https://miltonly.com'; const HOST = new URL(BASE).host;
const MODE = arg('mode', 'light');
const OUT = arg('out', path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), `link-unpublished-${MODE}-${Date.now()}.json`));
const UA = 'miltonly-audit/nightly (+https://miltonly.com)';
const FOCUS = ['/streets/gowland-crescent-milton', '/streets/ennisclare-drive-milton', '/streets/jempson-path-milton'];
const T0 = Date.now(); let fetches = 0;

// run.mjs get(), same redirect handling, no budget.
async function get(url, { hops = 5, body = true } = {}) {
  const chain = []; let cur = url;
  for (let i = 0; i <= hops; i++) {
    fetches++;
    let r;
    try { r = await fetch(cur, { redirect: 'manual', headers: { 'user-agent': UA, accept: 'text/html,*/*' }, signal: AbortSignal.timeout(25000) }); }
    catch (e) { return { status: null, error: (e.cause?.code || e.name || 'error').slice(0, 40), chain }; }
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      const loc = new URL(r.headers.get('location'), cur).href; chain.push({ status: r.status, to: loc });
      await r.body?.cancel().catch(() => {});
      if (i === hops) return { status: r.status, error: 'too-many-redirects', chain, final: loc };
      if (new URL(loc).host !== HOST) return { status: r.status, chain, final: loc, offhost: true };
      cur = loc; continue;
    }
    let html = null;
    if (body && /text\/html|xml/.test(r.headers.get('content-type') || '')) html = await r.text(); else await r.body?.cancel().catch(() => {});
    return { status: r.status, chain, final: cur, html };
  }
}
const pathOf = (u) => { const x = new URL(u, BASE); return (x.pathname.replace(/\/+$/, '') || '/') + x.search; };
async function pool(items, n, fn) { const q = items.slice(); await Promise.all(Array.from({ length: n }, async () => { while (q.length) await fn(q.shift()); })); }

// 1. Sitemap, as run.mjs.
const sm = await get(`${BASE}/sitemap.xml`);
const locs = (x) => [...(x || '').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
let urls = locs(sm.html);
if (urls.length && urls.every((u) => /sitemap[^/]*\.xml$/.test(u))) { const k = []; for (const u of urls) k.push(...locs((await get(u)).html)); urls = k; }
const sitemap = new Set(urls.filter((u) => { try { return new URL(u).host === HOST; } catch { return false; } }).map(pathOf));

// Referrers.
const state = JSON.parse(fs.readFileSync('D:/miltonly/scratchpad/audit/nightly/state.json', 'utf8'));
const openLU = Object.entries(state.links).filter(([, l]) => l.finding?.code === 'link-unpublished').map(([t]) => t);
const refs = new Set(['/streets']);
for (const t of openLU) for (const f of state.links[t].from || []) refs.add(f);
if (MODE === 'always') {
  for (const p of sitemap) if (!/^\/(streets|listings)\//.test(p)) refs.add(p);
  for (const s of JSON.parse(fs.readFileSync('D:/miltonly/scripts/audit/streets.json', 'utf8'))) refs.add(`/streets/${s.slug}`);
  refs.add('/'); refs.add('/neighbourhoods/timberlea');
}

// 4. Sweep the referrers and collect internal links with the audit's own extractor.
const linksOut = new Map(); const refStatus = {};
await pool([...refs], 10, async (p) => {
  const r = await get(`${BASE}${p}`);
  refStatus[p] = r.status;
  if (!(r.html && r.status === 200)) return;
  const res = pageFindings({ html: r.html, path: r.final ? pathOf(r.final) : p, base: BASE, listing: p.startsWith('/listings/') });
  for (const t of res.internal.keys()) { if (!linksOut.has(t)) linksOut.set(t, new Set()); linksOut.get(t).add(p); }
});

// 5. Discovery exactly as run.mjs:196-203.
const byPath = new Map();
for (const [t, rs] of linksOut) {
  if (sitemap.has(t)) continue;
  const key = t.split('?')[0];
  if (!byPath.has(key)) byPath.set(key, { target: t, refs: new Set(), variants: 0 });
  const e = byPath.get(key); e.variants++; for (const r of rs) e.refs.add(r);
}
const discovered = [...byPath.values()].map((e) => [e.target, e.refs, e.variants]).sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]));
const ENTITY = /^\/(streets|condos|neighbourhoods|schools|mosques|guides|listings|market-watch)\/[^/?#]+$/;
const toCheck = new Map();
for (const [t, rs, v] of discovered) if (MODE === 'always' || ENTITY.test(t)) toCheck.set(t, { refs: rs, variants: v });
for (const t of openLU) if (!toCheck.has(t)) toCheck.set(t, { refs: new Set(), variants: 1, notDiscovered: true });

// Classification exactly as run.mjs:210-228.
const results = {};
await pool([...toCheck.keys()], 10, async (t) => {
  const { refs: rs, variants, notDiscovered } = toCheck.get(t);
  const onSitemap = sitemap.has(t);
  const rec = { onSitemap, discovered: !notDiscovered, refs: rs.size, from: [...rs].slice(0, 5) };
  if (variants > 1) rec.variants = variants;
  // A target on the sitemap is skipped by run.mjs:199 and can never be link-unpublished; checked
  // here only so the report can show it renders.
  const r = await get(`${BASE}${t}`, { body: false });
  rec.status = r.status;
  if (r.chain?.length) rec.chain = r.chain.map((h) => `${h.status} ${r.offhost && h === r.chain.at(-1) ? h.to : pathOf(h.to)}`);
  const entity = t.match(ENTITY);
  const via = rec.chain ? ` via ${rec.chain.join(' > ')}` : '';
  if (onSitemap) rec.finding = null;
  else if (r.error) rec.finding = { code: 'link-broken', sev: 2 };
  else if (r.status >= 500) rec.finding = { code: 'link-broken', sev: 1 };
  else if (r.status >= 400) rec.finding = { code: entity ? 'link-unpublished' : 'link-broken', sev: 2, detail: `${r.status}${via}` };
  else if (r.offhost) rec.finding = { code: 'host-leak', sev: 1 };
  else if (entity && !t.startsWith('/listings/') && !sitemap.has(pathOf(r.final))) rec.finding = { code: 'link-unpublished', sev: 3, detail: `${r.status}${via}, renders but is not on the sitemap` };
  else if (rec.chain) rec.finding = { code: 'link-redirect', sev: 3, detail: rec.chain.join(' > ') };
  else rec.finding = null;
  results[t] = rec;
});

const lu = Object.entries(results).filter(([, r]) => r.finding?.code === 'link-unpublished').map(([t]) => t).sort();
const summary = {
  mode: MODE, at: new Date().toISOString(), seconds: Math.round((Date.now() - T0) / 1000), fetches,
  sitemapUrls: sitemap.size, referrersSwept: refs.size, discoveredOffSitemap: discovered.length, checked: Object.keys(results).length,
  focus: Object.fromEntries(FOCUS.map((t) => [t, { onSitemap: sitemap.has(t), linkedFromSweptReferrers: [...(linksOut.get(t) || [])], check: results[t] || null }])),
  priorOpenLinkUnpublished: openLU.length,
  priorOpenNowOnSitemap: openLU.filter((t) => sitemap.has(t)).sort(),
  linkUnpublishedNow: lu.length, linkUnpublishedNowTargets: lu,
};
fs.writeFileSync(OUT, JSON.stringify({ summary, results, refStatus }, null, 1));
console.log(JSON.stringify(summary, null, 1));
console.log(`wrote ${OUT}`);
