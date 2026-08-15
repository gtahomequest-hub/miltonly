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
// So this asserts VALUES, on all three published surfaces, per page:
//   · the meta price     == the live k-gated 12-month typical, rounded as the page rounds it
//   · the meta count     == the live sale count
//   · the hero tile      == the same figure, in the compact form the tile prints
//   · the JSON-LD        == the same figure at the same precision — it was emitting the RAW
//                          pool mean (972775 for Beaty) beside a page publishing $975K
//   · sub-k              == silent on ALL THREE, never on some
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

/** THE THIRD PUBLISHED SURFACE. JSON-LD is output, and it is where this defect class hid last
 *  time: on the street corpus the schema was sourced from the raw generation record while the
 *  body was built from the suppressed view, and 1,240 already-suppressed answers went on being
 *  served to Google. Here the hub schema's aggregatePrice was emitting the RAW pool mean —
 *  972775 for Beaty, beside a page publishing $975K. Parsed per node, never grepped from a blob.
 *  Returns undefined only when the page emits no JSON-LD at all, which is itself a finding. */
function schemaPrice(html) {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (!blocks.length) return undefined;
  let price = null;
  for (const b of blocks) {
    let parsed;
    try { parsed = JSON.parse(b[1]); } catch { return undefined; }
    for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
      const p = node?.aggregatePrice?.price;
      if (typeof p === 'number') price = p;
    }
  }
  return price; // null = no aggregatePrice node emitted (the k-anon-silent state)
}

export default {
  id: 'hub-meta',
  title: 'Hub meta, body and JSON-LD all publish the live aggregate',
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
        ld: schemaPrice(r.body),
        rec: hubRecord.hub(slug),
      });
    }

    const ok = rows.filter((r) => r.status === 200);
    const parsed = ok.filter((r) => r.description !== null);
    const withRec = parsed.filter((r) => r.rec);
    const tiles = withRec.filter((r) => r.hero['typical home'] && r.hero['sold · last 12 months']);

    const withLd = withRec.filter((r) => r.ld !== undefined);
    const priceMismatch = [], countMismatch = [], subKLeak = [], heroMismatch = [], heroCountMismatch = [], silentSplit = [], ldMismatch = [], ldSubKLeak = [];
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

      // 4. the JSON-LD publishes the SAME figure, at the SAME precision — the machine-readable
      //    twin is never more precise, never staler, and never louder than the page
      if (r.ld !== undefined) {
        if (typicalRounded === null) {
          if (r.ld !== null) ldSubKLeak.push(`${r.slug}: JSON-LD aggregatePrice ${r.ld} off ${salesCount} sales (below k=5)`);
        } else if (r.ld !== typicalRounded) {
          ldMismatch.push(`${r.slug}: JSON-LD ${r.ld === null ? 'absent' : r.ld} vs live ${typicalRounded}`);
        }
      }

      // 5. price-silence agrees across ALL THREE surfaces — never suppressed on some only
      if (tile.silent !== (mp === null)) silentSplit.push(`${r.slug}: hero silent=${tile.silent}, meta price=${mp === null ? 'absent' : 'present'}`);
      if (r.ld !== undefined && tile.silent !== (r.ld === null)) silentSplit.push(`${r.slug}: hero silent=${tile.silent}, JSON-LD price=${r.ld === null ? 'absent' : 'present'}`);

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
        ['JSON-LD parsed', withLd.length],
        ['sub-k hubs (price must be silent everywhere)', tiles.filter((r) => r.rec.typicalRounded === null).map((r) => r.slug).join(', ') || 'none'],
      ],
      assertions: [
        // A parser that reaches nothing must fail on its own coverage, not read as "no findings".
        ['hub pages read == sitemap hub count', ok.length, slugs.length],
        ['hero stat tiles parsed on every hub', tiles.length, slugs.length],
        ['JSON-LD parsed on every hub', withLd.length, slugs.length],
        ['meta price != live typical', priceMismatch.length, 0],
        ['meta sale count != live sale count', countMismatch.length, 0],
        ['meta states a price off a sub-k pool', subKLeak.length, 0],
        ['hero typical != live typical as displayed', heroMismatch.length, 0],
        ['hero sold count != live sale count', heroCountMismatch.length, 0],
        ['JSON-LD price != live typical as published', ldMismatch.length, 0],
        ['JSON-LD states a price off a sub-k pool', ldSubKLeak.length, 0],
        ['price suppressed on some surfaces only', silentSplit.length, 0],
      ],
      notes: [
        `stored HubContent.metaDescription (no longer served) still drifts from live on ${storedDrift} of ${tiles.length} hubs`,
        `stored descriptions publishing a price off a sub-k pool: ${storedSubKLeak}`,
      ],
      examples: [...subKLeak, ...ldSubKLeak, ...priceMismatch, ...countMismatch, ...heroMismatch, ...heroCountMismatch, ...ldMismatch, ...silentSplit],
    };
  },
};
