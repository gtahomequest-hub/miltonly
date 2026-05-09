// Phase 4.1 Step 13m-4a — generates a static canonical-slug map for the
// middleware to consume. Runs the same universe-load + identity-dedupe
// used by backfill, then emits an entry for every non-canonical slug
// pointing at its canonical data-bearing sibling.
//
// Run:
//   TSX_TSCONFIG_PATH=./tsconfig.test.json npx --yes tsx scripts/generate-canonical-map.ts
//
// Regenerate whenever the universe shifts materially (new MLS ingest pass,
// new streets, slug changes). Small output (~800 entries).

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

(async () => {
  const raw = readFileSync(".env.local", "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=["']?([^"'\n]+?)["']?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/\\n$/, "");
  }

  const { prisma } = await import("@/lib/prisma");
  const { getAnalyticsDb, getSoldDb } = await import("@/lib/db");
  const analyticsDb = getAnalyticsDb();
  const soldDb = getSoldDb();
  const { deriveIdentity } = await import("@/lib/streetUtils");
  const { isMalformedSlug } = await import("./backfill-descriptions");

  // Build raw universe (mirror loadCandidateUniverse)
  const universe = new Set<string>();
  const permRows = await prisma.listing.findMany({
    where: { permAdvertise: true },
    distinct: ["streetSlug"],
    select: { streetSlug: true },
  });
  for (const r of permRows) if (r.streetSlug) universe.add(r.streetSlug);

  const contentRows = await prisma.streetContent.findMany({ select: { streetSlug: true } });
  for (const r of contentRows) universe.add(r.streetSlug);

  if (analyticsDb) {
    const rows = (await analyticsDb`SELECT DISTINCT street_slug AS s FROM analytics.street_sold_stats WHERE street_slug IS NOT NULL`) as unknown as Array<{ s: string }>;
    for (const r of rows) universe.add(r.s);
  }
  if (soldDb) {
    const rows = (await soldDb`SELECT DISTINCT street_slug AS s FROM sold.sold_records WHERE street_slug IS NOT NULL`) as unknown as Array<{ s: string }>;
    for (const r of rows) universe.add(r.s);
  }

  // Drop malformed slugs — no canonical redirect for those; route handles 404.
  for (const s of Array.from(universe)) if (isMalformedSlug(s)) universe.delete(s);

  // Group by identityKey. Canonical winner is the deriveIdentity-derived
  // full-word slug for the group, not the most-frequent abbreviated MLS form.
  // Prior logic ranked by DB2 sold_records tx-count, which always favored
  // abbreviated suffixes (crt, cres, blvd) since MLS ingest writes those.
  // That made the middleware 301 canonical → abbreviated, undoing the R2
  // StreetGeneration migration at the URL layer. Render path is slug-agnostic
  // via resolveSiblingSlugs, so the abbreviated slugs in DB2 sold/analytics
  // tables continue to be unioned in at query time.
  const groups = new Map<string, string[]>();
  for (const s of Array.from(universe)) {
    const id = deriveIdentity(s);
    const key = id ? id.identityKey : `__noident__|${s}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }

  const canonicalMap: Record<string, string> = {};
  for (const [, members] of Array.from(groups.entries())) {
    if (members.length === 1) continue; // singletons don't need redirects
    // All members share the same identityKey, so their canonicalSlug is
    // identical. Use the first member's deriveIdentity to get it.
    const canonical = deriveIdentity(members[0])?.canonicalSlug ?? members[0];
    for (const m of members) {
      if (m !== canonical) canonicalMap[m] = canonical;
    }
  }

  const outPath = path.join(process.cwd(), "src/lib/_generated");
  mkdirSync(outPath, { recursive: true });
  const jsonPath = path.join(outPath, "canonical-map.json");
  writeFileSync(jsonPath, JSON.stringify(canonicalMap, null, 2), "utf-8");
  console.log(`Wrote ${jsonPath}`);
  console.log(`Entries: ${Object.keys(canonicalMap).length} non-canonical → canonical redirects`);
  console.log(`Universe: ${universe.size} valid slugs, ${groups.size} identity groups`);

  // Spot-check user's expected test cases
  const TEST = [
    "asleton-boulevard-milton",
    "main-st-e-milton",
    "aird-court-milton",
    "aird-crt-milton",
  ];
  console.log("\nExpected test-case lookups:");
  for (const s of TEST) {
    console.log(`  ${s} → ${canonicalMap[s] ?? "(already canonical)"}`);
  }

  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
