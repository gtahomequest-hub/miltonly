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

/** Labels whose sample is a SUBSET of the street pool by design and must not be compared with it:
 *  the per-property-type rows ("Condo sold · across 8 sales") and anything not sales-based. */
const SUBSET_LABEL = /^(condo|town(house)?|detached|semi|link|other|active|on the market)\b/i;

/**
 * The samples the page states ABOUT ITS OWN STREET POOL, grouped by window, read from DISCRETE
 * PARSED CONTAINERS — hero tile basis lines and at-a-glance descriptions.
 *
 * The first version of this tag-stripped the whole document and regex-swept it, which is the
 * exact mistake the README warns about: it swept up the neighbourhood's sample ("107 sales") and
 * every per-type subset ("8 sales" for condos) alongside the street's own, and reported 214 of
 * 426 pages as self-contradictory when not one of them was. Different pools are allowed to state
 * different numbers; only the same pool must agree with itself.
 */
function statedSamples(p) {
  const out = {};
  const add = (s) => {
    const m = String(s ?? '').match(/(\d+)\s+sales?\s*(?:in the last|·\s*last)\s*(12 months|~2 years)/);
    if (m) (out[m[2]] ??= new Set()).add(Number(m[1]));
  };
  for (const [label, t] of Object.entries(p.hero)) if (!SUBSET_LABEL.test(label)) add(t.basis);
  for (const [label, g] of Object.entries(p.glance)) if (!SUBSET_LABEL.test(label)) add(g.d);
  return Object.fromEntries(Object.entries(out).map(([w, s]) => [w, [...s].sort((a, b) => a - b)]));
}

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
      // Every sample the PAGE states about itself, for the self-consistency assertion below.
      // Read from the raw HTML rather than a parsed container because these basis clauses hang
      // off tiles, glance rows and prose alike, and the assertion is about all of them agreeing.
      statedSamples: statedSamples(p),
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

    // ── THE BASIS LINE ─────────────────────────────────────────────────────────────────────────
    // This used to assert the rendered sample against DB2's CURRENT count, and that was the wrong
    // question. Street pages are statically generated; after the 11:30 UTC compute-sold-stats cron
    // a page correctly serving what it was built from says "across 9 sales" while DB2 now says 10.
    // The page is not wrong — a prerendered figure trailing a cron by an hour is the design
    // working — and the gate went red for an hour a day with nothing to fix. A gate that is red
    // for the wrong reason hides the next real regression.
    //
    // So the assertion is now about what the page can be held to: INTERNAL CONSISTENCY. Whatever
    // sample it claims, it must claim the same one everywhere it repeats it, the hero basis must
    // be one of them, and a published price must sit on a sample at or above the k-anon floor.
    // Those hold regardless of when the page was built.
    const basisMalformed = rows.filter((r) => has(r.heroV) && r.heroBasis &&
      !/across (\d+) (?:sale|sales) in the last (12 months|~2 years)/.test(r.heroBasis));

    const heroSample = (r) => {
      const m = r.heroBasis?.match(/across (\d+) (?:sale|sales) in the last (12 months|~2 years)/);
      return m ? { n: Number(m[1]), window: m[2] } : null;
    };

    // (a) one page, one sample per window
    const sampleDisagrees = rows.filter((r) =>
      Object.values(r.statedSamples ?? {}).some((ns) => ns.length > 1));

    // (b) the hero basis is one of the samples the page states
    const heroOrphaned = rows.filter((r) => {
      const h = heroSample(r);
      if (!h) return false;
      return !(r.statedSamples?.[h.window] ?? []).includes(h.n);
    });

    // (c) a published price never sits on a sub-k sample, by the page's OWN account
    const heroBelowFloor = rows.filter((r) => {
      const h = heroSample(r);
      return h !== null && h.n < K_ANON_PRICE;
    });

    // Reported, not asserted: how far prerendered pages currently trail the record. This is the
    // ISR lag, and it is expected to be non-zero for part of every day.
    const lagging = rows.filter((r) => {
      const h = heroSample(r);
      if (!h || !r.entitled) return false;
      const wantWindow = r.entitled.window === '12mo' ? '12 months' : '~2 years';
      return h.n !== r.entitled.count || h.window !== wantWindow;
    });

    return {
      coverage: [
        ['pages rendering a hero price', rows.filter((r) => has(r.heroV)).length],
        ['pages entitled to a price at all', rows.filter((r) => r.entitled).length],
        ['pages with a 90-day sample below threshold', rows.filter((r) => r.c90 > 0 && r.c90 < K_ANON_PRICE).length],
        // Without this, the three self-consistency assertions below would read PASS over a page
        // set the sample parser never reached — the same blindness the coverage rule exists for.
        ['pages stating a street-level sample', rows.filter((r) => Object.keys(r.statedSamples ?? {}).length > 0).length],
        ['distinct sample windows seen', [...new Set(rows.flatMap((r) => Object.keys(r.statedSamples ?? {})))].join(', ') || 'none'],
      ],
      assertions: [
        ['prices rendered with NO entitled basis', pricedNoBasis.length, 0],
        ['prices that are the sub-k 90-day figure', subkPrice.length, 0],
        ['sidebar DOM published with n12 < 5', rows.filter((r) => has(r.sideDom) && r.n12 < K_ANON_PRICE).length, 0],
        ['glance DOM published with n12 < 5', rows.filter((r) => has(r.glDom) && r.n12 < K_ANON_PRICE).length, 0],
        ['glance sold-to-ask published with n12 < 5', rows.filter((r) => has(r.glSta) && r.n12 < K_ANON_PRICE).length, 0],
        ['glance Trend published (YoY, no countable sample)', rows.filter((r) => has(r.glTrend)).length, 0],
        ['glance Market state with a sub-k 90-day sample', rows.filter((r) => r.glState && r.c90 < K_ANON_PRICE && has(r.glState)).length, 0],
        ['hero basis line malformed', basisMalformed.length, 0],
        ['page states two different samples for one window', sampleDisagrees.length, 0],
        ['hero basis names a sample the page states nowhere else', heroOrphaned.length, 0],
        ["hero price sits on a sub-k sample by the page's own account", heroBelowFloor.length, 0],
      ],
      notes: [
        `${lagging.length} page(s) state a sample that differs from the record right now — ISR lag, ` +
        `not a defect: street pages are prerendered and the sold-stats cron moves the record under them. ` +
        `Reported so a genuine drift is still visible; not gated, because the page is correctly ` +
        `serving what it was built from.`,
      ],
      examples: [
        ...subkPrice.slice(0, 4).map((r) => `sub-k price ${r.slug}: c90=${r.c90} hero=${r.heroV}`),
        ...sampleDisagrees.slice(0, 4).map((r) => `mixed samples ${r.slug}: ${JSON.stringify(r.statedSamples)}`),
        ...heroOrphaned.slice(0, 4).map((r) => `orphan basis ${r.slug}: "${r.heroBasis}" vs ${JSON.stringify(r.statedSamples)}`),
        ...heroBelowFloor.slice(0, 4).map((r) => `sub-k basis ${r.slug}: "${r.heroBasis}"`),
        ...lagging.slice(0, 3).map((r) => `LAG (note only) ${r.slug}: "${r.heroBasis}" vs record n=${r.entitled.count}`),
      ],
    };
  },
};
