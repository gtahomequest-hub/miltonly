// MC-045 round 2: class 1 v2 precision (the 113 sentences v2 added, all of them labelled twice),
// class 1 v2 recall and class 2 net recall on a FRESH 40-page sample, the full-corpus class 3 findings
// with two skeptics each, and the verification of every class 2 WRONG claim.
//   node scratchpad/mc045/method/process-round2.mjs <workDir> <round2OutputJson> <outDir>
import fs from 'node:fs';
import path from 'node:path';

const [workDir, file, outDir] = process.argv.slice(2);
const W = (f) => path.join(workDir, f);
const R = JSON.parse(fs.readFileSync(file, 'utf8')).result;
const norm = (s) => String(s ?? '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
const wilson = (k, n) => { if (!n) return null; const z = 1.96, p = k / n, d = 1 + z * z / n; const c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d; return [+(c - h).toFixed(3), +(c + h).toFixed(3)]; };

// ── class 1 v2 precision (census of the added rows) ──
const added = JSON.parse(fs.readFileSync(W('review/c1v2-added.json'), 'utf8'));
const lab = {};
for (const x of R.precision) for (const l of x.r.labels ?? []) (lab[l.sid] ??= [])[x.k] = l;
let n2 = 0, era2 = 0, about2 = 0;
for (const a of added) { const [p, q] = lab[a.sid] ?? []; if (!p || !q) continue; n2++; if (p.isBuildEraClaim && q.isBuildEraClaim) { era2++; if (p.aboutThisStreetOrItsArea && q.aboutThisStreetOrItsArea) about2++; } }
const r1 = JSON.parse(fs.readFileSync(W('review-out/review-results.json'), 'utf8'));
const c1 = JSON.parse(fs.readFileSync(W('class1.json'), 'utf8'));
const v1rows = c1.rows.length - added.length;
const pV1 = r1.precision.precisionBuildEraBothAgree, pV2add = era2 / n2;
const blended = (v1rows * pV1 + added.length * pV2add) / c1.rows.length;
const aboutBlended = (v1rows * r1.precision.precisionAboutThisStreetOrArea + added.length * (about2 / n2)) / c1.rows.length;

// ── fresh recall ──
const units = JSON.parse(fs.readFileSync(W('units.json'), 'utf8'));
const slugs2 = JSON.parse(fs.readFileSync(W('review2/recall-pages.json'), 'utf8'));
const c2c = JSON.parse(fs.readFileSync(W('class2-candidates.json'), 'utf8'));
const by = {}; for (const x of R.recall) for (const p of x.r.pages ?? []) by[p.slug] = p;
const has = (t, set) => { const a = norm(t); return [...set].some((u) => u === a || u.includes(a) || a.includes(u)); };
let e1 = 0, f1 = 0, e2 = 0, f2 = 0, pagesAgent = 0, pagesSweep = 0; const miss1 = [], miss2 = [];
for (const s of slugs2) {
  const p = by[s]; if (!p) continue;
  const pu = new Set(units.find((u) => u.slug === s)?.units.map((u) => norm(u.t)) ?? []);
  const sw = new Set(c1.rows.filter((r) => r.slug === s).map((r) => norm(r.text)));
  const net = new Set(c2c.filter((c) => c.slug === s).map((c) => norm(c.text)));
  const b = (p.buildEra ?? []).filter((t) => has(t, pu));
  if (b.length) { pagesAgent++; if (sw.size) pagesSweep++; }
  for (const t of b) { e1++; if (has(t, sw)) f1++; else miss1.push({ slug: s, text: t }); }
  for (const t of (p.position ?? []).filter((t) => has(t, pu))) { e2++; if (has(t, net)) f2++; else miss2.push({ slug: s, text: t }); }
}

// ── class 3 ──
const findings = R.c3.flat().map((f) => { const up = f.votes.filter((v) => !v.refuted).length; return { slug: f.slug, type: f.type, claimField: f.claimField, claim: f.claim, refuter: f.refuter, why: f.why, verdict: up === 2 ? 'confirmed' : up === 1 ? 'split' : 'refuted', votes: f.votes.map((v) => `${v.refuted ? 'REFUTED' : 'UPHELD'}: ${v.reason}`) }; });
const conf = findings.filter((f) => f.verdict === 'confirmed');
const tally = (arr, k) => arr.reduce((a, x) => ((a[x[k]] = (a[x[k]] ?? 0) + 1), a), {});
fs.writeFileSync(W('class3-confirmed.json'), JSON.stringify(conf.filter((f) => f.claimField !== 'meta-template-lead')));
fs.writeFileSync(W('class3-all-findings.json'), JSON.stringify(findings, null, 1));

// ── class 2 verification ──
const wrong = JSON.parse(fs.readFileSync(W('review2/c2-wrong.json'), 'utf8'));
const tie = JSON.parse(fs.readFileSync(W('review2/c2-tie.json'), 'utf8'));
const wv = {}; for (const x of R.wrong) (wv[x.i] ??= [])[x.k] = x.r;
const verified = wrong.map((w) => { const v = (wv[w.wid] ?? []).filter(Boolean); const up = v.filter((y) => !y.refuted).length; return { ...w, reading: up === 2 ? 'confirmed' : up === 1 ? 'split' : 'refuted', votes: v.map((y) => `${y.refuted ? 'REFUTED' : 'UPHELD'}: ${y.reason}`) }; });
const tv = tie.map((t) => { const r = R.tie.find((x) => x.i === t.tid)?.r; return { ...t, reading: r && !r.refuted ? 'confirmed' : 'refuted', vote: r ? `${r.refuted ? 'REFUTED' : 'UPHELD'}: ${r.reason}` : null }; });
const finalWrong = [...verified.filter((v) => v.reading === 'confirmed'), ...tv.filter((t) => t.reading === 'confirmed').map((t) => ({ ...t, fromTie: true }))];
fs.writeFileSync(W('class2-verified.json'), JSON.stringify({ verified, tie: tv, finalWrong }, null, 1));

const out = {
  class1: {
    v2Rows: c1.rows.length, v1Rows: v1rows, addedByV2: added.length,
    precisionV1Sample: { n: r1.precision.sampleSize, p: pV1, ci95: r1.precision.ci95 },
    precisionV2Added: { n: n2, p: +(pV2add).toFixed(3), ci95: wilson(era2, n2), aboutThisStreetOrArea: +(about2 / n2).toFixed(3) },
    precisionBlended: +blended.toFixed(3), precisionAboutBlended: +aboutBlended.toFixed(3),
    recallV2Fresh: { pages: slugs2.length, agentListed: e1, found: f1, recall: e1 ? +(f1 / e1).toFixed(3) : null, ci95: wilson(f1, e1), pageLevel: { pagesWhereAgentFoundAClaim: pagesAgent, ofThoseFlaggedBySweep: pagesSweep }, missed: miss1 },
  },
  class2NetRecallFresh: { agentListed: e2, inNet: f2, recall: e2 ? +(f2 / e2).toFixed(3) : null, ci95: wilson(f2, e2), missed: miss2 },
  class3: { findings: findings.length, byVerdict: tally(findings, 'verdict'), confirmedPages: new Set(conf.map((f) => f.slug)).size, confirmedByType: tally(conf, 'type'), confirmedByField: tally(conf, 'claimField'), generatedConfirmedPages: new Set(conf.filter((f) => f.claimField !== 'meta-template-lead').map((f) => f.slug)).size },
  class2Verification: { wrongClaims: wrong.length, readingConfirmed: verified.filter((v) => v.reading === 'confirmed').length, split: verified.filter((v) => v.reading === 'split').length, refuted: verified.filter((v) => v.reading === 'refuted').length, tieClaims: tie.length, tieConfirmed: tv.filter((t) => t.reading === 'confirmed').length, finalWrongClaims: finalWrong.length, finalWrongPages: new Set(finalWrong.map((w) => w.slug)).size },
};
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'round2-results.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ ...out, class1: { ...out.class1, recallV2Fresh: { ...out.class1.recallV2Fresh, missed: out.class1.recallV2Fresh.missed.length } }, class2NetRecallFresh: { ...out.class2NetRecallFresh, missed: out.class2NetRecallFresh.missed.length } }, null, 1));
