// ML-014: the nightly's link-redirect rule (scripts/audit/nightly/run.mjs, the links phase), applied by hand
// to every school and mosque page on a host: fetch each page, collect its /book links, fetch each distinct
// target with redirects NOT followed, and record the chain. A target whose response is a redirect is a
// link-redirect finding; a 200 with no chain is clean.
//   node scratchpad/ml014/book-links.mjs <base>
import fs from 'node:fs';
const BASE = (process.argv[2] || '').replace(/\/$/, '');
if (!BASE) { console.error('usage: node book-links.mjs <base>'); process.exit(2); }
const UA = 'miltonly-verify ml014';
const sitemap = await (await fetch(`${BASE}/sitemap.xml`, { headers: { 'user-agent': UA } })).text();
const pages = [...new Set([...sitemap.matchAll(/\/(schools|mosques)\/[a-z0-9-]+/g)].map((m) => m[0]))].sort();
const out = { base: BASE, pages: pages.length, perPage: {}, targets: {}, findings: [] };
const refs = new Map();
let i = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (i < pages.length) {
    const p = pages[i++];
    const r = await fetch(`${BASE}${p}`, { headers: { 'user-agent': UA } });
    const html = await r.text();
    const links = [...new Set([...html.matchAll(/href="(\/book[^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&')))];
    out.perPage[p] = { status: r.status, bookLinks: links };
    for (const l of links) { if (!refs.has(l)) refs.set(l, new Set()); refs.get(l).add(p); }
  }
}));
for (const [t, from] of refs) {
  const chain = []; let url = `${BASE}${t}`; let status = 0;
  for (let hop = 0; hop < 5; hop++) {
    const r = await fetch(url, { method: 'GET', redirect: 'manual', headers: { 'user-agent': UA } });
    status = r.status;
    if (status >= 300 && status < 400 && r.headers.get('location')) { const to = new URL(r.headers.get('location'), url); chain.push(`${status} ${to.pathname}${to.search}`); url = to.href; continue; }
    break;
  }
  const rec = { status, refs: from.size, from: [...from].slice(0, 5) };
  if (chain.length) rec.chain = chain;
  if (chain.length) out.findings.push({ code: 'link-redirect', key: t, detail: `${chain.join(' > ')}; linked from ${from.size} pages` });
  else if (status >= 400) out.findings.push({ code: 'link-broken', key: t, detail: `${status}; linked from ${from.size} pages` });
  out.targets[t] = rec;
}
const withLink = Object.values(out.perPage).filter((p) => p.bookLinks.length > 0).length;
const withRef = Object.values(out.perPage).filter((p) => p.bookLinks.some((l) => /\/book\?ref=/.test(l))).length;
fs.mkdirSync('scratchpad/ml014', { recursive: true });
fs.writeFileSync('scratchpad/ml014/book-links.json', JSON.stringify(out, null, 1));
console.log(`place pages on the sitemap: ${pages.length}; pages linking /book: ${withLink}; of which with ?ref=: ${withRef}; distinct /book targets: ${refs.size}; targets answering 200 with no chain: ${Object.values(out.targets).filter((t) => t.status === 200 && !t.chain).length}`);
console.log(`link-redirect findings for /book: ${out.findings.filter((f) => f.code === 'link-redirect').length}; link-broken: ${out.findings.filter((f) => f.code === 'link-broken').length}`);
for (const f of out.findings.slice(0, 5)) console.log('  ', f.code, f.key, f.detail);
