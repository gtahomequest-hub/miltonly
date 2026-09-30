// MC-046 Stage 0: how many anonymous pages carry each VOW-derived value today.
// Anonymous GET of every sitemap URL (no cookie). Prints COUNTS ONLY: no address, price, slug or key.
// Usage: BASE=https://miltonly.com node scratchpad/mc046/stage0-count.mjs
import { get } from '../../scripts/verify/lib/http.mjs';

const BASE = process.env.BASE || 'https://miltonly.com';
const sm = await get(`${BASE}/sitemap.xml`);
if (sm.status !== 200) throw new Error(`sitemap ${sm.status}`);
const urls = [...new Set([...sm.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, '') || '/'))];
urls.push('/this-page-does-not-exist-mc046'); // the 404

const section = (p) => {
  if (p === '/') return 'home';
  if (p.startsWith('/this-page-does-not-exist')) return '404';
  const seg = p.split('/').filter(Boolean);
  if (seg.length === 1) return `index:/${seg[0]}`;
  return seg[0];
};

// Each probe answers yes/no for a page. Patterns name labels, never values.
const probes = {
  // street page (sections.tsx)
  street_hero_price: (h) => /class="s-n"><b>\$<\/b>/.test(h),
  street_glance_vow: (h) => /s-gi-l">(Typical sold|Sold to ask|Typical DOM|Lowest sold|Highest sold|Sales tracked|Market state|Busiest month)<\/div><div class="s-gi-v">/.test(h),
  street_gate_count: (h) => /closed sales in the last 12 months/.test(h),
  street_ld_additionalProperty: (h) => /"additionalProperty"/.test(h),
  street_og_png: (h) => /\/og\.png/.test(h),
  // any page
  rent_per_month_figure: (h) => /\$[\d,.]+K?\s*(?:<!-- -->)?\s*\/\s*mo/.test(h),
  mega_sell_panel: (h) => /Days to sell/.test(h) && /Sold to ask/.test(h),
  mega_rent_leased_to_ask: (h) => /Leased to ask/.test(h),
  // hub
  hub_ld_aggregatePrice: (h) => /"aggregatePrice"/.test(h),
  hub_sales_12mo: (h) => /sales here in 12 months/.test(h),
  meta_desc_has_dollar: (h) => { const m = h.match(/<meta name="description" content="([^"]*)"/); return !!m && /\$\d/.test(m[1]); },
  // generic sold wording near a figure
  sold_word_with_figure: (h) => /(typical|sold)[^<]{0,40}\$\d/i.test(h.replace(/<script[\s\S]*?<\/script>/g, '')),
  days_on_market_label: (h) => /days on market/i.test(h.replace(/<script[\s\S]*?<\/script>/g, '')),
};

const tally = {}; // section -> { pages, status:{}, probe:{} }
let i = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (i < urls.length) {
    const p = urls[i++];
    const s = section(p);
    const t = (tally[s] ??= { pages: 0, ok: 0, status: {}, probe: {} });
    t.pages++;
    const r = await get(`${BASE}${p}`);
    t.status[r.status] = (t.status[r.status] || 0) + 1;
    let body = r.body;
    if (s === '404' && r.status === 404) {
      const r2 = await fetch(`${BASE}${p}`, { headers: { 'user-agent': 'miltonly-verify' } });
      body = await r2.text();
    }
    if (!body) continue;
    t.ok++;
    for (const [k, f] of Object.entries(probes)) if (f(body)) t.probe[k] = (t.probe[k] || 0) + 1;
  }
}));

// The street card API (source of og.png): count streets whose card carries a figure.
const streetSlugs = urls.filter((p) => /^\/streets\/[^/]+$/.test(p));
let cardFigure = 0, cardBasis = 0, j = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
  while (j < streetSlugs.length) {
    const p = streetSlugs[j++];
    const r = await get(`${BASE}/api${p}/card`);
    if (r.status !== 200) continue;
    try { const c = JSON.parse(r.body); if (c.figure) cardFigure++; if (c.basis) cardBasis++; } catch {}
  }
}));

console.log(`base ${BASE} · ${urls.length} urls`);
for (const [s, t] of Object.entries(tally).sort()) {
  const probesStr = Object.entries(t.probe).map(([k, v]) => `${k}=${v}`).join(' ');
  console.log(`${s.padEnd(22)} pages=${t.pages} ok=${t.ok} status=${JSON.stringify(t.status)} ${probesStr}`);
}
console.log(`api/streets/[slug]/card: ${streetSlugs.length} streets, figure=${cardFigure} basis=${cardBasis}`);
