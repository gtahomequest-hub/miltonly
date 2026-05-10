// Canonicalization regression check. Wired into prebuild via package.json so
// every Vercel build (and every local `npm run build`) fails when an
// abbreviated-form streetSlug shows up in StreetGeneration outside the
// known-deferred allow-list.
//
// History: on 2026-05-09 the backfill-descriptions claimRow() raw INSERT
// bypassed the canonicalization guard at generateStreetContent and produced
// 7 abbreviated SG rows in a single overnight run. The structural fix lives
// in scripts/backfill-descriptions.ts (deriveIdentity guard at top of
// processOne) + the slugMalformedDetection extraction. This check is the
// belt-and-suspenders runtime guard.
//
// Allow-list of intentionally-deferred abbreviated streetSlugs.
// ONE entry expected: 106-rottenburg-crt-milton (deferred pending deriveIdentity
// building-number-prefix hole fix — see Notion: deriveIdentity + rottenburg
// cleanup). When that work ships and the SG row is renamed, this test will
// fail with a "remove from allow-list" message — that's the correct pressure
// to keep this list current.

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
  } catch {}
}
loadEnvLocal();

import { prisma } from "@/lib/prisma";
import { SUFFIX_PAIRS } from "@/lib/slugMalformedDetection";

const ALLOW_LIST: readonly string[] = ["106-rottenburg-crt-milton"];

const SHORT_FORMS = new Set(SUFFIX_PAIRS.map(([abbr]) => abbr));

function hasAbbreviatedToken(slug: string): boolean {
  for (const tok of slug.split("-")) {
    if (SHORT_FORMS.has(tok.toLowerCase())) return true;
  }
  return false;
}

async function main(): Promise<void> {
  const rows = await prisma.streetGeneration.findMany({ select: { streetSlug: true } });
  const found = rows
    .map((r) => r.streetSlug)
    .filter(hasAbbreviatedToken)
    .sort();

  const allowed = new Set(ALLOW_LIST);
  const unexpected = found.filter((s) => !allowed.has(s));
  const missingFromAllowList = ALLOW_LIST.filter((s) => !found.includes(s));

  if (unexpected.length > 0) {
    console.error("[canonicalization-regression] FAIL — abbreviated streetSlug regression detected:");
    for (const s of unexpected) console.error(`  - ${s}`);
    console.error(
      "These slugs contain a SUFFIX_PAIRS short form (blvd/cres/rd/st/crt/etc.) but are " +
      "not on the deferred allow-list. They likely escaped the canonicalization guard.",
    );
    process.exit(1);
  }

  if (missingFromAllowList.length > 0) {
    console.error("[canonicalization-regression] FAIL — allow-list is stale:");
    for (const s of missingFromAllowList) console.error(`  - ${s} (not present in StreetGeneration)`);
    console.error(
      "Rottenburg cleanup appears to have shipped — remove these entries from ALLOW_LIST " +
      "in scripts/test-canonicalization-regression.ts to re-tighten the regression check.",
    );
    process.exit(1);
  }

  console.log(`[canonicalization-regression] PASS — ${found.length} allowed abbreviated row(s) present, no regressions.`);
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error("[canonicalization-regression] error:", e);
  process.exit(2);
});
