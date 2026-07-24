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
  const { OFF_REGISTRY_STREETS } = await import("@/data/offRegistryStreets");
  const { MILTON_STREET_REGISTRY } = await import("@/data/miltonStreetRegistry");
  // "Never redirect these" — official registry slugs (canonical streets in their own
  // right, incl. the distinct directional NAMES Kennedy Circle East/West) + off-registry
  // rural roads. They must never be a redirect SOURCE, in the static map or the computed rule.
  const noRedirect = new Set<string>([...MILTON_STREET_REGISTRY.map((r) => r.slug), ...OFF_REGISTRY_STREETS]);
  // Import from standalone util (no top-level main() side-effect, unlike
  // backfill-descriptions). See 2026-05-09 cleanup ledger entry — accidental
  // re-import of backfill-descriptions previously triggered $5-10 of unintended
  // SG generation per script run.
  const { isMalformedSlug } = await import("@/lib/slugMalformedDetection");

  // Build raw universe (mirror loadCandidateUniverse). `renderBearing` is the
  // subset that actually renders a 200 (DB1 listings, StreetContent, DB2 sold) —
  // DB3 analytics.street_sold_stats is DERIVED and no longer renders alone (see the
  // phantom-200 guard), so it feeds `universe` (for grouping) but NOT the valid set.
  const universe = new Set<string>();
  const renderBearing = new Set<string>();
  const permRows = await prisma.listing.findMany({
    where: { permAdvertise: true },
    distinct: ["streetSlug"],
    select: { streetSlug: true },
  });
  for (const r of permRows) if (r.streetSlug) { universe.add(r.streetSlug); renderBearing.add(r.streetSlug); }

  const contentRows = await prisma.streetContent.findMany({ select: { streetSlug: true } });
  for (const r of contentRows) { universe.add(r.streetSlug); renderBearing.add(r.streetSlug); }

  if (analyticsDb) {
    const rows = (await analyticsDb`SELECT DISTINCT street_slug AS s FROM analytics.street_sold_stats WHERE street_slug IS NOT NULL`) as unknown as Array<{ s: string }>;
    for (const r of rows) universe.add(r.s);
  }
  if (soldDb) {
    const rows = (await soldDb`SELECT DISTINCT street_slug AS s FROM sold.sold_records WHERE street_slug IS NOT NULL`) as unknown as Array<{ s: string }>;
    for (const r of rows) { universe.add(r.s); renderBearing.add(r.s); }
  }
  // ResidentialStreet entities also render (via listings/sold on siblings) + carry the
  // off-registry roads — include them so a canonical entity is always "valid".
  const entRows = await prisma.residentialStreet.findMany({ select: { slug: true } });
  for (const r of entRows) { universe.add(r.slug); renderBearing.add(r.slug); }

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
      if (m === canonical) continue;
      if (noRedirect.has(m)) continue; // never redirect FROM an official / off-registry slug
      canonicalMap[m] = canonical;
    }
  }

  // Valid CANONICAL slugs = the deriveIdentity canonical of every render-bearing
  // slug, plus the off-registry roads (which are their own canonical). The Edge
  // middleware's computed rule redirects a variant to its canonical ONLY when the
  // canonical is in this set — so it never 301s into a 404.
  const validCanonicals = new Set<string>();
  for (const s of Array.from(renderBearing)) {
    const c = deriveIdentity(s)?.canonicalSlug ?? s;
    validCanonicals.add(c);
    validCanonicals.add(s); // the render-bearing slug itself is valid too
  }
  for (const s of OFF_REGISTRY_STREETS) validCanonicals.add(s);

  const outPath = path.join(process.cwd(), "src/lib/_generated");
  mkdirSync(outPath, { recursive: true });
  const jsonPath = path.join(outPath, "canonical-map.json");
  writeFileSync(jsonPath, JSON.stringify(canonicalMap, null, 2), "utf-8");
  console.log(`Wrote ${jsonPath}`);
  console.log(`Entries: ${Object.keys(canonicalMap).length} non-canonical → canonical redirects`);
  console.log(`Universe: ${universe.size} valid slugs, ${groups.size} identity groups`);

  const validPath = path.join(outPath, "valid-canonical-slugs.json");
  writeFileSync(validPath, JSON.stringify(Array.from(validCanonicals).sort(), null, 2), "utf-8");
  console.log(`Wrote ${validPath}: ${validCanonicals.size} valid canonical slugs (computed-rule guard)`);

  const noRedirectPath = path.join(outPath, "no-redirect-slugs.json");
  writeFileSync(noRedirectPath, JSON.stringify(Array.from(noRedirect).sort(), null, 2), "utf-8");
  console.log(`Wrote ${noRedirectPath}: ${noRedirect.size} never-redirect slugs (registry + off-registry)`);

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
