#!/usr/bin/env node
// MA-004. Every href the header, menu and footer serve, checked once against the host, and the
// footer's coverage of the sitemap's hubs, guides, schools and mosques.
//
//   BASE=https://miltonly.com node scripts/audit/nav-links.mjs [--in=<dir with nav-footer.mjs output>]
//
// Reads the per-page JSON nav-footer.mjs wrote, unions the nav and footer hrefs, GETs each with
// redirects NOT followed (a nav link that lands on a 3xx is a hop, not a destination), and writes
// links.json plus a coverage table. Read-only: GET only, no form is touched.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.BASE || '').replace(/\/$/, '');
if (!BASE) { console.error('BASE is required'); process.exit(2); }
const IN = (process.argv.find((a) => a.startsWith('--in=')) || '').slice(5) || path.join(HERE, '..', '..', 'scratchpad', 'audit', 'MA-004');

const runs = fs.readdirSync(IN).filter((f) => /^[a-z]+\.\d+\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(IN, f), 'utf8')));
const byHref = new Map(); // href -> { where: Set, texts: Set }
for (const r of runs) {
  if (!r.static) continue;
  for (const [where, list] of [['nav', r.static.navLinks], ['footer', r.static.footerLinks]]) {
    for (const l of list) {
      const e = byHref.get(l.href) || { where: new Set(), texts: new Set(), pages: new Set() };
      e.where.add(where); e.texts.add(l.text); e.pages.add(r.key); byHref.set(l.href, e);
    }
  }
}

const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(BASE, ''));
const bucket = (p) => (p.startsWith('/neighbourhoods/') ? 'hub' : p.startsWith('/guides/') ? 'guide' : p.startsWith('/schools/') ? 'school' : p.startsWith('/mosques/') ? 'mosque' : p.startsWith('/streets/') ? 'street' : p.startsWith('/listings/') ? 'listing' : p.startsWith('/condos/') ? 'condo' : p.startsWith('/market-watch/') ? 'edition' : 'other');
const groups = {};
for (const u of urls) (groups[bucket(u)] ||= []).push(u);

const results = [];
for (const [href, e] of byHref) {
  if (!href || href.startsWith('#') || href.startsWith('tel:') || href.startsWith('mailto:') || href.startsWith('http') && !href.startsWith(BASE)) { results.push({ href, external: true, where: [...e.where], texts: [...e.texts], pages: [...e.pages] }); continue; }
  const url = href.startsWith('http') ? href : BASE + href;
  const t0 = Date.now();
  let status = 0, location = null, robots = null, chain = [];
  try {
    let cur = url;
    for (let i = 0; i < 5; i++) {
      const res = await fetch(cur, { redirect: 'manual', headers: { 'user-agent': 'Mozilla/5.0 (compatible; MA-004 audit)' } });
      status = res.status; location = res.headers.get('location');
      if (status >= 300 && status < 400 && location) { chain.push(`${status} -> ${location}`); cur = location.startsWith('http') ? location : BASE + location; continue; }
      robots = res.headers.get('x-robots-tag');
      if (status === 200) { const html = await res.text(); const m = html.match(/<meta[^>]+name="robots"[^>]+content="([^"]+)"/i); if (m) robots = (robots ? robots + '; ' : '') + m[1]; const t = html.match(/<title>([^<]*)<\/title>/i); results.push({ href, status, chain, robots, title: t ? t[1].slice(0, 80) : null, ms: Date.now() - t0, inSitemap: urls.includes(new URL(cur).pathname), where: [...e.where], texts: [...e.texts], pages: [...e.pages] }); }
      else results.push({ href, status, chain, robots, ms: Date.now() - t0, inSitemap: urls.includes(new URL(cur).pathname), where: [...e.where], texts: [...e.texts], pages: [...e.pages] });
      break;
    }
  } catch (err) { results.push({ href, status: -1, error: String(err), where: [...e.where], texts: [...e.texts], pages: [...e.pages] }); }
}
fs.writeFileSync(path.join(IN, 'links.json'), JSON.stringify(results, null, 2));

// coverage: which sitemap pages of each kind does the footer (and the nav) reach in one click, per page type
const cov = {};
for (const r of runs) {
  if (!r.static || r.width !== 1440) continue;
  const foot = new Set(r.static.footerLinks.map((l) => l.href));
  const nav = new Set(r.static.navLinks.map((l) => l.href));
  cov[r.key] = {};
  for (const [kind, list] of Object.entries(groups)) {
    if (['street', 'listing'].includes(kind)) { cov[r.key][kind] = { total: list.length, footer: list.filter((u) => foot.has(u)).length, nav: list.filter((u) => nav.has(u)).length }; continue; }
    cov[r.key][kind] = { total: list.length, footer: list.filter((u) => foot.has(u)).length, nav: list.filter((u) => nav.has(u)).length, missingFooter: list.filter((u) => !foot.has(u)).slice(0, 40) };
  }
  cov[r.key].footerHrefs = [...foot]; cov[r.key].navHrefs = [...nav];
}
fs.writeFileSync(path.join(IN, 'coverage.json'), JSON.stringify(cov, null, 2));

const bad = results.filter((r) => !r.external && (r.status !== 200 || r.chain.length));
console.log(`${results.length} unique hrefs; ${bad.length} not a clean 200:`);
for (const b of bad) console.log(`  ${b.href} -> ${b.status} ${b.chain.join(' ')} [${b.where.join(',')}] "${[...b.texts].join(' | ')}" on ${b.pages.join(',')}`);
const noindex = results.filter((r) => r.robots && /noindex/.test(r.robots));
console.log(`noindex destinations: ${noindex.map((r) => r.href + ' (' + r.robots + ')').join(', ') || 'none'}`);
for (const [k, c] of Object.entries(cov)) console.log(k, Object.entries(c).filter(([n]) => !n.endsWith('Hrefs')).map(([n, v]) => `${n} ${v.footer}/${v.total} footer, ${v.nav}/${v.total} nav`).join(' | '));
