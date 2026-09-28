// MC-045 class 3: INTERNAL CONTRADICTION. A claim in a claim field (the generated hero,
// JSON-LD Place.description, the meta tail, or an FAQ answer, which is also JSON-LD FAQPage) that
// the same page's FAQ or data island refutes. Only POSITIVE evidence refutes: a missing record
// never refutes a presence claim. Candidates only; every candidate is then put to skeptics.
//
//   node scratchpad/mc045/method/class3.mjs <cacheDir> <workDir>
//
// Types decided here:
//   T1 housing type: hero/LD/meta names type T while the FAQ says U is the only type (the Jempson
//      case), or the hero says only T while the FAQ names U or the data island records U
//   T2 FAQ exclusivity ("only / entirely / throughout / uniform") vs a positive data record of
//      another type inside the claim's scope
//   T3 sales absence ("no recent sales", "has not sold") vs a 12-month sale count of 1 or more
//   T4 listings: "no listings / nothing for sale" vs Active >= 1, or "currently listed" vs Active 0
//   T5 neighbourhood: the hero/LD places the street in a registry neighbourhood the page's own
//      neighbourhood set does not carry
//   T8 (reported separately) the FAQ says no build-year/era data exists while the hero/LD asserts
//      an era: it refutes the claim's grounding, not the fact
// Not decidable and left out: orientation vs the true-bearing axis, short/long vs length, quiet/
// busy vs road class, pace words vs days on market, price adjectives, market direction vs YoY.
import fs from 'node:fs';
import path from 'node:path';

const [cacheDir, workDir] = process.argv.slice(2);
const pages = JSON.parse(fs.readFileSync(path.join(workDir, 'units.json'), 'utf8'));

const TYPES = {
  detached: /\b(?<!semi[- ])detached\b|\bsingle[- ]family\b|\bsingle[- ]detached\b/i,
  semi: /\bsemi(?:[- ]detached|s)?\b/i,
  townhouse: /\btown ?(?:house|home)s?\b|\brow ?(?:house|home)s?\b|\btownhouse rows?\b|\brows? of townhouses\b|\bfreehold towns?\b/i,
  condo: /\bcondo(?:minium)?s?\b|\bapartments?\b/i,
  link: /\blinked? (?:home|house|homes|houses)\b/i,
};
const typesIn = (t) => Object.entries(TYPES).filter(([, re]) => re.test(t)).map(([k]) => k);
const EXCL = /\bonly (?:housing|property|home) type\b|\bthe only (?:type|form)\b|\bthroughout\b|\bentirely\b|\bexclusively\b|\bno other (?:property|housing|home) type\b|\bevery (?:home|house)\b|\ball of the homes\b|\bsingle housing type\b|\bis (?:all|uniformly)\b|\buniform\b/i;
const WINDOWED = /\brecent(?:ly)?\b|\blast (?:year|twelve months|12 months)\b|\bpast year\b|\bcurrent(?:ly)?\b|\bnow\b/i;
const normType = (s) => (/semi/i.test(s) ? 'semi' : /condo|apartment/i.test(s) ? 'condo' : /town|row/i.test(s) ? 'townhouse' : /link/i.test(s) ? 'link' : /detached/i.test(s) ? 'detached' : null);
const REG = ['Old Milton', 'Dorset Park', 'Timberlea', 'Clarke', 'Dempsey', 'Beaty', 'Coates', 'Cobban', 'Ford', 'Harrison', 'Scott', 'Willmott', 'Walker', 'Bowes', 'Moffat', 'Campbellville', 'Brookville', 'Milton Heights', 'Nassagaweya', 'Trafalgar', 'Nelson', 'Esquesing', 'Milton North', 'Rural Milton West', 'Valley View', 'Fallingbrook', 'Mountain View', 'Forest Grove', 'Bronte Meadows'];
const ALIAS = { Brookville: ['Brookville / Haltonville', 'Brookville/Haltonville', 'Haltonville'], Nassagaweya: ['Rural Nassagaweya', 'Rural Milton West'], 'Rural Milton West': ['Nassagaweya'], Esquesing: ['Rural Esquesing'], Trafalgar: ['Rural Trafalgar'], Nelson: ['Rural Nelson'] };
const nbRe = new RegExp("\\b(?:in|within) (?:Milton['’]s |the )?(" + REG.join('|') + ")\\b(?! (?:Road|Street|Drive|Avenue|Crescent|Park|Line|Way|Court|Trail))", 'g');

const cands = [];
const add = (p, type, field, claim, refuter, evidence) => cands.push({ id: cands.length, slug: p.slug, template: p.template, type, field, claim, refuter, evidence });
for (const p of pages) {
  const html = fs.readFileSync(path.join(cacheDir, 'html', `${p.slug}.html`), 'utf8');
  const dom = html.slice(0, html.indexOf('<script>self.__next_f.push')).replace(/<!-- -->/g, '');
  const isl = p.island;
  // the data island, positive records only, with their scope
  const saleTypes = new Set(), saleCount = [];
  for (const row of isl.pillRows ?? []) if (row.row === 'sales') for (const q of row.pills) if (q.count > 0) { saleTypes.add(normType(q.type)); saleCount.push(q.count); }
  for (const g of isl.glance ?? []) { const m = g.label.match(/^(Detached|Semi|Townhouse|Condo|Link)\b.* sold$/i); if (m && /\d/.test(g.detail || '') && +g.value > 0) saleTypes.add(normType(m[1])); }
  const listingTypes = new Set((isl.listings ?? []).map((l) => normType(l.propertyType || '')).filter(Boolean));
  const ladderTypes = new Set();
  for (const m of dom.matchAll(/data-d="([^"]*)"/g)) { const segs = m[1].split(' · '); const f = segs[segs.length - 2]; if (/^(Detached|Semi-detached|Townhouse|Link|Condo apartment|Condo townhouse)$/.test(f)) ladderTypes.add(normType(f)); }
  const sales12 = saleCount.reduce((a, b) => a + b, 0);
  const activeTile = (isl.glance ?? []).find((g) => g.label === 'Active right now') ?? (isl.heroStats ?? []).find((h) => /Active/.test(h.label));
  const active = activeTile ? +String(activeTile.value).replace(/[^\d]/g, '') || 0 : null;
  const island = { saleTypes12m: [...saleTypes].filter(Boolean), listingTypes: [...listingTypes], ladderTypesEver: [...ladderTypes], sales12, active };

  const heroUnits = p.units.filter((u) => u.s.includes('hero') || u.s.includes('ld-place'));
  const kinds = p.faq.find((f) => /^What kinds of homes are on /.test(f.q));
  const faqTypes = kinds ? typesIn(kinds.a) : [];
  const faqExcl = !!kinds && EXCL.test(kinds.a) && faqTypes.length === 1;

  for (const u of heroUnits) {
    const ht = typesIn(u.t);
    if (!ht.length) continue;
    const excl = EXCL.test(u.t) && ht.length === 1;
    if (faqExcl && ht.some((t) => t !== faqTypes[0])) add(p, 'T1', u.s.join(' '), u.t, `FAQ: ${kinds.a}`, island);
    if (excl && faqTypes.some((t) => t !== ht[0])) add(p, 'T1', u.s.join(' '), u.t, `FAQ: ${kinds.a}`, island);
    if (excl) {
      const scoped = WINDOWED.test(u.t) ? [...saleTypes, ...listingTypes] : [...saleTypes, ...listingTypes, ...ladderTypes];
      const other = [...new Set(scoped)].filter((t) => t && t !== ht[0]);
      if (other.length) add(p, 'T1', u.s.join(' '), u.t, `data island records ${other.join(', ')}`, island);
    }
  }
  if (faqExcl) {
    // scope is read per sentence: "composed entirely of detached homes" is a claim about the stock
    // (any positive record refutes it); "no other types appear in the current data" is windowed
    for (const s of kinds.a.split(/(?<=\.)\s+/)) {
      if (!EXCL.test(s)) continue;
      const scoped = WINDOWED.test(s) ? [...saleTypes, ...listingTypes] : [...saleTypes, ...listingTypes, ...ladderTypes];
      const other = [...new Set(scoped)].filter((t) => t && t !== faqTypes[0]);
      if (other.length) { add(p, 'T2', 'faq', kinds.a, `"${s}" vs data island records ${other.join(', ')}`, island); break; }
    }
  }
  const own = new Set([...(p.containedIn ?? []), ...String(isl.eyebrow ?? '').split(' · '), ...String((isl.streetFacts ?? []).find((f) => f.label === 'Neighbourhood')?.value ?? '').split(', ')].map((s) => s.trim()).filter(Boolean));
  for (const u of p.units) {
    const claimField = u.s.includes('hero') || u.s.includes('ld-place') || u.s.includes('faq');
    if (!claimField) continue;
    if (/\bno (?:recorded |recent )?(?:sales|resales|transactions)\b|\bhas(?:n['’]t| not) (?:sold|traded)\b|\bnever (?:sold|traded)\b|\bno homes? (?:has|have) (?:sold|traded)\b/i.test(u.t) && !/\b(?:few|little|limited|thin)\b/i.test(u.t) && sales12 > 0) add(p, 'T3', u.s.join(' '), u.t, `12-month sales pills total ${sales12}`, island);
    if (/\bno (?:active |current )?listings?\b|\bnothing (?:is )?(?:currently )?(?:listed|for sale)\b|\bno homes? (?:is|are) (?:currently )?(?:listed|for sale|on the market)\b/i.test(u.t) && active > 0) add(p, 'T4', u.s.join(' '), u.t, `Active right now = ${active}`, island);
    if (/\b(?:currently|now) (?:listed|for sale|on the market)\b|\b(?:an?|one|two|several) (?:active )?listings? (?:is|are) (?:live|active|current)/i.test(u.t) && active === 0) add(p, 'T4', u.s.join(' '), u.t, 'Active right now = 0', island);
    if (u.s.includes('hero') || u.s.includes('ld-place')) {
      for (const m of u.t.matchAll(nbRe)) {
        const n = m[1];
        const ok = own.has(n) || (ALIAS[n] ?? []).some((a) => own.has(a)) || [...own].some((o) => o.includes(n) || n.includes(o));
        if (!ok) add(p, 'T5', u.s.join(' '), u.t, `page neighbourhood set: ${[...own].join(' / ')}`, island);
      }
    }
    if (u.s.includes('faq') && /\bno (?:build|construction)[- ]?(?:year|era|date)\b|\bbuild-year\b[^.]*\b(?:not|no)\b|cannot be dated/i.test(u.t)) {
      const era = p.units.filter((v) => (v.s.includes('hero') || v.s.includes('ld-place')) && /\bestablish|\bmatur|\bnewer\b|\bbuilt[- ]?out\b|\bolder\b|\bhistoric\b/i.test(v.t));
      for (const e of era) add(p, 'T8', e.s.join(' '), e.t, `FAQ: ${u.t}`, island);
    }
  }
}
fs.writeFileSync(path.join(workDir, 'class3-candidates.json'), JSON.stringify(cands));
const by = {};
for (const c of cands) (by[c.type] ??= new Set()).add(c.slug);
console.log('candidates', cands.length, Object.fromEntries(Object.entries(by).map(([k, v]) => [k, `${cands.filter((c) => c.type === k).length} on ${v.size} pages`])));
