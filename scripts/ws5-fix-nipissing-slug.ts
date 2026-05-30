// WS5 — heal the malformed published slug "nipissing-rd-milton-road-milton".
//
// Defect: a DUPLICATE generation/content row for Nipissing Road carries a
// malformed slug (raw MLS street name "Nipissing Rd Milton" + suffix "Road" +
// city "Milton" slugified to nipissing-rd-milton-road-milton, with the
// abbreviation "rd" separated from the full-form "road" by an embedded "milton"
// token). deriveIdentity() does NOT heal this shape (the doubled-suffix collapse
// only fires on ADJACENT abbrev+fullform), so the write-time canonicalization
// guard re-emits it unchanged. It reddens the prebuild canonicalization gate.
//
// Unlike WS4-1B/huffman (which RENAMED because no clean row existed), here the
// clean canonical row ALREADY EXISTS:
//   - ResidentialStreet.slug = "nipissing-road-milton" (the WS3 entity slug)
//   - StreetGeneration["nipissing-road-milton"] = succeeded (1003 words, 8 FAQ)
//   - StreetContent["nipissing-road-milton"]    = published
// A rename to that slug would COLLIDE on @id/@unique. The malformed row is a
// duplicate of the SAME street whose body is NOT richer than the survivor
// (970 words / 7 FAQ vs the survivor's 1003 / 8; market data equivalent, both
// totalSold12mo=0). So the heal REMOVES the malformed duplicate and keeps the
// canonical clean row (restoring the WS3 invariant slug == street_slug for this
// street). No redirect: the malformed URL is never indexed (WS6/Search Console
// not submitted; ADR-0001 DEC-6 does not bind a never-indexed URL).
//
// Guards (fail-loud, no write unless ALL hold). Removal is a single atomic
// prisma.$transaction so there is never a partial half-fix.
//
// Connectivity (per WS4-1B note): the shared pooled client connects reliably in
// this environment; the atomic two/three-statement $transaction is pooling-safe.

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
import type { Prisma } from "@prisma/client";

const MALFORMED = "nipissing-rd-milton-road-milton";
const CLEAN = "nipissing-road-milton";

async function main() {
  console.log("=".repeat(72));
  console.log("WS5 — remove malformed duplicate", MALFORMED);
  console.log("keep canonical survivor", CLEAN, "(== ResidentialStreet.slug)");
  console.log("=".repeat(72));

  try {
    // ── PRE guards ──────────────────────────────────────────────────────
    const scMal = await prisma.streetContent.count({ where: { streetSlug: MALFORMED } });
    const sgMal = await prisma.streetGeneration.count({ where: { streetSlug: MALFORMED } });
    const rsMal = await prisma.residentialStreet.count({ where: { slug: MALFORMED } });
    const sgrMal = await prisma.streetGenerationReview.count({ where: { streetSlug: MALFORMED } });
    const scClean = await prisma.streetContent.count({ where: { streetSlug: CLEAN } });
    const sgClean = await prisma.streetGeneration.count({ where: { streetSlug: CLEAN } });
    const rsClean = await prisma.residentialStreet.count({ where: { slug: CLEAN } });

    console.log("\nPRE-STATE:");
    console.log(`  StreetContent[${MALFORMED}]        = ${scMal}  (expect 1)`);
    console.log(`  StreetGeneration[${MALFORMED}]     = ${sgMal}  (expect 1)`);
    console.log(`  StreetGenerationReview[${MALFORMED}]= ${sgrMal} (expect 0; removed in tx if >0)`);
    console.log(`  ResidentialStreet[${MALFORMED}]    = ${rsMal}  (expect 0 — entity already clean)`);
    console.log(`  StreetContent[${CLEAN}]            = ${scClean} (survivor, expect 1)`);
    console.log(`  StreetGeneration[${CLEAN}]         = ${sgClean} (survivor, expect 1)`);
    console.log(`  ResidentialStreet[${CLEAN}]        = ${rsClean} (survivor entity, expect 1)`);

    if (scMal !== 1) throw new Error(`expected exactly 1 StreetContent[${MALFORMED}], got ${scMal}`);
    if (sgMal !== 1) throw new Error(`expected exactly 1 StreetGeneration[${MALFORMED}], got ${sgMal}`);
    if (rsMal !== 0) throw new Error(`unexpected ResidentialStreet[${MALFORMED}] = ${rsMal} (entity should be clean-only)`);
    if (scClean !== 1) throw new Error(`survivor StreetContent[${CLEAN}] must be exactly 1, got ${scClean}`);
    if (sgClean !== 1) throw new Error(`survivor StreetGeneration[${CLEAN}] must be exactly 1, got ${sgClean}`);
    if (rsClean !== 1) throw new Error(`survivor ResidentialStreet[${CLEAN}] entity must be exactly 1, got ${rsClean}`);

    // ── Atomic removal across content tables (+ review row if present) ───
    const ops: Prisma.PrismaPromise<unknown>[] = [
      prisma.streetContent.delete({ where: { streetSlug: MALFORMED } }),
      prisma.streetGeneration.delete({ where: { streetSlug: MALFORMED } }),
    ];
    if (sgrMal > 0) ops.push(prisma.streetGenerationReview.delete({ where: { streetSlug: MALFORMED } }));

    await prisma.$transaction(ops);
    console.log(`\nREMOVED (single transaction): StreetContent + StreetGeneration${sgrMal > 0 ? " + StreetGenerationReview" : ""} rows for ${MALFORMED}.`);

    // ── POST guards ─────────────────────────────────────────────────────
    const scMalAfter = await prisma.streetContent.count({ where: { streetSlug: MALFORMED } });
    const sgMalAfter = await prisma.streetGeneration.count({ where: { streetSlug: MALFORMED } });
    const sgrMalAfter = await prisma.streetGenerationReview.count({ where: { streetSlug: MALFORMED } });
    const scCleanAfter = await prisma.streetContent.count({ where: { streetSlug: CLEAN } });
    const sgCleanAfter = await prisma.streetGeneration.count({ where: { streetSlug: CLEAN } });

    console.log("\nPOST-STATE:");
    console.log(`  StreetContent[${MALFORMED}]        = ${scMalAfter}  (expect 0)`);
    console.log(`  StreetGeneration[${MALFORMED}]     = ${sgMalAfter}  (expect 0)`);
    console.log(`  StreetGenerationReview[${MALFORMED}]= ${sgrMalAfter} (expect 0)`);
    console.log(`  StreetContent[${CLEAN}] survivor    = ${scCleanAfter} (expect 1)`);
    console.log(`  StreetGeneration[${CLEAN}] survivor = ${sgCleanAfter} (expect 1)`);

    // POST: the canonicalization-gate invariant — StreetGeneration abbreviated
    // tokens must equal exactly the ALLOW_LIST (only 106-rottenburg-crt-milton).
    const { SUFFIX_PAIRS } = await import("@/lib/slugMalformedDetection");
    const SHORT = new Set(SUFFIX_PAIRS.map(([a]) => a));
    const allSg = await prisma.streetGeneration.findMany({ select: { streetSlug: true } });
    const abbrevLeft = allSg
      .map((r) => r.streetSlug)
      .filter((s) => s.split("-").some((t) => SHORT.has(t.toLowerCase())))
      .sort();
    const ALLOW_LIST = ["106-rottenburg-crt-milton"];
    const unexpected = abbrevLeft.filter((s) => !ALLOW_LIST.includes(s));
    console.log(`\n  StreetGeneration abbreviated-token slugs remaining: [${abbrevLeft.join(", ")}]`);
    console.log(`  unexpected (not on ALLOW_LIST): [${unexpected.join(", ")}]  (expect none)`);

    const ok =
      scMalAfter === 0 && sgMalAfter === 0 && sgrMalAfter === 0 &&
      scCleanAfter === 1 && sgCleanAfter === 1 && unexpected.length === 0;
    console.log(`\n=== RESULT: ${ok ? "PASS ✓ — malformed duplicate removed; survivor intact; gate invariant holds" : "FAIL ✗"} ===`);
    await prisma.$disconnect();
    process.exit(ok ? 0 : 1);
  } catch (e) {
    console.error("\nFAILED (no partial write — transaction is atomic):", (e as Error).message);
    await prisma.$disconnect();
    process.exit(2);
  }
}
main();
