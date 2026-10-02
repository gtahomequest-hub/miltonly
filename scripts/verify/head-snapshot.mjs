// MC-046 HEAD FREEZE. Snapshot title, meta description, canonical, robots and H1 of every street
// page in the target's sitemap, anonymously; or diff two snapshots.
//
//   BASE=https://miltonly.com node scripts/verify/head-snapshot.mjs snap scratchpad/mc046/head-before.json
//   BASE=https://<preview> node scripts/verify/head-snapshot.mjs snap scratchpad/mc046/head-after.json
//   node scripts/verify/head-snapshot.mjs diff scratchpad/mc046/head-before.json scratchpad/mc046/head-after.json
//
// Street names and their heads are public page text; no VOW value is read or written here.
// The canonical is compared as served (absolute, miltonly.com on every host).
import fs from 'node:fs';
import { get, publishedStreetSlugs } from './lib/http.mjs';

const [mode, a, b] = process.argv.slice(2);

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const pick = (html, re) => { const m = html.match(re); return m ? decode(m[1]) : null; };
function headOf(html) {
  const head = html.split('</head>')[0];
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => decode(m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()));
  return {
    title: pick(head, /<title>([\s\S]*?)<\/title>/),
    description: pick(head, /<meta name="description" content="([^"]*)"/),
    canonical: pick(head, /<link rel="canonical" href="([^"]*)"/),
    robots: pick(head, /<meta name="robots" content="([^"]*)"/),
    h1: h1s,
  };
}

if (mode === 'snap') {
  const BASE = process.env.BASE;
  if (!BASE || !a) throw new Error('BASE and an output path are required');
  const slugs = await publishedStreetSlugs(BASE);
  const out = {};
  let i = 0, bad = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (i < slugs.length) {
      const s = slugs[i++];
      const r = await get(`${BASE}/streets/${s}`);
      if (r.status !== 200) { bad++; out[s] = { status: r.status }; continue; }
      out[s] = headOf(r.body);
    }
  }));
  const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
  fs.writeFileSync(a, JSON.stringify({ base: BASE, at: new Date().toISOString(), pages: slugs.length, heads: sorted }, null, 1));
  console.log(`snap ${slugs.length} street pages from ${BASE}, ${bad} not 200 -> ${a}`);
  process.exit(bad ? 1 : 0);
} else if (mode === 'diff') {
  const A = JSON.parse(fs.readFileSync(a, 'utf8')), B = JSON.parse(fs.readFileSync(b, 'utf8'));
  const keys = new Set([...Object.keys(A.heads), ...Object.keys(B.heads)]);
  const fields = ['title', 'description', 'canonical', 'robots', 'h1'];
  const changed = Object.fromEntries(fields.map((f) => [f, 0]));
  let missing = 0, changedPages = 0;
  for (const k of keys) {
    const x = A.heads[k], y = B.heads[k];
    if (!x || !y || x.status || y.status) { missing++; continue; }
    let any = false;
    for (const f of fields) if (JSON.stringify(x[f]) !== JSON.stringify(y[f])) { changed[f]++; any = true; }
    if (any) changedPages++;
  }
  console.log(`head-freeze: ${A.pages} before (${A.base}), ${B.pages} after (${B.base}); pages compared ${keys.size - missing}, missing on one side ${missing}`);
  console.log(`changed: ${fields.map((f) => `${f}=${changed[f]}`).join(' ')} · pages with any change ${changedPages}`);
  process.exit(changedPages || missing ? 1 : 0);
} else {
  console.error('usage: head-snapshot.mjs snap <out> | diff <before> <after>');
  process.exit(2);
}
