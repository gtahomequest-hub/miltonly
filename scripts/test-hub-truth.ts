// scripts/test-hub-truth.ts
//
// MC-027, the hub audit's Core items, held in the prebuild:
//
//   1. DRIFT. calcHubDataHash folds the typical to $10,000, the sale count, days on market and
//      the active count; a change inside that is not drift, a change beyond it is. Both hub
//      generators write that hash, the page drops FAQPage while drifted, and the regenerate
//      route reads the same drift function. The cron entries exist.
//   2. PRERENDER. The hub page's generateStaticParams reads the published hubs, and the warm
//      job is on the crons after each sold and analytics job.
//   3. DEC-TYPICAL-MEDIAN. No AVG(sold_price) is left in the files that publish a typical
//      (the street page, the AI inputs, the hub input, the ladder, the battery's record), the
//      ladder's medianOf matches PERCENTILE_CONT, /sold has no "average" tile beside the
//      typical and its sign-in redirect carries the query.
//   4. Bronte Meadows is an urban hub in the seed; a polygon-less rural hub's siblings come
//      from the rural tier's order.
//   5. The street page's up-link reads the registry row and nothing else.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { calcHubDataHash } from "../src/lib/hubDataHash";
import { medianOf } from "../src/lib/hubStreetLadder";
import { NEIGHBOURHOOD_SEED } from "../src/lib/neighbourhood";

const ROOT = resolve(__dirname, "..");
const code = (p: string) => readFileSync(resolve(ROOT, p), "utf8");
const failures: string[] = [];
let n = 0;
function ok(cond: boolean, label: string) {
  n++;
  if (!cond) failures.push(`  ${label}`);
}

// ── 1. drift ─────────────────────────────────────────────────────────────────────────
{
  const base = { aggregates: { typicalPrice: 961_300, salesCount: 95, daysOnMarket: 21.4, priceRange: null }, activeListingsCount: 17 } as Parameters<typeof calcHubDataHash>[0];
  const h = calcHubDataHash(base);
  ok(h.length === 16, "the hub hash is 16 hex characters, like the street hash");
  ok(calcHubDataHash({ ...base, aggregates: { ...base.aggregates, typicalPrice: 964_900 } }) === h, "a typical moving within $10,000 is not drift");
  ok(calcHubDataHash({ ...base, aggregates: { ...base.aggregates, typicalPrice: 975_100 } }) !== h, "a typical crossing a $10,000 line is drift");
  ok(calcHubDataHash({ ...base, aggregates: { ...base.aggregates, salesCount: 96 } }) !== h, "one more sale is drift");
  ok(calcHubDataHash({ ...base, aggregates: { ...base.aggregates, daysOnMarket: 21.2 } }) === h, "days on market moving within the day is not drift");
  ok(calcHubDataHash({ ...base, activeListingsCount: 18 }) !== h, "one more active listing is drift");
  ok(calcHubDataHash({ ...base, aggregates: { ...base.aggregates, typicalPrice: null } }) !== h, "a typical falling under k is drift");
  for (const f of ["src/lib/ai/hub/generateUrbanHub.ts", "src/lib/ai/hub/generateRuralHub.ts"]) {
    const g = code(f);
    ok(/const inputHash = calcHubDataHash\(input\)/.test(g) && !/createHash\("sha256"\)\.update\(JSON\.stringify\(input\)\)/.test(g), `${f} writes the tolerance hash`);
  }
  const page = code("src/app/neighbourhoods/[slug]/page.tsx");
  ok(/data\.faqs\.length && !drift\.drifted \? \[generateFAQSchema\(data\.faqs\)\]/.test(page), "the hub page emits FAQPage only when not drifted");
  const route = code("src/app/api/sync/regenerate-hubs/route.ts");
  ok(/hubDrift\(h\.neighbourhoodSlug\)/.test(route) && /deepseekOnly: true/.test(route) && /HUBS_PER_RUN = 3/.test(route), "the regenerate route reads hubDrift, DeepSeek only, three a run");
  ok(/hubFallbackModel\(opts\?\.deepseekOnly\)/.test(code("src/lib/ai/hub/generateHubContent.ts")) && /hubFallbackModel\(opts\?\.deepseekOnly\)/.test(code("src/lib/ai/hub/generateUrbanHubContent.ts")), "both content generators honour deepseekOnly");
  const crons = JSON.parse(code("vercel.json")).crons as Array<{ path: string; schedule: string }>;
  ok(crons.some((c) => c.path === "/api/sync/regenerate-hubs"), "regenerate-hubs is on the crons");
}

// ── 2. prerender and warm ────────────────────────────────────────────────────────────
{
  const page = code("src/app/neighbourhoods/[slug]/page.tsx");
  ok(/export async function generateStaticParams\(\)[\s\S]*hubContent\.findMany\(\{ where: \{ status: "published" \}/.test(page), "the hub page prerenders the published hubs");
  ok(/export const dynamicParams = true/.test(page), "a hub published after the build still renders on visit");
  const crons = JSON.parse(code("vercel.json")).crons as Array<{ path: string; schedule: string }>;
  const warm = crons.filter((c) => c.path === "/api/jobs/warm-hubs").map((c) => c.schedule);
  ok(warm.length >= 4, `warm-hubs runs after each sold and analytics job (${warm.length} entries)`);
  ok(/user-agent": "miltonly-warm-hubs"/.test(code("src/app/api/jobs/warm-hubs/route.ts")), "the warm job walks the hubs as itself");
}

// ── 3. the median ────────────────────────────────────────────────────────────────────
{
  for (const f of [
    "src/lib/street-data.ts",
    "src/lib/ai/buildGeneratorInput.ts",
    "src/lib/ai/buildHubInput.ts",
    "src/lib/ai/neighbourhoodLookup.ts",
    "src/lib/streetEnrichment.ts",
    "src/lib/tenureHubData.ts",
    "src/lib/ai/buildCondoBuildingInput.ts",
    "src/lib/hubData.ts",
    "scripts/verify/lib/db.mjs",
  ]) {
    const s = code(f).split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
    ok(!/AVG\(sold_price\)/.test(s), `${f} computes no AVG(sold_price) outside a comment`);
  }
  ok(!/SUM\(sold_price\)/.test(code("src/lib/hubStreetLadder.ts")) && /array_agg\(sold_price ORDER BY sold_price\)/.test(code("src/lib/hubStreetLadder.ts")), "the ladder pools prices, not sums");
  ok(medianOf([]) === null, "medianOf of nothing is null");
  ok(medianOf([5]) === 5, "medianOf of one is the one");
  ok(medianOf([1, 2, 3, 4]) === 2.5, "medianOf interpolates an even sample like PERCENTILE_CONT");
  ok(medianOf([9, 1, 5]) === 5, "medianOf sorts first");
  ok(medianOf([100_000, 1_000_000, 2_000_000, 9_000_000, 9_500_000]) === 2_000_000, "medianOf ignores the tail a mean would follow");
  const sold = code("src/components/sold/SoldAggregates.tsx");
  ok(!/Average sold price/.test(sold) && !/overall\.meanPrice/.test(sold), "/sold prints no average tile beside the typical");
  const soldPage = code("src/app/sold/page.tsx");
  ok(/const returnTo = `\/sold\?type=\$\{typeParam\}\$\{nbhdQ\}\$\{ptypeQ\}`/.test(soldPage) && /encodeURIComponent\(returnTo\)/.test(soldPage), "/sold's sign-in returns to the filtered view");
  ok(/hubChips\.map\(\(nb\) =>/.test(soldPage) && !/neighbourhoods\.slice\(0, 10\)/.test(soldPage), "/sold's chip row is every published hub");
  ok(/nbhdLabel \? <>\{nbhdLabel\} <em>sold<\/em> homes<\/>/.test(soldPage), "/sold's H1 names the hub");
  const soldAgg = code("src/lib/soldAggregates.ts");
  ok(/hubTypical: number \| null/.test(soldAgg) && /meanPrice: kPrice \? round5k\(num\(r\.mean\)\)/.test(soldAgg), "soldAggregates keeps a real mean for the guide, named mean, and the hub typical apart");
}

// ── 4. the registry and the rural order ──────────────────────────────────────────────
{
  const bm = NEIGHBOURHOOD_SEED.find((s) => s.slug === "bronte-meadows");
  ok(bm?.profile === "urban_hub" && bm?.kind === "urban", "bronte-meadows is an urban hub in the seed");
  const hubData = code("src/lib/hubData.ts");
  ok(/NEIGHBOURHOOD_SEED\.filter\(\(n\) => n\.kind === "rural" && n\.slug !== slug && publishedSet\.has\(n\.slug\)\)/.test(hubData), "a polygon-less rural hub's siblings come from the rural tier's order");
  ok(/saleAggQuery\(hood\.rawStrings\)/.test(hubData), "sibling typicals come from the hub's own aggregate");
  const rural = NEIGHBOURHOOD_SEED.filter((s) => s.kind === "rural").map((s) => s.slug);
  ok(!rural.includes("bronte-meadows") && !rural.includes("milton-north"), "the rural tier carries no thin-urban hub");
}

// ── 5. the up-link ───────────────────────────────────────────────────────────────────
{
  const s = code("src/lib/street-data.ts");
  ok(/residentialStreet\.findMany\(\{\s*where: \{ slug: \{ in: siblingSlugs \}, neighbourhoodId: \{ not: null \} \}/.test(s), "the up-link reads the registry row");
  ok(!/resolveMap\.get\(hubSlugify\(raw\)\)/.test(s), "the up-link no longer resolves from sold strings");
  ok(/hub-membership-reconcile/.test(s), "the up-link names the reconciliation script");
}

if (failures.length) {
  console.error(`[hub-truth] FAIL: ${failures.length} of ${n} assertions:`);
  for (const f of failures) console.error(f);
  process.exit(1);
}
console.log(`[hub-truth] PASS: ${n} assertions; drift, prerender, the median, the registry, the up-link.`);
