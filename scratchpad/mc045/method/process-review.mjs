// MC-045: turn the agent review (workflow mc045-review) into numbers.
//   node scratchpad/mc045/method/process-review.mjs <workDir> <reviewOutputJson> <outDir>
// Produces: class 1 precision (two independent labellers per sentence, Wilson 95% interval), recall
// for all three classes on 40 pages read end to end, the class 2 parse file for the verdict engine,
// and the class 3 skeptic verdicts.
import fs from 'node:fs';
import path from 'node:path';

const [workDir, reviewFile, outDir] = process.argv.slice(2);
const W = (f) => path.join(workDir, f);
const R = JSON.parse(fs.readFileSync(reviewFile, 'utf8')).result;
const norm = (s) => String(s ?? '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
const wilson = (k, n) => { if (!n) return null; const z = 1.96, p = k / n, d = 1 + z * z / n; const c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d; return [+(c - h).toFixed(3), +(c + h).toFixed(3)]; };

// ── class 1 precision ──
const sample = JSON.parse(fs.readFileSync(W('review/c1-sample.json'), 'utf8'));
const labels = {};
for (const x of R.precision.filter(Boolean)) for (const l of x.r?.labels ?? []) (labels[l.sid] ??= [])[x.k] = l;
const c1now = new Set(JSON.parse(fs.readFileSync(W('class1.json'), 'utf8')).rows.map((r) => `${r.slug}|${r.text}`));
let both = 0, agreeEra = 0, eraBoth = 0, eraAbout = 0, n = 0, split = 0, droppedSince = 0;
const falsePositives = [], aboutElsewhere = [];
for (const s of sample) {
  if (!c1now.has(`${s.slug}|${s.text}`)) { droppedSince++; continue; } // excluded by a later rule (X5)
  const [a, b] = labels[s.sid] ?? [];
  if (!a || !b) continue;
  n++;
  if (a.isBuildEraClaim === b.isBuildEraClaim) agreeEra++; else split++;
  if (a.isBuildEraClaim && b.isBuildEraClaim) eraBoth++;
  else if (!a.isBuildEraClaim && !b.isBuildEraClaim) falsePositives.push({ sid: s.sid, slug: s.slug, text: s.text, why: [a.note, b.note] });
  if (a.isBuildEraClaim && b.isBuildEraClaim && a.aboutThisStreetOrItsArea && b.aboutThisStreetOrItsArea) eraAbout++;
  else if (a.isBuildEraClaim && b.isBuildEraClaim) aboutElsewhere.push({ sid: s.sid, slug: s.slug, text: s.text });
}
const precision = {
  sampleSize: n, droppedByLaterRule: droppedSince,
  labellerAgreementOnIsBuildEra: +(agreeEra / n).toFixed(3), splitDecisions: split,
  precisionBuildEraBothAgree: +(eraBoth / n).toFixed(3), ci95: wilson(eraBoth, n),
  precisionAboutThisStreetOrArea: +(eraAbout / n).toFixed(3), ciAbout95: wilson(eraAbout, n),
  falsePositivesBothAgree: falsePositives, eraButAboutElsewhere: aboutElsewhere.length,
};

// ── recall on 40 pages ──
const units = JSON.parse(fs.readFileSync(W('units.json'), 'utf8'));
const recallSlugs = JSON.parse(fs.readFileSync(W('review/recall-pages.json'), 'utf8'));
const c1rows = JSON.parse(fs.readFileSync(W('class1.json'), 'utf8')).rows;
const c2c = JSON.parse(fs.readFileSync(W('class2-candidates.json'), 'utf8'));
const c3c = JSON.parse(fs.readFileSync(W('class3-candidates.json'), 'utf8'));
const byPage = {};
for (const x of R.recall.filter(Boolean)) for (const p of x.r?.pages ?? []) byPage[p.slug] = p;
const match = (agentText, set) => { const a = norm(agentText); return [...set].some((t) => t === a || t.includes(a) || a.includes(t)); };
let e1 = 0, f1 = 0, e2 = 0, f2 = 0; const miss1 = [], miss2 = [], c3agent = [];
for (const slug of recallSlugs) {
  const p = byPage[slug]; if (!p) continue;
  const sweep1 = new Set(c1rows.filter((r) => r.slug === slug).map((r) => norm(r.text)));
  const net2 = new Set(c2c.filter((c) => c.slug === slug).map((c) => norm(c.text)));
  const pageUnits = new Set(units.find((u) => u.slug === slug)?.units.map((u) => norm(u.t)) ?? []);
  for (const t of p.buildEra ?? []) { if (!match(t, pageUnits)) continue; e1++; if (match(t, sweep1)) f1++; else miss1.push({ slug, text: t }); }
  for (const t of p.position ?? []) { if (!match(t, pageUnits)) continue; e2++; if (match(t, net2)) f2++; else miss2.push({ slug, text: t }); }
  for (const c of p.contradictions ?? []) c3agent.push({ slug, ...c, inCandidates: c3c.some((x) => x.slug === slug) });
}
const recall = {
  pages: recallSlugs.length,
  class1: { agentListed: e1, foundBySweep: f1, recall: e1 ? +(f1 / e1).toFixed(3) : null, ci95: wilson(f1, e1), missed: miss1 },
  class2Net: { agentListed: e2, inCandidateNet: f2, recall: e2 ? +(f2 / e2).toFixed(3) : null, ci95: wilson(f2, e2), missed: miss2 },
  class3: { agentFound: c3agent.length, alsoInCandidates: c3agent.filter((c) => c.inCandidates).length, agentFindings: c3agent },
};

// ── class 2 parse file ──
const parse = {};
for (const x of R.parse.filter(Boolean)) for (const it of x.r?.items ?? []) (parse[it.id] ??= [[], []])[x.k] = it.claims;
fs.writeFileSync(W('c2-parse.json'), JSON.stringify(parse));
const parsedIds = Object.keys(parse).length;

// ── class 3 skeptics ──
const sk = {};
for (const x of R.skeptics.filter(Boolean)) (sk[x.id] ??= [])[x.k] = x.r;
const c3 = c3c.map((c) => { const v = (sk[c.id] ?? []).filter(Boolean); const upheld = v.filter((y) => !y.refuted).length; return { ...c, votes: v.map((y) => `${y.refuted ? 'REFUTED' : 'UPHELD'}: ${y.reason}`), verdict: upheld === 2 ? 'confirmed' : upheld === 1 ? 'split' : 'refuted' }; });
fs.writeFileSync(W('class3-judged.json'), JSON.stringify(c3, null, 1));
fs.writeFileSync(W('class3-confirmed.json'), JSON.stringify(c3.filter((c) => c.verdict === 'confirmed' && c.type !== 'T8')));

const res = { precision, recall, class2ParsedCandidates: parsedIds, class3: c3.map((c) => ({ id: c.id, type: c.type, slug: c.slug, verdict: c.verdict })) };
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'review-results.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify({ precision: { ...precision, falsePositivesBothAgree: precision.falsePositivesBothAgree.length }, recall: { class1: { ...recall.class1, missed: recall.class1.missed.length }, class2Net: { ...recall.class2Net, missed: recall.class2Net.missed.length }, class3: { agentFound: recall.class3.agentFound, alsoInCandidates: recall.class3.alsoInCandidates } }, class2ParsedCandidates: parsedIds, class3: res.class3 }, null, 1));
