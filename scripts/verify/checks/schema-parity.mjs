// THE STRUCTURED DATA IS THE COPY THE READER GETS. One suppression pass, one set of prose, no
// second path to the index.
//
// This is the permanent shape of a defect that ran for the whole life of the suppression work.
// src/app/streets/[slug]/page.tsx read `generation.sections` and `generation.faq` RAW while the
// visible page was built from the suppressed view, so the FAQPage node carried every answer the
// cascade had already dropped: 2,282 Question nodes against 1,040 rendered items, and 375 of 426
// pages where the two surfaces disagreed. aird-court's visible prose was clean while its schema
// still told Google "A reliable street-level price isn't available".
//
// A per-page equality, not a corpus total: two totals can match while individual pages differ.
import { faqCounts } from '../lib/parse.mjs';

export default {
  id: 'schema-parity',
  title: 'Structured data publishes exactly what the page publishes',

  perPage(slug, html) {
    const f = faqCounts(html);
    return { slug, ...f };
  },

  finish(rows) {
    const differ = rows.filter((r) => r.schema !== r.visible);
    const empty = rows.filter((r) => r.visible === 0);
    // A heading is a promise that something follows it. When every FAQ item is suppressed the
    // section must collapse — heading AND schema node — rather than stand over nothing.
    const orphanHeading = empty.filter((r) => r.headingRendered);
    const orphanNode = empty.filter((r) => r.faqPageNode);
    return {
      coverage: [
        ['visible FAQ items', rows.reduce((t, r) => t + r.visible, 0)],
        ['schema Question nodes', rows.reduce((t, r) => t + r.schema, 0)],
        ['pages with no FAQ at all', empty.length],
      ],
      assertions: [
        ['pages where schema != visible', differ.length, 0],
        ['zero-FAQ pages still rendering the heading', orphanHeading.length, 0],
        ['zero-FAQ pages still emitting a FAQPage node', orphanNode.length, 0],
      ],
      examples: differ.slice(0, 5).map((r) => `${r.slug}: visible ${r.visible} vs schema ${r.schema}`),
    };
  },
};
