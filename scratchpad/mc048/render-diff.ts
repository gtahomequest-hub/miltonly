// MC-048: what did the strip change in what each page RENDERS? The page keeps sentences one by one
// (stripNumericParagraphs: numeric sentences and dangling references after a hole go) and drops a
// section left with fewer than two sentences (isFragment) or only a caveat (isDisclaimerOnly). So
// cutting one sentence can take a section's heading and its last sentence with it.
//
// The page's strip options (pricePublished, bandPublished, soldOverAskPublished, noRecord) come from
// live data; rather than reconstruct them, every edited section is rendered before and after under
// all 16 combinations. An outcome that holds under all 16 does not depend on them.
//
// Also writes the positive controls verify-strip.mjs uses: sentences on the page after the strip that
// render under all 16 combinations (for a minimal or needsReview page, the description's first
// sentence, which the JSON-LD place and the hero carry).
//
// Run: npx tsx --tsconfig tsconfig.test.json --require ./scripts/_server-only-shim.cjs scratchpad/mc048/render-diff.ts
import fs from "node:fs";
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = l.match(/^([A-Z_][A-Z0-9_]*)=(.*?)\r?$/); if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1"); }

async function main() {
  const ns = await import("../../src/lib/prose/numericSentences");
  const { firstSentence } = await import("../../src/lib/prose/sentences");
  const rep = JSON.parse(fs.readFileSync("scratchpad/mc048/strip-report.json", "utf8"));
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  const combos: any[] = [];
  for (let i = 0; i < 16; i++) combos.push({ noRecord: !!(i & 1), pricePublished: !!(i & 2), bandPublished: !!(i & 4), soldOverAskPublished: !!(i & 8) });
  const render = (paras: string[], o: any) => {
    const kept = ns.stripNumericParagraphs(paras, o);
    if (kept.length === 0 || ns.isDisclaimerOnly(kept) || ns.isFragment(kept)) return null;
    return kept;
  };
  const sentencesOf = (paras: string[] | null) => (paras ? paras.join(" ").split(/(?<=[.!?])\s+(?=[A-Z"“])/).map((s) => s.trim()).filter(Boolean) : []);

  const out: any[] = [];
  const controls: Record<string, string[]> = {};
  for (const p of rep.pages.filter((x: any) => x.applied)) {
    const row = (await sql`SELECT c.template, c."needsReview" nr, c.description d, g."sectionsJson" sj FROM public."StreetContent" c LEFT JOIN public."StreetGeneration" g ON g."streetSlug"=c."streetSlug" WHERE c."streetSlug"=${p.slug}`)[0] as any;
    const rendersProse = row.template === "standard" && !row.nr;
    const res: any = { slug: p.slug, template: row.template, needsReview: row.nr, rendersProse, sections: [] };
    if (rendersProse) {
      for (const c of p.claims.filter((c: any) => c.status === "cut")) {
        const w = c.where.find((x: string) => x.startsWith("StreetGeneration.sections["));
        if (!w) continue;
        const id = w.match(/sections\[([^\]]+)\]/)![1];
        const after = row.sj.find((s: any) => s.id === id).paragraphs as string[];
        const pi = Number(w.match(/\.p(\d+)/)![1]);
        const before = [...after];
        if (c.after[0].startsWith("(paragraph removed")) before.splice(pi, 0, c.before[0]); else before[pi] = c.before[0];
        const outcomes = new Set<string>();
        let beforeAll: string[] | null = null; const beforeAny = new Set<string>();
        let afterAll: string[] | null = null; const afterAny = new Set<string>();
        for (const o of combos) {
          const rb = render(before, o), ra = render(after, o);
          const sb = sentencesOf(rb), sa = sentencesOf(ra);
          const others = sb.filter((x) => !x.includes(c.text.slice(0, 60)));
          beforeAll = beforeAll === null ? others : beforeAll.filter((x) => others.includes(x)); others.forEach((x) => beforeAny.add(x));
          afterAll = afterAll === null ? sa : afterAll.filter((x) => sa.includes(x)); sa.forEach((x) => afterAny.add(x));
          const targetRendered = sb.some((s) => s.includes(c.text.slice(0, 60)));
          let k: string;
          if (!targetRendered) k = rb ? "the cut sentence was not rendered before" : "the section was not rendered before";
          else if (!ra) k = `SECTION DROPPED: ${sb.length - 1} other sentence(s) and the heading went with it`;
          else {
            const lost = sb.filter((s) => !s.includes(c.text.slice(0, 60)) && !sa.includes(s));
            k = lost.length ? `CASCADE: ${lost.length} more sentence(s) no longer render` : "only the cut sentence left the page";
          }
          outcomes.add(k);
        }
        res.sections.push({ id, outcomes: [...outcomes], otherRenderedBeforeAll: beforeAll || [], otherRenderedBeforeAny: [...beforeAny], renderedAfterAll: afterAll || [], renderedAfterAny: [...afterAny] });
      }
      // controls: sentences rendered in every combination, from any section after the strip
      const pool: string[] = [];
      for (const s of row.sj) {
        let common: string[] | null = null;
        for (const o of combos) { const ss = sentencesOf(render(s.paragraphs, o)); common = common === null ? ss : common.filter((x) => ss.includes(x)); }
        for (const x of common || []) if (x.length >= 40 && !/\d/.test(x)) pool.push(x);
      }
      controls[p.slug] = pool.slice(0, 5);
    } else {
      // minimal or needsReview: no generated prose renders; the description's first sentence reaches the
      // hero and the JSON-LD place only through the page's summary rule (street-data.ts:819-820:
      // stripNumericSentences over the first sentence, standalone). Where it survives under every option
      // combination it is the control; where it survives under none, the page shows the neighbourhood
      // fallback (street-schema.ts:122, "A residential street in ...") and that is the control.
      const lead = firstSentence(row.d);
      const survives = (o: any) => (lead && lead.length > 30 ? ns.stripNumericSentences(lead, { ...o, standalone: true }) : "").trim();
      const all = combos.every((o) => survives(o) === lead.trim());
      const none = combos.every((o) => !survives(o));
      controls[p.slug] = all ? [lead] : none ? ["@fallback:A residential street in "] : [];
      res.summaryLead = { lead, survivesUnderAll16: all, survivesUnderNone: none };
    }
    out.push(res);
  }
  fs.writeFileSync("scratchpad/mc048/strip-render.json", JSON.stringify({ at: new Date().toISOString(), pages: out, controls }, null, 1));
  const tally: Record<string, number> = {};
  for (const r of out) for (const s of r.sections) for (const o of s.outcomes) tally[o.replace(/\d+/g, "N")] = (tally[o.replace(/\d+/g, "N")] || 0) + 1;
  console.log("pages rendering generated prose:", out.filter((r) => r.rendersProse).length, "| minimal or needsReview (prose not rendered):", out.filter((r) => !r.rendersProse).map((r) => `${r.slug} (${r.needsReview ? "needsReview" : r.template})`).join(", "));
  console.log("outcomes, per edited section, across the 16 option combinations:", JSON.stringify(tally, null, 1));
  for (const r of out) for (const s of r.sections) if (s.outcomes.some((o: string) => /DROPPED|CASCADE|not rendered/.test(o))) console.log(`  ${r.slug} [${s.id}]: ${s.outcomes.join(" / ")}`);
  console.log("pages with no control sentence:", Object.entries(controls).filter(([, v]) => !v.length).map(([k]) => k).join(", ") || "none");
}
main().catch((e) => { console.error(e); process.exit(1); });
