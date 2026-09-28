// MH-010 proof: the nightly's em-dash rule (scripts/audit/nightly/checks.mjs, MA-010 definition),
// run against BASE on a fixed page set, reporting every em-dash finding and whether it comes from
// one of the four MH-010 sources.
//   BASE=https://<preview> node scratchpad/mh010/emdash-proof.mjs
import { pageFindings } from '../../scripts/audit/nightly/checks.mjs';
const BASE = (process.env.BASE || '').replace(/\/$/, '');
if (!BASE) { console.error('BASE required'); process.exit(2); }
const LISTINGS = ['W13833302','W13719332','W13825334','W13792692','W13809096','W13085252','W13802432','W13802154','W13698120','W13783956','W13832636','W13832066','W13161606','W13545672','W13772920','W13691544','W13769510','W13684984','W13767554','W13830966'].map((m) => `/listings/${m}`);
const CONDOS = ['1105-leger-way-milton','33-whitmer-street-milton','1340-main-street-milton','610-farmstead-drive-milton','139-main-street-milton'].map((s) => `/condos/${s}`);
const SCHOOLS = ['chris-hadfield-ps','anne-j-macarthur-ps','irma-coulson-ps','ew-foster-ps','tiger-jeet-singh-ps'].map((s) => `/schools/${s}`);
const EXTRA = ['/', '/about', '/sell', '/rentals', '/compare', '/compare/freehold-vs-condo', '/condos', '/condos-guide', '/freehold', '/potl', '/sold', '/mosques', '/mosques/icna-milton', '/neighbourhoods'];
const SOURCES = [
  ['bio', /far more than price — it is about/],
  ['condo-cost', /(?:Varies by suite|Not stated) — confirm/],
  ['condo-empty', /right now — register to be alerted/],
  ['title-meta', /^\d+ in (?:title|meta):/],
];
const pages = [...LISTINGS, ...CONDOS, ...SCHOOLS, ...EXTRA];
const bySource = Object.fromEntries(SOURCES.map(([k]) => [k, 0]));
let other = 0; let fetched = 0; const rows = [];
for (const p of pages) {
  const res = await fetch(`${BASE}${p}`, { headers: { 'user-agent': 'Mozilla/5.0 miltonly-audit/mh010-proof' }, redirect: 'follow' });
  const html = await res.text();
  if (!res.ok) { rows.push(`${p} HTTP ${res.status}`); continue; }
  fetched++;
  const fin = pageFindings({ html, path: new URL(res.url).pathname.replace(/\/$/, '') || '/', base: BASE, listing: p.startsWith('/listings/') });
  for (const f of fin.findings) {
    if (f.code !== 'em-dash') continue;
    const src = SOURCES.find(([, re]) => re.test(f.detail))?.[0];
    if (src) bySource[src]++; else other++;
    rows.push(`${p} · ${src || 'other'} · ${f.detail.replace(/\s+/g, ' ').slice(0, 160)}`);
  }
}
console.log(`BASE ${BASE} · ${fetched}/${pages.length} pages fetched (${LISTINGS.length} listings, ${CONDOS.length} condos, ${SCHOOLS.length} schools, ${EXTRA.length} others)`);
console.log(`em-dash findings from the four MH-010 sources: ${JSON.stringify(bySource)} · other prose em-dashes (out of scope): ${other}`);
for (const r of rows) console.log(r);
