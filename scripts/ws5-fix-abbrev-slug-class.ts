// WS5 — heal the class-A abbreviated-token ResidentialStreet rows (scoped).
//
// Diagnosed in ws5-derive-identity-fix. The 56 abbreviated-token RS rows are
// heterogeneous; this script touches ONLY the 18 class-A rows with a well-defined
// clean target, in three per-row shapes. It NEVER touches:
//   - the 36 class-C unit-descriptor rows (a different defect),
//   - savoline-blvd-avenue (dirty target: blvd+ave) and asleton-blvd-boulevard-140
//     (target still carries the "140" unit number) — both HELD for a human call.
//
// Every operation is a single atomic prisma.$transaction guarded by per-row PRE
// guards (fail-loud) and verified by POST guards. A row whose PRE guard does not
// match the diagnosis is SKIPPED and reported — never forced. Mirrors the
// discipline of scripts/ws5-fix-nipissing-slug.ts.
//
// Three shapes:
//   REMOVE-DUP (13): the clean RS sibling already exists in the SAME neighbourhood
//     and the malformed RS row carries no content (SC=0,SG=0). Remove the malformed
//     RS row; the clean sibling (which holds the content) survives and de-dups the
//     hub road list.
//   MERGE (2): the clean RS sibling exists but is mis-/un-assigned, while the
//     malformed row carries the live neighbourhood assignment + currentRank.
//     Reassign the clean sibling's neighbourhoodId + currentRank FROM the malformed
//     row, then remove the malformed row. (country-ln-court: clean sibling is
//     unassigned but has published StreetContent → moffat keeps its rank-1 road,
//     now pointing at a real page. 20-side-rd-road: clean sibling is in a different
//     hub, neither side has content.)
//   RENAME (3): no clean sibling exists anywhere → rename the malformed RS.slug to
//     the clean target (from the name field; C2 base-expansion is deferred so the
//     canonicalizer does not produce these, hence explicit targets).

import { readFileSync } from "node:fs";
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
  } catch { /* ignore */ }
}
loadEnvLocal();

import { prisma } from "@/lib/prisma";

// ── op tables (locked scope) ────────────────────────────────────────────────
const REMOVE_DUP: Array<[string, string]> = [
  ["bessy-trl-trail-milton", "bessy-trail-milton"],
  ["celandine-terr-terrace-milton", "celandine-terrace-milton"],
  ["chretien-st-street-milton", "chretien-street-milton"],
  ["english-mill-crt-court-milton", "english-mill-court-milton"],
  ["hickory-cres-crescent-milton", "hickory-crescent-milton"],
  ["holmes-cres-crescent-milton", "holmes-crescent-milton"],
  ["mccandless-crt-court-milton", "mccandless-court-milton"],
  ["mockridge-terr-terrace-milton", "mockridge-terrace-milton"],
  ["ontario-st-street-milton", "ontario-street-milton"],
  ["rothbury-cres-crescent-milton", "rothbury-crescent-milton"],
  ["stirling-todd-ter-terrace-milton", "stirling-todd-terrace-milton"],
  ["tasker-crt-court-milton", "tasker-court-milton"],
  ["thornborrow-crt-court-milton", "thornborrow-court-milton"],
];

// The two MERGE rows are NOT the same risk:
//   - country-ln-court: the clean sibling is UNASSIGNED (neighbourhoodId NULL) and
//     already has published StreetContent → we FILL the null with moffat + rank.
//     cleanNbhdMustBeNull guards that we never overwrite a real assignment.
//   - 20-side-rd-road: the clean sibling 20-side-road currently lives in a
//     DIFFERENT hub (e49d63e6). Reassigning it to ac56a421 MOVES a road between
//     hubs — heavier, and possibly wrong if it legitimately belongs in e49d63e6.
//     HELD by default (hold:true → skipped + reported) pending explicit approval.
//     cleanNbhdExpectedPrefix records the current hub so the PRE state is captured.
const MERGE: Array<{
  malformed: string;
  clean: string;
  expectedMalNbhdPrefix: string;      // malformed must still carry this assignment (else data drift → skip)
  cleanNbhdMustBeNull: boolean;       // true → clean sibling must be UNASSIGNED (fill-null, safe)
  cleanNbhdExpectedPrefix?: string;   // cross-hub move → assert clean's current hub before moving it
  hold?: boolean;                     // true → SKIP, awaiting explicit per-row human approval
}> = [
  { malformed: "country-ln-court-milton", clean: "country-lane-court-milton", expectedMalNbhdPrefix: "e16d463f", cleanNbhdMustBeNull: true }, // fill-null → moffat
  { malformed: "20-side-rd-road-milton", clean: "20-side-road-milton", expectedMalNbhdPrefix: "ac56a421", cleanNbhdMustBeNull: false, cleanNbhdExpectedPrefix: "e49d63e6", hold: true }, // CROSS-HUB MOVE — HELD
];

const RENAME: Array<[string, string]> = [
  ["milton-hts-crescent-milton", "milton-heights-crescent-milton"],
  ["crt-street-milton", "court-street-south-milton"],
  ["carr-landing-dr-milton-milton", "carr-landing-drive-milton"],
];

const rsCount = (slug: string) => prisma.residentialStreet.count({ where: { slug } });
const scCount = (slug: string) => prisma.streetContent.count({ where: { streetSlug: slug } });
const sgCount = (slug: string) => prisma.streetGeneration.count({ where: { streetSlug: slug } });

let done = 0;
const skipped: string[] = []; // PRE-guard failures — unexpected, investigate
const held: string[] = []; // intentionally HELD rows (e.g. the 20-side cross-hub move)

async function removeDup(malformed: string, clean: string): Promise<void> {
  console.log(`\n[REMOVE-DUP] ${malformed} → keep ${clean}`);
  const [rsM, scM, sgM, rsC] = await Promise.all([rsCount(malformed), scCount(malformed), sgCount(malformed), rsCount(clean)]);
  const mRow = await prisma.residentialStreet.findUnique({ where: { slug: malformed }, select: { neighbourhoodId: true, currentRank: true } });
  const cRow = await prisma.residentialStreet.findUnique({ where: { slug: clean }, select: { neighbourhoodId: true } });
  console.log(`  PRE: RS[mal]=${rsM} SC[mal]=${scM} SG[mal]=${sgM} | RS[clean]=${rsC} | mal.nbhd=${mRow?.neighbourhoodId?.slice(0,8)} clean.nbhd=${cRow?.neighbourhoodId?.slice(0,8)} | mal.rank=${mRow?.currentRank}`);
  if (rsM !== 1) return skip(malformed, `RS[malformed] expected 1, got ${rsM}`);
  if (scM !== 0) return skip(malformed, `SC[malformed] expected 0, got ${scM} (malformed has content — do not force)`);
  if (sgM !== 0) return skip(malformed, `SG[malformed] expected 0, got ${sgM} (malformed has content — do not force)`);
  if (rsC !== 1) return skip(malformed, `RS[clean sibling] expected 1, got ${rsC} (sibling absent — do not force)`);
  if (!mRow?.neighbourhoodId || !cRow?.neighbourhoodId || mRow.neighbourhoodId !== cRow.neighbourhoodId)
    return skip(malformed, `neighbourhood mismatch (mal=${mRow?.neighbourhoodId?.slice(0,8)} clean=${cRow?.neighbourhoodId?.slice(0,8)}) — not a same-nbhd remove-dup`);

  await prisma.$transaction([prisma.residentialStreet.delete({ where: { slug: malformed } })]);

  const [rsMa, rsCa] = await Promise.all([rsCount(malformed), rsCount(clean)]);
  console.log(`  POST: RS[mal]=${rsMa} (expect 0) | RS[clean]=${rsCa} (expect 1)`);
  if (rsMa !== 0 || rsCa !== 1) throw new Error(`POST guard failed for ${malformed}`);
  console.log(`  ✓ removed malformed; survivor ${clean} intact`);
  done++;
}

async function merge(entry: typeof MERGE[number]): Promise<void> {
  const { malformed, clean, expectedMalNbhdPrefix, cleanNbhdMustBeNull, cleanNbhdExpectedPrefix, hold } = entry;
  console.log(`\n[MERGE] ${malformed} → ${clean}${hold ? "  (HELD pending review)" : ""}`);
  if (hold) {
    console.log(`  ⏸ HELD ${malformed}: CROSS-HUB MOVE (clean sibling currently in a different hub, not a null-fill) — awaiting explicit per-row approval`);
    held.push(malformed);
    return;
  }
  const [rsM, scM, sgM, rsC, scC] = await Promise.all([rsCount(malformed), scCount(malformed), sgCount(malformed), rsCount(clean), scCount(clean)]);
  const mRow = await prisma.residentialStreet.findUnique({ where: { slug: malformed }, select: { neighbourhoodId: true, currentRank: true } });
  const cBefore = await prisma.residentialStreet.findUnique({ where: { slug: clean }, select: { neighbourhoodId: true, currentRank: true } });
  console.log(`  PRE: RS[mal]=${rsM} SC[mal]=${scM} SG[mal]=${sgM} | RS[clean]=${rsC} SC[clean]=${scC} | mal.nbhd=${mRow?.neighbourhoodId?.slice(0,8)} mal.rank=${mRow?.currentRank} | clean.nbhd=${cBefore?.neighbourhoodId?.slice(0,8) ?? "NULL"} clean.rank=${cBefore?.currentRank}`);
  if (rsM !== 1) return skip(malformed, `RS[malformed] expected 1, got ${rsM}`);
  if (scM !== 0) return skip(malformed, `SC[malformed] expected 0, got ${scM}`);
  if (sgM !== 0) return skip(malformed, `SG[malformed] expected 0, got ${sgM}`);
  if (rsC !== 1) return skip(malformed, `RS[clean sibling] expected 1, got ${rsC} (sibling absent — do not force)`);
  if (!mRow?.neighbourhoodId) return skip(malformed, `malformed has null neighbourhoodId — nothing to carry`);
  if (!mRow.neighbourhoodId.startsWith(expectedMalNbhdPrefix))
    return skip(malformed, `malformed nbhd ${mRow.neighbourhoodId.slice(0,8)} != expected ${expectedMalNbhdPrefix} (data changed since diagnosis)`);
  // FILL-NULL guard: refuse to overwrite a real assignment on the clean sibling.
  if (cleanNbhdMustBeNull && cBefore?.neighbourhoodId != null)
    return skip(malformed, `clean sibling ${clean} is already assigned (nbhd=${cBefore?.neighbourhoodId?.slice(0,8)}) but cleanNbhdMustBeNull — refuse to overwrite a real assignment`);
  // CROSS-HUB guard (only reached if hold were false): assert clean's current hub matches the captured state.
  if (cleanNbhdExpectedPrefix && !(cBefore?.neighbourhoodId ?? "").startsWith(cleanNbhdExpectedPrefix))
    return skip(malformed, `clean sibling nbhd ${cBefore?.neighbourhoodId?.slice(0,8) ?? "NULL"} != expected current ${cleanNbhdExpectedPrefix} (state changed)`);

  await prisma.$transaction([
    prisma.residentialStreet.update({ where: { slug: clean }, data: { neighbourhoodId: mRow.neighbourhoodId, currentRank: mRow.currentRank } }),
    prisma.residentialStreet.delete({ where: { slug: malformed } }),
  ]);

  const rsMa = await rsCount(malformed);
  const cAfter = await prisma.residentialStreet.findUnique({ where: { slug: clean }, select: { neighbourhoodId: true, currentRank: true } });
  console.log(`  POST: RS[mal]=${rsMa} (expect 0) | clean.nbhd=${cAfter?.neighbourhoodId?.slice(0,8)} (expect ${mRow.neighbourhoodId.slice(0,8)}) clean.rank=${cAfter?.currentRank} (expect ${mRow.currentRank})`);
  if (rsMa !== 0 || cAfter?.neighbourhoodId !== mRow.neighbourhoodId || cAfter?.currentRank !== mRow.currentRank)
    throw new Error(`POST guard failed for merge ${malformed}`);
  console.log(`  ✓ merged: ${clean} reassigned to ${mRow.neighbourhoodId.slice(0,8)} rank ${mRow.currentRank}; malformed removed`);
  done++;
}

async function rename(malformed: string, clean: string): Promise<void> {
  console.log(`\n[RENAME] ${malformed} → ${clean}`);
  const [rsM, scM, sgM, rsC, scC, sgC] = await Promise.all([rsCount(malformed), scCount(malformed), sgCount(malformed), rsCount(clean), scCount(clean), sgCount(clean)]);
  console.log(`  PRE: RS[mal]=${rsM} SC[mal]=${scM} SG[mal]=${sgM} | RS[clean]=${rsC} SC[clean]=${scC} SG[clean]=${sgC} (clean expect all 0 — no collision)`);
  if (rsM !== 1) return skip(malformed, `RS[malformed] expected 1, got ${rsM}`);
  if (scM !== 0) return skip(malformed, `SC[malformed] expected 0, got ${scM}`);
  if (sgM !== 0) return skip(malformed, `SG[malformed] expected 0, got ${sgM}`);
  if (rsC !== 0 || scC !== 0 || sgC !== 0) return skip(malformed, `clean target ${clean} already exists (RS=${rsC} SC=${scC} SG=${sgC}) — would collide, do not force`);

  await prisma.$transaction([prisma.residentialStreet.update({ where: { slug: malformed }, data: { slug: clean } })]);

  const [rsMa, rsCa] = await Promise.all([rsCount(malformed), rsCount(clean)]);
  console.log(`  POST: RS[mal]=${rsMa} (expect 0) | RS[clean]=${rsCa} (expect 1)`);
  if (rsMa !== 0 || rsCa !== 1) throw new Error(`POST guard failed for rename ${malformed}`);
  console.log(`  ✓ renamed ${malformed} → ${clean}`);
  done++;
}

function skip(slug: string, reason: string): void {
  console.log(`  ⚠ SKIPPED ${slug}: ${reason}`);
  skipped.push(`${slug}: ${reason}`);
}

async function main(): Promise<void> {
  console.log("=".repeat(76));
  console.log("WS5 — abbreviated-slug class-A heal (13 remove-dup + 2 merge + 3 rename)");
  console.log("HOLD: savoline-blvd-avenue, asleton-blvd-boulevard-140 | NEVER TOUCH: 36 class-C");
  console.log("=".repeat(76));
  try {
    for (const [m, c] of REMOVE_DUP) await removeDup(m, c);
    for (const x of MERGE) await merge(x);
    for (const [m, c] of RENAME) await rename(m, c);
  } catch (e) {
    console.error("\nFATAL (POST guard or unexpected error — atomic tx leaves no partial row):", (e as Error).message);
    await prisma.$disconnect();
    process.exit(2);
  }
  console.log("\n" + "=".repeat(76));
  console.log(`DONE: ${done} healed | HELD: ${held.length} | SKIPPED(guard-fail): ${skipped.length}`);
  for (const h of held) console.log(`  ⏸ held: ${h}`);
  for (const s of skipped) console.log(`  ⚠ skipped: ${s}`);
  console.log("=".repeat(76));
  await prisma.$disconnect();
  // Success = no unexpected guard failures, and everything not held was healed.
  const expectedHealed = 18 - held.length;
  process.exit(skipped.length === 0 && done === expectedHealed ? 0 : 1);
}
main();
