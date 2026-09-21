// MC-034: a cold street render, then the card route (a second request sharing the Data Cache entry).
import fs from 'node:fs'; import { neon } from '@neondatabase/serverless';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^"|"$/g,'')]}));
const BASE = process.env.BASE; const slug = process.argv[2] || 'main-street-milton'; const runs = Number(process.argv[3] || 3);
const db1 = neon(env.DATABASE_URL);
const snap = async () => { const rows = await db1`SELECT queryid::text id, calls, rows, query FROM pg_stat_statements`; const m = new Map(); let c = 0, r = 0; for (const x of rows) { m.set(x.id, { calls: Number(x.calls), rows: Number(x.rows), q: x.query }); c += Number(x.calls); r += Number(x.rows); } return { m, calls: c, rows: r }; };
const isPull = (q) => /FROM "public"\."Listing" WHERE \("public"\."Listing"\."streetSlug" IN/.test(q) || /FROM "public"\."Listing" WHERE "public"\."Listing"\."streetSlug" IN/.test(q);
const isFull = (q) => /"public"\."Listing"\."photos"/.test(q);
const isPhoto = (q) => /photos\[\$?1?\] AS photo/i.test(q) || /photos\[/.test(q);
const purge = async (body) => (await fetch(`${BASE}/api/revalidate?secret=${encodeURIComponent(env.REVALIDATION_SECRET)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).status;
const delta = (a, b, pred) => { let calls = 0, rows = 0; for (const [id, v] of b.m) { const p = a.m.get(id) || { calls: 0, rows: 0 }; if (pred(v.q)) { calls += v.calls - p.calls; rows += v.rows - p.rows; } } return { calls, rows }; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (path) => { const r = await fetch(`${BASE}${path}`, { headers: { 'user-agent': 'miltonly-rows-per-render' }, cache: 'no-store' }); await r.arrayBuffer(); return r.headers.get('x-vercel-cache'); };
for (let i = 0; i < runs; i++) {
  for (const b of [{ tag: 'db2' }, { tag: 'db3' }, { tag: 'listings' }, { path: `/streets/${slug}` }]) await purge(b);
  await sleep(3000);
  const a = await snap(); const c1 = await get(`/streets/${slug}`); await sleep(5000); const b = await snap();
  const cold = { pass: 'cold page', cache: c1, db1: { calls: b.calls - a.calls, rows: b.rows - a.rows }, pull: delta(a, b, isPull), pullFull: delta(a, b, (q) => isPull(q) && isFull(q)), pullNarrow: delta(a, b, (q) => isPull(q) && !isFull(q)), photo: delta(a, b, isPhoto) };
  const c2 = await get(`/api/streets/${slug}/card`); await sleep(4000); const c = await snap();
  const card = { pass: 'card route after', cache: c2, db1: { calls: c.calls - b.calls, rows: c.rows - b.rows }, pull: delta(b, c, isPull), pullNarrow: delta(b, c, (q) => isPull(q) && !isFull(q)), photo: delta(b, c, isPhoto) };
  console.log(JSON.stringify({ run: i + 1, cold, card }));
}
