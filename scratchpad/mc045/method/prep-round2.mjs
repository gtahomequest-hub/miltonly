// MC-045 round 2 packets: a fresh class 1 recall sample (a stride offset from round 1, so no page is
// reused), the full-corpus class 3 packets, and the class 2 WRONG and one-parser claims to verify.
//   node scratchpad/mc045/method/prep-round2.mjs <workDir>
import fs from 'node:fs';
import path from 'node:path';

const [workDir] = process.argv.slice(2);
const W = (f) => path.join(workDir, f);
const pages = JSON.parse(fs.readFileSync(W('units.json'), 'utf8'));
const r1 = new Set(JSON.parse(fs.readFileSync(W('review/recall-pages.json'), 'utf8')));
const gen = pages.filter((p) => p.units.length > 0);
const stride = Math.floor(gen.length / 40);
const fresh = gen.filter((_, i) => i % stride === Math.floor(stride / 2)).filter((p) => !r1.has(p.slug)).slice(0, 40);
fs.mkdirSync(W('review2/packets'), { recursive: true });
for (const p of fresh) fs.writeFileSync(W(`review2/packets/${p.slug}.json`), JSON.stringify({ slug: p.slug, template: p.template, h1: p.h1, metaDescription: p.metaDescription, containedIn: p.containedIn, units: p.units, faq: p.faq, island: p.island }, null, 1));
fs.writeFileSync(W('review2/recall-pages.json'), JSON.stringify(fresh.map((p) => p.slug)));

// class 3: every page with generated text, compact: the claim fields and the refuting fields only
const c3 = gen.map((p) => ({
  slug: p.slug, template: p.template, h1: p.h1,
  claimFields: {
    heroAndPlaceDescription: p.units.filter((u) => u.s.includes('hero') || u.s.includes('ld-place')).map((u) => u.t),
    metaDescription: p.metaDescription,
    faq: p.faq,
  },
  dataIsland: p.island,
  neighbourhoods: p.containedIn,
}));
const B = 8;
fs.mkdirSync(W('review2/c3'), { recursive: true });
for (let i = 0; i < c3.length; i += B) fs.writeFileSync(W(`review2/c3/batch-${String(i / B).padStart(3, '0')}.json`), JSON.stringify(c3.slice(i, i + B), null, 1));

// class 2: every WRONG claim (agreed by both parsers), and every one-parser claim the engine would call WRONG
const j = JSON.parse(fs.readFileSync(W('class2-judgedx.json'), 'utf8'));
const wrong = j.judged.filter((x) => x.v === 'WRONG').map((x, i) => ({ wid: i, slug: x.slug, text: x.text, claim: x.claim, test: x.test, subject: x.subject, errM: x.errM, surfaces: x.surfaces }));
const tie = j.oneParser.filter((x) => x.v === 'WRONG').map((x, i) => ({ tid: i, slug: x.slug, text: x.text, parser: x.parser, claim: x.claim, test: x.test, errM: x.errM }));
fs.writeFileSync(W('review2/c2-wrong.json'), JSON.stringify(wrong, null, 1));
fs.writeFileSync(W('review2/c2-tie.json'), JSON.stringify(tie, null, 1));
console.log(JSON.stringify({ freshRecallPages: fresh.length, overlapWithRound1: fresh.filter((p) => r1.has(p.slug)).length, c3Pages: c3.length, c3Batches: Math.ceil(c3.length / B), c2Wrong: wrong.length, c2Tie: tie.length }));
