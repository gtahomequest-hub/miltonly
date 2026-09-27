#!/usr/bin/env node
// MA-007. One GET per sitemap URL in a route family, recording the CDN cache state, age, TTFB and
// the cache-control header, so a route's cached share can be read from the edge rather than guessed.
//   BASE=https://miltonly.com node scripts/audit/cache-states.mjs --family=/streets/ [--limit=n]
import fs from 'node:fs';
const BASE = (process.env.BASE || '').replace(/\/$/, '');
// The family is given without slashes (Git Bash rewrites a leading slash into a Windows path).
const fam = '/' + ((process.argv.find((a) => a.startsWith('--family=')) || '').slice(9) || 'streets').replace(/^\/+|\/+$/g, '') + '/';
const limit = Number((process.argv.find((a) => a.startsWith('--limit=')) || '').slice(8)) || 0;
const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
let urls = [...new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]))].filter((u) => new URL(u).pathname.startsWith(fam));
if (limit) urls = urls.slice(0, limit);
const rows = [];
for (const u of urls) {
  const t0 = performance.now();
  const r = await fetch(u, { headers: { 'user-agent': 'miltonly-audit MA-007' } });
  await r.arrayBuffer();
  rows.push({ path: new URL(u).pathname, status: r.status, cache: r.headers.get('x-vercel-cache'), age: r.headers.get('age'), cc: r.headers.get('cache-control'), matched: r.headers.get('x-matched-path'), ms: Math.round(performance.now() - t0) });
}
const by = {};
for (const r of rows) { const k = `${r.cache}|${r.cc}`; by[k] = by[k] || { n: 0, ms: [] }; by[k].n++; by[k].ms.push(r.ms); }
const p = (a, q) => a.sort((x, y) => x - y)[Math.floor((a.length - 1) * q)];
console.log(`${fam} ${rows.length} pages`);
for (const [k, v] of Object.entries(by).sort((a, b) => b[1].n - a[1].n)) console.log(`  ${String(v.n).padStart(4)}  ${k}  p50 ${p(v.ms, 0.5)} ms  p90 ${p(v.ms, 0.9)} ms`);
fs.mkdirSync('scratchpad/audit/MA-007', { recursive: true });
fs.writeFileSync(`scratchpad/audit/MA-007/cache-states${fam.replace(/\W+/g, '-')}.json`, JSON.stringify(rows, null, 1));
