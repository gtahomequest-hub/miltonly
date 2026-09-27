// MC-045: packets for the agent review. Deterministic selections (every Nth), so a rerun picks the
// same rows and pages.
//   node scratchpad/mc045/method/prep-review.mjs <workDir>
import fs from 'node:fs';
import path from 'node:path';

const [workDir] = process.argv.slice(2);
const W = (f) => path.join(workDir, f);
const pages = JSON.parse(fs.readFileSync(W('units.json'), 'utf8'));
const c1 = JSON.parse(fs.readFileSync(W('class1.json'), 'utf8'));
const c2 = JSON.parse(fs.readFileSync(W('class2-candidates.json'), 'utf8'));
fs.mkdirSync(W('review'), { recursive: true });

// class 1 precision: 120 rows at a fixed stride through the published CSV order
const stride = Math.floor(c1.rows.length / 120);
const sample = c1.rows.filter((_, i) => i % stride === 0).slice(0, 120).map((r, i) => ({ sid: i, slug: r.slug, surfaces: r.surfaces, terms: r.terms, text: r.text }));
fs.writeFileSync(W('review/c1-sample.json'), JSON.stringify(sample, null, 1));

// recall pages: 40 of the pages that carry generated text, at a fixed stride, each as a packet of
// everything the page serves as generated text plus its data island
const gen = pages.filter((p) => p.units.length > 0);
const rstride = Math.floor(gen.length / 40);
const recall = gen.filter((_, i) => i % rstride === 0).slice(0, 40);
fs.mkdirSync(W('review/packets'), { recursive: true });
for (const p of recall) fs.writeFileSync(W(`review/packets/${p.slug}.json`), JSON.stringify({ slug: p.slug, template: p.template, h1: p.h1, metaDescription: p.metaDescription, containedIn: p.containedIn, units: p.units, faq: p.faq, island: p.island }, null, 1));
fs.writeFileSync(W('review/recall-pages.json'), JSON.stringify(recall.map((p) => p.slug)));

// class 2 parse batches: 24 candidates each
const B = 24;
const batches = [];
for (let i = 0; i < c2.length; i += B) batches.push(c2.slice(i, i + B).map((c) => ({ id: c.id, slug: c.slug, streetName: c.h1, neighbourhoods: c.containedIn, surfaces: c.surfaces, text: c.text })));
fs.mkdirSync(W('review/c2'), { recursive: true });
batches.forEach((b, i) => fs.writeFileSync(W(`review/c2/batch-${String(i).padStart(2, '0')}.json`), JSON.stringify(b, null, 1)));
console.log(JSON.stringify({ c1Sample: sample.length, stride, recallPages: recall.length, rstride, c2Candidates: c2.length, c2Batches: batches.length }));
