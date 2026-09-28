// MC-048: ground truth on production for the render-diff finding. For every edited section whose
// render outcome was "SECTION DROPPED" under some option combination, each OTHER sentence that section
// rendered before the cut is looked for on the live page now (anywhere: prose, hero, JSON-LD, meta).
//   node scratchpad/mc048/render-truth.mjs
import fs from "node:fs";

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const normalize = (s) => s
  .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\(["\\/])/g, "$1")
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&([a-z]+);/g, (m, n) => ENT[n] ?? m).replace(/<[^>]+>/g, " ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ");
const fold = (s) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
const split = (p) => p.split(/(?<=[.!?])\s+(?=[A-Z"“])/).map((s) => s.trim()).filter(Boolean);

const rep = JSON.parse(fs.readFileSync("scratchpad/mc048/strip-report.json", "utf8"));
const rd = JSON.parse(fs.readFileSync("scratchpad/mc048/strip-render.json", "utf8"));
const rows = [];
for (const r of rd.pages) {
  for (const s of r.sections) {
    if (!s.outcomes.some((o) => o.startsWith("SECTION DROPPED"))) continue;
    const p = rep.pages.find((x) => x.slug === r.slug);
    const c = p.claims.find((c) => c.status === "cut" && c.where.some((w) => w.includes(`sections[${s.id}]`)));
    // only sentences the section RENDERED before the cut (under any of the 16 option combinations);
    // `certain` marks those it rendered under all 16
    const others = s.otherRenderedBeforeAny.map(fold);
    const certain = new Set(s.otherRenderedBeforeAll.map(fold));
    const html = normalize(await (await fetch(`https://miltonly.com/streets/${r.slug}`, { headers: { "user-agent": "miltonly-verify mc048-render" } })).text());
    for (const o of others) rows.push({ slug: r.slug, section: s.id, sentence: o, renderedBeforeUnderAll16: certain.has(o), onPage: html.includes(o) });
  }
}
const off = rows.filter((x) => !x.onPage);
fs.writeFileSync("scratchpad/mc048/render-truth.json", JSON.stringify({ at: new Date().toISOString(), rows }, null, 1));
console.log(`sections checked: ${new Set(rows.map((r) => r.slug + r.section)).size} on ${new Set(rows.map((r) => r.slug)).size} pages; sentences they rendered before besides the cut one: ${rows.length} (${rows.filter((r) => r.renderedBeforeUnderAll16).length} under all 16 option combinations); still on the live page: ${rows.length - off.length}; no longer on the page: ${off.length} (${off.filter((r) => r.renderedBeforeUnderAll16).length} of them rendered under all 16)`);
for (const x of off) console.log(`  OFF  ${x.slug} [${x.section}]${x.renderedBeforeUnderAll16 ? '' : ' (rendered under some combinations only)'} ${x.sentence.slice(0, 150)}`);
