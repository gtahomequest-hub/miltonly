// scripts/backfill-condo-names.ts
// QUEUE item 4. Rewrites the three STORED name columns on CondoContent from condoName.
//
//   buildingName      the resolved name
//   metaTitle         the existing title template, with the resolved name in it
//   metaDescription   the existing description template, SAME VARIANT, resolved name in it
//
// THE PROSE COLUMN IS NOT TOUCHED. `description` is generated text and 57 of 59 rows mention the
// abbreviated form inside sentences; rewriting prose with a string substitution is how a backfill
// starts inventing claims. Those 57 are a regeneration question and they stay open.
//
// THE DESCRIPTION VARIANT IS PRESERVED, NOT RECOMPUTED. generateCondoBuilding writes one of two
// sentences depending on whether the building had an active sale listing at generation time.
// Recomputing that today would silently restate a fact about a different moment, so this detects
// which variant the row already carries and rebuilds THAT one. A row matching neither is left
// alone and reported.
//
// DRY RUN BY DEFAULT. --write is required to touch anything.
import { readFileSync } from "node:fs";
function loadEnvLocal(): void {
  try {
    const raw = readFileSync(".env.local", "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        let v = m[2].replace(/\r$/, "");
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  } catch {}
}
loadEnvLocal();

const WRITE = process.argv.includes("--write");

// The templates, copied from src/lib/ai/hub/generateCondoBuilding.ts. Kept verbatim so a
// backfilled row is byte-identical to a freshly generated one.
const titleOf = (name: string, city: string) => `${name} | ${city} Condo Building Guide`;
const saleDesc = (name: string, city: string) =>
  `${name}, ${city}: the building, its unit mix, fees, and a grounded read on how units trade.`;
const rentDesc = (name: string, city: string) =>
  `${name}, ${city}: the building, its unit mix, fees, and current rental availability.`;

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const { resolveCondoName } = await import("../src/lib/condoName");
  const { config } = await import("../src/lib/config");
  const CITY = config.CITY_NAME;

  const rows = await prisma.condoContent.findMany({
    where: { status: "published" },
    select: { buildingSlug: true, buildingName: true, metaTitle: true, metaDescription: true },
    orderBy: { buildingSlug: "asc" },
  });
  const buildings = await prisma.condoBuilding.findMany({
    select: { slug: true, streetNumber: true, streetSlug: true, buildingAddress: true, displayName: true },
  });
  const bySlug = new Map(buildings.map((b) => [b.slug, b]));

  console.log(`${WRITE ? "WRITE" : "DRY RUN"} — published CondoContent rows: ${rows.length}\n`);

  const changes: Array<{ slug: string; field: string; before: string | null; after: string }> = [];
  const skipped: string[] = [];
  const unmatched: string[] = [];
  let rowsChanged = 0;

  for (const r of rows) {
    const b = bySlug.get(r.buildingSlug);
    if (!b) { skipped.push(`${r.buildingSlug}: no CondoBuilding row`); continue; }
    const resolved = resolveCondoName({
      slug: b.slug,
      streetNumber: b.streetNumber,
      streetSlug: b.streetSlug,
      buildingAddress: b.buildingAddress ?? b.displayName,
    });
    if (resolved.source === "raw") { skipped.push(`${r.buildingSlug}: does not resolve (${resolved.issues.join("; ")})`); continue; }
    const name = resolved.name;

    const next: Record<string, string> = {};
    if (r.buildingName !== name) next.buildingName = name;

    const wantTitle = titleOf(name, CITY);
    if (r.metaTitle !== wantTitle) next.metaTitle = wantTitle;

    // Which description variant does this row already carry?
    const d = r.metaDescription ?? "";
    const isSale = d.endsWith("a grounded read on how units trade.");
    const isRent = d.endsWith("current rental availability.");
    if (isSale || isRent) {
      const wantDesc = isSale ? saleDesc(name, CITY) : rentDesc(name, CITY);
      if (d !== wantDesc) next.metaDescription = wantDesc;
    } else if (d) {
      unmatched.push(`${r.buildingSlug}: metaDescription matches neither template, left alone`);
    }

    const fields = Object.keys(next);
    if (!fields.length) continue;
    rowsChanged++;
    if (next.buildingName) changes.push({ slug: r.buildingSlug, field: "buildingName", before: r.buildingName, after: next.buildingName });
    if (next.metaTitle) changes.push({ slug: r.buildingSlug, field: "metaTitle", before: r.metaTitle, after: next.metaTitle });
    if (next.metaDescription) changes.push({ slug: r.buildingSlug, field: "metaDescription", before: r.metaDescription, after: next.metaDescription });

    if (WRITE) {
      await prisma.condoContent.update({ where: { buildingSlug: r.buildingSlug }, data: next });
    }
  }

  console.log(`rows that would change      ${rowsChanged} of ${rows.length}`);
  console.log(`field values changed        ${changes.length}`);
  for (const f of ["buildingName", "metaTitle", "metaDescription"]) {
    console.log(`  ${f.padEnd(18)}${changes.filter((c) => c.field === f).length}`);
  }
  console.log(`skipped                     ${skipped.length}`);
  for (const s of skipped) console.log(`   ${s}`);
  console.log(`metaDescription off-template ${unmatched.length}`);
  for (const s of unmatched.slice(0, 5)) console.log(`   ${s}`);

  console.log(`\n── 10 before/after samples ──`);
  for (const c of changes.slice(0, 10)) {
    console.log(`\n${c.slug}  [${c.field}]`);
    console.log(`   before  ${JSON.stringify(c.before)}`);
    console.log(`   after   ${JSON.stringify(c.after)}`);
  }

  if (WRITE) {
    // Idempotency, proven rather than asserted: re-read and recompute. A backfill that cannot say
    // "0 on the second run" has not finished, it has just stopped.
    const after = await prisma.condoContent.findMany({
      where: { status: "published" },
      select: { buildingSlug: true, buildingName: true, metaTitle: true, metaDescription: true },
    });
    let still = 0;
    for (const r of after) {
      const b = bySlug.get(r.buildingSlug);
      if (!b) continue;
      const resolved = resolveCondoName({ slug: b.slug, streetNumber: b.streetNumber, streetSlug: b.streetSlug, buildingAddress: b.buildingAddress ?? b.displayName });
      if (resolved.source === "raw") continue;
      const name = resolved.name;
      const d = r.metaDescription ?? "";
      const isSale = d.endsWith("a grounded read on how units trade.");
      const isRent = d.endsWith("current rental availability.");
      const wantDesc = isSale ? saleDesc(name, CITY) : isRent ? rentDesc(name, CITY) : d;
      if (r.buildingName !== name || r.metaTitle !== titleOf(name, CITY) || d !== wantDesc) still++;
    }
    console.log(`\nre-run would change         ${still} rows`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
