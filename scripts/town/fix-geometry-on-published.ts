// scripts/town/fix-geometry-on-published.ts
// A LEAK, AND THE CORRECTION.
//
// The assignment run treated "dormant" as `NOT (recencyWeightedSold > 0 OR hasPublishedPage)` —
// the repo's own SURFACED_STREET_WHERE predicate — and reasoned that a dormant street therefore
// cannot appear on a published page. That reasoning is only as good as `hasPublishedPage`, and
// that column is STALE for some rows: geddes-landing-milton carries hasPublishedPage=false while
// StreetContent.status='published', so it is in the sitemap, it renders, and a geometry
// assignment reached it. It gained its neighbourhood's area context ($1.09M / 106 sales from
// scott) on a live page.
//
// No hub aggregate moved — constraint 2 held. But "do not change a published street page" is its
// own boundary, and geometry crossed it. So the real test of publication is StreetContent, not
// the denormalised flag, and every geometry assignment on a street with a published
// StreetContent row is reverted here.
//
// The stale flag itself is NOT repaired by this script. It is a pre-existing inconsistency with
// its own blast radius (it gates hero search, autocomplete and hub ladders), and fixing it inside
// a pass that promised to change no published page would be the same mistake twice.
//
//   npx tsx --tsconfig tsconfig.test.json scripts/town/fix-geometry-on-published.ts          (dry)
//   npx tsx --tsconfig tsconfig.test.json scripts/town/fix-geometry-on-published.ts --apply
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../../.env", "../../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }

const APPLY = process.argv.includes("--apply");
const pad = (s: unknown, n: number) => String(s).padEnd(n);

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const L = (s = "") => console.log(s);

  const nb = await prisma.neighbourhood.findMany();
  const byId = new Map(nb.map((n) => [n.id, n.slug]));
  const geo = await prisma.residentialStreet.findMany({
    where: { neighbourhoodSource: "town-geometry" },
    select: { id: true, slug: true, neighbourhoodId: true, hasPublishedPage: true, recencyWeightedSold: true },
  });
  const publishedSlugs = new Set(
    (await prisma.streetContent.findMany({ where: { status: "published" }, select: { streetSlug: true } })).map((r) => r.streetSlug),
  );

  const leaked = geo.filter((s) => publishedSlugs.has(s.slug));

  L("═".repeat(96));
  L(`GEOMETRY ASSIGNMENTS THAT REACHED A PUBLISHED PAGE   ${APPLY ? "[APPLY]" : "[DRY RUN]"}`);
  L("═".repeat(96));
  L(`    town-geometry assignments ............................ ${geo.length}`);
  L(`    published StreetContent rows ......................... ${publishedSlugs.size}`);
  L(`    => geometry assignments on a PUBLISHED street ........ ${leaked.length}`);
  L();
  for (const s of leaked) {
    L(`    ${pad(s.slug, 34)} -> ${pad(byId.get(s.neighbourhoodId!) ?? "?", 20)} hasPublishedPage=${pad(s.hasPublishedPage, 6)} rws=${s.recencyWeightedSold}`);
  }
  if (!leaked.length) L(`    (none)`);

  // The wider inconsistency, reported so it is on the record even though this script will not fix it.
  const all = await prisma.residentialStreet.findMany({ select: { slug: true, hasPublishedPage: true } });
  const staleFalse = all.filter((s) => !s.hasPublishedPage && publishedSlugs.has(s.slug));
  const staleTrue = all.filter((s) => s.hasPublishedPage && !publishedSlugs.has(s.slug));
  L();
  L(`    PRE-EXISTING FLAG DRIFT (reported, not repaired here):`);
  L(`      hasPublishedPage=false but StreetContent IS published .. ${staleFalse.length}`);
  for (const s of staleFalse.slice(0, 20)) L(`        ${s.slug}`);
  if (staleFalse.length > 20) L(`        ...(${staleFalse.length - 20} more)`);
  L(`      hasPublishedPage=true but StreetContent is NOT ......... ${staleTrue.length}`);
  for (const s of staleTrue.slice(0, 10)) L(`        ${s.slug}`);
  if (staleTrue.length > 10) L(`        ...(${staleTrue.length - 10} more)`);

  if (APPLY && leaked.length) {
    for (const s of leaked) {
      await prisma.residentialStreet.update({
        where: { id: s.id },
        data: { neighbourhoodId: null, neighbourhoodSource: null },
      });
    }
    L();
    L(`    REVERTED ${leaked.length} geometry assignment(s). Those streets are unassigned again and`);
    L(`    their pages render exactly as they did before this pass.`);
  } else if (leaked.length) {
    L();
    L(`    DRY RUN — nothing written. Re-run with --apply.`);
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
