// MC-045: fetch the served HTML of every published street page (sitemap), read-only, 6 at a time.
import fs from 'node:fs';
const OUT = process.argv[2];
const BASE = 'https://miltonly.com';
const xml = await (await fetch(`${BASE}/sitemap.xml`, { headers: { 'user-agent': 'miltonly-verify MC-045' } })).text();
const slugs = [...xml.matchAll(/<loc>https:\/\/miltonly\.com\/streets\/([^<]+)<\/loc>/g)].map((m) => m[1]);
fs.writeFileSync(`${OUT}/slugs.json`, JSON.stringify(slugs));
const meta = {};
let i = 0;
async function worker() {
  while (i < slugs.length) {
    const s = slugs[i++];
    for (let t = 0; t < 3; t++) {
      try {
        const r = await fetch(`${BASE}/streets/${s}`, { headers: { 'user-agent': 'miltonly-verify MC-045' } });
        const h = await r.text();
        fs.writeFileSync(`${OUT}/html/${s}.html`, h);
        meta[s] = { status: r.status, cache: r.headers.get('x-vercel-cache'), bytes: h.length };
        break;
      } catch (e) { meta[s] = { error: String(e) }; }
    }
  }
}
const t0 = Date.now();
await Promise.all(Array.from({ length: 6 }, worker));
fs.writeFileSync(`${OUT}/crawl-meta.json`, JSON.stringify({ at: new Date().toISOString(), seconds: Math.round((Date.now() - t0) / 1000), count: slugs.length, build: await (await fetch(`${BASE}/api/build`)).text(), meta }));
const st = Object.values(meta).reduce((a, m) => { a[m.status ?? 'err'] = (a[m.status ?? 'err'] || 0) + 1; return a; }, {});
console.log('slugs', slugs.length, 'status', JSON.stringify(st), 'seconds', Math.round((Date.now() - t0) / 1000));
