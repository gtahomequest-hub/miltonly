// MC-045: overlap and traffic weight across the three classes, streets only.
//   node scratchpad/mc045/method/summarize.mjs <workDir> <outDir>
//
// Traffic: GSC sc-domain:miltonly.com, 28 days to the latest date the API has (gsc28.json), joined on
// the PATH across both hosts (apex and www.; keying on the apex URL alone loses more than half the
// street rows). "Since generation" sums only the days on or after the served text's generation date
// (StreetContent.generatedAt), because most pages were regenerated inside the window and earlier
// clicks landed on earlier text. Street paths that are not one of the 719 published slugs are reported
// as unattributed, not guessed onto a slug.
import fs from 'node:fs';
import path from 'node:path';

const [workDir, outDir] = process.argv.slice(2);
const J = (f) => JSON.parse(fs.readFileSync(path.join(workDir, f), 'utf8'));
const units = J('units.json');
const slugs = new Set(units.map((p) => p.slug));
const c1 = J('class1.json');
const c2 = J('class2-judged.json');
const c3 = J('class3-confirmed.json');
const gsc = J('gsc28.json');
const daily = J('gsc28-daily.json');
const dates = J('db-dates.json');

const pathOf = (u) => { try { const x = new URL(u); return x.pathname.replace(/\/$/, ''); } catch { return null; } };
const slugOf = (u) => { const p = pathOf(u); const m = p && p.match(/^\/streets\/([^/]+)$/); return m ? decodeURIComponent(m[1]) : null; };
const t28 = {}, unattributed = {};
for (const r of gsc.pages) {
  const s = slugOf(r.page); if (!s) continue;
  const bucket = slugs.has(s) ? t28 : unattributed;
  bucket[s] ??= { clicks: 0, impressions: 0 };
  bucket[s].clicks += r.clicks; bucket[s].impressions += r.impressions;
}
const since = {};
for (const r of daily.daily) {
  const s = slugOf(r.page); if (!s || !slugs.has(s)) continue;
  const gen = (dates[s]?.cgen ?? '0000').slice(0, 10);
  since[s] ??= { clicks: 0, impressions: 0 };
  if (r.date >= gen) { since[s].clicks += r.clicks; since[s].impressions += r.impressions; }
}

const C1 = new Set(c1.rows.map((r) => r.slug));
const C2 = new Set(c2.judged.filter((x) => x.v === 'WRONG').map((x) => x.slug));
const C2M = new Set(c2.judged.filter((x) => x.v === 'MISPLACED').map((x) => x.slug));
const C3 = new Set(c3.map((x) => x.slug));
const classesOf = (s) => [C1.has(s) && '1', C2.has(s) && '2', C3.has(s) && '3'].filter(Boolean);
const rows = [...slugs].map((s) => ({ slug: s, classes: classesOf(s).join('+'), misplaced: C2M.has(s) && !C2.has(s), genDate: (dates[s]?.cgen ?? '').slice(0, 10), clicks28: t28[s]?.clicks ?? 0, impr28: t28[s]?.impressions ?? 0, clicksSinceGen: since[s]?.clicks ?? 0, imprSinceGen: since[s]?.impressions ?? 0 }));
const sum = (arr, k) => arr.reduce((a, r) => a + r[k], 0);
const weight = (set) => { const rs = rows.filter((r) => set.has(r.slug)); return { pages: rs.length, pagesWithGscRows: rs.filter((r) => r.impr28 > 0).length, pagesWithClicks: rs.filter((r) => r.clicks28 > 0).length, clicks28: sum(rs, 'clicks28'), impressions28: sum(rs, 'impr28'), clicksSinceGeneration: sum(rs, 'clicksSinceGen'), impressionsSinceGeneration: sum(rs, 'imprSinceGen') }; };
const any = new Set([...C1, ...C2, ...C3]);
const venn = {}; for (const r of rows) if (r.classes) venn[r.classes] = (venn[r.classes] ?? 0) + 1;
const all = { pages: rows.length, ...weight(slugs) };
const summary = {
  gscWindow: `${gsc.start}..${gsc.end}`, property: gsc.property,
  allPublishedStreets: all,
  class1: weight(C1), class2Wrong: weight(C2), class2MisplacedOnly: weight(new Set([...C2M].filter((s) => !C2.has(s)))), class3: weight(C3), anyClass: weight(any),
  overlap: { pagesWithMoreThanOneClass: rows.filter((r) => r.classes.includes('+')).length, byCombination: venn },
  unattributedStreetPaths: { paths: Object.keys(unattributed).length, clicks: sum(Object.values(unattributed), 'clicks'), impressions: sum(Object.values(unattributed), 'impressions') },
  topByImpressions: rows.filter((r) => r.classes).sort((a, b) => b.impr28 - a.impr28 || b.clicks28 - a.clicks28).slice(0, 25),
  topByClicks: rows.filter((r) => r.classes && r.clicks28 > 0).sort((a, b) => b.clicks28 - a.clicks28 || b.impr28 - a.impr28).slice(0, 15),
};
fs.mkdirSync(outDir, { recursive: true });
const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
fs.writeFileSync(path.join(outDir, 'pages.csv'), ['slug,classes,class2_misplaced_only,served_text_generated,clicks_28d,impressions_28d,clicks_since_generation,impressions_since_generation', ...rows.sort((a, b) => b.impr28 - a.impr28).map((r) => [r.slug, r.classes, r.misplaced, r.genDate, r.clicks28, r.impr28, r.clicksSinceGen, r.imprSinceGen].map(csv).join(','))].join('\n') + '\n');
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
