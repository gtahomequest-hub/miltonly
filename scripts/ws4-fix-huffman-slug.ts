// WS4 patch 1B — fix the malformed published slug "huffman-cres-crescent-milton".
//
// Root cause: raw MLS concatenated StreetName ("Huffman Cres") + StreetSuffix
// ("Crescent") without de-duplication, slugifying to a doubled abbrev+fullform
// suffix ("huffman-cres-crescent-milton"). The write-time canonicalization guard
// (deriveIdentity().canonicalSlug in generateStreetContent) failed to collapse it
// because deriveIdentity stripped only the trailing full-form token and left the
// abbreviation "cres" stuck in the base, re-emitting the malformed slug unchanged.
// isMalformedSlug also misses it (its doubled-pair branch requires a trailing
// numeric). The recurrence fix is the doubled-suffix collapse added to
// deriveIdentity in this patch; THIS script fixes the one existing data row.
//
// The clean entity already exists: ResidentialStreet.slug = "huffman-crescent-milton"
// (name "Huffman Cres"). The content tables violate the WS3 invariant
// ResidentialStreet.slug == street_slug. This is a RENAME (no clean content row
// exists yet), not a dedupe. WS6/Search Console not submitted → the malformed URL
// has zero organic equity → no redirect needed (ADR-0001 DEC-6 does not bind a
// never-indexed malformed URL).
//
// Guards (fail-loud, no write unless all hold):
//   - exactly 1 StreetContent + 1 StreetGeneration row with the malformed slug
//   - the clean target slug does NOT already exist in either table (no collision)
//   - post: 0 malformed, 1 clean, each side
//
// Connectivity note: the ADR-0002 addendum recommends the UNPOOLED DB1 endpoint.
// In THIS environment the unpooled host is unreachable (P1001) while the POOLED
// endpoint (pgbouncer=true) connects reliably — the inverse of the addendum's
// assumption, and consistent with the ADR-0001 "Prisma engine reaches one
// endpoint but not the other" note. We therefore use the shared pooled client,
// which is the connection every other script in this repo uses successfully.
// The rename is a two-statement $transaction (atomic) so pooling is safe.

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

const MALFORMED = "huffman-cres-crescent-milton";
const CLEAN = "huffman-crescent-milton";

async function main() {
  console.log("=".repeat(70));
  console.log("WS4 patch 1B — rename", MALFORMED, "→", CLEAN);
  console.log("=".repeat(70));

  try {
    // ── PRE guards ──────────────────────────────────────────────────────
    const scMalformed = await prisma.streetContent.count({ where: { streetSlug: MALFORMED } });
    const sgMalformed = await prisma.streetGeneration.count({ where: { streetSlug: MALFORMED } });
    const scClean = await prisma.streetContent.count({ where: { streetSlug: CLEAN } });
    const sgClean = await prisma.streetGeneration.count({ where: { streetSlug: CLEAN } });
    const entity = await prisma.residentialStreet.findUnique({ where: { slug: CLEAN }, select: { slug: true, name: true } });

    console.log("\nPRE-STATE:");
    console.log(`  StreetContent[${MALFORMED}]      = ${scMalformed}`);
    console.log(`  StreetGeneration[${MALFORMED}]   = ${sgMalformed}`);
    console.log(`  StreetContent[${CLEAN}]          = ${scClean} (collision target)`);
    console.log(`  StreetGeneration[${CLEAN}]       = ${sgClean} (collision target)`);
    console.log(`  ResidentialStreet[${CLEAN}]      = ${entity ? `present (name="${entity.name}")` : "MISSING"}`);

    if (scMalformed !== 1) throw new Error(`expected exactly 1 StreetContent[${MALFORMED}], got ${scMalformed}`);
    if (sgMalformed !== 1) throw new Error(`expected exactly 1 StreetGeneration[${MALFORMED}], got ${sgMalformed}`);
    if (scClean !== 0) throw new Error(`collision: StreetContent[${CLEAN}] already exists (${scClean})`);
    if (sgClean !== 0) throw new Error(`collision: StreetGeneration[${CLEAN}] already exists (${sgClean})`);
    if (!entity) throw new Error(`ResidentialStreet[${CLEAN}] entity missing — rename target unverified`);

    // ── Rename in a single transaction across BOTH content tables ───────
    const [sc, sg] = await prisma.$transaction([
      prisma.streetContent.update({ where: { streetSlug: MALFORMED }, data: { streetSlug: CLEAN } }),
      prisma.streetGeneration.update({ where: { streetSlug: MALFORMED }, data: { streetSlug: CLEAN } }),
    ]);
    console.log("\nRENAMED (single transaction):");
    console.log(`  StreetContent.streetSlug    → ${sc.streetSlug} (status=${sc.status})`);
    console.log(`  StreetGeneration.streetSlug → ${sg.streetSlug} (status=${sg.status})`);

    // ── POST guards ─────────────────────────────────────────────────────
    const scMalAfter = await prisma.streetContent.count({ where: { streetSlug: MALFORMED } });
    const sgMalAfter = await prisma.streetGeneration.count({ where: { streetSlug: MALFORMED } });
    const scCleanAfter = await prisma.streetContent.count({ where: { streetSlug: CLEAN } });
    const sgCleanAfter = await prisma.streetGeneration.count({ where: { streetSlug: CLEAN } });

    console.log("\nPOST-STATE:");
    console.log(`  StreetContent[${MALFORMED}]      = ${scMalAfter} (expect 0)`);
    console.log(`  StreetGeneration[${MALFORMED}]   = ${sgMalAfter} (expect 0)`);
    console.log(`  StreetContent[${CLEAN}]          = ${scCleanAfter} (expect 1)`);
    console.log(`  StreetGeneration[${CLEAN}]       = ${sgCleanAfter} (expect 1)`);

    const ok = scMalAfter === 0 && sgMalAfter === 0 && scCleanAfter === 1 && sgCleanAfter === 1;
    console.log(`\n=== RESULT: ${ok ? "PASS ✓ — WS3 invariant restored (ResidentialStreet.slug == street_slug)" : "FAIL ✗"} ===`);
    await prisma.$disconnect();
    process.exit(ok ? 0 : 1);
  } catch (e) {
    console.error("\nFAILED (no partial write — transaction is atomic):", (e as Error).message);
    await prisma.$disconnect();
    process.exit(2);
  }
}
main();
