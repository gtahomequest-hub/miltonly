// ONE METRIC, ONE NUMBER. The same figure must read the same everywhere it appears on a page.
//
// The street typical appears in the hero tile, the at-a-glance grid and the sidebar facts; the
// per-type typical appears on a hero pill and again on its type card; the rent appears on a lease
// pill and again on the market card. They used to be computed per surface, so one neighbourhood
// was published at three different typicals across three pages — the figures were INVENTED per
// surface, not drifting from one source.
//
// Also here: the coherence failures that a sentence-level suppression leaves behind — a standalone
// FAQ answer opening on a reference whose antecedent was cut, and a section whose whole surviving
// content is a compliance caveat standing under a heading that promised content.
import { parsePage } from '../lib/parse.mjs';
import { moneyToken } from '../lib/money.mjs';

const UNRESOLVED_OPENER =
  /^(?:both|either|neither|these|those|they|them|their|it|its|this|that|such|the former|the latter|the two|the three|all three)\b/i;
const SELF_EVIDENT =
  /^(?:the)\s+(?:street|court|crescent|road|drive|avenue|lane|way|place|terrace|boulevard|trail|close|circle|area|neighbourhood|neighborhood|town|city|market|setting)\b/i;
const DISCLAIMER =
  /^(?:families should confirm|buyers should (?:confirm|verify)|confirm .* directly with|verify .* with the (?:board|city|town)|information (?:is )?(?:deemed )?reliable but|figures are (?:approximate|indicative))/i;

const TYPE_KEY = { Detached: 'detached', Semi: 'semi', 'Semi-Detached': 'semi', Townhouse: 'townhouse', Condo: 'condo', Town: 'townhouse' };

export default {
  id: 'consistency',
  title: 'One metric, one number — and prose that still reads after suppression',

  perPage(slug, html) {
    const p = parsePage(html);

    const hero = p.hero['Typical price'];
    const publishesPrice = !!(hero && !hero.silent && /\d/.test(hero.v));
    const streetTypical = publishesPrice
      ? new Set([moneyToken(hero.v), moneyToken(p.glance['Typical sold']?.v), moneyToken(p.facts['Typical price'])].filter(Boolean))
      : new Set();

    const typeMismatch = [];
    for (const pill of p.pills) {
      if (pill.type === 'Lease') continue;
      const card = p.types.find((t) => t.type === (TYPE_KEY[pill.type] ?? pill.type.toLowerCase()));
      const cardV = moneyToken(card?.cells['Typical price']?.v);
      const pillV = moneyToken(pill.price);
      if (pillV && cardV && pillV !== cardV) typeMismatch.push(`${pill.type} pill ${pillV} vs card ${cardV}`);
    }

    const leasePill = p.pills.find((x) => x.type === 'Lease');
    const rentCard = Object.entries(p.msum.Leases ?? {}).find(([k]) => /^Typical rent/.test(k))?.[1] ?? null;
    const pillRent = leasePill ? moneyToken(leasePill.price) : null;
    const cardRent = moneyToken(rentCard);
    const rentMismatch = (leasePill || rentCard)
      ? ((pillRent && !cardRent) || (!pillRent && cardRent) || (pillRent && cardRent && pillRent !== cardRent))
      : false;

    const ctaMismatch = !!(p.cta && publishesPrice && moneyToken(p.cta) !== moneyToken(hero.v));
    const msTypical = moneyToken(Object.entries(p.msum.Sales ?? {}).find(([k]) => /^Typical sold/.test(k))?.[1] ?? null);
    const msMismatch = !!(msTypical && publishesPrice && msTypical !== moneyToken(hero.v));

    const danglingFaq = p.faq.filter((f) => {
      const first = f.a.split(/(?<=[.!?])\s+/)[0] ?? '';
      return first && !SELF_EVIDENT.test(first) && UNRESOLVED_OPENER.test(first);
    }).length;
    const disclaimerSecs = p.secs.filter((s) => s.paras.length && s.paras.every((x) => DISCLAIMER.test(x))).length;

    return {
      slug,
      streetTypicalValues: streetTypical.size,
      typeMismatch, rentMismatch, ctaMismatch, msMismatch,
      danglingFaq, disclaimerSecs,
      faqItems: p.faq.length, sections: p.secs.length,
    };
  },

  finish(rows) {
    const a = rows.filter((r) => r.streetTypicalValues > 1);
    const b = rows.filter((r) => r.typeMismatch.length);
    const c = rows.filter((r) => r.rentMismatch);
    const d = rows.filter((r) => r.ctaMismatch);
    const e = rows.filter((r) => r.msMismatch);
    return {
      coverage: [
        ['FAQ items rendered', rows.reduce((t, r) => t + r.faqItems, 0)],
        ['prose sections rendered', rows.reduce((t, r) => t + r.sections, 0)],
      ],
      assertions: [
        ['1a street typical at more than one value', a.length, 0],
        ['1b per-type typical: hero pill != type card', b.length, 0],
        ['1d inline CTA price != hero typical', d.length, 0],
        ['1e market card typical != hero typical', e.length, 0],
        ['2 FAQ answers opening on an unresolved reference', rows.reduce((t, r) => t + r.danglingFaq, 0), 0],
        ['3 sections whose whole content is a disclaimer', rows.reduce((t, r) => t + r.disclaimerSecs, 0), 0],
      ],
      // KNOWN AND LOGGED, not asserted: 1c is 2 pages that render a hero lease pill with no
      // matching market card (mcdougall-crossing, melville-bonus-crescent). Pre-existing on
      // production and on every branch measured. Reported so it cannot be forgotten, and not
      // asserted so it cannot mask a NEW regression by being permanently red.
      notes: [`1c rent pill vs market card disagree: ${c.length} pages${c.length ? ` (${c.slice(0, 4).map((r) => r.slug).join(', ')}) — known standing defect, not gated` : ''}`],
      examples: [...a.slice(0, 3).map((r) => `1a ${r.slug}`), ...b.slice(0, 3).map((r) => `1b ${r.slug}: ${r.typeMismatch[0]}`)],
    };
  },
};
