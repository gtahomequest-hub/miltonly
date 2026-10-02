// MC-046 THE LEAK TEST. A signed-out client, every page type, every payload: no VOW-derived value.
//
//   BASE=https://<preview> node scripts/verify/leak.mjs [--pages=all|sample] [--rsc=all|sample]
//
// It reads what a TRREB auditor would read with DevTools open, and nothing it finds is printed:
// the output is totals per surface. Exits 0 clean, 1 on any leak, 2 when it could not run.
//
// Surfaces: every sitemap URL (HTML and its RSC payload, fetched with the `RSC: 1` header, which
// carries the nav's client props), the pages taken out of the sitemap (Market Watch, noindexed
// guides, /value), JSON-LD blocks, every /api route answered signed out (enumerated from
// src/app/api, GET on all, POST only where the route is cron- or admin-gated), each street's
// og.png and card, the sitemaps, robots and manifest, a 404, and the 500 page.
//
// Checks:
//   (a) MARKER. Every component that renders a VOW-derived value carries `data-vow`; no anonymous
//       response may contain one (HTML attribute or RSC prop).
//   (b) VALUE. The VOW-derived values the old code showed are recomputed from DB2, DB3 and the
//       DB1 rows that stored them, per street, per hub, per condo and Milton-wide, in every format
//       the pages used; none may appear. A money token preceded by asking/list wording is counted
//       as explained (an IDX asking price can coincide with a sold typical) and reported apart.
//   (c) CLASS. No phrase of the VOW kinds survives in any form: "N sales / sold / leases",
//       "N days on market / to sell / to lease", sold- or leased-to-ask with a figure, a typical
//       sold price or rent with a figure.
//   (d) CLEAN RENDER. No "undefined" or "NaN" in visible text, no empty <section>, no element
//       holding only a separator.
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { get } from './lib/http.mjs';
import { loadEnv, requireEnv, REPO_ROOT } from './lib/env.mjs';
import { identityKey } from './lib/db.mjs';
import { shortCAD, roundForDisplay } from './lib/money.mjs';

const BASE = process.env.BASE;
if (!BASE) { console.error('BASE is required'); process.exit(2); }
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `=${d}`).split('=')[1];
const PAGES = arg('pages', 'all');
const RSC_MODE = arg('rsc', 'all');
loadEnv();
requireEnv('SOLD_DATABASE_URL', 'ANALYTICS_DATABASE_URL', 'DATABASE_URL');
const sold = neon(process.env.SOLD_DATABASE_URL);
const analytics = neon(process.env.ANALYTICS_DATABASE_URL);
const app = neon(process.env.DATABASE_URL);

// ── formats ──────────────────────────────────────────────────────────────────────────────────
const full = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const roundTo = (n, s) => Math.round(n / s) * s;
function priceTokens(v) {
  if (!Number.isFinite(v) || v < 50000) return [];
  const t = new Set();
  for (const s of [1, 1000, 5000, 10000, 25000]) { const r = roundTo(v, s); t.add(shortCAD(r)); t.add(full(r)); }
  t.add(shortCAD(roundForDisplay(v))); t.add(full(roundForDisplay(v)));
  if (v >= 1e6) for (const d of [1, 2]) t.add(`$${(v / 1e6).toFixed(d)}M`);
  return [...t].filter(Boolean);
}
function rentTokens(v) {
  if (!Number.isFinite(v) || v < 500 || v > 20000) return [];
  const t = new Set();
  for (const s of [1, 5, 10, 25, 50, 100]) t.add(full(roundTo(v, s)));
  return [...t];
}
const num = (x) => (x === null || x === undefined ? null : Number(x));

// ── the VOW record, recomputed (held in memory, never printed) ───────────────────────────────
async function loadValues() {
  const streets = new Map(); // identityKey -> Set(tokens)
  const add = (map, k, toks) => { if (!map.has(k)) map.set(k, new Set()); for (const x of toks) map.get(k).add(x); };
  const W12 = `sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW()`;
  const W24 = `sold_date >= NOW() - INTERVAL '24 months' AND sold_date <= NOW()`;
  const q = (db, text) => db.query(text);

  for (const r of await q(sold, `SELECT street_slug s, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) med, AVG(sold_price) mean, MIN(sold_price) lo, MAX(sold_price) hi
      FROM sold.sold_records WHERE perm_advertise AND transaction_type='For Sale' AND ${W12} GROUP BY 1`))
    add(streets, identityKey(r.s), [r.med, r.mean, r.lo, r.hi].flatMap((v) => priceTokens(num(v))));
  for (const r of await q(sold, `SELECT street_slug s, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) med, MIN(sold_price) lo, MAX(sold_price) hi
      FROM sold.sold_records WHERE perm_advertise AND transaction_type='For Sale' AND ${W24} AND sold_price IS NOT NULL GROUP BY 1`))
    add(streets, identityKey(r.s), [r.med, r.lo, r.hi].flatMap((v) => priceTokens(num(v))));
  for (const r of await q(sold, `SELECT street_slug s, property_type t, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) med, MIN(sold_price) lo, MAX(sold_price) hi
      FROM sold.sold_records WHERE perm_advertise AND transaction_type='For Sale' AND ${W12} GROUP BY 1,2`))
    add(streets, identityKey(r.s), [r.med, r.lo, r.hi].flatMap((v) => priceTokens(num(v))));
  for (const r of await q(sold, `SELECT street_slug s, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) med, beds b
      FROM sold.sold_records WHERE perm_advertise AND transaction_type='For Lease' AND ${W12} GROUP BY ROLLUP(1, 3)`))
    if (r.s) add(streets, identityKey(r.s), rentTokens(num(r.med)));
  for (const r of await q(analytics, `SELECT street_slug s, avg_sold_price a, median_sold_price m FROM analytics.street_sold_stats`))
    add(streets, identityKey(r.s), [r.a, r.m].flatMap((v) => priceTokens(num(v))));

  // Hubs and Milton-wide: checked on every page (the menu and the ladders carried them everywhere).
  const everywhere = new Set();
  const put = (toks) => toks.forEach((x) => everywhere.add(x));
  for (const r of await q(sold, `SELECT neighbourhood n, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) med, AVG(sold_price) mean, MIN(sold_price) lo, MAX(sold_price) hi
      FROM sold.sold_records WHERE perm_advertise AND transaction_type='For Sale' AND ${W12} GROUP BY 1`))
    put([r.med, r.mean].flatMap((v) => priceTokens(num(v))));
  for (const r of await q(sold, `SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) med, AVG(sold_price) mean FROM sold.sold_records
      WHERE perm_advertise AND transaction_type='For Sale' AND ${W12}`)) put([r.med, r.mean].flatMap((v) => priceTokens(num(v))));
  for (const r of await q(sold, `SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) med FROM sold.sold_records
      WHERE city='Milton' AND perm_advertise AND transaction_type='For Sale' AND sold_date >= date_trunc('month', NOW()) AND sold_date <= NOW()`)) put(priceTokens(num(r.med)));
  for (const r of await q(sold, `SELECT property_type t, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) med FROM sold.sold_records
      WHERE perm_advertise AND transaction_type='For Sale' AND ${W12} GROUP BY 1`)) put(priceTokens(num(r.med)));
  for (const r of await q(sold, `SELECT property_type t, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sold_price) med FROM sold.sold_records
      WHERE perm_advertise AND transaction_type='For Lease' AND ${W12} GROUP BY 1`)) put(rentTokens(num(r.med)));
  // The Board: every money leaf of board_stats.
  const leaves = (o, out = []) => { if (o && typeof o === 'object') for (const v of Object.values(o)) leaves(v, out); else if (typeof o === 'number') out.push(o); return out; };
  for (const r of await q(analytics, `SELECT data FROM analytics.board_stats`)) put(leaves(r.data).flatMap(priceTokens));

  // Condos: the stored statsJson each building page printed.
  const condos = new Map();
  for (const r of await q(app, `SELECT "buildingSlug" s, "statsJson" j FROM "CondoContent" WHERE status='published' AND "statsJson" IS NOT NULL`)) {
    try { add(condos, r.s, leaves(JSON.parse(r.j)).flatMap(priceTokens)); } catch { /* unparseable row: nothing to add */ }
  }
  // Market Watch: every money leaf the editions stored.
  const editions = new Set();
  for (const r of await q(app, `SELECT "sectionsJson" j FROM "MarketEdition"`)) leaves(r.j).flatMap(priceTokens).forEach((x) => editions.add(x));

  // AMBIGUITY. A sold typical rounded to $5,000 can equal an active listing's asking price, and a
  // lease median rounded to $50 can equal an available unit's asking rent; the page shows those
  // asking prices by right (IDX). A token that equals a public asking price in the same format
  // cannot be told apart in text, so it is dropped from the search and counted, never matched.
  const idx = new Set();
  for (const r of await q(app, `SELECT price p FROM "Listing" WHERE "permAdvertise" AND city = 'Milton'
      AND ((status = 'active' AND ("transactionType" IS NULL OR "transactionType" <> 'For Lease'))
        OR ("transactionType" = 'For Lease' AND "leaseStatus" = 'active'))`)) {
    for (const t of [...priceTokens(num(r.p)), ...rentTokens(num(r.p))]) idx.add(t);
  }
  let ambiguous = 0;
  const clean = (set) => { for (const t of [...set]) if (idx.has(t)) { set.delete(t); ambiguous++; } };
  clean(everywhere); clean(editions);
  for (const m of [streets, condos]) for (const set of m.values()) clean(set);
  return { streets, everywhere, condos, editions, ambiguous, idxTokens: idx.size };
}

// ── what the page says, as text ──────────────────────────────────────────────────────────────
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;| /g, ' ');
const visibleText = (html) => decode(html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
// The flight payload's STRING CONTENTS, joined: the text a component received. Its structure is
// left out: React references ("$L1"), element keys ("0"), and tag or prop names ("h2", "className"),
// which carry digits a phrase check would otherwise read as figures.
const rscText = (body) => [...body.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1])
  .filter((x) => !/^\$(?!\d)/.test(x) && !/^\d+$/.test(x) && !/^[A-Za-z][A-Za-z0-9-]{0,24}$/.test(x)).join(' | ');
const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

const MARKER_HTML = /\sdata-vow(?=[\s=>\/])/;
const MARKER_RSC = /"data-vow"\s*:/;
const CLASS = [
  // Lower case on purpose: "12 Sales Court" is an address on a street named Sales Court.
  ['count', /\b\d[\d,]*\s+(?:homes?\s+|closed\s+)?(?:sales|sold|resales|leases|leased)\b/],
  ['dom', /\b\d+\s+days?\s+(?:on\s+(?:the\s+)?market|to\s+sell|to\s+lease)\b|days on market[^.]{0,24}\d/i],
  ['to-ask', /(?:sold|leased|sale)[- ]to[- ](?:ask|list)[^.]{0,30}\d|\d[\d.]*%\s+(?:of|over|under)\s+(?:ask|asking|list)/i],
  // "typical asking" is IDX (the median of active asking prices) and is not a finding.
  ['typical', /\btypical(?:ly)?\s+(?!asking)(?:(?:sold|sale|sale price|rent|price|home)\s+)?(?:(?:is|of|at|around|near)\s+)?~?\$\d/i],
];
const EXPLAINED = /(asking|list(?:ed|ing)?|for sale|for rent|avg ask)[^$]{0,60}$/i;

function scanValue(text, tokens, tally, key) {
  for (const tok of tokens) {
    let i = text.indexOf(tok);
    while (i !== -1) {
      const after = text[i + tok.length];
      // a token must end where a figure ends ("$950K" must not match inside "$950K5")
      if (!after || !/[0-9]/.test(after)) {
        if (EXPLAINED.test(text.slice(Math.max(0, i - 80), i))) tally[`${key}_explained`] = (tally[`${key}_explained`] || 0) + 1;
        else tally[key] = (tally[key] || 0) + 1;
      }
      i = text.indexOf(tok, i + 1);
    }
  }
}

function cleanRender(html, tally) {
  const text = visibleText(html);
  if (/\bundefined\b/.test(text)) tally.undefined = (tally.undefined || 0) + 1;
  if (/\bNaN\b/.test(text)) tally.nan = (tally.nan || 0) + 1;
  for (const m of html.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/g)) {
    const inner = m[1];
    if (/<section\b/.test(inner)) continue;
    const headings = [...inner.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/g)].map((h) => visibleText(h[1])).join(' ').trim();
    const all = visibleText(inner).trim();
    if (!all || all === headings) { tally.empty_section = (tally.empty_section || 0) + 1; break; }
  }
  // A dash alone in an element is what a removed figure leaves behind ("Typical: –"). The design's
  // own dot and pipe separators between links are not findings.
  // The menu's A to Z marks a letter with no street pages with a dash by design (m-mega-az-off).
  const body = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!-- -->/g, '').replace(/<span class="m-mega-az-off"[^>]*>[\s\S]*?<\/span><\/span>/g, '');
  if (/>\s*[–—-]\s*</.test(body)) { tally.lone_separator = (tally.lone_separator || 0) + 1; return true; }
  return false;
}

// ── the surfaces ─────────────────────────────────────────────────────────────────────────────
function apiRoutes() {
  const root = path.join(REPO_ROOT, 'src', 'app', 'api');
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'route.ts' || e.name === 'route.tsx') {
        const src = fs.readFileSync(p, 'utf8');
        const rel = path.relative(root, path.dirname(p)).split(path.sep).join('/');
        out.push({
          route: `/api/${rel}`,
          get: /export\s+(?:async\s+)?function\s+GET\b|export\s+const\s+GET\b/.test(src),
          post: /export\s+(?:async\s+)?function\s+POST\b/.test(src),
          gatedPost: /vowSystemAccess|CRON_SECRET|verifyAdminCookieValue|REVALIDATION_SECRET|CONTENT_ENGINE_API_TOKEN/.test(src),
        });
      }
    }
  };
  walk(root);
  return out;
}

async function main() {
  const t0 = Date.now();
  const build = await get(`${BASE}/api/build`);
  let served = 'unknown';
  try { served = JSON.parse(build.body).commit?.slice(0, 7) ?? 'unknown'; } catch { /* reported as unknown */ }
  console.log(`\n═══ MC-046 LEAK TEST ═══\ntarget   ${BASE}\nbuild    ${served}`);

  const V = await loadValues();

  // --explain=<path>: where each finding on one page sits, every digit masked (no value printed).
  const EXPLAIN = arg('explain', '');
  if (EXPLAIN) {
    const mask = (t) => t.replace(/\d/g, '#').replace(/\s+/g, ' ');
    const streetKey = EXPLAIN.startsWith('/streets/') ? identityKey(EXPLAIN.split('/')[2].split('?')[0]) : null;
    const condoKey = EXPLAIN.startsWith('/condos/') ? EXPLAIN.split('/')[2] : null;
    const tokens = [...V.everywhere, ...(streetKey && V.streets.get(streetKey) ? V.streets.get(streetKey) : []), ...(condoKey && V.condos.get(condoKey) ? V.condos.get(condoKey) : []), ...V.editions];
    for (const [label, headers] of [['html', {}], ['rsc', { RSC: '1' }]]) {
      const body = decode(await (await fetch(`${BASE}${EXPLAIN}`, { headers })).text());
      const text = label === 'html' ? visibleText(body) : rscText(body);
      for (const tok of tokens) for (let i = text.indexOf(tok); i !== -1; i = text.indexOf(tok, i + 1)) console.log(`${label} value   …${mask(text.slice(Math.max(0, i - 120), i + tok.length + 30))}…`);
      for (const [k, re] of CLASS) { const m = text.match(re); if (m) console.log(`${label} class:${k} …${mask(text.slice(Math.max(0, m.index - 80), m.index + m[0].length + 30))}…`); }
      if (label === 'html') for (const m of body.replace(/<script[\s\S]*?<\/script>/g, '').matchAll(/>\s*[–—-]\s*</g)) console.log(`html separator …${mask(body.replace(/<script[\s\S]*?<\/script>/g, '').slice(Math.max(0, m.index - 160), m.index + 20))}…`);
    }
    process.exit(0);
  }
  console.log(`record   ${V.streets.size} street identities, ${V.everywhere.size} Milton-wide and hub tokens, ${V.condos.size} condos, ${V.editions.size} edition tokens; ${V.ambiguous} tokens dropped as equal to a public asking price (${V.idxTokens} IDX tokens); values held in memory, not printed`);

  const sm = await get(`${BASE}/sitemap.xml`);
  if (sm.status !== 200) { console.error(`sitemap ${sm.status}`); process.exit(2); }
  let urls = [...new Set([...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, '') || '/'))];
  const inSitemap = new Set(urls);
  // Pages out of the sitemap that must still be clean.
  const extra = ['/market-watch', '/sold', '/sold?nbhd=old-milton', '/value/old-milton', '/guides', '/signin', '/this-page-does-not-exist-mc046'];
  for (const r of await app.query(`SELECT "weekOf" w FROM "MarketEdition" ORDER BY 1 DESC LIMIT 8`)) extra.push(`/market-watch/${r.w}`);
  // Everything production's sitemap lists is read too, so a page this build took out of the
  // sitemap (Market Watch, a noindexed guide) is still checked.
  const prodMap = await get(process.env.PROD_SITEMAP || 'https://miltonly.com/sitemap.xml');
  for (const m of prodMap.body.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const u = m[1].replace(/^https?:\/\/[^/]+/, '') || '/';
    if (!u.startsWith('/listings/') && !inSitemap.has(u)) extra.push(u);
  }
  urls = [...new Set([...urls, ...extra])];
  if (PAGES === 'sample') urls = urls.filter((u, i) => !u.startsWith('/streets/') && !u.startsWith('/listings/') || i % 20 === 0);

  const tally = {}; // surface -> counters
  const T = (s) => (tally[s] ??= { requests: 0, ok: 0 });
  const note = (t, key, u) => { t.examples ??= {}; const e = (t.examples[key] ??= []); if (e.length < 3 && !e.includes(u)) e.push(u); };
  const surfaceOf = (u) => u === '/' ? 'home' : u.startsWith('/this-page-does-not-exist') ? '404' : u.split(/[/?]/)[1] || 'home';

  let i = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (i < urls.length) {
      const u = urls[i++];
      const s = surfaceOf(u);
      const t = T(`html:${s}`);
      const r = await fetch(`${BASE}${u}`, { headers: { 'user-agent': 'miltonly-leak' }, redirect: 'manual' }).catch(() => null);
      t.requests++;
      if (!r) { t.error = (t.error || 0) + 1; continue; }
      t[`status_${r.status}`] = (t[`status_${r.status}`] || 0) + 1;
      if (r.status >= 300 && r.status < 400) continue;
      const html = await r.text();
      t.ok++;
      const streetKey = u.startsWith('/streets/') ? identityKey(u.split('/')[2].split('?')[0]) : null;
      const condoKey = u.startsWith('/condos/') ? u.split('/')[2] : null;
      const tokens = [...V.everywhere, ...(streetKey && V.streets.get(streetKey) ? V.streets.get(streetKey) : []), ...(condoKey && V.condos.get(condoKey) ? V.condos.get(condoKey) : []), ...V.editions];
      if (MARKER_HTML.test(html)) { t.marker = (t.marker || 0) + 1; note(t, 'marker', u); }
      const text = visibleText(html);
      const before = t.value || 0;
      scanValue(text, tokens, t, 'value');
      if ((t.value || 0) > before) note(t, 'value', u);
      for (const [k, re] of CLASS) if (re.test(text)) { t[`class_${k}`] = (t[`class_${k}`] || 0) + 1; note(t, `class_${k}`, u); }
      const ld = jsonLd(html);
      const tl = T('jsonld');
      tl.requests += ld.length; tl.ok += ld.length;
      for (const block of ld) {
        if (/data-vow/.test(block)) tl.marker = (tl.marker || 0) + 1;
        const lb = tl.value || 0;
        scanValue(decode(block), tokens, tl, 'value');
        if ((tl.value || 0) > lb) note(tl, 'value', u);
        for (const [k, re] of CLASS) if (re.test(decode(block))) { tl[`class_${k}`] = (tl[`class_${k}`] || 0) + 1; note(tl, `class_${k}`, u); }
        if (/"additionalProperty"|"aggregatePrice"/.test(block)) tl.vow_node = (tl.vow_node || 0) + 1;
      }
      if (cleanRender(html, t)) note(t, 'lone_separator', u);
      if (!inSitemap.has(u) && !extra.includes(u)) t.unlisted = (t.unlisted || 0) + 1;

      if (RSC_MODE === 'all' || i % 10 === 0) {
        const tr = T(`rsc:${s}`);
        const rr = await fetch(`${BASE}${u}`, { headers: { RSC: '1', 'user-agent': 'miltonly-leak' }, redirect: 'manual' }).catch(() => null);
        tr.requests++;
        if (rr && rr.status < 300) {
          const body = await rr.text();
          tr.ok++;
          if (MARKER_RSC.test(body) || MARKER_HTML.test(body)) tr.marker = (tr.marker || 0) + 1;
          const rt = decode(rscText(body));
          const rb = tr.value || 0;
          scanValue(rt, tokens, tr, 'value');
          if ((tr.value || 0) > rb) note(tr, 'value', u);
          for (const [k, re] of CLASS) if (re.test(rt)) { tr[`class_${k}`] = (tr[`class_${k}`] || 0) + 1; note(tr, `class_${k}`, u); }
        } else tr[`status_${rr ? rr.status : 0}`] = (tr[`status_${rr ? rr.status : 0}`] || 0) + 1;
      }
    }
  }));

  // Signed-out API routes. A dynamic segment gets a real value from the page set.
  const aStreet = urls.find((u) => u.startsWith('/streets/'))?.split('/')[2] ?? 'main-street-east-milton';
  const aListing = urls.find((u) => u.startsWith('/listings/'))?.split('/')[2] ?? 'W0000000';
  const fill = (r) => r.replace('[slug]', aStreet).replace('[mlsNumber]', aListing).replace(/\[[^\]]+\]/g, 'x');
  const ta = T('api');
  const cardFields = { figure: 0, basis: 0, count: 0 };
  for (const r of apiRoutes()) {
    const url = `${BASE}${fill(r.route)}`;
    const calls = [];
    if (r.get) calls.push(fetch(url, { headers: { 'user-agent': 'miltonly-leak' }, redirect: 'manual' }));
    if (r.post && r.gatedPost) calls.push(fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'miltonly-leak' }, body: '{}', redirect: 'manual' }));
    for (const p of calls) {
      const res = await p.catch(() => null);
      ta.requests++;
      if (!res) { ta.error = (ta.error || 0) + 1; continue; }
      ta[`status_${res.status}`] = (ta[`status_${res.status}`] || 0) + 1;
      const body = decode(await res.text().catch(() => ''));
      if (res.status >= 200 && res.status < 300) ta.ok++;
      if (/data-vow/.test(body)) ta.marker = (ta.marker || 0) + 1;
      const toks = [...V.everywhere, ...(V.streets.get(identityKey(aStreet)) ?? [])];
      scanValue(body, toks, ta, 'value');
      for (const [k, re] of CLASS) if (re.test(body)) ta[`class_${k}`] = (ta[`class_${k}`] || 0) + 1;
      if (/"(?:soldPrice|soldDate|daysOnMarket|avgDOM|priorPrice|soldCount|leasedCount|typicalSold|medianSold)"\s*:/.test(body)) ta.vow_key = (ta.vow_key || 0) + 1;
    }
  }

  // Every street's card (og.png's only source) and a sample of og.png images.
  const streets = urls.filter((u) => /^\/streets\/[^/?]+$/.test(u)).map((u) => u.split('/')[2]);
  const tc = T('card+og');
  let j = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (j < streets.length) {
      const s = streets[j++];
      const r = await get(`${BASE}/api/streets/${s}/card`);
      tc.requests++;
      if (r.status !== 200) { tc[`status_${r.status}`] = (tc[`status_${r.status}`] || 0) + 1; continue; }
      tc.ok++;
      let c = {};
      try { c = JSON.parse(r.body); } catch { tc.unparseable = (tc.unparseable || 0) + 1; }
      for (const k of Object.keys(cardFields)) if (c[k] !== undefined && c[k] !== null) tc[`card_${k}`] = (tc[`card_${k}`] || 0) + 1;
      scanValue(decode(r.body), [...(V.streets.get(identityKey(s)) ?? []), ...V.everywhere], tc, 'value');
      for (const [k, re] of CLASS) if (re.test(decode(r.body))) tc[`class_${k}`] = (tc[`class_${k}`] || 0) + 1;
      if (j % 25 === 0) {
        const og = await fetch(`${BASE}/streets/${s}/og.png`).catch(() => null);
        tc.og_fetched = (tc.og_fetched || 0) + 1;
        if (og?.status === 200 && /image\/png/.test(og.headers.get('content-type') || '')) tc.og_png_ok = (tc.og_png_ok || 0) + 1;
      }
    }
  }));

  // Sitemaps, robots, manifest.
  const tsm = T('sitemaps');
  for (const u of ['/sitemap.xml', '/sitemap-index.xml', '/sitemap-video.xml', '/robots.txt', '/manifest.webmanifest']) {
    const r = await get(`${BASE}${u}`);
    tsm.requests++;
    if (r.status !== 200) { tsm[`status_${r.status}`] = (tsm[`status_${r.status}`] || 0) + 1; continue; }
    tsm.ok++;
    scanValue(decode(r.body), [...V.everywhere], tsm, 'value');
    for (const [k, re] of CLASS) if (re.test(decode(r.body))) tsm[`class_${k}`] = (tsm[`class_${k}`] || 0) + 1;
    if (u === '/sitemap.xml' && /\/market-watch/.test(r.body)) tsm.market_watch_listed = 1;
  }

  // The 500 page: the app has no error.tsx, so Next serves its static 500 document. It is
  // checked from the build output, which is the file served (see the report for the path).
  const t5 = T('500');
  const five = path.join(REPO_ROOT, '.next', 'server', 'pages', '500.html');
  if (fs.existsSync(five)) {
    const html = fs.readFileSync(five, 'utf8');
    t5.requests++; t5.ok++;
    if (MARKER_HTML.test(html)) t5.marker = 1;
    scanValue(visibleText(html), [...V.everywhere], t5, 'value');
    for (const [k, re] of CLASS) if (re.test(visibleText(html))) t5[`class_${k}`] = 1;
    if (/sn-strip|SiteNav|mega/i.test(html)) t5.chrome = 1;
  } else t5.not_built = 1;

  // ── totals ─────────────────────────────────────────────────────────────────────────────────
  const FAIL_KEYS = /^(marker|value|class_|vow_node|vow_key|card_|undefined|nan|empty_section|lone_separator|market_watch_listed|error)/;
  let fails = 0;
  console.log('');
  for (const [s, t] of Object.entries(tally).sort()) {
    const bad = Object.entries(t).filter(([k, v]) => FAIL_KEYS.test(k) && !k.endsWith('_explained') && v > 0);
    fails += bad.reduce((a, [, v]) => a + v, 0);
    const rest = Object.entries(t).filter(([k]) => !['requests', 'ok', 'examples'].includes(k)).map(([k, v]) => `${k}=${v}`).join(' ');
    console.log(`${bad.length ? 'FAIL' : 'ok  '} ${s.padEnd(22)} requests=${t.requests} ok=${t.ok}${rest ? ' ' + rest : ''}`);
    for (const [k] of bad) if (t.examples?.[k]) console.log(`       ${k}: ${t.examples[k].join('  ')}`);
  }
  console.log(`\n${fails ? 'LEAK' : 'CLEAN'} · ${Object.values(tally).reduce((a, t) => a + t.requests, 0)} responses · ${fails} findings · ${Math.round((Date.now() - t0) / 1000)}s`);
  process.exit(fails ? 1 : 0);
}

main().catch((e) => { console.error(`leak test could not run: ${e.message}`); process.exit(2); });
