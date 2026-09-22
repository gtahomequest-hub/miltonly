// MA-005. Sweep every published hub on production once: cache state, TTFB, and the shape the
// page itself declares (facts, ladder length, filmed streets, condos, schools, siblings), so
// the five audit hubs are chosen from the record and the whole class is measured.
import fs from 'node:fs';
const BASE = process.env.BASE || 'https://miltonly.com';
const OUT = process.env.OUT || 'scratchpad/audit/MA-005/hub-sweep.json';
const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
const slugs = [...new Set([...xml.matchAll(/neighbourhoods\/([a-z0-9-]+)/g)].map((m) => m[1]))];
const rows = [];
for (const slug of slugs) {
  const t0 = performance.now();
  const r = await fetch(`${BASE}/neighbourhoods/${slug}`, { headers: { 'user-agent': 'miltonly-audit MA-005' } });
  const html = await r.text();
  const ms = Math.round(performance.now() - t0);
  const facts = Object.fromEntries([...html.matchAll(/data-fig="hub-fact-([a-z]+)" data-value="([^"]*)"/g)].map((m) => [m[1], m[2]]));
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1];
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1];
  const h1 = (html.match(/<h1[^>]*>([^<]*)<\/h1>/) || [])[1];
  rows.push({
    slug, status: r.status, cache: r.headers.get('x-vercel-cache'), age: r.headers.get('age'), ms,
    bytes: html.length, title, titleLen: title?.length, desc, descLen: desc?.length, h1,
    facts,
    ladder: (html.match(/data-fig="hub-street-sold"/g) || []).length,
    silent: (html.match(/hh-ladsilent/g) || []).length,
    film: (html.match(/class="hh-filmstrip"/g) || []).length ? (html.match(/hh-framename/g) || []).length : 0,
    schools: (html.match(/hh-schoolname/g) || []).length,
    condos: (html.match(/hh-condoname/g) || []).length,
    faqs: (html.match(/<details/g) || []).length,
    siblings: (html.match(/class="hh-sib"/g) || []).length,
    overviewParas: html.includes('id="about"') ? 1 : 0,
    compareRows: (html.match(/hh-comparerow/g) || []).length,
    h2: [...html.matchAll(/<h2[^>]*>([^<]*)<\/h2>/g)].map((m) => m[1]),
    ldCount: (html.match(/application\/ld\+json/g) || []).length,
  });
  console.log(slug.padEnd(24), r.status, String(r.headers.get('x-vercel-cache')).padEnd(11), String(ms).padStart(5), 'ms', 'ladder', rows.at(-1).ladder, 'silent', rows.at(-1).silent, 'film', rows.at(-1).film, 'schools', rows.at(-1).schools, 'condos', rows.at(-1).condos, 'typ', facts.typical ?? '-', 'active', facts.active ?? '-');
}
fs.mkdirSync('scratchpad/audit/MA-005', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(rows, null, 2));
