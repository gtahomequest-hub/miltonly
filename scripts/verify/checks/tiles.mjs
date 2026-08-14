// Every published figure is floored against the sample it was computed over.
//
// Not a keyword scan: for every published street this recomputes from the record what each tile is
// ENTITLED to publish, then checks the rendered page against that. 236 pages once published a DOM
// or sold-to-ask figure off fewer than five sales, and 50 published a "typical" computed over
// fewer than five — 16 of them over exactly one.
import { parsePage } from '../lib/parse.mjs';
import { asPublished, publishes } from '../lib/money.mjs';
import { K_ANON_PRICE } from '../lib/db.mjs';

const has = (x) => {
  if (x === null || x === undefined) return false;
  const s = typeof x === 'string' ? x : (x.v ?? '');
  return s !== '—' && /\d/.test(s);
};

export default {
  id: 'tiles',
  title: 'Every published figure is floored against its own sample',
  needsRecord: true,

  perPage(slug, html, { record }) {
    const p = parsePage(html);
    const e = record.entitled(slug);
    const d90 = record.ninetyDay(slug);
    const heroPrice = p.hero['Typical price'] && !p.hero['Typical price'].silent && /\d/.test(p.hero['Typical price'].v)
      ? p.hero['Typical price'] : null;
    return {
      slug,
      ...d90,
      n12: e.n12, entitled: e.basis,
      heroV: heroPrice ? heroPrice.v : null,
      heroBasis: heroPrice ? heroPrice.basis : null,
      sideTypical: p.facts['Typical price'] ?? null,
      sideDom: p.facts['Typical days on market'] ?? null,
      glTypical: p.glance['Typical sold'] ?? null,
      glDom: p.glance['Typical DOM'] ?? null,
      glSta: p.glance['Sold to ask'] ?? null,
      glTrend: p.glance['Trend'] ?? null,
      glState: p.glance['Market state'] ?? null,
    };
  },

  finish(rows) {
    const pricedNoBasis = rows.filter((r) => (has(r.heroV) || has(r.sideTypical) || has(r.glTypical)) && !r.entitled);

    // Sub-k means the page is publishing the 90-day figure INSTEAD OF the entitled one. Where the
    // two are indistinguishable once rounded to the display step, the rendered value is no
    // evidence about which was used, so it is not a finding — comparing raw numbers reported 19
    // pages that were publishing the entitled average all along.
    const subkPrice = rows.filter((r) => {
      if (!(r.c90 > 0 && r.c90 < K_ANON_PRICE)) return false;
      const d90 = asPublished(r.a90), entitled = asPublished(r.entitled?.typical ?? null);
      if (!d90 || d90 === entitled) return false;
      return publishes(r.heroV, d90) || publishes(r.sideTypical, d90) || publishes(r.glTypical?.v, d90);
    });

    const basisWrong = rows.filter((r) => {
      if (!has(r.heroV) || !r.heroBasis || !r.entitled) return false;
      const m = r.heroBasis.match(/across (\d+) (?:sale|sales) in the last (12 months|~2 years)/);
      if (!m) return true;
      const wantWindow = r.entitled.window === '12mo' ? '12 months' : '~2 years';
      return Number(m[1]) !== r.entitled.count || m[2] !== wantWindow;
    });

    return {
      coverage: [
        ['pages rendering a hero price', rows.filter((r) => has(r.heroV)).length],
        ['pages entitled to a price at all', rows.filter((r) => r.entitled).length],
        ['pages with a 90-day sample below threshold', rows.filter((r) => r.c90 > 0 && r.c90 < K_ANON_PRICE).length],
      ],
      assertions: [
        ['prices rendered with NO entitled basis', pricedNoBasis.length, 0],
        ['prices that are the sub-k 90-day figure', subkPrice.length, 0],
        ['sidebar DOM published with n12 < 5', rows.filter((r) => has(r.sideDom) && r.n12 < K_ANON_PRICE).length, 0],
        ['glance DOM published with n12 < 5', rows.filter((r) => has(r.glDom) && r.n12 < K_ANON_PRICE).length, 0],
        ['glance sold-to-ask published with n12 < 5', rows.filter((r) => has(r.glSta) && r.n12 < K_ANON_PRICE).length, 0],
        ['glance Trend published (YoY, no countable sample)', rows.filter((r) => has(r.glTrend)).length, 0],
        ['glance Market state with a sub-k 90-day sample', rows.filter((r) => r.glState && r.c90 < K_ANON_PRICE && has(r.glState)).length, 0],
        ['hero basis line disagrees with its sample', basisWrong.length, 0],
      ],
      examples: [
        ...subkPrice.slice(0, 4).map((r) => `sub-k price ${r.slug}: c90=${r.c90} hero=${r.heroV}`),
        ...basisWrong.slice(0, 4).map((r) => `basis ${r.slug}: "${r.heroBasis}" vs n=${r.entitled.count} ${r.entitled.window}`),
      ],
    };
  },
};
