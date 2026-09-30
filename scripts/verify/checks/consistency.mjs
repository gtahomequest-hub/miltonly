// ONE METRIC, ONE NUMBER, and prose that still reads after suppression.
//
// The first half of this check held the sold figures a page repeated (the street typical in the
// hero, the glance grid and the sidebar; a per-type typical on its pill and its card; the rent on
// the lease pill and the market card; the inline CTA's typical) to one value each. MC-046 Stage 1
// (PropTx VOW Best Practices item 40) removed every one of those figures from the visitor view,
// so those assertions now hold them ABSENT: a page that carries none cannot disagree with itself.
//
// The second half is unchanged: the coherence failures a sentence-level suppression leaves
// behind (a standalone FAQ answer opening on a cut antecedent, a section that is only a
// compliance caveat). And one more, for ruling R1: no rendered FAQ item, and no FAQPage Question
// in the JSON-LD, speaks about price, sales, leases, rents or the market, and neither generated
// section written from market aggregates (market, neighbourhoodComparable) renders. The topic
// pattern below is this check's own, deliberately not the render filter's (src/lib/prose/
// vowTopic.ts): a guard verified against its own predicate verifies nothing. It is narrower than
// the render filter, so anything it finds the render filter should have dropped.
import { parsePage } from '../lib/parse.mjs';
import { moneyToken } from '../lib/money.mjs';

const VOW_TOPIC = /\b(?:sold|sales?|resales?|prices?|priced|pricing|markets?|leases?|leased|rents?|rental|typical(?:ly)?|median|days on market|appreciat\w*)\b/i;

const UNRESOLVED_OPENER =
  /^(?:both|either|neither|these|those|they|them|their|it|its|this|that|such|the former|the latter|the two|the three|all three)\b/i;
const SELF_EVIDENT =
  /^(?:the)\s+(?:street|court|crescent|road|drive|avenue|lane|way|place|terrace|boulevard|trail|close|circle|area|neighbourhood|neighborhood|town|city|market|setting)\b/i;
const DISCLAIMER =
  /^(?:families should confirm|buyers should (?:confirm|verify)|confirm .* directly with|verify .* with the (?:board|city|town)|information (?:is )?(?:deemed )?reliable but|figures are (?:approximate|indicative))/i;

/** Every FAQPage Question in the JSON-LD, parsed (not regex-swept), as [question, answer]. */
function schemaQuestions(html) {
  const out = [];
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let parsed;
    try { parsed = JSON.parse(m[1]); } catch { continue; }
    const walk = (node) => {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (!node || typeof node !== 'object') return;
      if (node['@type'] === 'Question') out.push([String(node.name ?? ''), String(node.acceptedAnswer?.text ?? '')]);
      Object.values(node).forEach(walk);
    };
    walk(parsed);
  }
  return out;
}

export default {
  id: 'consistency',
  title: 'No repeated market figure left to disagree, and prose that still reads after suppression',

  perPage(slug, html) {
    const p = parsePage(html);

    // the figures the parity assertions used to compare, each read where it used to render
    const hero = p.hero['Typical price'];
    const streetTypical = [moneyToken(hero?.v), moneyToken(p.glance['Typical sold']?.v), moneyToken(p.facts['Typical price'])].filter(Boolean).length;
    const typeTypical = p.pills.filter((x) => x.type !== 'Lease' && moneyToken(x.price)).length
      + p.types.filter((t) => moneyToken(t.cells['Typical price']?.v)).length;
    const rent = (p.pills.some((x) => x.type === 'Lease') ? 1 : 0)
      + (Object.keys(p.msum.Leases ?? {}).some((k) => /^Typical rent/.test(k)) ? 1 : 0);
    const ctaFigure = p.cta ? 1 : 0;
    const marketTypical = Object.keys(p.msum.Sales ?? {}).some((k) => /^Typical sold/.test(k)) ? 1 : 0;

    // R1: the FAQ as rendered and as declared, and the two dropped sections
    const faqTopic = p.faq.filter((f) => VOW_TOPIC.test(f.q) || VOW_TOPIC.test(f.a)).length;
    const schemaFaqTopic = schemaQuestions(html).filter(([q, a]) => VOW_TOPIC.test(q) || VOW_TOPIC.test(a)).length;
    const vowSections = (html.replace(/<script[\s\S]*?<\/script>/g, ' ').match(/id="s-(?:market|neighbourhoodComparable)"/g) || []).length;

    const danglingFaq = p.faq.filter((f) => {
      const first = f.a.split(/(?<=[.!?])\s+/)[0] ?? '';
      return first && !SELF_EVIDENT.test(first) && UNRESOLVED_OPENER.test(first);
    }).length;
    const disclaimerSecs = p.secs.filter((s) => s.paras.length && s.paras.every((x) => DISCLAIMER.test(x))).length;

    return {
      slug,
      streetTypical, typeTypical, rent, ctaFigure, marketTypical,
      faqTopic, schemaFaqTopic, vowSections,
      danglingFaq, disclaimerSecs,
      faqItems: p.faq.length, sections: p.secs.length,
    };
  },

  finish(rows) {
    const has = (key) => rows.filter((r) => r[key] > 0);
    return {
      coverage: [
        ['FAQ items rendered', rows.reduce((t, r) => t + r.faqItems, 0)],
        ['prose sections rendered', rows.reduce((t, r) => t + r.sections, 0)],
      ],
      assertions: [
        ['1a street typical rendered (hero, glance or sidebar)', has('streetTypical').length, 0],
        ['1b per-type typical rendered (pill or type card)', has('typeTypical').length, 0],
        ['1c rent rendered (lease pill or market card)', has('rent').length, 0],
        ['1d inline CTA figure rendered', has('ctaFigure').length, 0],
        ['1e market card typical rendered', has('marketTypical').length, 0],
        ['2 FAQ answers opening on an unresolved reference', rows.reduce((t, r) => t + r.danglingFaq, 0), 0],
        ['3 sections whose whole content is a disclaimer', rows.reduce((t, r) => t + r.disclaimerSecs, 0), 0],
        ['4a FAQ items on a price/sales/market topic (visible)', has('faqTopic').length, 0],
        ['4b FAQPage Questions on a price/sales/market topic (JSON-LD)', has('schemaFaqTopic').length, 0],
        ['4c market / neighbourhoodComparable sections rendered', has('vowSections').length, 0],
      ],
      examples: [
        ...has('streetTypical').slice(0, 2).map((r) => `1a ${r.slug}`),
        ...has('faqTopic').slice(0, 3).map((r) => `4a ${r.slug}: ${r.faqTopic} item(s)`),
        ...has('schemaFaqTopic').slice(0, 2).map((r) => `4b ${r.slug}: ${r.schemaFaqTopic} question(s)`),
        ...has('vowSections').slice(0, 2).map((r) => `4c ${r.slug}`),
      ],
    };
  },
};
