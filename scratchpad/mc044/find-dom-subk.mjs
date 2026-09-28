// MC-044: which street page publishes "Typical days on market" (sidebar or glance) or the glance
// sold-to-ask while the record's 12-month sample is under 5, on a given host? The battery's own
// record, crawl and parser (tiles.mjs), run over every published street.
//   node scratchpad/mc044/find-dom-subk.mjs <base>
import { publishedStreetSlugs, crawl } from '../../scripts/verify/lib/http.mjs';
import { loadRecord, K_ANON_PRICE } from '../../scripts/verify/lib/db.mjs';
import { parsePage } from '../../scripts/verify/lib/parse.mjs';
const base = process.argv[2];
const record = await loadRecord();
const slugs = await publishedStreetSlugs(base);
const hits = [];
await crawl(base, slugs, (slug, html) => {
  const e = record.entitled(slug);
  if (!html || e.n12 >= K_ANON_PRICE) return;
  const p = parsePage(html);
  const side = p.facts['Typical days on market'] ?? null, gl = p.glance['Typical DOM'] ?? null, sta = p.glance['Sold-to-ask'] ?? p.glance['Sold to ask'] ?? null;
  if (side || gl || sta) hits.push({ slug, n12: e.n12, sideDom: side, glDom: gl, glSta: sta, stated: (html.match(/across \d+ sales? in the last (?:12 months|~2 years)/g) || []).slice(0, 3) });
});
console.log(`${base}: ${slugs.length} pages; published DOM or sold-to-ask with record n12 < ${K_ANON_PRICE}: ${hits.length}`);
for (const h of hits) console.log(JSON.stringify(h));
