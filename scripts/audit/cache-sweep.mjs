#!/usr/bin/env node
// MA-001. How every published street page is served: cached (X-Matched-Path is the concrete
// path, public cache-control) or rendered per request (X-Matched-Path is /streets/[slug],
// private no-store). One GET per page, TTFB recorded, concurrency 8, nothing written.
//
//   BASE=https://miltonly.com node scripts/audit/cache-sweep.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { loadEnv, requireEnv } from '../verify/lib/env.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.BASE || '').replace(/\/$/, '');
if (!BASE) { console.error('BASE is required'); process.exit(2); }
loadEnv(); requireEnv('DATABASE_URL');
const app = neon(process.env.DATABASE_URL);
const rows = await app`SELECT "streetSlug" slug, template, "createdAt" c FROM public."StreetContent" WHERE status='published' ORDER BY 1`;
const out = [];
const queue = rows.slice();
async function worker() {
  while (queue.length) {
    const r = queue.shift();
    const t0 = Date.now();
    try {
      const res = await fetch(`${BASE}/streets/${r.slug}`, { headers: { 'user-agent': 'miltonly-audit/MA-001' } });
      await res.arrayBuffer();
      out.push({ slug: r.slug, template: r.template, created: r.c, status: res.status, ms: Date.now() - t0, cache: res.headers.get('x-vercel-cache'), matched: res.headers.get('x-matched-path'), cc: res.headers.get('cache-control') });
    } catch (e) { out.push({ slug: r.slug, error: e.message }); }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
const dyn = out.filter((o) => o.matched === '/streets/[slug]');
const byCache = out.reduce((m, o) => { m[o.cache] = (m[o.cache] || 0) + 1; return m; }, {});
const p = (arr, q) => { const s = arr.map((o) => o.ms).sort((a, b) => a - b); return s[Math.floor(s.length * q)]; };
console.log(`pages ${out.length}  by x-vercel-cache ${JSON.stringify(byCache)}`);
console.log(`rendered per request (matched /streets/[slug]): ${dyn.length}  minimal ${dyn.filter((o) => o.template === 'minimal').length}  standard ${dyn.filter((o) => o.template === 'standard').length}`);
console.log(`ttfb p50/p90 cached ${p(out.filter((o) => o.cache === 'HIT'), 0.5)}/${p(out.filter((o) => o.cache === 'HIT'), 0.9)} ms, per-request ${p(dyn, 0.5)}/${p(dyn, 0.9)} ms, REVALIDATED ${p(out.filter((o) => o.cache === 'REVALIDATED'), 0.5)}/${p(out.filter((o) => o.cache === 'REVALIDATED'), 0.9)} ms`);
console.log('per-request pages:', dyn.map((o) => `${o.slug}(${o.template[0]}, ${String(o.created).slice(0, 10)})`).join(', '));
fs.writeFileSync(path.join(HERE, '..', '..', 'scratchpad', 'audit', 'MA-001', 'cache-sweep.json'), JSON.stringify(out, null, 1));
