// A hub's SERP head, glance and JSON-LD carry no value derived from VOW records.
//
// HISTORY. This check used to assert that the hub's meta description, its hero tile and its
// JSON-LD aggregatePrice all published the SAME live k-gated 12-month typical and sale count
// (the 2026-08-15 drift: 16 of 22 stored prices and 21 of 21 sale counts had moved, and two
// sub-k hubs published a price into the SERP their own pages suppressed).
//
// MC-046 Stage 1 (PropTx VOW Best Practices item 40, ruling R4). Those figures are derived from
// sold records, and a SERP snippet, a hero and a JSON-LD node are all served to everyone. So the
// assertion is now their ABSENCE, on all three surfaces, per page:
//   · the meta description carries no price, no sale count and no "typically" / "tracked" hook;
//     it states homes for sale today and street guides at most
//   · the glance renders no typical fact (hub-fact-typical) and no type-share-of-sales fact
//   · no JSON-LD node carries an aggregatePrice
//   · the voice rule reaches the SERP: no em-dash in a title or a description (MC-012)
//
// Read from the deployed pages at BASE. No database is read: absence needs no record.
import { get, publishedHubSlugs } from '../lib/http.mjs';

const decode = (s) =>
  s.replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x2F;/g, '/');

/** A VOW figure in a head string: a price, a sale count, or the retired hooks. "for sale" is IDX. */
const VOW_IN_HEAD = /\$\s?\d|\btypically\b|\b\d[\d,]*\s+sales\b|\bsold\b|\btracked\b|last 12 months|days on market/i;

/** Every JSON-LD node that carries an aggregatePrice, at any depth. Undefined when none parse. */
function ldAggregatePrices(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!blocks.length) return undefined;
  let found = 0;
  const walk = (n) => {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (Object.prototype.hasOwnProperty.call(n, 'aggregatePrice')) found++;
    Object.values(n).forEach(walk);
  };
  for (const b of blocks) {
    try { walk(JSON.parse(b[1])); } catch { return undefined; }
  }
  return found;
}

export default {
  id: 'hub-meta',
  title: 'Hub meta, glance and JSON-LD carry no VOW-derived figure',
  wholeCorpusOnly: true,

  async finish(_rows, { base }) {
    const slugs = await publishedHubSlugs(base);
    const rows = [];
    for (const slug of slugs) {
      const r = await get(`${base}/neighbourhoods/${slug}`);
      if (r.status !== 200) { rows.push({ slug, status: r.status }); continue; }
      const dm = r.body.match(/<meta name="description" content="([^"]*)"/);
      const tm = r.body.match(/<title>([^<]*)<\/title>/);
      rows.push({
        slug,
        status: 200,
        description: dm ? decode(dm[1]) : null,
        title: tm ? decode(tm[1]) : null,
        glanceTypical: /data-fig="hub-fact-(typical|stock)"/.test(r.body),
        ld: ldAggregatePrices(r.body),
      });
    }

    const ok = rows.filter((r) => r.status === 200);
    // MC-012: the voice rule reaches the SERP. A title or a description carrying an em-dash is a
    // template that was edited without this line moving.
    const dashed = ok.filter((r) => (r.title && r.title.includes('—')) || (r.description && r.description.includes('—'))).map((r) => `${r.slug}: ${r.title && r.title.includes('—') ? 'title' : 'description'}`);
    const parsed = ok.filter((r) => r.description !== null);
    const withLd = ok.filter((r) => r.ld !== undefined);
    const metaVow = parsed.filter((r) => VOW_IN_HEAD.test(r.description) || (r.title && VOW_IN_HEAD.test(r.title))).map((r) => `${r.slug}: "${r.description}"`);
    const glanceVow = ok.filter((r) => r.glanceTypical).map((r) => `${r.slug}: the glance still renders a typical or a type share of sales`);
    const ldVow = withLd.filter((r) => r.ld > 0).map((r) => `${r.slug}: ${r.ld} JSON-LD node(s) carry aggregatePrice`);

    return {
      coverage: [
        ['hub pages in the live sitemap', slugs.length],
        ['fetched 200', ok.length],
        ['meta description parsed', parsed.length],
        ['JSON-LD parsed', withLd.length],
      ],
      assertions: [
        // A parser that reaches nothing must fail on its own coverage, not read as "no findings".
        ['hub pages read == sitemap hub count', ok.length, slugs.length],
        ['meta descriptions parsed on every hub', parsed.length, slugs.length],
        ['JSON-LD parsed on every hub', withLd.length, slugs.length],
        ['hub titles or descriptions carrying an em-dash', dashed.length, 0],
        ['hub titles or descriptions carrying a VOW figure (price, sale count, sold)', metaVow.length, 0],
        ['hubs whose glance renders a typical or a type share of sales', glanceVow.length, 0],
        ['hubs whose JSON-LD carries aggregatePrice', ldVow.length, 0],
      ],
      examples: [...dashed, ...metaVow, ...glanceVow, ...ldVow],
    };
  },
};
