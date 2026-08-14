// A published sentence may not deny, or contradict, a figure the same page publishes.
//
// This is the detector for the render-time guards in src/lib/prose/numericSentences.ts. It is
// deliberately a SEPARATE implementation reading the served HTML: a guard verified against its own
// predicate verifies nothing. 141 of 426 pages carried "A reliable street-level price isn't
// available given the thin recent activity on X" directly beneath a hero publishing a price.
//
// Both published surfaces are checked. The JSON-LD is not a copy of the page — until 2026-08-14 it
// was sourced from the RAW generation record and bypassed every suppression pass the reader's
// copy goes through.
import { proseBlocks, schemaBlocks, sentences, parsePage } from '../lib/parse.mjs';

const DENIES =
  /\b(?:no|not|isn'?t|is not|cannot|can'?t|could not|couldn'?t|too few|too thin|too sparse|too shallow|too small|falls? below|sits? below|below the threshold|insufficient|unable|lacks?)\b/i;
const PUBLISHING =
  /\b(?:publish(?:ed|ing|able)?|available|stated?|state|support|report(?:ed)?|quote[ds]?)\b/i;
const PRICE_NOUN = /\b(?:price|pricing|prices|typical|number|figure|benchmark|valuation)\b/i;
const RANGE_NOUN = /\b(?:range|band)\b/i;
// Class (c): direction, not denial. A page publishing sold-to-ask above 100% is publishing
// "homes closed OVER ask"; a sentence framing the same metric as at-or-below ask contradicts it.
const AT_ASK =
  /\b(?:close to (?:full )?ask|at or (?:just )?below ask|near(?:ly)? full ask|meeting near the listed number|concessions? (?:are|remain) the exception|rarely (?:go|sell) over ask|seldom over ask|below asking)\b/i;
const OVER_ASK = /\b(?:over ask|above ask|over asking|above asking|bidding war|competing offers)\b/i;

function findHits(blocks, { priced, band, overAsk }) {
  const out = [];
  for (const block of blocks) {
    for (const sent of sentences(block)) {
      if (DENIES.test(sent) && PUBLISHING.test(sent)) {
        if (PRICE_NOUN.test(sent)) { if (priced) { out.push({ cls: 'a', sent: sent.slice(0, 200) }); continue; } }
        else if (RANGE_NOUN.test(sent)) { if (band) { out.push({ cls: 'b', sent: sent.slice(0, 200) }); continue; } }
      }
      if (overAsk && AT_ASK.test(sent) && !OVER_ASK.test(sent)) out.push({ cls: 'c', sent: sent.slice(0, 200) });
    }
  }
  return out;
}

export default {
  id: 'denials',
  title: 'No sentence denies or contradicts a figure the page publishes',

  perPage(slug, html) {
    const p = parsePage(html);
    const staRaw = p.glance['Sold to ask']?.v ?? null;
    const staPct = staRaw && /\d/.test(staRaw) ? Number(staRaw.replace(/[^\d.]/g, '')) : null;
    const gate = { priced: p.publishesPrice, band: p.publishesBand, overAsk: staPct !== null && staPct > 100 };
    const vis = proseBlocks(html);
    const sch = schemaBlocks(html);
    return {
      slug,
      ...gate,
      staPct,
      nProse: vis.length,
      nSchema: sch.length,
      visible: findHits(vis, gate),
      schema: findHits(sch, gate),
    };
  },

  finish(rows) {
    const hitsIn = (key, cls) => rows.filter((r) => r[key].some((h) => !cls || h.cls === cls));
    const either = rows.filter((r) => r.visible.length || r.schema.length);
    const examples = either.slice(0, 5).map((r) => `${r.slug}: "${(r.visible[0] ?? r.schema[0]).sent.slice(0, 110)}"`);
    return {
      // COVERAGE FIRST. A parser that reached nothing would report zero denials and read as a
      // pass, so what was read is stated beside what was found.
      coverage: [
        ['prose blocks read', rows.reduce((t, r) => t + r.nProse, 0)],
        ['schema strings read', rows.reduce((t, r) => t + r.nSchema, 0)],
        ['pages publishing a price', rows.filter((r) => r.priced).length],
        ['pages publishing a band', rows.filter((r) => r.band).length],
        ['pages publishing sold-to-ask > 100%', rows.filter((r) => r.overAsk).length],
      ],
      assertions: [
        ['pages with NO prose block (parser reached nothing)', rows.filter((r) => !r.nProse).length, 0],
        ['pages with NO schema string', rows.filter((r) => !r.nSchema).length, 0],
        ['(a) denies a published price — visible', hitsIn('visible', 'a').length, 0],
        ['(a) denies a published price — JSON-LD', hitsIn('schema', 'a').length, 0],
        ['(b) denies a published band — visible', hitsIn('visible', 'b').length, 0],
        ['(b) denies a published band — JSON-LD', hitsIn('schema', 'b').length, 0],
        ['(c) contradicts its sold-to-ask tile — visible', hitsIn('visible', 'c').length, 0],
        ['(c) contradicts its sold-to-ask tile — JSON-LD', hitsIn('schema', 'c').length, 0],
        ['either surface, any class', either.length, 0],
      ],
      examples,
    };
  },
};
