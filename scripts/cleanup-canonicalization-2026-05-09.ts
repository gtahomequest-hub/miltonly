// Single-transaction cleanup for the 2026-05-09 canonicalization-hole
// fallout. Run once with `--apply` after the structural fix is committed.
//
// Reverses the bad state caused by backfill-descriptions claimRow()'s raw
// INSERT bypassing the canonicalization guard at generateStreetContent —
// 7 abbreviated SG rows were written overnight 2026-05-09, with their
// canonical counterparts left in status=failed (from the 2026-04-23 run).
// Plus 1 legacy stale row (asleton-blvd-milton) where the canonical
// asleton-boulevard-milton has already succeeded + published.
//
// Steps inside one BEGIN/COMMIT:
//   1. DELETE legacy asleton-blvd-milton SG row
//   2. DELETE 6 failed canonical SG rows (gen 2026-04-23)
//   3. INSERT 5 StreetQueue rows for canonical slugs not yet queued
//   4. UPDATE 6 abbreviated SG slugs to canonical form
//
// Excluded from this cleanup: 106-rottenburg-crt-milton — deferred pending
// deriveIdentity building-number-prefix hole fix. Will remain on the
// regression check allow-list until then.

import { readFileSync, writeFileSync } from "node:fs";
function loadEnvLocal(): void {
  try {
    const raw = readFileSync(".env.local", "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        let v = m[2].replace(/\\n$/, "");
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  } catch {}
}
loadEnvLocal();

import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

const ASLETON_LEGACY_DELETE = "asleton-blvd-milton";

const FAILED_CANONICAL_DELETE = [
  "3-side-road-milton",
  "5-side-road-milton",
  "agnew-crescent-milton",
  "abbott-street-milton",
  "aird-court-milton",
  "alexander-crescent-milton",
];

const QUEUE_INSERTS: Array<{ streetSlug: string; streetName: string }> = [
  { streetSlug: "3-side-road-milton",         streetName: "3 Side Road" },
  { streetSlug: "5-side-road-milton",         streetName: "5 Side Road" },
  { streetSlug: "agnew-crescent-milton",      streetName: "Agnew Crescent" },
  { streetSlug: "abbott-street-milton",       streetName: "Abbott Street" },
  { streetSlug: "alexander-crescent-milton",  streetName: "Alexander Crescent" },
];

const RENAMES: Array<{ from: string; to: string }> = [
  { from: "3-side-rd-milton",       to: "3-side-road-milton" },
  { from: "5-side-rd-milton",       to: "5-side-road-milton" },
  { from: "agnew-cres-milton",      to: "agnew-crescent-milton" },
  { from: "abbott-st-milton",       to: "abbott-street-milton" },
  { from: "aird-crt-milton",        to: "aird-court-milton" },
  { from: "alexander-cres-milton",  to: "alexander-crescent-milton" },
];

async function snapshot(): Promise<unknown> {
  const allTouchedSlugs = [
    ASLETON_LEGACY_DELETE,
    ...FAILED_CANONICAL_DELETE,
    ...QUEUE_INSERTS.map(q => q.streetSlug),
    ...RENAMES.flatMap(r => [r.from, r.to]),
  ];
  const sg = await prisma.streetGeneration.findMany({ where: { streetSlug: { in: allTouchedSlugs } } });
  const sq = await prisma.streetQueue.findMany({ where: { streetSlug: { in: allTouchedSlugs } } });
  const sc = await prisma.streetContent.findMany({ where: { streetSlug: { in: allTouchedSlugs } } });
  return { capturedAt: new Date().toISOString(), streetGeneration: sg, streetQueue: sq, streetContent: sc };
}

async function main(): Promise<void> {
  console.log(APPLY ? "==== APPLY MODE ====" : "==== DRY-RUN (use --apply to execute) ====");

  const before = await snapshot();
  if (APPLY) {
    const path = `experiment-output/cleanup-canonicalization-2026-05-09-pre-apply-${Date.now()}.json`;
    writeFileSync(path, JSON.stringify(before, null, 2));
    console.log(`Pre-apply backup: ${path}`);
  }

  // Sanity gates — refuse to run if state doesn't match the plan
  for (const slug of FAILED_CANONICAL_DELETE) {
    const r = await prisma.streetGeneration.findUnique({ where: { streetSlug: slug } });
    if (!r) {
      console.error(`ABORT: expected failed canonical row not present: ${slug}`);
      process.exit(1);
    }
    if (r.status !== "failed") {
      console.error(`ABORT: ${slug} is ${r.status}, expected failed`);
      process.exit(1);
    }
  }
  for (const { from, to } of RENAMES) {
    const fromRow = await prisma.streetGeneration.findUnique({ where: { streetSlug: from } });
    if (!fromRow) {
      console.error(`ABORT: expected abbreviated row not present: ${from}`);
      process.exit(1);
    }
    if (fromRow.status !== "succeeded") {
      console.error(`ABORT: ${from} is ${fromRow.status}, expected succeeded`);
      process.exit(1);
    }
  }
  const asletonLegacy = await prisma.streetGeneration.findUnique({ where: { streetSlug: ASLETON_LEGACY_DELETE } });
  if (!asletonLegacy) {
    console.error(`ABORT: expected legacy row not present: ${ASLETON_LEGACY_DELETE}`);
    process.exit(1);
  }
  console.log("Sanity gates passed.");

  if (!APPLY) {
    console.log("\nWould execute (in single transaction):");
    console.log(`  DELETE SG WHERE streetSlug = '${ASLETON_LEGACY_DELETE}'`);
    console.log(`  DELETE SG WHERE streetSlug IN (${FAILED_CANONICAL_DELETE.length} rows)`);
    console.log(`  INSERT INTO StreetQueue (${QUEUE_INSERTS.length} rows, status=pending)`);
    console.log(`  UPDATE SG SET streetSlug = canonical (${RENAMES.length} renames)`);
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.streetGeneration.delete({ where: { streetSlug: ASLETON_LEGACY_DELETE } });
    await tx.streetGeneration.deleteMany({ where: { streetSlug: { in: FAILED_CANONICAL_DELETE } } });
    await tx.streetQueue.createMany({
      data: QUEUE_INSERTS.map(({ streetSlug, streetName }) => ({
        streetSlug,
        streetName,
        status: "pending",
      })),
    });
    for (const { from, to } of RENAMES) {
      await tx.streetGeneration.update({
        where: { streetSlug: from },
        data: { streetSlug: to },
      });
    }
  });

  console.log("\n[OK] Transaction committed.");
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
