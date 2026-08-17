// scripts/reconcile-published-flag.ts
// TEMPORARY, AND ITS EXPIRY IS THE POINT.
//
// ResidentialStreet.hasPublishedPage is a denormalised copy of StreetContent.status that nothing
// maintained: generateStreet.ts publishes a page without touching it. src/lib/streetSurface.ts now
// derives publication instead, so no code reads the flag any more — but the currently DEPLOYED
// build still does, and one Neon instance serves production and every preview. Until that build is
// replaced, the flag is still load-bearing in production, so it gets reconciled once here.
//
// Delete this script together with the column. If it is still in the repo after the DROP, that is
// a bug in the cleanup, not a reason to keep running it.
//
//   npx tsx --tsconfig tsconfig.test.json scripts/reconcile-published-flag.ts          (dry run)
//   npx tsx --tsconfig tsconfig.test.json scripts/reconcile-published-flag.ts --apply
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../.env", "../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }

const APPLY = process.argv.includes("--apply");

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const L = (s = "") => console.log(s);

  const published = new Set(
    (await prisma.streetContent.findMany({ where: { status: "published" }, select: { streetSlug: true } })).map((r) => r.streetSlug),
  );
  const streets = await prisma.residentialStreet.findMany({ select: { id: true, slug: true, hasPublishedPage: true } });

  const shouldBeTrue = streets.filter((s) => !s.hasPublishedPage && published.has(s.slug));
  const shouldBeFalse = streets.filter((s) => s.hasPublishedPage && !published.has(s.slug));

  L("═".repeat(92));
  L(`RECONCILE hasPublishedPage WITH StreetContent   ${APPLY ? "[APPLY]" : "[DRY RUN]"}`);
  L("═".repeat(92));
  L(`    ResidentialStreet rows ................................ ${streets.length}`);
  L(`    published StreetContent rows .......................... ${published.size}`);
  L(`    flag=false but StreetContent IS published ............. ${shouldBeTrue.length}`);
  for (const s of shouldBeTrue) L(`      ${s.slug}`);
  L(`    flag=true but StreetContent is NOT published .......... ${shouldBeFalse.length}`);
  for (const s of shouldBeFalse) L(`      ${s.slug}`);

  if (APPLY) {
    if (shouldBeTrue.length) await prisma.residentialStreet.updateMany({ where: { id: { in: shouldBeTrue.map((s) => s.id) } }, data: { hasPublishedPage: true } });
    if (shouldBeFalse.length) await prisma.residentialStreet.updateMany({ where: { id: { in: shouldBeFalse.map((s) => s.id) } }, data: { hasPublishedPage: false } });
    L();
    L(`    APPLIED: ${shouldBeTrue.length} -> true, ${shouldBeFalse.length} -> false.`);
  } else if (shouldBeTrue.length || shouldBeFalse.length) {
    L();
    L(`    DRY RUN — nothing written. Re-run with --apply.`);
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
