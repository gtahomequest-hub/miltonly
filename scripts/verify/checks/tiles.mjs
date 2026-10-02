// No street page publishes a value derived from a sold or leased record (MC-046 Stage 1).
//
// This check used to recompute, for every published street, what each tile was ENTITLED to
// publish under the k-anon floors, and hold the rendered page to it. Under PropTx VOW Best
// Practices item 40 there is nothing left to entitle: the hero typical and its basis,
// "Transactions tracked", the sale and lease pills, the whole glance grid, the sidebar's market
// facts, the owner CTA's figure, the type cards' sold rows, the market cards, the rent grid, the
// quarterly chart, the area-context block and the "needs 5 sales, has N" notes all left the
// visitor view. So the check now asserts their ABSENCE on the served page, container by
// container, and that the IDX values that stayed (the active count, the type cards' active
// listings and "avg asking", the similar streets' "avg asking") are still there and labelled.
//
// Read from discrete parsed containers (parse.mjs), never a tag-stripped document, plus the
// rendered document with the RSC payload removed for the class and text sweeps.
import { parsePage } from '../lib/parse.mjs';

const rendered = (raw) => raw.replace(/<script[\s\S]*?<\/script>/g, ' ');

/** Hero tiles that were sold- or leased-derived. */
const VOW_HERO = ['Typical price', 'Transactions tracked'];
/** Sidebar facts that were sold-derived. */
const VOW_FACTS = ['Typical price', 'Price band', 'Typical days on market', 'Sales tracked', 'Transactions tracked'];

export default {
  id: 'tiles',
  title: 'No sold- or leased-derived tile, pill, fact or card on a street page',

  perPage(slug, raw) {
    const p = parsePage(raw);
    const html = rendered(raw);
    const typeCells = p.types.flatMap((t) => Object.entries(t.cells).map(([label, c]) => ({ type: t.type, label, ...c })));
    return {
      slug,
      heroVow: VOW_HERO.filter((l) => p.hero[l]),
      heroActive: !!p.hero['Active right now'],
      pills: p.pills.length,
      glance: Object.keys(p.glance).length,
      factsVow: VOW_FACTS.filter((l) => p.facts[l] != null),
      typeCards: p.types.length,
      typeVowCells: typeCells.filter((c) => c.label !== 'Active listings').map((c) => `${c.type}:${c.label}`),
      // the one cell a type card keeps is the active count; its detail, where present, says asking
      typeUnlabelled: typeCells.filter((c) => c.label === 'Active listings' && c.d && !/^avg asking \$/.test(c.d)).length,
      marketCards: Object.keys(p.msum).length + Object.keys(p.msumFlat).length,
      rentGrid: /class="s-rentgrid"/.test(html),
      chart: /class="s-(?:market-)?chart"|class="s-bars"|Quarterly sold/.test(html),
      ctaFigure: p.cta,
      areaContext: /class="s-block s-areacx"|class="s-areacx-num"/.test(html),
      gateLine: /class="s-hero-gate"|closed (?:sale|sales) in the last 12 months/.test(html),
      silentNotes: (html.match(/needs \d+ sales?, has \d+/g) || []).length,
      sampleClauses: (html.match(/across \d+ (?:sales?|leases?)\b/g) || []).length,
      basisLines: (html.match(/<div class="s-basis">/g) || []).length,
      // the street's own line ("Sold history for <street> …"); a site-wide "Milton sold history"
      // line in the menu, if the chrome carries one, is not this page's line
      soldLines: (html.match(/data-sold-history-line[^>]*>Sold history for /g) || []).length,
      // similar streets: the IDX average is labelled asking
      similarUnlabelled: (html.match(/active · avg (?!asking)/g) || []).length,
    };
  },

  finish(rows) {
    const any = (key) => rows.filter((r) => (Array.isArray(r[key]) ? r[key].length > 0 : !!r[key]));
    return {
      // COVERAGE FIRST. "Found nothing" and "read nothing" print identically otherwise.
      coverage: [
        ['pages parsed', rows.length],
        ['pages rendering the "Active right now" tile', rows.filter((r) => r.heroActive).length],
        ['pages rendering a type card (active listings)', rows.filter((r) => r.typeCards > 0).length],
      ],
      assertions: [
        ['pages with no "Active right now" tile (parser reached nothing)', rows.filter((r) => !r.heroActive).length, 0],
        ['hero sold/leased tiles (typical price, transactions tracked)', any('heroVow').length, 0],
        ['sale or lease pills', rows.filter((r) => r.pills > 0).length, 0],
        ['at-a-glance tiles', rows.filter((r) => r.glance > 0).length, 0],
        ['sidebar sold facts (typical, band, DOM, sales tracked)', any('factsVow').length, 0],
        ['type-card sold rows (typical, band, time on market, sold to ask)', any('typeVowCells').length, 0],
        ['type-card active detail not labelled asking', rows.filter((r) => r.typeUnlabelled > 0).length, 0],
        ['Sales / Leases market cards', rows.filter((r) => r.marketCards > 0).length, 0],
        ['rent-by-beds grid', any('rentGrid').length, 0],
        ['quarterly sold chart', any('chart').length, 0],
        ['owner CTA figure ("Typical is $X")', any('ctaFigure').length, 0],
        ['area-context block (neighbourhood typical)', any('areaContext').length, 0],
        ['hero gate line ("N closed sales in the last 12 months")', any('gateLine').length, 0],
        ['"needs 5 sales, has N" notes', rows.filter((r) => r.silentNotes > 0).length, 0],
        ['"across N sales/leases" clauses', rows.filter((r) => r.sampleClauses > 0).length, 0],
        ['basis lines', rows.filter((r) => r.basisLines > 0).length, 0],
        ['pages without exactly one neutral line', rows.filter((r) => r.soldLines !== 1).length, 0],
        ['similar streets "avg" not labelled asking', rows.filter((r) => r.similarUnlabelled > 0).length, 0],
      ],
      examples: [
        ...any('heroVow').slice(0, 2).map((r) => `hero ${r.slug}: ${r.heroVow.join(', ')}`),
        ...any('factsVow').slice(0, 2).map((r) => `facts ${r.slug}: ${r.factsVow.join(', ')}`),
        ...any('typeVowCells').slice(0, 2).map((r) => `type ${r.slug}: ${r.typeVowCells.slice(0, 3).join(', ')}`),
        ...rows.filter((r) => r.soldLines !== 1).slice(0, 2).map((r) => `neutral line ${r.slug}: ${r.soldLines}`),
      ],
    };
  },
};
