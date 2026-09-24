// MC-045 class 1: BUILD-ERA claims in the served generated text. A text sweep; no ground truth is
// needed because no street's generator input carries build-era data (verified: rep-inputs, the
// StreetGeneratorInput type has no year or era field, and primaryBuilder / dominantStyle / lotSize
// are present in 0 of 663 stored inputs).
//
//   node scratchpad/mc045/method/class1.mjs <workDir> <outDir>
//
// Lexicon: an include list (I1-I9) applied to each unique served sentence after proper names are
// neutralised (X0), with sense exclusions (X1-X4). Sentences whose only hits use the historic core
// as a PLACE anchor (bucket 1L) or that only frame growth (bucket 1G) are counted separately and
// are not in the headline. Every included sentence is written to class1-sentences.csv.
import fs from 'node:fs';
import path from 'node:path';

const [workDir, outDir] = process.argv.slice(2);
const pages = JSON.parse(fs.readFileSync(path.join(workDir, 'units.json'), 'utf8'));

// X0: proper names carrying an era word, neutralised before matching
const NAMES = /\b(?:Old Milton|Old Tremaine Road|Campbellville (?:Old|New) Park|New Park|Newell Street|Old Mill\w*)\b/g;
const scrub = (t) => t.replace(NAMES, '<NAME>');

const INC = [
  ['I1 established', /\b(?:long|well|more|most|fully|largely)?[- ]?established\b/i],
  ['I2 mature', /\bmatur(?:e|ed|ing)\b/i],
  ['I3 newer', /\bnew(?:er|est)\b/i],
  ['I4 new-build', /\bnew[- ]?(?:build\w*|construction|development\w*|subdivisions?)\b|\bnewly (?:built|developed|constructed)\b|\bbrand[- ]new\b/i],
  ['I5 built-out', /\bbuilt[- ]?out\b|\bbuild[- ]?out\b|\bbuilt[- ]up\b(?!\s+(?:core|edge|area|grid|town|centre))/i],
  ['I6 construction-state', /\brecently (?:built|developed|constructed|completed)\b|\b(?:under|active|ongoing) construction\b|\bstill (?:being built|developing|filling in|maturing|growing)\b|\bfilling in\b|\bactive (?:new[- ]build|build)\w*\b|\bconstruction (?:pipeline|activity|program(?:me)?)\b/i],
  ['I7 older', /\bolder\s+(?:\w+\s+){0,2}?(?:homes?|houses?|stock|housing|core|grid|parts?|sections?|neighbourhoods?|districts?|streets?|subdivisions?|fabric|settlement|downtown|commercial|halves|half|build\w*|construction|residential|pockets?|areas?|town|village|lots?|storefronts?|layer)\b/i],
  ['I8 historic/original', /\bhistoric(?:al)?\s+(?:core|centre|center|downtown|district|town|village|homes?|streets?|grid|part|heart|settlement|commercial|main)\b|\boriginal\s+(?:core|settlement|town|homes?|owners?|residential|grid|village|layout|hardwood|stock|builders?)\b/i],
  ['I9 age words', /\bheritage\b|\bcentur(?:y|ies)[- ]old\b|\bmid[- ]century\b|\b(?:nineteenth|twentieth|19th|20th)[- ]century\b|\b(?:recent|past few|several|over|for) decades\b|\bdecades[- ]old\b|\b(?:era|vintage)\b|\bpre-?dat\w+|\blong[- ]settled\b|\bsettled (?:into place )?(?:over|for) (?:decades|years|some time)\b|\b(?:built out|settled|in place|established) for some time\b|\blaid out (?:long )?before\b/i],
];
// v2 (after the first recall review found them missing; V1=1 reproduces the v1 sweep): settlement
// history, growth history, the age of the stock, infill and builder history, recent build activity,
// and "older" across a comma.
if (process.env.V1 !== '1') INC.push(
  ['I10 settled-history', /\b(?:earliest|first|originally)\s+settled\b|\bsettled\s+(?:[A-Za-z']+\s+)?(?:pocket|part|area|neighbourhood|streets?|residential|fabric|character|feel|address|setting)\b|\blong-?standing\b/i],
  ['I11 growth-history', /\bgrown (?:steadily|up|out)\b|\b(?:has|have)\s+(?:grown|developed|expanded|filled in)\b|\bas the town (?:has\s+)?(?:grown|grew|expanded|filled in)\b|\bdeveloped (?:incrementally|gradually|in stages|over (?:time|the years|decades))\b|\bfilled in\b/i],
  ['I12 stock-age', /\bupdated over the years\b|\bretain(?:s|ed)? (?:their |its )?original\b|\boriginal (?:details|features|character|finishes)\b|\bage of (?:the )?(?:homes|housing|stock|street|houses)\b|\b(?:size|scale) and age\b|\bof this age\b/i],
  ['I13 infill/builder-history', /\binfill\b|\bbuilder pattern\b|\bby multiple builders\b|\bplanned communit(?:y|ies)\b|\bsubdivision plans\b/i],
  ['I14 build-activity', /\b(?:recent|new|active|ongoing)\s+build(?:ing)?\s+activity\b|\bbuild activity\b|\bno indication of (?:recent |new )?(?:build|construction)/i],
  ['I7b older-comma', /\bolder,\s+(?:\w+\s+){0,2}?(?:fabric|stock|homes|houses|streets|grid|core|parts?|areas?|pockets?|neighbourhoods?)\b/i],
);
const ESTABLISHED_DESCRIPTOR = /\bestablished\s+(?:street|streets|court|crescent|neighbourhood|area|part|pocket|district|fabric|grid|core|residential|section|sections|subdivision|community|feel|setting|landscaping|homes|housing|stock|character|trees|rural)\b|\b(?:an|is|reads as|as)\s+established\b/i;
const NEWER_DESCRIPTOR = /\bnewer\s+(?:subdivisions?|homes?|builds?|construction|developments?|streets?|neighbourhoods?|pockets?|areas?|growth|residential|halves|half|edges?|parts?|layer)\b/i;
// X1: "establish" as a verb or a statistic
const X1 = /\b(?:to|can|could|cannot|can't|enough to|not yet|isn't|is not|has not been|hasn't been|be)\s+(?:be\s+)?establish(?:ed)?\b|\bestablish(?:ed|es|ing)?\s+(?:a|any|the)?\s*(?:meaningful|clear|reliable|firm|street-level)?\s*(?:trend|pattern|benchmark|price|typical|range|baseline|pace|figure|read|picture)\b|\bestablished\s+(?:from|by|through)\s+(?:the\s+)?(?:activity|data|sales|record)/i;
// X5: "established" about management, a market or a record, not the building or the area
const X5 = /\b(?:well[- ])?established\s+(?:property\s+)?(?:management|manager|leasing|rental(?:\s+market)?|resale(?:\s+market)?|condo(?:minium)?\s+corporation|corporation|board|reserve(?:\s+fund)?|track\s+record|market|demand|tenant|owner)\b|\b(?:leasing|rental|resale)\s+(?:market|activity)\s+(?:is|has been)\s+(?:well[- ])?established\b/i;
// X2: "newer" about data
const X2 = /\bnew(?:er|est)\s+(?:listings?|data|figures?|sales|records?|activity|numbers|quarter|window|edition)\b/i;
// X3: a disclaimer clause is removed and the rest re-tested
const X3_CLAUSE = /[^.]*\b(?:no\s+(?:build|construction)[- ]?(?:year|era|date|period)|cannot\s+be\s+(?:dated|stated)|verify the age|age of any specific home)[^.;]*/i;
// X4: era named as a buyer's criterion, not asserted
const X4 = /\b(?:weigh\w*|consider\w*|prioriti\w*|value\w*|choos\w*|exploring)\b[^.]{0,80}\b(?:era|vintage|age)\s+of\s+(?:construction|the homes|its homes|homes)\b/i;
// bucket 1L: the historic core used as a place anchor only
const LANDMARK = /\b(?:of|from|to|toward|towards|near|beside|around)\s+(?:the\s+)?(?:town's\s+|Milton's\s+)?(?:historic|older|old|original)\s+(?:core|centre|center|downtown(?:\s+(?:core|grid))?|grid|commercial\s+\w+)\b/i;
// bucket 1G: growth framing only
const GROWTH = /\b(?:newer|recent|steady|western|northern|southern|eastern|outward)\s+growth\b|\bgrowth\s+(?:pockets?|areas?|corridors?|edges?|fringes?|fronts?|frontiers?)\b/i;
// subject tag: the claim is about somewhere else (reported, not excluded)
const ELSEWHERE = /\b(?:farther|further|elsewhere|other\s+(?:streets|neighbourhoods|parts|areas|pockets|subdivisions)|comparable options|alternatives?|streets with|look (?:to|toward)|rare in|unusual for)\b/i;

function classify(text) {
  const t = scrub(text);
  let hits = INC.filter(([, re]) => re.test(t)).map(([id]) => id);
  const growth = GROWTH.test(t);
  if (!hits.length) return growth ? { bucket: '1G' } : null;
  const excluded = [];
  if (hits.includes('I1 established') && X1.test(t) && !ESTABLISHED_DESCRIPTOR.test(t)) { hits = hits.filter((h) => h !== 'I1 established'); excluded.push('X1'); }
  if (hits.includes('I1 established') && X5.test(t) && !ESTABLISHED_DESCRIPTOR.test(t.replace(X5, ''))) { hits = hits.filter((h) => h !== 'I1 established'); excluded.push('X5'); }
  if (hits.includes('I3 newer') && X2.test(t) && !NEWER_DESCRIPTOR.test(t)) { hits = hits.filter((h) => h !== 'I3 newer'); excluded.push('X2'); }
  if (hits.includes('I9 age words') && X4.test(t)) { hits = hits.filter((h) => h !== 'I9 age words'); excluded.push('X4'); }
  if (hits.length && X3_CLAUSE.test(t)) {
    const rest = t.replace(X3_CLAUSE, '');
    hits = INC.filter(([, re]) => re.test(rest)).map(([id]) => id);
    excluded.push('X3');
  }
  if (!hits.length) return growth ? { bucket: '1G', excluded } : { bucket: 'excluded', excluded };
  const landmarkOnly = LANDMARK.test(t) && hits.every((h) => h === 'I7 older' || h === 'I8 historic/original') && !/\b(?:is|sits|lies)\s+in\s+(?:<NAME>|the\s+(?:historic|older|original))/i.test(t);
  if (landmarkOnly) return { bucket: '1L', hits, excluded };
  return { bucket: '1', hits, excluded, elsewhere: ELSEWHERE.test(t) };
}

// is the first matching term of this sentence inside the page's meta tail?
function inMeta(page, text, hits) {
  if (!page.metaTail) return false;
  const tail = page.metaTail.replace(/\.$/, '');
  if (!text.startsWith(tail.slice(0, Math.min(tail.length, 20)))) return false; // the tail is a prefix of the hero/Place sentence
  const t = scrub(text);
  let first = Infinity;
  for (const [id, re] of INC) if (hits.includes(id)) { const m = t.match(re); if (m && m.index < first) first = m.index + m[0].length; }
  return first <= tail.length;
}

const FAQ_Q = /^Is .+ new construction or established\?$/;
function faqAnswerKind(a) {
  const dis = /\b(?:no|not)\b[^.]{0,60}\b(?:build|construction)[- ]?(?:year|era|date|record|data)\b|\bdoes not (?:carry|include|record|hold)\b|\bcannot be (?:dated|stated|confirmed)\b|\bverify\b[^.]{0,40}\bage\b/i.test(a);
  const est = /\bestablished\b|\bbuilt[- ]?out\b|\bmature\b|\bsettled\b|\bolder\b|\bin place for\b/i.test(a);
  const nw = /\bnew construction\b(?![^.]{0,30}\b(?:not|no)\b)|\bnewer\b|\brecently built\b|\bstill (?:being built|developing)\b/i.test(a) && !/\bnot (?:new construction|a new)\b|\brather than (?:new|still)\b/i.test(a);
  if (est && dis) return 'disclaims-then-asserts-established';
  if (est) return 'asserts-established';
  if (nw) return 'asserts-new';
  if (dis) return 'disclaims-only';
  return 'other';
}

const rows = [], buckets = { '1L': 0, '1G': 0, excluded: 0 }, exclusions = {};
for (const p of pages) {
  for (const u of p.units) {
    const c = classify(u.t);
    if (!c) continue;
    for (const x of c.excluded ?? []) exclusions[x] = (exclusions[x] ?? 0) + 1;
    if (c.bucket !== '1') { buckets[c.bucket]++; continue; }
    const surfaces = [...u.s];
    const meta = (u.s.includes('hero') || u.s.includes('ld-place')) && inMeta(p, u.t, c.hits);
    if (meta) surfaces.push('meta');
    rows.push({ slug: p.slug, template: p.template, hiddenOnly: p.hiddenOnly, surfaces, terms: c.hits, subject: c.elsewhere ? 'elsewhere' : 'street/area', text: u.t });
  }
}
const pagesHit = new Set(rows.map((r) => r.slug));
const bySurface = {};
for (const r of rows) for (const s of new Set(r.surfaces.map((x) => (x.startsWith('sec:') ? 'profile' : x)))) bySurface[s] = (bySurface[s] ?? 0) + 1;
const byTerm = {};
for (const r of rows) for (const h of r.terms) byTerm[h] = (byTerm[h] ?? 0) + 1;
const pageSurfaces = {};
for (const r of rows) { pageSurfaces[r.slug] ??= new Set(); for (const s of r.surfaces) pageSurfaces[r.slug].add(s.startsWith('sec:') ? 'profile' : s); }
const pagesFaqOnly = Object.entries(pageSurfaces).filter(([, s]) => s.size === 1 && s.has('faq')).length;
const pagesHeroOrLd = Object.entries(pageSurfaces).filter(([, s]) => s.has('hero') || s.has('ld-place')).length;
const pagesMeta = Object.entries(pageSurfaces).filter(([, s]) => s.has('meta')).length;
const byTemplate = {};
for (const sl of pagesHit) { const t = pages.find((p) => p.slug === sl).template; byTemplate[t] = (byTemplate[t] ?? 0) + 1; }

// the build-era FAQ question itself
const faqRows = [];
for (const p of pages) for (const f of p.faq) if (FAQ_Q.test(f.q)) faqRows.push({ slug: p.slug, q: f.q, a: f.a, kind: faqAnswerKind(f.a) });
const faqKinds = {};
for (const r of faqRows) faqKinds[r.kind] = (faqKinds[r.kind] ?? 0) + 1;

// most repeated sentences across pages (one prompt fix removes all of them)
const rep = {};
for (const r of rows) rep[r.text] = (rep[r.text] ?? 0) + 1;
const repeated = Object.entries(rep).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([text, n]) => ({ n, text }));

const pagesWithGen = pages.filter((p) => p.units.length > 0).length;
const summary = {
  pagesPublished: pages.length, pagesWithGeneratedText: pagesWithGen,
  pages: pagesHit.size, byTemplate, sentences: rows.length,
  faqSentences: rows.filter((r) => r.surfaces.includes('faq')).length,
  faqShareOfSentences: +(rows.filter((r) => r.surfaces.includes('faq')).length / rows.length).toFixed(3),
  pagesWhereFaqIsTheOnlyCarrier: pagesFaqOnly,
  pagesWithClaimInHeroOrLd: pagesHeroOrLd, pagesWithClaimInsideMeta: pagesMeta,
  hiddenOnlyPages: [...pagesHit].filter((s) => pages.find((p) => p.slug === s).hiddenOnly).length,
  sentencesAboutElsewhere: rows.filter((r) => r.subject === 'elsewhere').length,
  bySurface, byTerm, buckets, exclusionsApplied: exclusions,
  buildEraFaq: { served: faqRows.length, kinds: faqKinds, pagesAssertingEstablished: faqRows.filter((r) => /established/.test(r.kind)).length },
  repeated,
};
fs.mkdirSync(outDir, { recursive: true });
const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
fs.writeFileSync(path.join(outDir, 'class1-sentences.csv'), ['slug,template,surfaces,terms,subject,text', ...rows.map((r) => [r.slug, r.template, r.surfaces.join(' '), r.terms.join('; '), r.subject, r.text].map(csv).join(','))].join('\n') + '\n');
fs.writeFileSync(path.join(outDir, 'class1-faq-question.csv'), ['slug,kind,question,answer', ...faqRows.map((r) => [r.slug, r.kind, r.q, r.a].map(csv).join(','))].join('\n') + '\n');
fs.writeFileSync(path.join(workDir, 'class1.json'), JSON.stringify({ summary, rows, faqRows }));
fs.writeFileSync(path.join(outDir, 'class1-summary.json'), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
