// MC-034: rows per street render, measured in pg_stat_statements. usage:
//   BASE=https://miltonly.com node scratchpad/mc003/rows-per-render.mjs <slug> [runs]
// Drops the db2/db3 tags and the street path so the render hits the databases, fetches the page
// once, and reports the delta in calls and rows on DB1 and DB2, plus the Listing pulls by shape.
import fs from 'node:fs';
import { neon } from '@neondatabase/serverless';
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]; }));
const BASE = process.env.BASE || 'https://miltonly.com';
const slug = process.argv[2] || 'farmstead-drive-milton';
const runs = Number(process.argv[3] || 3);
const db1 = neon(env.DATABASE_URL); const db2 = neon(env.SOLD_DATABASE_URL);
const snap = async (sql) => {
  const rows = await sql`SELECT queryid::text id, calls, rows, query FROM pg_stat_statements`;
  const m = new Map(); let calls = 0, total = 0;
  for (const r of rows) { m.set(r.id, { calls: Number(r.calls), rows: Number(r.rows), q: r.query }); calls += Number(r.calls); total += Number(r.rows); }
  return { m, calls, rows: total };
};
const isListingPull = (q) => /FROM "public"\."Listing" WHERE \("public"\."Listing"\."streetSlug" IN/.test(q) || /FROM "public"\."Listing" WHERE "public"\."Listing"\."streetSlug" IN/.test(q);
const isFullRow = (q) => /"public"\."Listing"\."photos"/.test(q) || /"public"\."Listing"\."description"/.test(q);
const purge = async (body) => (await fetch(`${BASE}/api/revalidate?secret=${encodeURIComponent(env.REVALIDATION_SECRET)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).status;
const out = [];
for (let i = 0; i < runs; i++) {
  await purge({ tag: 'db2' }); await purge({ tag: 'db3' }); await purge({ tag: 'listings' }); await purge({ path: `/streets/${slug}` });
  await new Promise((r) => setTimeout(r, 1500));
  const [a1, a2] = await Promise.all([snap(db1), snap(db2)]);
  const t = Date.now();
  const res = await fetch(`${BASE}/streets/${slug}`, { headers: { 'user-agent': 'miltonly-rows-per-render' }, cache: 'no-store' });
  await res.arrayBuffer();
  const ms = Date.now() - t; const cache = res.headers.get('x-vercel-cache');
  await new Promise((r) => setTimeout(r, 1500));
  const [b1, b2] = await Promise.all([snap(db1), snap(db2)]);
  const delta = (a, b, pred) => { let calls = 0, rows = 0; for (const [id, v] of b.m) { const p = a.m.get(id) || { calls: 0, rows: 0 }; if (pred(v.q)) { calls += v.calls - p.calls; rows += v.rows - p.rows; } } return { calls, rows }; };
  const pull = delta(a1, b1, isListingPull); const full = delta(a1, b1, (q) => isListingPull(q) && isFullRow(q));
  const r = { run: i + 1, status: res.status, cache, ms, db1: { calls: b1.calls - a1.calls, rows: b1.rows - a1.rows }, db2: { calls: b2.calls - a2.calls, rows: b2.rows - a2.rows }, listingPull: pull, listingPullFullRow: full };
  out.push(r); console.log(JSON.stringify(r));
  if (process.env.WARM) {
    await purge({ path: `/streets/${slug}` });
    await new Promise((rr) => setTimeout(rr, 1500));
    const [c1] = await Promise.all([snap(db1)]);
    const res2 = await fetch(`${BASE}/streets/${slug}`, { headers: { 'user-agent': 'miltonly-rows-per-render' }, cache: 'no-store' }); await res2.arrayBuffer();
    await new Promise((rr) => setTimeout(rr, 1500));
    const [d1] = await Promise.all([snap(db1)]);
    const w = { run: i + 1, warm: true, cache: res2.headers.get('x-vercel-cache'), db1: { calls: d1.calls - c1.calls, rows: d1.rows - c1.rows }, listingPull: delta(c1, d1, isListingPull) };
    console.log(JSON.stringify(w));
  }
}
const med = (k) => { const v = out.map(k).sort((x, y) => x - y); return v[Math.floor(v.length / 2)]; };
console.log(JSON.stringify({ slug, base: BASE, runs, median: { db1_rows: med((r) => r.db1.rows), db1_calls: med((r) => r.db1.calls), db2_rows: med((r) => r.db2.rows), listingPull_calls: med((r) => r.listingPull.calls), listingPull_rows: med((r) => r.listingPull.rows), fullRow_calls: med((r) => r.listingPullFullRow.calls), fullRow_rows: med((r) => r.listingPullFullRow.rows) } }));
