// scripts/test-neon-egress.ts
//
// MC-018, the Neon egress fixes, held in the prebuild. MC-016 measured where DB1's rows leave:
// the two slug sets on nearly every render, /streets pulling every Milton listing per render
// to keep one per street, the two hub sets several times a render, /rentals with nothing
// cached. Each fix is a shape in the code, and this test holds the shape:
//
//   1. the slug sets go through unstable_cache under SURFACE_KEYS, and every in-app publication
//      write drops them (generateStreet's hook, admin publish, admin reject, /api/revalidate
//      on a /streets path);
//   2. the hub sets go through unstable_cache under HUB_SET_KEYS, the street render, the footer,
//      the sold options and the hub-card map read them from hubSets.ts, and both hub
//      generators and /api/revalidate on a /neighbourhoods path drop them;
//   3. /streets is ISR (no force-dynamic, a revalidate) and its sample is DISTINCT ON;
//   4. /rentals caches its bundle per scope and no longer declares a revalidate beside
//      force-dynamic;
//   5. the two TTLs are an hour, the Neon reads' own (MC-017): a shorter one would cut every
//      ISR page's revalidate to it. The Data Cache, not Upstash: `cached()` is bypassed under a
//      static render, which since MC-017 is nearly every page's first render.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SURFACE_KEYS, SURFACE_TTL, SURFACE_TAG } from "../src/lib/streetSurface";
import { HUB_SET_KEYS, HUB_SET_TTL, HUB_SET_TAG } from "../src/lib/hubSets";

const ROOT = resolve(__dirname, "..");
const code = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
const failures: string[] = [];
let n = 0;
function ok(cond: boolean, label: string) {
  n++;
  if (!cond) failures.push(`  ${label}`);
}

// ── 1. the slug sets ─────────────────────────────────────────────────────────────────
{
  const s = code("src/lib/streetSurface.ts");
  ok(/\[SURFACE_KEYS\.published\],\s*\{ revalidate: SURFACE_TTL, tags: \[SURFACE_TAG\] \}/.test(s), "publishedStreetSlugs reads through dataCached (unstable_cache) under SURFACE_KEYS.published");
  ok(/\[SURFACE_KEYS\.entities\],\s*\{ revalidate: SURFACE_TTL, tags: \[SURFACE_TAG\] \}/.test(s), "the entity set reads through dataCached (unstable_cache) under SURFACE_KEYS.entities");
  ok(!/from "@\/lib\/cache"/.test(s), "streetSurface does not go through cached(), which a static render bypasses");
  ok(!/prisma\.residentialStreet\.findMany\(\{ select: \{ slug: true \} \}\),\s*\]\)/.test(s), "publishedStreetPageSlugs no longer runs its own two queries");
  ok(/export async function dropSurfaceCache/.test(s) && /revalidateTag\(SURFACE_TAG\)/.test(s), "dropSurfaceCache revalidates the tag");
  ok(SURFACE_KEYS.published !== SURFACE_KEYS.entities && /:v\d+$/.test(SURFACE_KEYS.published), "the keys are distinct and versioned");
  for (const [file, label] of [
    ["src/lib/generateStreet.ts", "generateStreet's revalidation hook"],
    ["src/app/api/admin/publish/route.ts", "admin publish"],
    ["src/app/api/admin/reject/route.ts", "admin reject"],
    ["src/app/api/revalidate/route.ts", "/api/revalidate"],
  ] as const) {
    ok(/await dropSurfaceCache\(\)/.test(code(file)), `${label} drops the slug sets`);
  }
  ok(/path === "\/streets" \|\| path\.startsWith\("\/streets\/"\)/.test(code("src/app/api/revalidate/route.ts")), "/api/revalidate drops on a /streets path only");
}

// ── 2. the hub sets ──────────────────────────────────────────────────────────────────
{
  const s = code("src/lib/hubSets.ts");
  ok(/\[HUB_SET_KEYS\.neighbourhoods\],\s*\{ revalidate: HUB_SET_TTL, tags: \[HUB_SET_TAG\] \}/.test(s) && /\[HUB_SET_KEYS\.published\],\s*\{ revalidate: HUB_SET_TTL, tags: \[HUB_SET_TAG\] \}/.test(s), "both hub sets read through dataCached (unstable_cache)");
  ok(!/from "@\/lib\/cache"/.test(s) && /revalidateTag\(HUB_SET_TAG\)/.test(s), "hubSets does not go through cached() and drops by tag");
  ok(HUB_SET_KEYS.neighbourhoods !== HUB_SET_KEYS.published && /:v\d+$/.test(HUB_SET_KEYS.published), "the hub keys are distinct and versioned");
  const street = code("src/lib/street-data.ts");
  ok(/from "\.\/hubSets"/.test(street) && !/prisma\.hubContent\.findMany\(\{ where: \{ status: "published" \}, select: \{ neighbourhoodSlug: true \} \}\),\s*prisma\.neighbourhood\.findMany/.test(street), "the street render reads the hub sets from hubSets.ts, not its own two queries");
  ok(/publishedHubSlugs\(\)/.test(code("src/lib/hubFooter.ts")), "the footer reads the published hubs from hubSets.ts");
  ok(/neighbourhoodRows\(\)/.test(code("src/lib/sold-data.ts")), "the sold options read the neighbourhoods from hubSets.ts");
  ok(/publishedHubSlugs\(\)/.test(code("src/lib/neighbourhoodCards.ts")), "the hub-card map reads the published hubs from hubSets.ts");
  for (const f of ["src/lib/ai/hub/generateRuralHub.ts", "src/lib/ai/hub/generateUrbanHub.ts"]) {
    const g = code(f);
    ok(/revalidateHubSurfaces\(neighbourhoodSlug, "[^"]+"\);\r?\n\s*await dropHubSetCache\(\)/.test(g), `${f} drops the hub sets right after its revalidation`);
  }
  ok(/path === "\/neighbourhoods" \|\| path\.startsWith\("\/neighbourhoods\/"\)\) await dropHubSetCache\(\)/.test(code("src/app/api/revalidate/route.ts")), "/api/revalidate drops the hub sets on a /neighbourhoods path");
}

// ── 3. /streets ──────────────────────────────────────────────────────────────────────
{
  const s = code("src/app/streets/page.tsx");
  ok(!/export const dynamic\s*=\s*"force-dynamic"/.test(s), "/streets is not force-dynamic");
  ok(/export const revalidate = 3600/.test(s), "/streets revalidates hourly");
  ok(/SELECT DISTINCT ON \("streetSlug"\)/.test(s) && !/distinct: \["streetSlug"\]/.test(s), "/streets samples one row per street on the server");
  ok(/slugs\.length === 0 \? \[\]/.test(s), "/streets guards the empty slug list before Prisma.join");
  ok(/searchParams/.test(s) === false, "/streets reads no searchParams (so ISR is honest)");
}

// ── 4. /rentals ──────────────────────────────────────────────────────────────────────
{
  const s = code("src/app/rentals/page.tsx");
  ok(/cached\(`rentals:\$\{scope\?\.slug \?\? "all"\}:v1`, RENTALS_TTL/.test(s), "/rentals caches its bundle per scope");
  ok(!/export const revalidate/.test(s), "/rentals no longer declares a revalidate beside force-dynamic");
  ok(/const RENTALS_TTL = 900/.test(s), "/rentals TTL is fifteen minutes");
}

// ── 5. the TTLs: an hour, the Neon reads' own, so no ISR page is cut shorter by them ──
ok(SURFACE_TTL === 3600, `SURFACE_TTL is 3600 (got ${SURFACE_TTL})`);
ok(HUB_SET_TTL === 3600, `HUB_SET_TTL is 3600 (got ${HUB_SET_TTL})`);
ok(SURFACE_TAG !== HUB_SET_TAG, "the two tags are distinct");

if (failures.length) {
  console.error(`[neon-egress] FAIL: ${failures.length} of ${n} assertions:`);
  for (const f of failures) console.error(f);
  process.exit(1);
}
console.log(`[neon-egress] PASS: ${n} assertions; the slug sets, the hub sets, /streets on ISR with DISTINCT ON, /rentals cached per scope.`);
