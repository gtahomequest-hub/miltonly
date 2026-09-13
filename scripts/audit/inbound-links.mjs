#!/usr/bin/env node
// MA-001. Internal links IN to each audit street, counted from the live corpus.
//
//   BASE=https://miltonly.com node scripts/audit/inbound-links.mjs
//
// Fetches the sitemap, crawls every URL on it (HTML only, GET, concurrency 8), and records which
// pages link to each audit street and with what anchor text. Nothing is written to the host.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.BASE || '').replace(/\/$/, '');
if (!BASE) { console.error('BASE is required'); process.exit(2); }
const OUT = path.join(HERE, '..', '..', 'scratchpad', 'audit', 'MA-001');
fs.mkdirSync(OUT, { recursive: true });
const STREETS = JSON.parse(fs.readFileSync(path.join(HERE, 'streets.json'), 'utf8')).map((s) => s.slug);

const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
let urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
// A sitemap index lists child sitemaps; follow one level.
if (urls.length && urls.every((u) => /sitemap.*\.xml$/.test(u))) {
  const kids = await Promise.all(urls.map(async (u) => [...(await (await fetch(u)).text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])));
  urls = kids.flat();
}
console.log(`sitemap urls ${urls.length}`);
const wanted = new Map(STREETS.map((s) => [s, []]));
const hrefRe = /<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
let done = 0;
const queue = urls.slice();
const onSitemap = new Set(urls.map((u) => new URL(u).pathname));
async function worker() {
  while (queue.length) {
    const u = queue.shift();
    try {
      const r = await fetch(u, { headers: { 'user-agent': 'miltonly-audit/MA-001' } });
      if (!r.ok) { console.log(`${r.status} ${u}`); continue; }
      const html = await r.text();
      const from = new URL(u).pathname;
      for (const m of html.matchAll(hrefRe)) {
        const href = m[1];
        for (const s of STREETS) {
          if (href === `/streets/${s}` || href.startsWith(`/streets/${s}#`) || href === `${BASE}/streets/${s}`) {
            if (from !== `/streets/${s}`) wanted.get(s).push({ from, text: m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 80) });
          }
        }
      }
    } catch (e) { console.log(`ERR ${u} ${e.message}`); }
    if (++done % 100 === 0) console.log(`crawled ${done}/${urls.length}`);
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
const out = {};
for (const [s, links] of wanted) {
  const byFrom = new Map();
  for (const l of links) { if (!byFrom.has(l.from)) byFrom.set(l.from, []); byFrom.get(l.from).push(l.text); }
  out[s] = { inbound: byFrom.size, onSitemap: onSitemap.has(`/streets/${s}`), sources: [...byFrom].map(([from, texts]) => ({ from, texts: [...new Set(texts)] })) };
  console.log(`${s}: ${byFrom.size} linking pages, on sitemap ${onSitemap.has(`/streets/${s}`)}: ${[...byFrom.keys()].slice(0, 8).join(', ')}`);
}
fs.writeFileSync(path.join(OUT, 'inbound.json'), JSON.stringify({ sitemapUrls: urls.length, streets: out }, null, 1));
