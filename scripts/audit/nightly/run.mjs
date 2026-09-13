#!/usr/bin/env node
// MA-002. The nightly audit of production. Reads pages, never the database.
//
//   BASE=https://miltonly.com node scripts/audit/nightly/run.mjs [--no-email] [--no-lh] [--out=dir]
//     [--budget=600] [--deadline=285] [--sample=40] [--lh=12]
//
// One run: the sitemap, a status sweep of as many sitemap URLs as the fetch budget allows (the
// non-street pages every night, streets and listings in rotation, oldest sweep first), the links
// those pages carry that are not on the sitemap, a 40-page structural sample in Chrome at 390 px,
// Lighthouse mobile on the ten audit streets plus the homepage and one hub, and a diff against the
// previous night's state. Output: scratchpad/audit/nightly/<date>.md and state.json, both committed
// by the workflow, and one email through Resend carrying only what changed or broke.
//
// Budget: 600 page fetches and 285 s, both enforced here, both reported.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageFindings } from './checks.mjs';
import { launch, inspect, lighthouse, LH_BIN, CHROME } from './browser.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const flag = (k) => process.argv.includes(`--${k}`);

loadEnvLocal();
const BASE = (process.env.BASE || 'https://miltonly.com').replace(/\/$/, '');
const HOST = new URL(BASE).host;
const OUT = path.resolve(ROOT, arg('out', 'scratchpad/audit/nightly'));
const BUDGET = +arg('budget', 600);
const DEADLINE = +arg('deadline', 285) * 1000;
const SAMPLE_N = +arg('sample', 40);
const NO_EMAIL = flag('no-email');
const NO_LH = flag('no-lh');
const TO = process.env.AUDIT_EMAIL_TO || 'gtahomequest@gmail.com';
const UA = 'miltonly-audit/nightly (+https://miltonly.com)';
const CONCURRENCY = 10;
const REPO = process.env.GITHUB_REPOSITORY || 'gtahomequest-hub/miltonly';
const BRANCH = process.env.GITHUB_REF_NAME || 'feat/audit';

const T0 = Date.now();
const elapsed = () => Math.round((Date.now() - T0) / 1000);
const past = (ms) => Date.now() - T0 > ms;
const DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const STREETS = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'streets.json'), 'utf8')).map((s) => `/streets/${s.slug}`);
const FIXED = ['/', '/neighbourhoods/timberlea', ...STREETS];
const SEV = { 1: 'S1', 2: 'S2', 3: 'S3', 4: 'S4' };
const notes = [];
const phases = {};
const log = (m) => console.log(`[${String(elapsed()).padStart(3)}s] ${m}`);

// The fetch budget. Every request to the host, including each redirect hop, is one fetch.
let fetches = 0;
const fetchesBy = {};
function budget(phase, n = 1) {
  if (fetches + n > BUDGET) return false;
  fetches += n; fetchesBy[phase] = (fetchesBy[phase] || 0) + n; return true;
}
async function get(url, phase, { hops = 5, body = true } = {}) {
  const chain = []; let cur = url; const t = Date.now();
  for (let i = 0; i <= hops; i++) {
    if (!budget(phase)) return { status: null, error: 'budget', chain, ms: Date.now() - t };
    let r;
    try { r = await fetch(cur, { redirect: 'manual', headers: { 'user-agent': UA, accept: 'text/html,*/*' }, signal: AbortSignal.timeout(25000) }); }
    catch (e) { return { status: null, error: (e.cause?.code || e.name || 'error').slice(0, 40), chain, ms: Date.now() - t }; }
    if (r.status >= 300 && r.status < 400 && r.headers.get('location')) {
      const loc = new URL(r.headers.get('location'), cur).href;
      chain.push({ status: r.status, to: loc });
      await r.body?.cancel().catch(() => {});
      if (i === hops) return { status: r.status, error: 'too-many-redirects', chain, final: loc, ms: Date.now() - t };
      if (new URL(loc).host !== HOST) return { status: r.status, chain, final: loc, offhost: true, ms: Date.now() - t };
      cur = loc; continue;
    }
    let html = null;
    if (body && /text\/html|xml/.test(r.headers.get('content-type') || '')) html = await r.text();
    else await r.body?.cancel().catch(() => {});
    return { status: r.status, chain, final: cur, html, ms: Date.now() - t, cache: r.headers.get('x-vercel-cache') };
  }
}
const pathOf = (u) => { const x = new URL(u, BASE); return (x.pathname.replace(/\/+$/, '') || '/') + x.search; };
const family = (p) => p === '/' ? 'home' : p.split('/')[1].split('?')[0];

// State from the previous night: what each page looked like and when it was last swept.
fs.mkdirSync(OUT, { recursive: true });
const STATE_FILE = path.join(OUT, 'state.json');
const prev = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : null;
const state = { date: DATE, base: BASE, pages: {}, links: {}, lh: {}, sample: [] };

// 1. The sitemap.
let sitemapUrls = [];
{
  const r = await get(`${BASE}/sitemap.xml`, 'sitemap');
  const locs = (x) => [...(x || '').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  let urls = locs(r.html);
  if (!urls.length) { console.error(`sitemap unreadable: status ${r.status} ${r.error || ''}`); process.exit(2); }
  if (urls.length && urls.every((u) => /sitemap[^/]*\.xml$/.test(u))) {
    const kids = [];
    for (const u of urls) { const k = await get(u, 'sitemap'); kids.push(...locs(k.html)); }
    urls = kids;
  }
  sitemapUrls = [...new Set(urls.filter((u) => { try { return new URL(u).host === HOST; } catch { return false; } }))];
}
const sitemap = new Set(sitemapUrls.map(pathOf));
const families = {};
for (const p of sitemap) families[family(p)] = (families[family(p)] || 0) + 1;
log(`sitemap ${sitemap.size} urls: ${Object.entries(families).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`);
if (prev) {
  const was = new Set(Object.keys(prev.pages || {}));
  const joined = [...sitemap].filter((p) => !was.has(p)); const left = [...was].filter((p) => !sitemap.has(p));
  state.sitemapDelta = { joined: joined.length, left: left.length, joinedSample: joined.slice(0, 12), leftSample: left.slice(0, 12) };
}

// 2. Which sitemap URLs to sweep tonight. Everything that is not a street or a listing is swept
//    every night; streets and listings fill the rest of the budget, the longest-unswept first, so
//    the whole sitemap is covered in a few nights and the report says how many.
const RESERVE = SAMPLE_N + (NO_LH ? 0 : FIXED.length) + 40;
const sweepCap = Math.max(0, BUDGET - fetches - RESERVE);
const always = [...sitemap].filter((p) => !/^\/(streets|listings)\//.test(p));
const rotating = [...sitemap].filter((p) => /^\/(streets|listings)\//.test(p) && !FIXED.includes(p));
const lastSwept = (p) => prev?.pages?.[p]?.sweptAt || '';
rotating.sort((a, b) => lastSwept(a).localeCompare(lastSwept(b)) || a.localeCompare(b));
const toSweep = [...new Set([...FIXED.filter((p) => sitemap.has(p) || p === '/'), ...always, ...rotating])].slice(0, sweepCap);
const sweepSet = new Set(toSweep);
log(`sweeping ${toSweep.length} of ${sitemap.size} (cap ${sweepCap}); ${always.length} always, ${rotating.length} in rotation`);

// 3. Lighthouse, started first so its CPU time overlaps the network-bound sweep. Two at a time;
//    the sweep runs against the same host meanwhile, so the numbers are indicative, not clean.
const lhTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'miltonly-lh-'));
const lhJobs = NO_LH ? [] : FIXED.slice(0, +arg('lh', FIXED.length));
const lhDone = (async () => {
  if (NO_LH) return;
  if (!LH_BIN || !fs.existsSync(LH_BIN)) { notes.push(`Lighthouse skipped: no CLI at ${LH_BIN || '(unset)'}`); return; }
  await Promise.all([0, 1].map(async () => {
    while (lhJobs.length) {
      if (past(DEADLINE * 0.75)) { notes.push(`Lighthouse stopped by the clock with ${lhJobs.length} runs left`); lhJobs.length = 0; break; }
      const p = lhJobs.shift();
      if (!budget('lighthouse')) { notes.push(`Lighthouse skipped ${p}: fetch budget`); continue; }
      const r = await lighthouse(`${BASE}${p}`, path.join(lhTmp, `${p.replace(/[^a-z0-9]+/gi, '_') || 'home'}.json`), { timeout: Math.max(30000, DEADLINE * 0.8 - (Date.now() - T0)) });
      state.lh[p] = r;
      log(`lighthouse ${p} ${r.error ? 'ERROR ' + r.error : `perf ${r.perf} seo ${r.seo} a11y ${r.a11y} bp ${r.bp} lcp ${r.lcp} cls ${r.cls} tbt ${r.tbt}`}`);
    }
  }));
  phases.lighthouse = elapsed();
})();

// 4. The sweep, with the raw-HTML checks on every page that answers HTML.
const pages = {};
const linksOut = new Map();   // target path -> Set of referrers
const crossAnchors = [];      // { from, path, frag }
const pageIds = {};           // path -> Set of ids (raw HTML)
async function sweepOne(p) {
  const r = await get(`${BASE}${p}`, 'sweep');
  const rec = { status: r.status, ms: r.ms, sweptAt: DATE, findings: [], cache: r.cache || null };
  if (r.error) rec.error = r.error;
  if (r.chain.length) rec.chain = r.chain.map((h) => `${h.status} ${pathOf(h.to)}`);
  if (r.final) rec.final = r.offhost ? r.final : pathOf(r.final);
  const f = rec.findings;
  if (r.error === 'budget') { f.push({ code: 'not-swept', sev: 4, key: '', detail: 'fetch budget exhausted before this page' }); }
  else if (r.error) f.push({ code: 'fetch-error', sev: 1, key: '', detail: `${r.error} after ${r.ms} ms` });
  else if (r.status >= 500) f.push({ code: 'status-5xx', sev: 1, key: '', detail: `${r.status}${rec.chain ? ' via ' + rec.chain.join(' > ') : ''}` });
  else if (r.status >= 400) f.push({ code: 'status-4xx', sev: 1, key: '', detail: `${r.status}${rec.chain ? ' via ' + rec.chain.join(' > ') : ''}` });
  if (rec.chain) {
    if (r.offhost) f.push({ code: 'host-leak', sev: 1, key: 'redirect', detail: `redirects off host to ${r.final}` });
    else if (rec.chain.length >= 2) f.push({ code: 'redirect-chain', sev: 2, key: '', detail: `${rec.chain.length} hops: ${rec.chain.join(' > ')}` });
    else f.push({ code: 'sitemap-redirect', sev: 2, key: '', detail: `sitemap URL answers ${rec.chain[0]}` });
  }
  if (r.html && r.status === 200) {
    const voice = !p.startsWith('/listings/');
    const res = pageFindings({ html: r.html, path: rec.final || p, base: BASE, voice });
    f.push(...res.findings);
    if (res.meta.robots && /noindex/i.test(res.meta.robots)) f.push({ code: 'noindex', sev: 2, key: '', detail: `robots ${res.meta.robots} on a sitemap URL` });
    pageIds[p] = res.ids;
    for (const t of res.internal.keys()) { if (!linksOut.has(t)) linksOut.set(t, new Set()); linksOut.get(t).add(p); }
    for (const a of res.crossAnchors) crossAnchors.push({ from: p, ...a });
  } else if (r.status === 200 && !r.html) f.push({ code: 'not-html', sev: 2, key: '', detail: 'sitemap URL did not answer text/html' });
  pages[p] = rec;
}
{
  const q = toSweep.slice(); let done = 0; let stopped = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (q.length) {
      if (past(DEADLINE * 0.7)) { stopped += q.length; q.length = 0; break; }
      const p = q.shift(); await sweepOne(p);
      if (++done % 100 === 0) log(`swept ${done}/${toSweep.length}`);
    }
  }));
  if (stopped) notes.push(`sweep stopped by the clock at ${elapsed()} s with ${stopped} pages unswept`);
  phases.sweep = elapsed();
  const st = {}; for (const r of Object.values(pages)) { const k = r.error ? 'error' : `${Math.floor(r.status / 100)}xx`; st[k] = (st[k] || 0) + 1; }
  log(`sweep done: ${Object.entries(st).map(([k, v]) => `${k} ${v}`).join(', ')}, ${fetches} fetches`);
}

// 5. Links the swept pages carry that are not on the sitemap, most-referenced first.
// Query variants of one path (/sell?street=x for every street) collapse to the first seen, so the
// long tail cannot starve the check of the paths that matter.
const byPath = new Map();
for (const [t, refs] of linksOut) {
  if (sitemap.has(t)) continue;
  const key = t.split('?')[0];
  if (!byPath.has(key)) byPath.set(key, { target: t, refs: new Set(), variants: 0 });
  const e = byPath.get(key); e.variants++; for (const r of refs) e.refs.add(r);
}
const discovered = [...byPath.values()].map((e) => [e.target, e.refs, e.variants]).sort((a, b) => b[1].size - a[1].size || a[0].localeCompare(b[0]));
{
  const linkCap = Math.max(0, BUDGET - fetches - SAMPLE_N - lhJobs.length - 8);
  const q = discovered.slice(0, linkCap); let checked = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (q.length) {
      if (past(DEADLINE * 0.8)) { q.length = 0; break; }
      const [t, refs, variants] = q.shift();
      const r = await get(`${BASE}${t}`, 'links', { body: false });
      if (r.error === 'budget') { q.length = 0; break; }
      checked++;
      const rec = { status: r.status, refs: refs.size, from: [...refs].slice(0, 5), checkedAt: DATE };
      if (variants > 1) rec.variants = variants;
      if (r.chain?.length) rec.chain = r.chain.map((h) => `${h.status} ${r.offhost && h === r.chain.at(-1) ? h.to : pathOf(h.to)}`);
      const entity = t.match(/^\/(streets|condos|neighbourhoods|schools|mosques|guides|listings|market-watch)\/[^/?#]+$/);
      const via = rec.chain ? ` via ${rec.chain.join(' > ')}` : '';
      const fromTxt = `linked from ${refs.size} page${refs.size === 1 ? '' : 's'}: ${rec.from.join(', ')}${refs.size > 5 ? ', …' : ''}`;
      if (r.error) rec.finding = { code: 'link-broken', sev: 2, key: t, detail: `${r.error}; ${fromTxt}` };
      else if (r.status >= 500) rec.finding = { code: 'link-broken', sev: 1, key: t, detail: `${r.status}${via}; ${fromTxt}` };
      else if (r.status >= 400) rec.finding = { code: entity ? 'link-unpublished' : 'link-broken', sev: 2, key: t, detail: `${r.status}${via}; ${fromTxt}` };
      else if (r.offhost) rec.finding = { code: 'host-leak', sev: 1, key: t, detail: `link redirects off host${via}; ${fromTxt}` };
      // A page that renders but is not on the sitemap is unlisted, not unpublished: S3. Listings are
      // exempt; the sitemap lags the feed by design.
      else if (entity && !t.startsWith('/listings/') && !sitemap.has(pathOf(r.final))) rec.finding = { code: 'link-unpublished', sev: 3, key: t, detail: `${r.status}${via}, renders but is not on the sitemap; ${fromTxt}` };
      else if (rec.chain) rec.finding = { code: 'link-redirect', sev: 3, key: t, detail: `${rec.chain.join(' > ')}; ${fromTxt}` };
      state.links[t] = rec;
    }
  }));
  const unchecked = discovered.length - checked;
  if (unchecked > 0) notes.push(`${unchecked} of ${discovered.length} discovered links not checked tonight (budget or clock); the most-linked ${checked} were`);
  phases.links = elapsed();
  log(`links: ${discovered.length} off-sitemap targets, ${checked} checked, ${Object.values(state.links).filter((l) => l.finding).length} with findings`);
}
for (const [t, l] of Object.entries(prev?.links || {})) if (!state.links[t] && l.finding) state.links[t] = { ...l, carried: true };
// Cross-page anchors to pages swept tonight.
for (const a of crossAnchors) {
  const ids = pageIds[a.path];
  if (ids && !ids.has(a.frag)) pages[a.from].findings.push({ code: 'dead-anchor', sev: 3, key: `${a.path}#${a.frag}`, detail: `${a.path}#${a.frag} matches no id on that page` });
}

// 6. The structural sample in Chrome at 390 px: the twelve fixed pages plus a date-seeded
//    stratified draw from tonight's swept pages, so every family is looked at and a re-run on the
//    same day draws the same pages.
const seed = [...DATE].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
let rng = seed; const rand = () => { rng = (rng + 0x6d2b79f5) >>> 0; let t = rng; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const swept200 = Object.entries(pages).filter(([, r]) => r.status === 200 && !r.error).map(([p]) => p);
const pool = {}; for (const p of swept200) { if (FIXED.includes(p)) continue; (pool[family(p)] ||= []).push(p); }
const sample = FIXED.filter((p) => pages[p]?.status === 200).slice(0, SAMPLE_N);
{
  const fams = Object.keys(pool).sort(); const want = Math.max(0, SAMPLE_N - sample.length);
  // Weighted round-robin: each family gets at least one, the rest go by family size.
  const picks = []; for (const f of fams) { const arr = pool[f]; if (arr.length) picks.push(arr.splice(Math.floor(rand() * arr.length), 1)[0]); }
  while (picks.length < want) {
    const rest = fams.flatMap((f) => pool[f]); if (!rest.length) break;
    const p = rest[Math.floor(rand() * rest.length)]; picks.push(p); pool[family(p)].splice(pool[family(p)].indexOf(p), 1);
  }
  sample.push(...picks.slice(0, want));
}
state.sample = sample;
{
  let browser = null;
  try { browser = await launch(); } catch (e) { notes.push(`Chrome sample skipped: ${e.message.split('\n')[0]}`); }
  if (browser) {
    const q = sample.slice(); let n = 0;
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (q.length) {
        if (past(DEADLINE * 0.92)) { notes.push(`sample stopped by the clock with ${q.length} pages left`); q.length = 0; break; }
        const p = q.shift();
        if (!budget('sample')) { notes.push(`sample stopped: fetch budget, ${q.length + 1} pages left`); q.length = 0; break; }
        const rec = pages[p];
        try {
          const r = await inspect(browser, `${BASE}${p}`);
          rec.dom = { docWidth: r.docWidth, innerWidth: r.innerWidth, fonts: r.fonts.reduce((s, f) => s + f.count, 0) };
          rec.findings = rec.findings.filter((f) => { if (f.code !== 'dead-anchor') return true; const [target, frag] = f.key.split('#'); const samePage = target === '' || target === p || target === `${BASE}${p}`; return !(samePage && r.ids.includes(decodeURIComponent(frag || ''))); });
          if (r.docWidth > r.innerWidth + 1) rec.findings.push({ code: 'overflow-390', sev: 2, key: '', detail: `document ${r.docWidth}px wide at ${r.innerWidth}px; widest ${r.culprit || 'unknown'}` });
          if (r.fonts.length) { const top = r.fonts.sort((a, b) => b.count - a.count).slice(0, 3); rec.findings.push({ code: 'font-under-12', sev: 3, key: '', detail: `${top.reduce((s, f) => s + f.count, 0)} text nodes under 12 px: ${top.map((f) => `${f.key} ${f.fs}px x${f.count} "${f.sample}"`).join('; ')}` }); }
          n++;
        } catch (e) { rec.findings.push({ code: 'sample-error', sev: 3, key: '', detail: `Chrome could not settle the page: ${e.message.split('\n')[0].slice(0, 100)}` }); }
      }
    }));
    await browser.close().catch(() => {});
    log(`sample: ${n} of ${sample.length} pages inspected at 390`);
  }
  phases.sample = elapsed();
}
await lhDone;
fs.rmSync(lhTmp, { recursive: true, force: true });

// 7. Tonight's findings, the carried ones, and the diff against the previous night.
//    Identity is path|code|key. A page not swept tonight keeps last night's findings, marked
//    carried, and they count as neither new nor fixed.
for (const [p, r] of Object.entries(pages)) state.pages[p] = r;
for (const p of sitemap) if (!state.pages[p]) { const old = prev?.pages?.[p]; state.pages[p] = old ? { ...old, carried: true } : { status: null, findings: [{ code: 'not-swept', sev: 4, key: '', detail: 'not yet swept' }], sweptAt: '' }; }
const sampled = new Set(sample.filter((p) => pages[p]?.dom));
for (const [p, r] of Object.entries(state.pages)) {
  // Browser findings persist between samples; the raw-HTML ones refresh on every sweep.
  if (!r.carried && !sampled.has(p) && prev?.pages?.[p]?.findings) {
    for (const f of prev.pages[p].findings) if ((f.code === 'overflow-390' || f.code === 'font-under-12') && !r.findings.some((x) => x.code === f.code)) r.findings.push({ ...f, carried: true });
  }
}
const idOf = (p, f) => `${p}|${f.code}|${f.key}`;
const all = []; // { id, path, ...finding, carried }
for (const [p, r] of Object.entries(state.pages)) for (const f of r.findings) if (f.code !== 'not-swept') all.push({ id: idOf(p, f), path: p, ...f, carried: !!(r.carried || f.carried) });
for (const [t, l] of Object.entries(state.links)) if (l.finding) all.push({ id: idOf(t, l.finding), path: t, ...l.finding, carried: !!l.carried });
const prevAll = new Map();
if (prev) {
  for (const [p, r] of Object.entries(prev.pages || {})) for (const f of r.findings || []) if (f.code !== 'not-swept') prevAll.set(idOf(p, f), { path: p, ...f });
  for (const [t, l] of Object.entries(prev.links || {})) if (l.finding) prevAll.set(idOf(t, l.finding), { path: t, ...l.finding });
}
const nowIds = new Set(all.map((f) => f.id));
const rechecked = (id) => { const p = id.split('|')[0]; const code = id.split('|')[1]; if (nowIds.has(id)) return true; if (state.links[p]) return !state.links[p].carried; if (!pages[p]) return false; if ((code === 'overflow-390' || code === 'font-under-12') && !sampled.has(p)) return false; return true; };
const fresh = all.filter((f) => !f.carried && !prevAll.has(f.id));
const fixed = [...prevAll.entries()].filter(([id]) => !nowIds.has(id) && rechecked(id)).map(([, f]) => f);
const order = (a, b) => a.sev - b.sev || a.code.localeCompare(b.code) || a.path.localeCompare(b.path);
fresh.sort(order); fixed.sort(order); all.sort(order);
// Lighthouse moves.
const lhMoves = [];
for (const [p, r] of Object.entries(state.lh)) {
  const o = prev?.lh?.[p]; if (!o || o.error || r.error) { if (r.error) lhMoves.push({ path: p, sev: 3, text: `Lighthouse failed: ${r.error}` }); continue; }
  for (const k of ['perf', 'seo', 'a11y', 'bp']) { const d = (r[k] ?? 0) - (o[k] ?? 0); if (Math.abs(d) >= (k === 'perf' ? 10 : 5)) lhMoves.push({ path: p, sev: d < 0 ? 3 : 4, text: `${k} ${o[k]} > ${r[k]} (${d > 0 ? '+' : ''}${d})` }); }
  if (o.lcp && Math.abs(r.lcp - o.lcp) >= Math.max(500, o.lcp * 0.25)) lhMoves.push({ path: p, sev: r.lcp > o.lcp ? 3 : 4, text: `LCP ${o.lcp} > ${r.lcp} ms` });
  for (const k of ['seo', 'a11y', 'bp']) { const was = new Set(o.failing?.[k] || []); const now = new Set(r.failing?.[k] || []); const add = [...now].filter((x) => !was.has(x)); const gone = [...was].filter((x) => !now.has(x)); if (add.length) lhMoves.push({ path: p, sev: 3, text: `${k} now failing ${add.join(', ')}` }); if (gone.length) lhMoves.push({ path: p, sev: 4, text: `${k} no longer failing ${gone.join(', ')}` }); }
}
lhMoves.sort((a, b) => a.sev - b.sev || a.path.localeCompare(b.path));

// 8. The report and the state.
const runSeconds = elapsed();
const counts = (arr) => [1, 2, 3, 4].map((s) => `${SEV[s]} ${arr.filter((f) => f.sev === s).length}`).join(' · ');
const sweptTonight = Object.keys(pages).length;
const neverSwept = [...sitemap].filter((p) => !state.pages[p]?.sweptAt).length;
const rotationNights = rotating.length ? Math.ceil(rotating.length / Math.max(1, Math.min(rotating.length, sweepCap - always.length))) : 1;
const statusCounts = {}; const ttfbs = [];
for (const r of Object.values(pages)) { const k = r.error ? `error (${r.error})` : String(r.status); statusCounts[k] = (statusCounts[k] || 0) + 1; if (r.status === 200 && !r.chain) ttfbs.push(r.ms); }
ttfbs.sort((a, b) => a - b); const pct = (q) => ttfbs.length ? ttfbs[Math.min(ttfbs.length - 1, Math.floor(ttfbs.length * q))] : null;
const cacheCounts = {}; for (const r of Object.values(pages)) if (r.cache) cacheCounts[r.cache] = (cacheCounts[r.cache] || 0) + 1;
const sha = process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 7) : null;
const reportRel = `scratchpad/audit/nightly/${DATE}.md`;
const reportUrl = `https://github.com/${REPO}/blob/${BRANCH}/${reportRel}`;

const line = (f) => `- ${SEV[f.sev]} \`${f.code}\` ${f.path} · ${f.detail}`;
const listCapped = (arr, cap, empty, tail) => arr.length ? arr.slice(0, cap).map(line).join('\n') + (arr.length > cap ? `\n- and ${arr.length - cap} ${tail}` : '') : empty;
function grouped(arr, cap = 25) {
  const out = []; const byCode = new Map();
  for (const f of arr) { if (!byCode.has(f.code)) byCode.set(f.code, []); byCode.get(f.code).push(f); }
  for (const [code, fs_] of byCode) {
    out.push(`\n**${SEV[fs_[0].sev]} \`${code}\` · ${fs_.length}**\n`);
    for (const f of fs_.slice(0, cap)) out.push(`- ${f.path} · ${f.detail}${f.carried ? ' _(carried, not re-swept tonight)_' : ''}`);
    if (fs_.length > cap) out.push(`- and ${fs_.length - cap} more in state.json`);
  }
  return out.join('\n');
}
const lhTable = () => {
  const rows = Object.entries(state.lh); if (!rows.length) return '_not run_';
  return ['| page | perf | seo | a11y | bp | LCP ms | CLS | TBT ms | TTFB ms | KB |', '|---|---|---|---|---|---|---|---|---|---|',
    ...rows.map(([p, r]) => r.error ? `| ${p} | error: ${r.error} | | | | | | | | |` : `| ${p} | ${r.perf} | ${r.seo} | ${r.a11y} | ${r.bp} | ${r.lcp} | ${r.cls} | ${r.tbt} | ${r.ttfb} | ${r.kb} |`)].join('\n');
};
const open = all.filter((f) => f.sev <= 3);
const report = `# Nightly audit ${DATE}

${BASE}${sha ? ` · audit code \`${sha}\`` : ''} · run ${new Date(T0).toISOString()} · ${runSeconds} s of ${DEADLINE / 1000} · ${fetches} of ${BUDGET} fetches · previous night ${prev ? prev.date : 'none (baseline)'}

## Summary

- Sitemap ${sitemap.size} URLs: ${Object.entries(families).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}.${state.sitemapDelta ? ` Since ${prev.date}: ${state.sitemapDelta.joined} joined, ${state.sitemapDelta.left} left.` : ''}
- Swept tonight ${sweptTonight}: the ${always.length} pages outside \`/streets\` and \`/listings\` every night, the ${rotating.length} streets and listings in rotation (oldest sweep first, the whole set every ${rotationNights} night${rotationNights === 1 ? '' : 's'}). Never swept: ${neverSwept}.
- Status: ${Object.entries(statusCounts).sort().map(([k, v]) => `${k} × ${v}`).join(', ')}. GET p50 ${pct(0.5)} ms, p95 ${pct(0.95)} ms.${Object.keys(cacheCounts).length ? ` Cache: ${Object.entries(cacheCounts).sort().map(([k, v]) => `${k} ${v}`).join(', ')}.` : ''}
- Off-sitemap links: ${discovered.length} targets, ${Object.keys(state.links).length} checked, ${Object.values(state.links).filter((l) => l.finding).length} with findings.
- Sample at 390 px: ${sampled.size} of ${sample.length} pages; overflow on ${[...sampled].filter((p) => pages[p].findings.some((f) => f.code === 'overflow-390')).length}, fonts under 12 px on ${[...sampled].filter((p) => pages[p].findings.some((f) => f.code === 'font-under-12' && !f.carried)).length}.
- Open findings ${open.length}: ${counts(open)}. New tonight ${fresh.length}: ${counts(fresh)}. Fixed since ${prev ? prev.date : 'baseline'}: ${fixed.length}.
${notes.length ? `- Run notes: ${notes.join('; ')}.` : ''}
## Changed since ${prev ? prev.date : 'baseline'}

### Broke or appeared (${fresh.length})
${listCapped(fresh, 200, '_nothing new_', 'more, all under Open findings')}

### Fixed (${fixed.length})
${listCapped(fixed, 200, '_nothing fixed_', 'more in state.json')}

### Lighthouse moves (${lhMoves.length})
${lhMoves.length ? lhMoves.map((m) => `- ${SEV[m.sev]} ${m.path} · ${m.text}`).join('\n') : prev?.lh && Object.keys(prev.lh).length ? '_no score moved 10 points, no LCP moved a quarter_' : '_first Lighthouse night, nothing to compare_'}

## Open findings (${open.length})
${grouped(open)}

## Lighthouse (mobile, 390 px, simulated slow 4G)

${lhTable()}

## Sample (${sample.length})

${sample.map((p) => { const r = pages[p]; const d = r?.dom; return `- ${p} · ${r?.status ?? '?'}${d ? ` · ${d.docWidth > d.innerWidth + 1 ? `overflow ${d.docWidth}px` : 'no overflow'} · ${d.fonts} under 12 px` : ' · not inspected'}`; }).join('\n')}

## Budget

- Fetches by phase: ${Object.entries(fetchesBy).map(([k, v]) => `${k} ${v}`).join(', ')}; total ${fetches} of ${BUDGET}.
- Seconds at phase end: ${Object.entries(phases).map(([k, v]) => `${k} ${v}`).join(', ')}; total ${runSeconds} of ${DEADLINE / 1000}.
- Chrome ${CHROME || 'none'}; Lighthouse ${LH_BIN || 'none'}.
`;
fs.writeFileSync(path.join(OUT, `${DATE}.md`), report);
fs.writeFileSync(STATE_FILE, JSON.stringify(state));
log(`report ${path.relative(ROOT, path.join(OUT, `${DATE}.md`))}; open ${open.length} (${counts(open)}); new ${fresh.length}; fixed ${fixed.length}; lh moves ${lhMoves.length}`);

// 9. One email: what changed or broke, severity-ranked. A quiet night still sends three lines so
//    silence means the job did not run.
if (!NO_EMAIL) {
  const key = process.env.RESEND_API_KEY; const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) { console.error('RESEND_API_KEY or RESEND_FROM_EMAIL unset; no email'); }
  else {
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const s1 = fresh.filter((f) => f.sev === 1).length;
    const subject = !prev ? `Miltonly nightly audit ${DATE}: baseline, ${open.length} open findings`
      : fresh.length || fixed.length || lhMoves.some((m) => m.sev <= 3) ? `Miltonly nightly audit ${DATE}: ${fresh.length} broke${s1 ? ` (${s1} S1)` : ''}, ${fixed.length} fixed${lhMoves.some((m) => m.sev <= 3) ? ', Lighthouse moved' : ''}`
      : `Miltonly nightly audit ${DATE}: no change, ${open.length} open`;
    const ul = (arr, cap = 60) => arr.length ? `<ul style="padding-left:18px;margin:6px 0 14px">${arr.slice(0, cap).map((f) => `<li style="margin:0 0 6px"><span style="font-family:JetBrains Mono,Menlo,monospace;font-size:12px;color:#fff;background:${f.sev === 1 ? '#a3211a' : f.sev === 2 ? '#073126' : '#5a6b64'};padding:1px 6px;border-radius:3px">${SEV[f.sev]}</span> <code>${esc(f.code)}</code> <a href="${BASE}${esc(f.path)}" style="color:#017848">${esc(f.path)}</a><br><span style="color:#444">${esc(f.detail)}</span></li>`).join('')}${arr.length > cap ? `<li>and ${arr.length - cap} more in the report</li>` : ''}</ul>` : '<p style="color:#666;margin:6px 0 14px">none</p>';
    const h = (t) => `<h3 style="font:600 15px/1.3 Inter,system-ui,sans-serif;color:#073126;margin:18px 0 4px">${t}</h3>`;
    const quiet = prev && !fresh.length && !fixed.length && !lhMoves.some((m) => m.sev <= 3);
    const html = `<div style="font:14px/1.5 Inter,system-ui,sans-serif;color:#1a1a1a;background:#f6f4ef;padding:24px"><div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;padding:24px 28px">
<h2 style="font:600 20px/1.2 Fraunces,Georgia,serif;color:#073126;margin:0 0 6px">Nightly audit ${DATE}</h2>
<p style="color:#444;margin:0 0 12px">${esc(BASE)}${sha ? ` · audit code ${sha}` : ''} · ${sweptTonight} of ${sitemap.size} pages swept · ${fetches} fetches · ${runSeconds} s${notes.length ? `<br><span style="color:#a3211a">${esc(notes.join('; '))}</span>` : ''}</p>
${!prev ? `<p><strong>Baseline night.</strong> Nothing to diff against; every open finding is listed by severity.</p>${h(`Open findings (${open.length})`)}${ul(open, 80)}` : quiet ? `<p><strong>Nothing changed.</strong> ${open.length} findings still open (${esc(counts(open))}).</p>` : `${h(`Broke or appeared (${fresh.length})`)}${ul(fresh)}${h(`Fixed (${fixed.length})`)}${ul(fixed, 30)}${h(`Lighthouse moves (${lhMoves.filter((m) => m.sev <= 3).length})`)}${lhMoves.filter((m) => m.sev <= 3).length ? `<ul style="padding-left:18px">${lhMoves.filter((m) => m.sev <= 3).map((m) => `<li><a href="${BASE}${esc(m.path)}" style="color:#017848">${esc(m.path)}</a> · ${esc(m.text)}</li>`).join('')}</ul>` : '<p style="color:#666">none</p>'}<p style="margin-top:16px">Still open: ${open.length} (${esc(counts(open))}).</p>`}
<p style="margin-top:18px;color:#444">Full report: <a href="${reportUrl}" style="color:#017848">${esc(reportRel)}</a></p>
</div></div>`;
    const text = [`Nightly audit ${DATE}`, `${BASE} · ${sweptTonight} of ${sitemap.size} swept · ${fetches} fetches · ${runSeconds} s`, ...(notes.length ? [`Notes: ${notes.join('; ')}`] : []), '',
      ...(!prev ? [`Baseline: ${open.length} open (${counts(open)})`, ...open.slice(0, 80).map((f) => `${SEV[f.sev]} ${f.code} ${f.path}: ${f.detail}`)]
        : quiet ? [`Nothing changed. ${open.length} still open (${counts(open)}).`]
          : [`Broke or appeared (${fresh.length}):`, ...fresh.slice(0, 60).map((f) => `${SEV[f.sev]} ${f.code} ${f.path}: ${f.detail}`), '', `Fixed (${fixed.length}):`, ...fixed.slice(0, 30).map((f) => `${SEV[f.sev]} ${f.code} ${f.path}`), '', `Lighthouse moves:`, ...lhMoves.filter((m) => m.sev <= 3).map((m) => `${m.path}: ${m.text}`), '', `Still open: ${open.length} (${counts(open)})`]),
      '', `Report: ${reportUrl}`].join('\n');
    try {
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ from, to: [TO], subject, html, text }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { console.error(`email failed ${r.status}: ${JSON.stringify(j).slice(0, 200)}`); process.exitCode = 3; }
      else { log(`email ${j.id} to ${TO}`); fs.appendFileSync(path.join(OUT, `${DATE}.md`), `\nEmail \`${j.id}\` to ${TO}, subject "${subject}".\n`); }
    } catch (e) { console.error(`email failed: ${e.message}`); process.exitCode = 3; }
  }
}
log(`done in ${elapsed()} s, ${fetches} fetches`);
if (fetches > BUDGET) process.exitCode = 4;

function loadEnvLocal() {
  const f = path.join(ROOT, '.env.local'); if (!fs.existsSync(f)) return;
  for (const l of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m || process.env[m[1]] != null) continue;
    process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, '$2');
  }
}
