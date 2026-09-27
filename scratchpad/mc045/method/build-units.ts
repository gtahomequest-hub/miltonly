// MC-045: the measurement's unit of count. For every cached street page, the GENERATED text the
// page serves, split with the repo's own splitter (src/lib/prose/sentences.ts, the one the renderer
// uses), one unique normalised sentence per page carrying every surface it appears on.
//
//   npx tsx --tsconfig tsconfig.test.json scratchpad/mc045/method/build-units.ts <cacheDir> <workDir>
//
// Surfaces (generated text only; template and data strings are never units):
//   hero      the hero subtitle, when it is generated (it equals Place.description; minimal pages
//             render a template hero)
//   ld-place  JSON-LD Place.description, unless it is the template "A residential street in …"
//   sec:<id>  a profile paragraph, as served (after the render-time numeric strip)
//   faq       an FAQ answer; the visible FAQ and FAQPage JSON-LD are identical on 719/719 pages,
//             so an answer is one surface, tagged faq, and counts for both
// The meta description (and og/twitter, identical to it) carries a truncated prefix of
// Place.description after a template lead; it is kept per page as metaTail, and a claim counts as
// "in the meta" only when its matched phrase lies inside that tail.
import fs from "node:fs";
import path from "node:path";
import { splitSentences } from "../../../src/lib/prose/sentences";
// @ts-expect-error plain ESM helper
import { extract } from "./extract.mjs";

const [cacheDir, workDir] = process.argv.slice(2);
if (!cacheDir || !workDir) throw new Error("usage: build-units.ts <cacheDir> <workDir>");
fs.mkdirSync(workDir, { recursive: true });
const slugs: string[] = JSON.parse(fs.readFileSync(path.join(cacheDir, "slugs.json"), "utf8"));
const norm = (s: string) => s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
const LEAD = /^.+?, Milton: (?:homes typically \$[\d,]+ across \d+ sales? in the last (?:12 months|~2 years)|\d+ (?:sale|lease)s? in the last 12 months on record, current listings, and the full street read|current listings and the full street read)\.(?: (.+))?$/;
const TEMPLATE_LD = /^A residential street in .*, Milton Ontario\.$/;

const pages: unknown[] = [];
let leadMisses = 0;
for (const slug of slugs) {
  const html = fs.readFileSync(path.join(cacheDir, "html", `${slug}.html`), "utf8");
  const r = extract(html);
  const units = new Map<string, Set<string>>();
  const add = (text: string | null | undefined, surf: string) => {
    for (const s of splitSentences(text ?? "")) {
      const k = norm(s);
      if (!k) continue;
      if (!units.has(k)) units.set(k, new Set());
      units.get(k)!.add(surf);
    }
  };
  const ldGen = r.ldPlaceDescription && !TEMPLATE_LD.test(r.ldPlaceDescription) ? r.ldPlaceDescription : null;
  const heroGen = r.template !== "minimal" && r.heroSubtitle && ldGen && norm(r.heroSubtitle) === norm(ldGen) ? r.heroSubtitle : null;
  if (heroGen) add(heroGen, "hero");
  if (ldGen) add(ldGen, "ld-place");
  for (const sec of r.sections ?? []) for (const p of sec.paragraphs ?? []) add(p, `sec:${sec.id}`);
  for (const f of r.faq ?? []) add(f.a, "faq");
  const m = (r.metaDescription ?? "").match(LEAD);
  if (!m) leadMisses++;
  pages.push({
    slug,
    template: r.template,
    h1: r.h1,
    heroGenerated: !!heroGen,
    ldGenerated: !!ldGen,
    hiddenOnly: r.template === "minimal" && !!ldGen,
    metaDescription: r.metaDescription,
    metaTail: m?.[1] ? norm(m[1]) : null,
    containedIn: r.ldPlaceContainedIn,
    faq: (r.faq ?? []).map((f: { q: string; a: string }) => ({ q: norm(f.q), a: norm(f.a) })),
    sections: (r.sections ?? []).map((s: { id: string }) => s.id),
    units: [...units].map(([t, s]) => ({ t, s: [...s] })),
    island: {
      pillRows: r.pillRows, glance: r.glance, heroStats: r.heroStats, listings: r.listings,
      streetFacts: r.streetFacts, roadFacts: r.roadFacts, eyebrow: r.heroEyebrow,
    },
  });
}
fs.writeFileSync(path.join(workDir, "units.json"), JSON.stringify(pages));
const n = pages.length;
const u = (pages as Array<{ units: unknown[] }>).reduce((a, p) => a + p.units.length, 0);
const withGen = (pages as Array<{ units: unknown[] }>).filter((p) => p.units.length > 0).length;
console.log(`pages ${n} · pages with generated text ${withGen} · units ${u} · meta lead unparsed ${leadMisses}`);
