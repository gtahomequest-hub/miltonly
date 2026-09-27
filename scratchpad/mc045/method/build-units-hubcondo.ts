// MC-045: the same unit of count for the HUB and CONDO pipelines, so the street sweeps run on
// them unchanged. Generated surfaces only, split with the repo's splitter.
//
//   npx tsx --tsconfig tsconfig.test.json scratchpad/mc045/method/build-units-hubcondo.ts <htmlRoot> <workDir>
//   (htmlRoot holds hub-html/ and condo-html/, fetched read-only from the sitemap at 19:47Z)
//
// Hub surfaces: hero p.hh-lede (= firstSentence(overview[0]), also JSON-LD Place.description),
//   the overview and market prose, the FAQ. The hub meta is templated (hubMeta.ts) except one
//   hand-written Timberlea line (hubLive.ts:41), tagged meta-handwritten.
// Condo surfaces: hero p.c-character (= firstSentence(overview[0])), the overview, the FAQ (also
//   JSON-LD FAQPage). The 3 pilot condos render a deterministic brief with no model text: excluded.
// Subject geometry (for the class 2 verdicts): a hub is its Town polygon(s) per
//   src/data/townNeighbourhoodMap.ts, with the Nassagaweya polygon as a superset for the four rural
//   hamlet hubs; a condo is the Town rooftop of its civic address (src/lib/town/rooftop.ts).
import fs from "node:fs";
import path from "node:path";
import { splitSentences } from "../../../src/lib/prose/sentences";
import { TOWN_POLYGON_TO_NEIGHBOURHOOD } from "../../../src/data/townNeighbourhoodMap";
import { resolveRooftop } from "../../../src/lib/town/rooftop";

const [htmlRoot, workDir] = process.argv.slice(2);
const nbf = JSON.parse(fs.readFileSync("D:/miltonly/scripts/town/.cache/neighbourhoods.json", "utf8")).features;
const dec = (s: string) => s.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const norm = (s: string) => s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
const PILOTS = new Set(["480-gordon-krantz-avenue-milton", "610-farmstead-drive-milton", "830-megson-terrace-milton"]);
const RURAL_SUPERSET = new Set(["nassagaweya", "campbellville", "brookville-haltonville", "moffat"]);

for (const kind of ["hub", "condo"] as const) {
  const dir = path.join(htmlRoot, `${kind}-html`);
  const out: unknown[] = [];
  const verts: Record<string, { vertices: number[][]; source: string }> = {};
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".html"))) {
    const slug = f.replace(/\.html$/, "");
    if (kind === "condo" && PILOTS.has(slug)) continue;
    const html = fs.readFileSync(path.join(dir, f), "utf8");
    const cut = html.indexOf("<script>self.__next_f.push");
    const dom = html.slice(0, cut < 0 ? html.length : cut);
    const units = new Map<string, Set<string>>();
    const add = (text: string, surf: string) => { for (const s of splitSentences(text)) { const k = norm(s); if (!k) continue; if (!units.has(k)) units.set(k, new Set()); units.get(k)!.add(surf); } };
    const faq: Array<{ q: string; a: string }> = [];
    let h1 = "";
    if (kind === "hub") {
      h1 = dec(dom.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "");
      for (const m of dom.matchAll(/<p class="hh-lede">([\s\S]*?)<\/p>/g)) { add(dec(m[1]), "hero"); add(dec(m[1]), "ld-place"); }
      const ov = dom.match(/class="hh-sec hh-overview"[\s\S]*?<\/section>/)?.[0] ?? "";
      for (const m of ov.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) add(dec(m[1]), "sec:overview");
      const mk = dom.match(/class="hh-sec hh-market"[\s\S]*?<\/section>/)?.[0] ?? "";
      const pr = mk.match(/<div class="hh-prose">([\s\S]*?)<\/div>/)?.[1] ?? "";
      for (const m of pr.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) add(dec(m[1]), "sec:market");
      const fq = dom.match(/class="hh-sec hh-faqs"[\s\S]*?<\/section>/)?.[0] ?? "";
      for (const m of fq.matchAll(/<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>/g)) { faq.push({ q: norm(dec(m[1])), a: norm(dec(m[2])) }); add(dec(m[2]), "faq"); }
      const meta = dec(dom.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "");
      if (/established central pocket/i.test(meta)) add(meta, "meta-handwritten");
      const town = Object.entries(TOWN_POLYGON_TO_NEIGHBOURHOOD).filter(([, v]) => v === slug).map(([k]) => k);
      const names = town.length ? town : RURAL_SUPERSET.has(slug) ? ["Nassagaweya"] : [];
      const v = nbf.filter((x: { attributes: { NAME: string } }) => names.includes(x.attributes.NAME)).flatMap((x: { geometry: { rings: number[][][] } }) => x.geometry.rings.flat().map(([lng, lat]) => [lat, lng]));
      if (v.length) verts[slug] = { vertices: v, source: `Town polygon(s): ${names.join(" + ")}${RURAL_SUPERSET.has(slug) ? " (superset)" : ""}` };
    } else {
      h1 = dec(dom.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "");
      for (const m of dom.matchAll(/<p class="c-character">([\s\S]*?)<\/p>/g)) add(dec(m[1]), "hero");
      const ov = dom.match(/<div class="c-overview">([\s\S]*?)<\/div>/)?.[1] ?? "";
      for (const m of ov.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)) add(dec(m[1]), "sec:overview");
      for (const m of dom.matchAll(/<div class="c-faq-q">([\s\S]*?)<\/div>\s*<div class="c-faq-a">([\s\S]*?)<\/div>/g)) { faq.push({ q: norm(dec(m[1])), a: norm(dec(m[2])) }); add(dec(m[2]), "faq"); }
      const addr = slug.replace(/-milton$/, "").split("-").map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1))).join(" ");
      const r = resolveRooftop(addr);
      if (r) verts[slug] = { vertices: [[r.lat, r.lng]], source: `Town rooftop: ${addr}` };
    }
    const nbMatch = dom.match(/in (?:Milton's )?([A-Z][A-Za-z ]+?) neighbourhood/)?.[1];
    out.push({ slug, template: kind, h1, hiddenOnly: false, metaTail: null, containedIn: kind === "hub" ? [h1] : nbMatch ? [nbMatch] : [], faq, units: [...units].map(([t, s]) => ({ t, s: [...s] })) });
  }
  const wd = path.join(workDir, kind);
  fs.mkdirSync(wd, { recursive: true });
  fs.writeFileSync(path.join(wd, "units.json"), JSON.stringify(out));
  fs.writeFileSync(path.join(wd, "street-vertices.json"), JSON.stringify(verts));
  const n = (out as Array<{ units: unknown[] }>).reduce((a, p) => a + p.units.length, 0);
  console.log(`${kind}: pages ${out.length} · units ${n} · with subject geometry ${Object.keys(verts).length}`);
}
