#!/usr/bin/env node
// MA-011. The standing test for the nightly's guards, the pattern of test-voice-rules.mjs: real cases,
// each asserting the answer the check must give, a count, and an exit code. Run by the nightly workflow
// before the audit and by hand with `node scripts/audit/nightly/test-nightly-checks.mjs`.
//
//   street-head      MC-048's title ladder and meta shapes, served (checks.mjs, streetHeadFindings)
//   banned sentences MC-045's stripped sentences and MC-048's controls (strip.mjs, banned-sentences.json)
//   D1 and links     a carried link finding resolves when its target joins the sitemap or is no longer
//                    linked; targets are checked oldest check first (guards.mjs)
//   www twins        a 308 to exactly the same path on the apex, a date-seeded sample (guards.mjs)
// Sources: "production" (served 2026-09-28, page named), "MC-048" (its report's proof table).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, streetHeadFindings, pageFindings, STREET_PAGE_RE } from './checks.mjs';
import { loadBanned, checkStrip, freezeBanned, normalize } from './strip.mjs';
import { resolveCarriedLinks, linkQueue, wwwSample, wwwPasses } from './guards.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
let assertions = 0; const failures = [];
const ok = (cond, label) => { assertions++; if (!cond) failures.push(label); return cond; };

// ── 1. street-head ───────────────────────────────────────────────────────────────────────────────
const head = ({ title, meta, h1, og = {}, tw = {} }) => {
  const m = (k, v) => (v == null ? '' : `<meta ${k.startsWith('og:') ? 'property' : 'name'}="${k}" content="${v.replace(/"/g, '&quot;')}">`);
  return `<!doctype html><html><head><title>${title}</title><meta name="description" content="${meta.replace(/"/g, '&quot;')}">${m('og:title', og.title === undefined ? title : og.title)}${m('twitter:title', tw.title === undefined ? title : tw.title)}${m('og:description', og.desc === undefined ? meta : og.desc)}${m('twitter:description', tw.desc === undefined ? meta : tw.desc)}<link rel="canonical" href="https://miltonly.com/streets/x"></head><body><h1>${h1}</h1><p>Plain.</p></body></html>`;
};
const Z = { title: 'Zilio Terrace, Milton: homes, sold history, prices | Miltonly', meta: '55 addresses on Zilio Terrace, numbered 1364 to 1526. Every one listed, with its sold history for registered readers. Free to register.', h1: 'Zilio Terrace' };
const S2 = { title: 'Second Line Nassagaweya, Milton: homes, sold history | Miltonly', meta: '110 addresses on Second Line Nassagaweya, numbered 9301 to 14110. Every one listed, with its sold history for registered readers. Free to register.', h1: 'Second Line Nassagaweya' };
const S3 = { title: 'Nassagaweya Esquesing Townline, Milton: homes, sold history', meta: '43 addresses on Nassagaweya Esquesing Townline, numbered 10130 to 13344. Every one listed, with its sold history for registered readers. Free to register.', h1: 'Nassagaweya Esquesing Townline' };
const NA = { title: 'Highway 7, Milton: homes, sold history, prices | Miltonly', meta: 'Highway 7, Milton: every address on the street, with sold history for registered readers.', h1: 'Highway 7' };
const keys = (o) => streetHeadFindings(parse(head(o))).map((f) => f.key).sort();
export const HEAD_CASES = [
  ['rung 1 (production: zilio-terrace-milton)', Z, []],
  ['rung 2 (production: second-line-nassagaweya-milton)', S2, []],
  ['rung 3, the longest name (production: nassagaweya-esquesing-townline-milton)', S3, []],
  ['no Town address data (production: highway-7-milton, second-line-milton)', NA, []],
  ['the H1 split by an inline tag is still the name (production markup)', { ...Z, h1: 'Zilio<!-- --> <em>Terrace</em>' }, []],
  ['the pre-MC-048 meta (MC-048: "homes typically $950,000 across 19 sales")', { ...Z, meta: 'Zilio Terrace homes typically $950,000 across 19 sales. Every one listed, with its sold history for registered readers.' }, ['meta-banned', 'meta-shape']],
  ['"typical" alone', { ...Z, meta: 'Typical prices and 55 addresses on Zilio Terrace.' }, ['meta-banned', 'meta-shape']],
  ['"median" in the title', { ...Z, title: 'Zilio Terrace, Milton: median price | Miltonly' }, ['title-banned', 'title-shape']],
  ['a sales count in the meta', { ...Z, meta: '1 sale in the last 12 months on Zilio Terrace.' }, ['meta-banned', 'meta-shape']],
  ['an em dash in the title', { ...Z, title: 'Zilio Terrace \u2014 Milton: homes, sold history, prices | Miltonly' }, ['title-dash', 'title-shape']],
  ['an en dash in the meta range', { ...Z, meta: '55 addresses on Zilio Terrace, numbered 1364\u20131526. Every one listed, with its sold history for registered readers. Free to register.' }, ['meta-dash', 'meta-shape']],
  ['", prices" kept with the brand dropped', { ...Z, title: 'Zilio Terrace, Milton: homes, sold history, prices' }, ['title-shape']],
  ['a lower rung the ladder would not pick', { ...Z, title: 'Zilio Terrace, Milton: homes, sold history | Miltonly' }, ['title-rung']],
  ['a higher rung over 65', { ...S3, title: 'Nassagaweya Esquesing Townline, Milton: homes, sold history | Miltonly' }, ['title-length', 'title-rung']],
  ['the title names another street than the H1', { ...Z, h1: 'Zilio Court' }, ['title-name']],
  ['og:title differs', { ...Z, og: { title: 'Zilio Terrace homes' } }, ['og-title']],
  ['twitter:title missing', { ...Z, tw: { title: null } }, ['twitter-title']],
  ['og:description the old meta', { ...Z, og: { desc: 'Zilio Terrace homes typically $950,000.' } }, ['og-description']],
  ['twitter:description missing', { ...Z, tw: { desc: null } }, ['twitter-description']],
  ['"Free to register." dropped with room for it', { ...Z, meta: '55 addresses on Zilio Terrace, numbered 1364 to 1526. Every one listed, with its sold history for registered readers.' }, ['meta-shape']],
  ['a one-address "range"', { ...Z, meta: '1 addresses on Zilio Terrace, numbered 1364 to 1364. Every one listed, with its sold history for registered readers. Free to register.' }, ['meta-shape']],
  ['a meta over 155', { ...Z, meta: `55 addresses on Zilio Terrace, numbered 1364 to 1526. Every one listed, with its sold history for registered readers. Free to register. ${'x'.repeat(40)}` }, ['meta-length', 'meta-shape']],
];
let hPass = 0;
for (const [why, o, want] of HEAD_CASES) { const got = keys(o); if (ok(JSON.stringify(got) === JSON.stringify([...want].sort()), `STREET-HEAD ${why}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`)) hPass++; }
// Wired: pageFindings runs it on a street path and not elsewhere.
const onPath = (p) => pageFindings({ html: head({ ...Z, og: { title: 'x' } }), path: p, base: 'https://miltonly.com' }).findings.filter((f) => f.code === 'street-head').length;
ok(onPath('/streets/zilio-terrace-milton') === 1, 'street-head is not wired into pageFindings on a street page');
ok(onPath('/streets') === 0 && onPath('/neighbourhoods/timberlea') === 0, 'street-head runs off the street pages');
ok(STREET_PAGE_RE.test('/streets/a-b-milton') && !STREET_PAGE_RE.test('/streets') && !STREET_PAGE_RE.test('/streets/a/b'), 'STREET_PAGE_RE');

// ── 2. banned sentences ──────────────────────────────────────────────────────────────────────────
const banned = loadBanned();
ok(banned.counts.pages === 56 && banned.counts.claims === 60 && banned.counts.sentences === 58 && banned.counts.controls === 55, `banned-sentences.json counts ${JSON.stringify(banned.counts)}, expected 56 pages, 60 claims, 58 sentences, 55 controls (MC-048)`);
ok(Object.keys(banned.pages).length === 56 && Object.values(banned.pages).reduce((n, e) => n + e.sentences.length, 0) === 58, 'banned-sentences.json pages do not add up');
// The frozen file is what Core's two files say today; if Core changes them, refreeze (verify-strip.mjs --freeze).
const csv = path.join(ROOT, banned.source.csv); const render = path.join(ROOT, banned.source.render);
if (fs.existsSync(csv) && fs.existsSync(render)) {
  const again = freezeBanned(csv, render);
  ok(JSON.stringify(again.pages) === JSON.stringify(banned.pages) && again.source.csvSha256 === banned.source.csvSha256, "banned-sentences.json no longer matches Core's CSV and render controls: run `node scripts/audit/verify-strip.mjs --freeze`");
}
const [slug, entry] = Object.entries(banned.pages).find(([, e]) => e.controls && e.sentences[0].includes("'")) || Object.entries(banned.pages).find(([, e]) => e.controls);
const sentence = entry.sentences[0]; const control = entry.controls.find((c) => !c.startsWith('@fallback:'));
const curly = (s) => s.replace(/'/g, '\u2019');
const ent = (s) => s.replace(/'/g, '&#x27;').replace(/"/g, '&quot;');
export const STRIP_CASES = [
  ['a clean page with its control', `<p>${control}</p>`, 0, 'found'],
  ['the sentence back in the prose', `<p>${sentence}</p><p>${control}</p>`, 1, 'found'],
  ['the sentence back with curly quotes', `<p>${curly(sentence)}</p><p>${control}</p>`, 1, 'found'],
  ['the sentence back with entities', `<p>${ent(sentence)}</p><p>${control}</p>`, 1, 'found'],
  ['the sentence back split by an inline tag', `<p>${sentence.replace(' ', ' <em>')}</em></p><p>${control}</p>`, 1, 'found'],
  ['the sentence back in JSON-LD, JSON-escaped', `<script type="application/ld+json">${JSON.stringify({ '@type': 'Place', description: sentence }).replace(/'/g, '\\u0027')}</script><p>${control}</p>`, 1, 'found'],
  ['the sentence back in the meta description', `<meta name="description" content="${ent(sentence)}"><p>${control}</p>`, 1, 'found'],
  ['a clean page whose control is gone is unverified', '<p>Something else entirely.</p>', 0, 'missing'],
];
let sPass = 0;
for (const [why, html, n, ctl] of STRIP_CASES) { const r = checkStrip(entry, html); if (ok(r.found.length === n && r.control === ctl, `STRIP ${why} (${slug}): found ${r.found.length}, control ${r.control}; expected ${n}, ${ctl}`)) sPass++; }
const noCtl = Object.values(banned.pages).find((e) => !e.controls);
ok(!noCtl || checkStrip(noCtl, '<p>x</p>').control === 'none', 'a page MC-048 did not strip has no control and is "none", not "missing"');
ok(normalize('a&rsquo;b &amp; c\\u0027d') === "a'b & c'd", 'normalize folds entities, JSON escapes and curly quotes');

// ── 3. D1 and the link queue ─────────────────────────────────────────────────────────────────────
{
  const f = (code) => ({ code, sev: 3, key: 't', detail: 'd' });
  const prevLinks = {
    '/streets/joined-milton': { status: 200, refs: 3, from: ['/a', '/b', '/c'], checkedAt: '2026-09-27', finding: f('link-unpublished') },
    '/streets/gone-milton': { status: 404, refs: 2, from: ['/a', '/b'], checkedAt: '2026-09-27', finding: f('link-unpublished') },
    '/streets/still-milton': { status: 404, refs: 2, from: ['/a', '/b'], checkedAt: '2026-09-27', finding: f('link-unpublished') },
    '/streets/unseen-milton': { status: 404, refs: 2, from: ['/x', '/y'], checkedAt: '2026-09-27', finding: f('link-unpublished') },
    '/streets/many-milton': { status: 404, refs: 9, from: ['/a', '/b', '/c', '/d', '/e'], checkedAt: '2026-09-27', finding: f('link-unpublished') },
    '/streets/checked-milton': { status: 404, refs: 1, from: ['/a'], checkedAt: '2026-09-27', finding: f('link-unpublished') },
    '/streets/clean-milton': { status: 200, refs: 1, from: ['/a'], checkedAt: '2026-09-27' },
  };
  const links = { '/streets/checked-milton': { status: 404, refs: 1, from: ['/a'], checkedAt: '2026-09-28', finding: f('link-unpublished') } };
  const sitemap = new Set(['/', '/streets/joined-milton']);
  const pages = { '/a': { status: 200 }, '/b': { status: 200 }, '/c': { status: 200 }, '/d': { status: 200 }, '/e': { status: 200 } };
  const linkedTonight = ['/streets/still-milton?from=a'];
  const r = resolveCarriedLinks({ prevLinks, links, sitemap, pages, linkedTonight, date: '2026-09-28' });
  ok(JSON.stringify(r.sitemap) === JSON.stringify(['/streets/joined-milton']), `D1: a target that joined the sitemap resolves (got ${JSON.stringify(r.sitemap)})`);
  ok(JSON.stringify(r.unlinked) === JSON.stringify(['/streets/gone-milton']), `D1: a target its swept referrers no longer link resolves (got ${JSON.stringify(r.unlinked)})`);
  ok(links['/streets/still-milton']?.carried === true, 'D1: a target still linked (by a query variant) and not re-checked is carried');
  ok(links['/streets/unseen-milton']?.carried === true, 'D1: a target whose referrers were not swept tonight is carried');
  ok(links['/streets/many-milton']?.carried === true, 'D1: a target with more referrers than were recorded is carried, never guessed resolved');
  ok(links['/streets/checked-milton'].checkedAt === '2026-09-28' && !links['/streets/checked-milton'].carried, "D1: tonight's check is kept, not overwritten");
  ok(!('/streets/clean-milton' in links), 'D1: a target with no finding is not carried');
  ok(!links['/streets/joined-milton'].finding && links['/streets/joined-milton'].resolved === 'joined the sitemap', 'D1: a resolved entry carries no finding');
  const disc = [['/most', new Set([1, 2, 3])], ['/mid', new Set([1, 2])], ['/least', new Set([1])], ['/new', new Set([1])]];
  const q = linkQueue(disc, { '/most': { checkedAt: '2026-09-28' }, '/mid': { checkedAt: '2026-09-26' }, '/least': { checkedAt: '2026-09-26' } }).map(([t]) => t);
  ok(JSON.stringify(q) === JSON.stringify(['/new', '/mid', '/least', '/most']), `link queue: never checked first, then the oldest check, then the most linked (got ${JSON.stringify(q)})`);
}

// ── 4. www twins ─────────────────────────────────────────────────────────────────────────────────
{
  const B = 'https://miltonly.com';
  ok(wwwPasses(B, '/streets/zilio-terrace-milton', 308, 'https://miltonly.com/streets/zilio-terrace-milton'), 'www: a 308 to the same apex path passes (production 2026-09-28)');
  ok(wwwPasses(B, '/', 308, 'https://miltonly.com/'), 'www: the homepage');
  ok(!wwwPasses(B, '/about', 301, 'https://miltonly.com/about'), 'www: a 301 fails');
  ok(!wwwPasses(B, '/about', 307, 'https://miltonly.com/about'), 'www: a 307 fails');
  ok(!wwwPasses(B, '/about', 200, null), 'www: a 200 twin fails');
  ok(!wwwPasses(B, '/streets/x', 308, 'https://miltonly.com/'), 'www: a 308 to the homepage fails');
  ok(!wwwPasses(B, '/streets/x', 308, 'http://miltonly.com/streets/x'), 'www: a 308 to http fails');
  ok(!wwwPasses(B, '/streets/x', 308, 'https://www.miltonly.com/streets/x'), 'www: a 308 to itself fails');
  const sm = new Set(['/', ...Array.from({ length: 60 }, (_, i) => `/p${i}`)]);
  const a = wwwSample(sm, '2026-09-28', 20); const b = wwwSample(sm, '2026-09-28', 20); const c = wwwSample(sm, '2026-09-29', 20);
  ok(a.length === 20 && new Set(a).size === 20 && a[0] === '/', 'www sample: 20 distinct paths, the homepage first');
  ok(JSON.stringify(a) === JSON.stringify(b), 'www sample: the same day draws the same paths');
  ok(JSON.stringify(a) !== JSON.stringify(c), 'www sample: another day draws other paths');
  ok(wwwSample(new Set(['/', '/a']), '2026-09-28', 20).length === 2, 'www sample: never more than the sitemap holds');
  const g = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'guards.json'), 'utf8'));
  ok(typeof g.wwwTwinEnforced === 'boolean', 'guards.json: wwwTwinEnforced is a boolean');
}

console.log(`[nightly-checks] street-head: ${hPass}/${HEAD_CASES.length} cases; banned sentences: ${sPass}/${STRIP_CASES.length} cases`);
if (failures.length) { console.error(`[nightly-checks] FAIL: ${failures.length} of ${assertions} assertions:`); for (const f of failures) console.error(`  ${f}`); process.exit(1); }
console.log(`[nightly-checks] PASS: ${assertions} assertions.`);
