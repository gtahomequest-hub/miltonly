// MC-045 validity: the 126 pages served STALE at crawl time are fetched again (read-only GETs) and
// their generated units and data island are compared with what was measured.
//   node scratchpad/mc045/method/stale-check.mjs <cacheDir> <workDir>
import fs from 'node:fs';
import path from 'node:path';
import { extract } from './extract.mjs';

const [cacheDir, workDir] = process.argv.slice(2);
const meta = JSON.parse(fs.readFileSync(path.join(cacheDir, 'crawl-meta.json'), 'utf8')).meta;
const stale = Object.entries(meta).filter(([, m]) => m.cache === 'STALE').map(([s]) => s);
const norm = (s) => (s ?? '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
const gen = (r) => JSON.stringify({ hero: norm(r.heroSubtitle), ld: norm(r.ldPlaceDescription), secs: (r.sections ?? []).map((s) => s.paragraphs.map(norm)), faq: (r.faq ?? []).map((f) => norm(f.a)) });
const isl = (r) => JSON.stringify({ pills: r.pillRows, glance: r.glance, listings: (r.listings ?? []).map((l) => l.propertyType) });
let sameGen = 0, sameIsl = 0; const genDiff = [], islDiff = [];
for (const s of stale) {
  const before = extract(fs.readFileSync(path.join(cacheDir, 'html', `${s}.html`), 'utf8'));
  const after = extract(await (await fetch(`https://miltonly.com/streets/${s}`, { headers: { 'user-agent': 'miltonly-verify MC-045' } })).text());
  if (gen(before) === gen(after)) sameGen++; else genDiff.push(s);
  if (isl(before) === isl(after)) sameIsl++; else islDiff.push(s);
}
const res = { stale: stale.length, generatedTextIdentical: sameGen, generatedTextChanged: genDiff, dataIslandIdentical: sameIsl, dataIslandChanged: islDiff };
fs.writeFileSync(path.join(workDir, 'stale-check.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res));
