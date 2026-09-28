// scripts/audit/verify-strip.mjs. MC-048 (Core), adopted by Audit in MA-011: are MC-045's WRONG
// compass sentences gone from the live pages?
//
//   node scripts/audit/verify-strip.mjs [base]        (base defaults to https://miltonly.com)
//   node scripts/audit/verify-strip.mjs --freeze      (rebuild nightly/banned-sentences.json)
//
// For each page in nightly/banned-sentences.json (56 pages, 60 claims, 58 distinct sentences, frozen
// from scratchpad/mc045/out/class2-wrong-verified.csv and scratchpad/mc048/strip-render.json) it fetches
// the served HTML and looks for every sentence in the whole document: the prose, the hero, the JSON-LD
// and the meta tags, with the matcher in nightly/strip.mjs, which the nightly runs on the same pages
// every night (MA-011).
//
// A POSITIVE CONTROL keeps a clean result honest: on every page stripped in MC-048, a sentence that
// the page renders after the strip must be found by the same matcher. The controls are MC-048's
// (scratchpad/mc048/render-diff.ts): sentences the page's own render keeps under all 16 of its option
// combinations, or, for a minimal or needsReview page whose generated prose is not rendered, the
// description's first sentence where the page's summary rule keeps it (hero and JSON-LD place), and the
// JSON-LD place fallback ("A residential street in ...") where that rule keeps nothing. A page whose
// control is missing is reported as UNVERIFIED, not clean.
//
// Exit 0 only when 0 sentences are found and every control is found.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadBanned, checkStrip, freezeBanned, BANNED_FILE } from './nightly/strip.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
if (process.argv.includes('--freeze')) {
  const out = freezeBanned(path.join(REPO, 'scratchpad/mc045/out/class2-wrong-verified.csv'), path.join(REPO, 'scratchpad/mc048/strip-render.json'));
  fs.writeFileSync(BANNED_FILE, JSON.stringify(out, null, 1) + '\n');
  console.log(`froze ${out.counts.sentences} sentences (${out.counts.claims} claims) on ${out.counts.pages} pages, ${out.counts.controls} with controls, to ${path.relative(REPO, BANNED_FILE)}`);
  process.exit(0);
}

const BASE = (process.argv[2] || 'https://miltonly.com').replace(/\/$/, '');
const banned = loadBanned();
let found = 0, sentences = 0; const unverified = [], fetchErrors = [], lines = [];
let withControls = 0;
for (const [slug, entry] of Object.entries(banned.pages)) {
  let html;
  try {
    const r = await fetch(`${BASE}/streets/${slug}`, { headers: { 'user-agent': 'miltonly-verify mc048-strip' } });
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
    html = await r.text();
  } catch (e) { fetchErrors.push(`${slug} ${e.message}`); continue; }
  const res = checkStrip(entry, html);
  sentences += entry.sentences.length; found += res.found.length;
  if (entry.controls) withControls++;
  if (res.control === 'missing') unverified.push(slug);
  lines.push(`${res.found.length ? 'FOUND' : 'clean'}  ${slug}: ${res.found.length} of ${entry.sentences.length} sentence(s) on the page${res.found.length ? ` :: ${res.found.map((h) => h.slice(0, 70)).join(' | ')}` : ''}; control ${res.control === 'none' ? 'none (page not stripped)' : res.control === 'found' ? 'found' : 'MISSING'}`);
}
for (const l of lines) console.log(l);
console.log(`\n${BASE}: ${found} of ${sentences} distinct sentences found on ${Object.keys(banned.pages).length} pages (${banned.counts.claims} claims). Controls: ${withControls - unverified.length} of ${withControls} found${unverified.length ? `; MISSING on ${unverified.join(', ')}` : ''}. Fetch errors: ${fetchErrors.length}${fetchErrors.length ? ` (${fetchErrors.join('; ')})` : ''}.`);
process.exit(found === 0 && unverified.length === 0 && fetchErrors.length === 0 ? 0 : 1);
