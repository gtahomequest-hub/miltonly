// scripts/publish-redirect-targets.ts
// Publish the OFFICIAL redirect targets so the Step-4-proper 301s land on a
// permanently-published page (not one that merely renders because sold data
// exists). Standard where a succeeded StreetGeneration exists; else minimal
// (StreetContent.neighbourhood = raw TREB key so the minimal area-context resolves).
// Dry-run by default; --commit writes.
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../.env", "../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }
const COMMIT = process.argv.includes("--commit");
const TARGETS = ["first-line-milton","mcdougall-crossing-milton","pine-view-trail-milton","watercress-way-milton","weller-crossing-milton","symons-crossing-milton","fourth-line-nassagaweya-milton","highway-7-milton","sixth-line-nassagaweya-milton","campbellville-road-milton","lloyd-landing-milton","wetenhall-landing-milton","wise-crossing-milton","marigold-court-milton","nipissing-road-milton","french-garden-milton","first-line-nassagaweya-milton","restivo-lane-milton","nassagaweya-puslinch-townline-milton","rigo-crossing-milton","miltonbrook-crescent-milton"];
async function main() {
  const { PrismaClient } = await import("@prisma/client"); const { neon } = await import("@neondatabase/serverless");
  const p = new PrismaClient(); const soldDb = neon(process.env.SOLD_DATABASE_URL!);
  const nbAgg = await soldDb`SELECT street_slug slug, neighbourhood, COUNT(*)::int c FROM sold.sold_records WHERE street_slug = ANY(${TARGETS}) AND neighbourhood IS NOT NULL GROUP BY street_slug, neighbourhood` as any[];
  const domNb = new Map<string, string>(); { const m = new Map<string, Map<string, number>>(); for (const r of nbAgg) { if (!m.has(r.slug)) m.set(r.slug, new Map()); m.get(r.slug)!.set(r.neighbourhood, r.c); } for (const [slug, mm] of m) { let best = "", bc = 0; for (const [k, v] of mm) if (v > bc) { bc = v; best = k; } domNb.set(slug, best); } }
  const ents = await p.residentialStreet.findMany({ where: { slug: { in: TARGETS } }, select: { slug: true, name: true } });
  const entBySlug = new Map(ents.map((e) => [e.slug, e]));
  const gens = await p.streetGeneration.findMany({ where: { streetSlug: { in: TARGETS }, status: "succeeded" }, select: { streetSlug: true } });
  const hasGen = new Set(gens.map((g) => g.streetSlug));
  const contents = await p.streetContent.findMany({ where: { streetSlug: { in: TARGETS } }, select: { streetSlug: true, status: true } });
  const cBySlug = new Map(contents.map((c) => [c.streetSlug, c]));
  let pubStd = 0, pubMin = 0, already = 0, noEnt = 0;
  for (const slug of TARGETS) {
    const ent = entBySlug.get(slug); if (!ent) { console.log(`  ${slug.padEnd(36)} NO ENTITY — skip`); noEnt++; continue; }
    const c = cBySlug.get(slug);
    if (c?.status === "published") { console.log(`  ${slug.padEnd(36)} already published (${hasGen.has(slug) ? "standard" : c ? "template?" : ""})`); already++; continue; }
    const std = hasGen.has(slug); const raw = domNb.get(slug) ?? null;
    console.log(`  ${slug.padEnd(36)} -> PUBLISH ${std ? "standard" : "minimal"}${!std ? ` (nb="${raw ?? "?"}")` : ""}`);
    if (COMMIT) {
      if (std) {
        await p.streetContent.upsert({ where: { streetSlug: slug }, create: { streetSlug: slug, streetName: ent.name, description: `${ent.name} in Milton.`, status: "published", template: "standard", needsReview: false, aiGenerated: true, publishedAt: new Date() }, update: { status: "published", template: "standard", needsReview: false, publishedAt: new Date() } });
        pubStd++;
      } else {
        const desc = `No home resales are recorded on ${ent.name} in the last ~2 years of Milton sales. Area market context, nearby streets, schools, and any active listings are below.`;
        await p.streetContent.upsert({ where: { streetSlug: slug }, create: { streetSlug: slug, streetName: ent.name, neighbourhood: raw, description: desc, status: "published", template: "minimal", needsReview: false, aiGenerated: false, publishedAt: new Date() }, update: { neighbourhood: raw, status: "published", template: "minimal", needsReview: false, publishedAt: new Date() } });
        pubMin++;
      }
      await p.residentialStreet.update({ where: { slug }, data: { hasPublishedPage: true } });
    }
  }
  console.log(`\n${COMMIT ? "[commit] " : "(dry) "}standard=${pubStd} minimal=${pubMin} already=${already} noEntity=${noEnt}`);
  await p.$disconnect(); process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
