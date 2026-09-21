// The street sample (MC-035). MA-007 measured what a full crawl after every deploy cost: the
// battery fetched all 646 street pages within minutes of each of seven deploys a day, and 73%
// of the route's origin renders were our own tooling. The battery is testing one template 646
// times. Sample mode crawls about fifty: a FIXED SET that always runs, one street from every
// class the checks branch on (each tier, the zero-sale set, a filmed street and a night clip,
// the condo pill, a lease-heavy street, a sub-k 90-day sample, a band-entitled street, a
// street with sibling slugs, a Town-geometry neighbourhood, the minimal template, the
// highest-volume street, and one street from every published hub so the ladder parity touches
// every hub), rotating within each class run by run; the streets whose DATA changed since the
// last run on this host (StreetContent regenerated, a closed sale written to DB2 for the
// street, a sale that left the 12-month window); and a ROTATING FILL to the size, keyed by a
// run counter kept in the OS temp dir per host, so every street is crawled over time. A
// template change in the diff makes every street "touched"; the fixed set stands in for that,
// because it is chosen to cover every branch the template has.
//
// Full mode (`--streets=full` or BATTERY_STREETS=full) crawls every published street, as
// before; the nightly should run it. Everything the whole-corpus checks compare against the
// sitemap or the record stays whole-corpus in both modes; only the per-page crawl shrinks.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { loadEnv, requireEnv } from './env.mjs';
import { identityKey, K_ANON_PRICE } from './db.mjs';

export const SAMPLE_SIZE = 50;
export const K_IDENTITY = 3;

/** 'full' | 'sample', from --streets= or BATTERY_STREETS; the default is full. */
export function streetMode(argv = process.argv, env = process.env) {
  const flag = (argv.find((a) => a.startsWith('--streets=')) || '').slice(10);
  const mode = flag || env.BATTERY_STREETS || 'full';
  if (mode !== 'full' && mode !== 'sample') throw new Error(`--streets must be full or sample (got ${mode})`);
  return mode;
}

/** The run state for this host: the counter that rotates the sample and the previous run's time. */
function statePath(base) {
  return path.join(os.tmpdir(), `miltonly-verify-streets-${new URL(base).host}.json`);
}
export function readState(base) {
  try { return JSON.parse(fs.readFileSync(statePath(base), 'utf8')); } catch { return { runs: 0, lastRunAt: null }; }
}
export function writeState(base, state) {
  try { fs.writeFileSync(statePath(base), JSON.stringify(state)); } catch { /* the state is a convenience */ }
}

/** The tier as src/lib/streetEnrichment.ts graduates it: 12 months if k, else the full window if k. */
function tierOf(n12, nf, l12, lf) {
  const saleBasis = n12 >= K_ANON_PRICE || nf >= K_ANON_PRICE;
  const leaseBasis = l12 >= K_ANON_PRICE || lf >= K_ANON_PRICE;
  const identityOnly = Math.max(n12, nf) < K_IDENTITY && Math.max(l12, lf) < K_IDENTITY;
  return saleBasis ? 'priced-sale' : leaseBasis ? 'priced-lease' : identityOnly ? 'identity-only' : 'area-only';
}

/**
 * Choose the crawl set. `all` is the live sitemap's street slugs (the published set); the
 * classes are derived from DB1, DB2 and DB3 the same way the record loaders derive them.
 * Returns { crawl, fixed, touched, rotating, runs } where `fixed` maps a class to its pick.
 */
export async function sampleStreets(base, all, { size = SAMPLE_SIZE, since = null, runs = 0 } = {}) {
  loadEnv();
  requireEnv('DATABASE_URL', 'SOLD_DATABASE_URL', 'ANALYTICS_DATABASE_URL');
  const app = neon(process.env.DATABASE_URL);
  const sold = neon(process.env.SOLD_DATABASE_URL);
  const analytics = neon(process.env.ANALYTICS_DATABASE_URL);
  const published = new Set(all);
  const sorted = [...all].sort();

  const content = await app`SELECT sc."streetSlug" s, sc.template, (sc."videoUrl" IS NOT NULL) AS day, (sc."nightVideoUrl" IS NOT NULL) AS night,
                                   sc."updatedAt", sc."generatedAt", rs."neighbourhoodId" nid, rs."neighbourhoodSource" nsrc
                            FROM public."StreetContent" sc JOIN public."ResidentialStreet" rs ON rs.slug = sc."streetSlug"
                            WHERE sc.status = 'published'`;
  const row = new Map(content.filter((r) => published.has(r.s)).map((r) => [r.s, r]));
  const count = async (sql) => new Map((await sql).map((r) => [r.s, Number(r.n)]));
  const sale12 = await count(sold`SELECT street_slug s, COUNT(*)::int n FROM sold.sold_records WHERE perm_advertise=TRUE AND transaction_type='For Sale' AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW() GROUP BY 1`);
  const saleFull = await count(sold`SELECT street_slug s, COUNT(*)::int n FROM sold.sold_records WHERE perm_advertise=TRUE AND transaction_type='For Sale' AND sold_date <= NOW() AND sold_price IS NOT NULL GROUP BY 1`);
  const lease12 = await count(sold`SELECT street_slug s, COUNT(*)::int n FROM sold.sold_records WHERE perm_advertise=TRUE AND transaction_type='For Lease' AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW() GROUP BY 1`);
  const leaseFull = await count(sold`SELECT street_slug s, COUNT(*)::int n FROM sold.sold_records WHERE perm_advertise=TRUE AND transaction_type='For Lease' AND sold_date <= NOW() GROUP BY 1`);
  const condo12 = await count(sold`SELECT street_slug s, COUNT(*)::int n FROM sold.sold_records WHERE perm_advertise=TRUE AND transaction_type='For Sale' AND property_type='condo' AND sold_date >= NOW() - INTERVAL '12 months' AND sold_date <= NOW() GROUP BY 1`);
  const everSold = new Set((await sold`SELECT DISTINCT street_slug s FROM sold.sold_records WHERE transaction_type='For Sale' AND perm_advertise=TRUE`).map((r) => identityKey(r.s)));
  const idCount = new Map();
  for (const r of await sold`SELECT DISTINCT street_slug s FROM sold.sold_records`) { const k = identityKey(r.s); idCount.set(k, (idCount.get(k) ?? 0) + 1); }
  const c90 = await count(analytics`SELECT street_slug s, sold_count_90days n FROM analytics.street_sold_stats`);

  // ── the classes, each a sorted list; the pick rotates with the run counter ─────────────
  const classes = new Map();
  const add = (k, s) => { if (!classes.has(k)) classes.set(k, []); classes.get(k).push(s); };
  for (const s of sorted) {
    const r = row.get(s);
    const n12 = sale12.get(s) ?? 0, nf = saleFull.get(s) ?? 0, l12 = lease12.get(s) ?? 0, lf = leaseFull.get(s) ?? 0;
    add(`tier:${tierOf(n12, nf, l12, lf)}`, s);
    if (!everSold.has(identityKey(s))) add('zero-sales', s);
    if (r?.template === 'minimal') add('template:minimal', s);
    if (r?.day || r?.night) add('video:clip', s);
    if (r?.night) add('video:night', s);
    if ((condo12.get(s) ?? 0) >= 1) add('condo-pill', s);
    if (l12 >= K_ANON_PRICE && n12 < K_ANON_PRICE) add('lease-heavy', s);
    const ninety = c90.get(s) ?? 0;
    if (ninety > 0 && ninety < K_ANON_PRICE) add('sub-k-90-day', s);
    if (n12 >= 10) add('band-entitled', s);
    if ((idCount.get(identityKey(s)) ?? 0) > 1) add('sibling-slugs', s);
    if (r && !r.nid) add('no-hub', s);
    if (r?.nsrc && r.nsrc !== 'treb') add(`neighbourhood-source:${r.nsrc}`, s);
    if (r?.nid) add(`hub:${r.nid}`, s);
  }
  const top = [...sale12.entries()].filter(([s]) => published.has(s)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const fixed = {};
  const picked = new Set();
  const pick = (k, list) => { if (!list.length) return; const s = list[runs % list.length]; fixed[k] = s; picked.add(s); };
  if (top) pick('highest-volume', [top[0]]);
  for (const [k, list] of [...classes.entries()].sort(([a], [b]) => a.localeCompare(b))) pick(k, list);

  // ── the streets whose data changed since the previous run on this host ────────────────
  const touched = new Set();
  if (since) {
    const stamp = new Date(since);
    for (const r of content) if (published.has(r.s) && ((r.updatedAt && new Date(r.updatedAt) > stamp) || (r.generatedAt && new Date(r.generatedAt) > stamp))) touched.add(r.s);
    const iso = stamp.toISOString();
    for (const r of await sold`SELECT DISTINCT street_slug s FROM sold.sold_records WHERE updated_at > ${iso}::timestamptz OR created_at > ${iso}::timestamptz`) if (published.has(r.s)) touched.add(r.s);
    // a sale that left the 12-month window since the last run changes the street's figures with no row written
    for (const r of await sold`SELECT DISTINCT street_slug s FROM sold.sold_records WHERE perm_advertise=TRUE AND sold_date > ${iso}::timestamptz - INTERVAL '12 months' AND sold_date <= NOW() - INTERVAL '12 months'`) if (published.has(r.s)) touched.add(r.s);
  }
  for (const s of picked) touched.delete(s);
  const touchedList = [...touched].sort();
  const TOUCHED_CAP = 20;
  const touchedTaken = touchedList.slice(0, TOUCHED_CAP);

  // ── the rotating fill ─────────────────────────────────────────────────────────────────
  const rest = sorted.filter((s) => !picked.has(s) && !touched.has(s));
  const room = Math.max(0, size - picked.size - touchedTaken.length);
  const rotating = [];
  if (rest.length && room) {
    const start = (runs * room) % rest.length;
    for (let i = 0; i < Math.min(room, rest.length); i++) rotating.push(rest[(start + i) % rest.length]);
  }
  const crawl = [...new Set([...picked, ...touchedTaken, ...rotating])].sort();
  return { crawl, fixed, touched: touchedTaken, touchedDropped: touchedList.length - touchedTaken.length, rotating, runs, classes: [...classes.keys()].length };
}
