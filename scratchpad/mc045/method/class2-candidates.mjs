// MC-045 class 2, step 1: the candidate net for COMPASS AND POSITION claims. Deliberately broad:
// every served generated sentence with a compass word or a town-position phrase becomes a
// candidate. Step 2 (agents) parses each candidate into zero or more claims {subject, relation,
// direction, anchor}; step 3 (class2-verdict.mjs) grounds each parsed claim in Town geometry.
//
//   node scratchpad/mc045/method/class2-candidates.mjs <workDir>
import fs from 'node:fs';
import path from 'node:path';

const [workDir] = process.argv.slice(2);
const pages = JSON.parse(fs.readFileSync(path.join(workDir, 'units.json'), 'utf8'));
// names containing a compass word are neutralised before the net is cast
const NAMES = /\b(?:Milton North|Rural Milton (?:West|East)|Main Street (?:East|West)|(?:Bronte|Ontario|Martin|Commercial) Street (?:North|South)|Regional Road \d+ (?:North|South)|(?:North|South|East|West) (?:Park|Ridge|Pointe|Gate)|Southwind|Westmeath|Eastview|Northcote|Southcote|Westfield|east-west|north-south|northeast-southwest|northwest-southeast)\b/gi;
const NET = /\b(?:north|south|east|west|northern|southern|eastern|western|north-?east(?:ern)?|north-?west(?:ern)?|south-?east(?:ern)?|south-?west(?:ern)?|northward|southward|eastward|westward)\b|\bdowntown\b|\btown (?:centre|center|core)\b|\b(?:edge|outskirts|fringe|periphery|margins?)\s+of\s+(?:the\s+)?(?:town|Milton|the urban|urban)\b|\b(?:town's|Milton's)\s+(?:edge|outskirts|fringe|core|centre|heart|periphery)\b|\bheart of (?:the town|Milton|town)\b|\bcentral(?:ly)?\b|\bhistoric (?:core|centre|downtown)\b|\bolder (?:core|downtown)\b|\bbuilt-up (?:edge|area|core)\b|\burban (?:edge|boundary|core|area)\b/i;

const cands = [];
for (const p of pages) {
  for (const u of p.units) {
    const t = u.t.replace(NAMES, (m) => m.replace(/[A-Za-z]/g, 'x'));
    if (NET.test(t)) cands.push({ id: cands.length, slug: p.slug, surfaces: u.s, text: u.t, containedIn: p.containedIn, h1: p.h1 });
  }
}
fs.writeFileSync(path.join(workDir, 'class2-candidates.json'), JSON.stringify(cands));
const perPage = new Set(cands.map((c) => c.slug)).size;
console.log(`candidate sentences ${cands.length} on ${perPage} pages`);
