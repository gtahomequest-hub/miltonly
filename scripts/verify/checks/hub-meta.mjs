// A hub's SERP description states the same live aggregate its own body states.
//
// THE DEFECT CLASS THIS ENCODES — the same one the street tiles had: a number computed once and
// stored, drifting away from the number the page recomputes on every request. On 2026-08-15 the
// stored hub descriptions had drifted on 16 of 22 prices and 21 of 21 sale counts, always
// overstating; Beaty's meta advertised "$995,000, 187 sales" beside a body rendering $973K and
// 159. Worse, Brookville / Haltonville and Milton North published a typical price into the SERP
// off 4- and 3-sale pools — a k-anon suppression their own pages honoured and their metas did not.
// A suppression that holds on one of two published surfaces is not a suppression.
//
// So this asserts VALUES, on three surfaces, per page:
//   · the meta price     == the live k-gated 12-month typical, rounded as the page rounds it
//   · the meta count     == the live sale count
//   · the hero tile      == the same figure, in the compact form the tile prints
//   · sub-k              == silent in BOTH places, never one
//
// Both sides derived: the published side by reading the deployed pages at BASE, the record side
// by recomputing from DB2 in lib/db.mjs. The stored HubContent.metaDescription is read too, but
// only to REPORT how far the retired path had drifted — it is never the expected value.
import { get, publishedHubSlugs } from '../lib/http.mjs';

/** The compact money form the hero stat tile prints. Re-derived, not imported. */
const compact = (n) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(2).replace(/\.?0+$/, '')}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : `${n}`;

const strip = (s) => s.replace(/<!--.*?-->/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const decode = (s) =>
  s.replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x2F;/g, '/');

/** The three hero stat tiles, keyed by their own printed LABEL rather than by position — a
 *  positional parser reads the wrong tile the moment a tile is added or suppressed. */
function heroStats(html) {
  const out = {};
  // Split on the container and read each tile's own two fields. A single regex spanning the
  // whole tile cannot work: the non-greedy body stops at the first "</div></div>", which eats
  // the label's closing tag and silently yields zero tiles — which is exactly what the first
  // version of this parser did, and every value assertion below "passed" over nothing.
  for (const chunk of html.split('<div class="h-hs">').slice(1)) {
    const v = chunk.match(/^<div class="h-n([^"]*)">([\s\S]*?)<\/div>/);
    const l = chunk.match(/<div class="h-l">([\s\S]*?)<\/div>/);
    if (!v || !l) continue;
    out[strip(l[1])] = { silent: v[1].includes('h-silent'), text: strip(v[2]) };
  }
  return out;
}

/** The money token out of a description: "$975,000" / "$1,585,000". Whole token, never a substring. */
const metaPrice = (d) => {
  const m = d && d.match(/typically \$([\d,]+)/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
};
const metaCount = (d) => {
  const m = d && d.match(/(\d+) sales? (?:in the last 12 months|tracked)/);
  return m ? Number(m[1]) : null;
};

export default {
  id: 'hub-meta',
  title: 'Hub SERP description == the live aggregate the hub body publishes',
  wholeCorpusOnly: true,
  needsHubRecord: true,

  async finish(_rows, { base, hubRecord }) {
    const slugs = await publishedHubSlugs(base);
    const rows = [];
    for (const slug of slugs) {
      const r = await get(`${base}/neighbourhoods/${slug}`);
      if (r.status !== 200) { rows.push({ slug, status: r.status }); continue; }
      const dm = r.body.match(/<meta name="description" content="([^"]*)"/);
      rows.push({
        slug,
        status: 200,
        description: dm ? decode(dm[1]) : null,
        hero: heroStats(r.body),
        rec: hubRecord.hub(slug),
      });
    }

    const ok = rows.filter((r) => r.status === 200);
    const parsed = ok.filter((r) => r.description !== null);
    const withRec = parsed.filter((r) => r.rec);
    const tiles = withRec.filter((r) => r.hero['typical home'] && r.hero['sold · last 12 months']);

    const priceMismatch = [], countMismatch = [], subKLeak = [], heroMismatch = [], heroCountMismatch = [], silentSplit = [];
    let storedDrift = 0, storedSubKLeak = 0;

    for (const r of tiles) {
      const { typicalRounded, salesCount } = r.rec;
      const mp = metaPrice(r.description);
      const mc = metaCount(r.description);
      const tile = r.hero['typical home'];
      const soldTile = r.hero['sold · last 12 months'];

      // 1. the meta price IS the live k-gated, page-rounded typical — or absent when it is null
      if (typicalRounded === null) {
        if (mp !== null) subKLeak.push(`${r.slug}: meta states $${mp.toLocaleString()} off ${salesCount} sales (below k=5)`);
      } else if (mp !== typicalRounded) {
        priceMismatch.push(`${r.slug}: meta $${mp === null ? '—' : mp.toLocaleString()} vs live $${typicalRounded.toLocaleString()}`);
      }

      // 2. the meta sale count IS the live sale count
      if (mc !== salesCount) countMismatch.push(`${r.slug}: meta ${mc === null ? '—' : mc} sales vs live ${salesCount}`);

      // 3. the hero tile prints the SAME figure, compacted
      if (typicalRounded === null) {
        if (!tile.silent) heroMismatch.push(`${r.slug}: hero prints "${tile.text}" off a sub-k pool`);
      } else if (tile.silent || tile.text.replace(/\s/g, '') !== `$${compact(typicalRounded)}`) {
        heroMismatch.push(`${r.slug}: hero "${tile.text}" vs expected $${compact(typicalRounded)}`);
      }
      if (Number(soldTile.text) !== salesCount) heroCountMismatch.push(`${r.slug}: hero sold ${soldTile.text} vs live ${salesCount}`);

      // 4. price-silence agrees across the two surfaces — never suppressed on one only
      if (tile.silent !== (mp === null)) silentSplit.push(`${r.slug}: hero silent=${tile.silent}, meta price=${mp === null ? 'absent' : 'present'}`);

      // reported, not asserted: how far the retired stored path had drifted
      const sp = metaPrice(r.rec.storedMetaDescription), sc = metaCount(r.rec.storedMetaDescription);
      if ((sp !== null && sp !== typicalRounded) || (sc !== null && sc !== salesCount)) storedDrift++;
      if (typicalRounded === null && sp !== null) storedSubKLeak++;
    }

    return {
      coverage: [
        ['hub pages in the live sitemap', slugs.length],
        ['fetched 200', ok.length],
        ['meta description parsed', parsed.length],
        ['matched to a record', withRec.length],
        ['hero stat tiles parsed', tiles.length],
        ['sub-k hubs (price must be silent everywhere)', tiles.filter((r) => r.rec.typicalRounded === null).map((r) => r.slug).join(', ') || 'none'],
      ],
      assertions: [
        // A parser that reaches nothing must fail on its own coverage, not read as "no findings".
        ['hub pages read == sitemap hub count', ok.length, slugs.length],
        ['hero stat tiles parsed on every hub', tiles.length, slugs.length],
        ['meta price != live typical', priceMismatch.length, 0],
        ['meta sale count != live sale count', countMismatch.length, 0],
        ['meta states a price off a sub-k pool', subKLeak.length, 0],
        ['hero typical != live typical as displayed', heroMismatch.length, 0],
        ['hero sold count != live sale count', heroCountMismatch.length, 0],
        ['price suppressed on one surface only', silentSplit.length, 0],
      ],
      notes: [
        `stored HubContent.metaDescription (no longer served) still drifts from live on ${storedDrift} of ${tiles.length} hubs`,
        `stored descriptions publishing a price off a sub-k pool: ${storedSubKLeak}`,
      ],
      examples: [...subKLeak, ...priceMismatch, ...countMismatch, ...heroMismatch, ...heroCountMismatch, ...silentSplit],
    };
  },
};
