// MC-034: a timed pg_stat_statements window on DB1. usage: node scratchpad/mc003/pgstat-window.mjs <seconds> <label>
import fs from 'node:fs'; import { neon } from '@neondatabase/serverless';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^"|"$/g,'')]}));
const secs = Number(process.argv[2] || 600); const label = process.argv[3] || 'window';
const db1 = neon(env.DATABASE_URL);
const snap = async () => { const rows = await db1`SELECT queryid::text id, calls, rows, query FROM pg_stat_statements`; const m = new Map(); let c = 0, r = 0; for (const x of rows) { m.set(x.id, { calls: Number(x.calls), rows: Number(x.rows), q: x.query }); c += Number(x.calls); r += Number(x.rows); } return { m, calls: c, rows: r, at: new Date().toISOString() }; };
const isPull = (q) => /FROM "public"\."Listing" WHERE \("public"\."Listing"\."streetSlug" IN/.test(q) || /FROM "public"\."Listing" WHERE "public"\."Listing"\."streetSlug" IN/.test(q);
const isFull = (q) => /"public"\."Listing"\."photos"/.test(q);
const isStreetContent = (q) => /FROM "public"\."StreetContent" WHERE "public"\."StreetContent"\."streetSlug" IN/.test(q);
const a = await snap(); await new Promise((r) => setTimeout(r, secs * 1000)); const b = await snap();
const delta = (pred) => { let calls = 0, rows = 0; for (const [id, v] of b.m) { const p = a.m.get(id) || { calls: 0, rows: 0 }; if (pred(v.q)) { calls += v.calls - p.calls; rows += v.rows - p.rows; } } return { calls, rows }; };
const out = { label, from: a.at, to: b.at, seconds: secs, db1: { calls: b.calls - a.calls, rows: b.rows - a.rows }, streetPull: delta(isPull), streetPullFullRow: delta((q) => isPull(q) && isFull(q)), streetPullNarrow: delta((q) => isPull(q) && !isFull(q)), streetContentReads: delta(isStreetContent) };
out.perMinute = { db1_rows: Math.round(out.db1.rows / secs * 60), db1_calls: Math.round(out.db1.calls / secs * 60), pull_calls: +(out.streetPull.calls / secs * 60).toFixed(1), pull_rows: Math.round(out.streetPull.rows / secs * 60), streetContent_calls: +(out.streetContentReads.calls / secs * 60).toFixed(1) };
console.log(JSON.stringify(out)); fs.writeFileSync(`scratchpad/mc003/pgstat-window-${label}.json`, JSON.stringify(out, null, 1));
