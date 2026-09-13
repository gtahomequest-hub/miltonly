// Prebuild case for MC-017 (2026-09-13), the build-cost and TTFB change:
//   (a) hub, condo, guide and listing pages, and the three indexes, are ISR for a day, not
//       force-dynamic, and none of the detail pages prerenders at build (no generateStaticParams)
//   (b) /listings (searchParams) stays force-dynamic
//   (c) every DB1 write path those pages read from drops them: the three listing syncs, the two
//       hub generators and the condo generator
//   (d) the three analytics jobs drop the db3 tag, so a page's DB3 reads follow the rows
//   (e) the street page prerenders the top fifty and no more; the rest render on first visit
import { readFileSync } from "node:fs";
import { PRERENDER_STREET_LIMIT } from "../src/lib/streetPrerender";

let assertions = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => { assertions++; if (!cond) failures.push(label); };
const read = (p: string) => readFileSync(p, "utf8");
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");

// (a)
const isrPages = [
  "src/app/neighbourhoods/[slug]/page.tsx",
  "src/app/condos/[slug]/page.tsx",
  "src/app/guides/[slug]/page.tsx",
  "src/app/listings/[mlsNumber]/page.tsx",
  "src/app/neighbourhoods/page.tsx",
  "src/app/condos/page.tsx",
  "src/app/guides/page.tsx",
];
for (const p of isrPages) {
  const c = code(p);
  ok(/export const revalidate = 86400;/.test(c), `${p} revalidates daily`);
  ok(!/force-dynamic/.test(c), `${p} is not force-dynamic`);
  if (p.includes("[")) {
    ok(!/generateStaticParams/.test(c), `${p} has no build-time prerender`);
    ok(/export const dynamicParams = true;/.test(c), `${p} renders an unknown slug on first visit`);
  }
}
// (b)
ok(/force-dynamic/.test(code("src/app/listings/page.tsx")), "/listings (searchParams) stays force-dynamic");

// (c)
const writers: Array<[string, RegExp]> = [
  ["src/app/api/sync/detect/route.ts", /revalidateListingSurfaces\(/],
  ["src/app/api/sync/expire/route.ts", /revalidateListingSurfaces\(/],
  ["src/app/api/sync/route.ts", /revalidateListingSurfaces\(/],
  ["src/lib/ai/hub/generateUrbanHub.ts", /revalidateHubSurfaces\(neighbourhoodSlug/],
  ["src/lib/ai/hub/generateRuralHub.ts", /revalidateHubSurfaces\(neighbourhoodSlug/],
  ["src/lib/ai/hub/generateCondoBuilding.ts", /revalidateCondoSurfaces\(buildingSlug/],
];
for (const [p, re] of writers) ok(re.test(code(p)), `${p} drops the ISR pages it changes`);
const helper = code("src/lib/revalidateSurfaces.ts");
for (const path of ["/listings/[mlsNumber]", "/condos/[slug]", "/neighbourhoods/[slug]", "/condos", "/neighbourhoods"]) {
  ok(helper.includes(`"${path}"`), `revalidateListingSurfaces covers ${path}`);
}
ok(/revalidatePath\(p, "page"\)/.test(helper), "a dynamic-segment path is purged as a page pattern");

// (d)
for (const job of ["compute-sold-stats", "compute-board", "compute-geni"]) {
  ok(/revalidateTag\(DB_CACHE_TAG\.ANALYTICS_DATABASE_URL\)/.test(code(`src/app/api/jobs/${job}/route.ts`)), `${job} drops the db3 tag`);
}

// (e)
ok(PRERENDER_STREET_LIMIT === 50, `PRERENDER_STREET_LIMIT is 50 (${PRERENDER_STREET_LIMIT})`);
const street = code("src/app/streets/[slug]/page.tsx");
ok(/topStreetSlugsForPrerender\(\)/.test(street), "the street page prerenders through topStreetSlugsForPrerender");
ok(!/streetContent\.findMany/.test(street), "the street page no longer prerenders every published street");
ok(/export const dynamicParams = true;/.test(street) && /export const revalidate = 3600;/.test(street), "the other streets render on first visit under the hour's revalidate");

if (failures.length > 0) {
  console.error(`[build-cost] FAIL: ${failures.length} of ${assertions} assertions:`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`[build-cost] PASS: ${assertions} assertions.`);
