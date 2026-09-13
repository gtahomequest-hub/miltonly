// Prebuild case for MC-020 (2026-09-13), the first night's audit findings taken by Core:
//   (a) the battery's catchment check carries the render guard's pattern list, verbatim, so the
//       two cannot drift; it fires on a school title with zone language and on a keywords tag,
//       and not on a listing's "zoned for residential" with no school context
//   (b) every architecturalStyle value in the feed's enumeration has a plain-name label, none of
//       the labels is a TREB string the audit flags, and the formatter never returns a raw value
//       for a value it knows
//   (c) the listing page's remarks block carries data-remarks and the visible label, and the
//       "people viewed today" counter, which was a hash and not a counter, is gone from src/
//   (d) /rentals renders one H1
//   (e) the condo intent squares resolve: "#listings" has a target, "/#mls" is gone
import { readFileSync } from "node:fs";
import { formatArchitecturalStyle } from "../src/lib/listingStyle";

let assertions = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => { assertions++; if (!cond) failures.push(label); };
const read = (p: string) => readFileSync(p, "utf8");
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ 	]*\/\/.*$/gm, " ");

async function main() {
  // (a) the pattern lists agree
  const { PATTERNS, catchmentHits, headFields } = await import("./verify/checks/catchment.mjs");
  const guardSrc = read("src/lib/ai/catchmentVocabulary.ts");
  const guardRes = [...guardSrc.matchAll(/\{ re: (\/.+?\/gi)/g)].map((m) => m[1]);
  const checkRes = (PATTERNS as RegExp[]).map((r) => r.toString());
  ok(guardRes.length === checkRes.length && guardRes.every((r, i) => r === checkRes[i]),
    `catchment.mjs PATTERNS == catchmentVocabulary.ts BAN_PATTERNS (${guardRes.length} vs ${checkRes.length})`);
  const schoolHead = `<html><head><title>Homes Near Anne J. MacArthur Milton — Prices, Listings &amp; School Zone Data</title><meta name="description" content="Find homes in the school zone."><meta name="keywords" content="Milton school zones, homes"></head><body></body></html>`;
  const hits = catchmentHits(headFields(schoolHead));
  ok(hits.length === 3 && hits.every((h: string) => /school zone/i.test(h)), `the old school title, description and keywords all fire (${hits.length})`);
  const listingHead = `<html><head><title>123 Main St, Milton</title><meta name="description" content="Zoned for residential dwellings, a bright two-storey."></head></html>`;
  ok(catchmentHits(headFields(listingHead)).length === 0, `"zoned for residential" with no school context does not fire`);
  const fixedHead = `<html><head><title>Anne J. MacArthur PS, Milton: Homes and Prices Nearby</title><meta name="description" content="Homes for sale near Anne J. MacArthur PS in Hawthorne Village, Milton Ontario: live TREB listings."><meta property="og:description" content="Schools nearby, GO commute data, and live TREB listings."></head></html>`;
  ok(catchmentHits(headFields(fixedHead)).length === 0, `the new school title and the site OG description are clean`);
  ok(/catchment\]/.test(read("scripts/verify/run.mjs")), "catchment is registered in run.mjs ALL");

  // (b) the style formatter
  const feedValues = ["2-Storey", "Apartment", "3-Storey", "1 Storey/Apt", "Bungalow", "Stacked Townhouse", "Multi-Level", "1 1/2 Storey",
    "Bungalow-Raised", "2 1/2 Storey", "Other", "Backsplit 3", "Bungaloft", "Backsplit 4", "", "Backsplit 5", "Sidesplit", "Sidesplit 3", "Sidesplit 5", "Loft"];
  const trebRe = /(?<![\w/])(?:Bungalow-Raised|Sidesplit|Backsplit|Sq Ft|W\/O|Bsmt)(?![\w/])/;
  for (const v of feedValues) {
    const out = formatArchitecturalStyle(v);
    if (v === "" || v === "Other") { ok(out === null, `"${v}" prints nothing`); continue; }
    ok(typeof out === "string" && out.length > 0, `"${v}" gets a label (${out})`);
    ok(!trebRe.test(out ?? ""), `"${v}" -> "${out}" is not a TREB string`);
  }
  ok(formatArchitecturalStyle("Bungalow-Raised") === "Raised bungalow", "Bungalow-Raised -> Raised bungalow");
  ok(formatArchitecturalStyle("Backsplit 4") === "Four-level backsplit", "Backsplit 4 -> Four-level backsplit");
  ok(formatArchitecturalStyle("2-Storey, Bungalow") === "Two-storey, Bungalow", "a joined feed value labels each half");
  ok(formatArchitecturalStyle(null) === null, "null -> null");
  const client = read("src/app/listings/[mlsNumber]/ListingDetailClient.tsx");
  ok(!/\bl\.architecturalStyle\b(?!\))/.test(client.replace(/formatArchitecturalStyle\(l\.architecturalStyle\)/g, "")), "ListingDetailClient renders architecturalStyle only through the formatter");

  // (c) remarks and the counter
  ok(/data-remarks/.test(client) && /Listing agent&apos;s remarks/.test(client), "the remarks block carries data-remarks and the visible label");
  const srcFiles = ["src/app/listings/[mlsNumber]/page.tsx", "src/app/listings/[mlsNumber]/ListingExtras.tsx", client && "src/app/listings/[mlsNumber]/ListingDetailClient.tsx"];
  ok(srcFiles.every((f) => !/viewsToday|people viewed today/.test(code(f))), "the hashed viewed-today counter is gone");

  // (d) one H1 on /rentals
  const rentals = read("src/app/rentals/RentalsClient.tsx");
  ok((rentals.match(/<h1[\s>]/g) || []).length === 1, `RentalsClient has one <h1> (${(rentals.match(/<h1[\s>]/g) || []).length})`);

  // (e) condo anchors
  ok(/id="listings"/.test(read("src/components/condo/sections.tsx")), "the condo listings section has id=listings");
  ok(!/\/#mls/.test(code("src/lib/condoData.ts")) && !/\/#mls/.test(code("src/components/condo/mockData.ts")), "no condo intent points at /#mls");

  // schools: no zone language in the two page files
  for (const f of ["src/app/schools/page.tsx", "src/app/schools/[slug]/page.tsx", "src/components/listings/v2/sections.tsx", "src/app/layout.tsx"]) {
    const body = read(f).replace(/^[ \t]*\/\/.*$/gm, "");
    ok(!/school zones?|catchment|top-rated/i.test(body), `${f} has no zone, catchment or top-rated language`);
  }

  if (failures.length > 0) {
    console.error(`[audit-night-1] FAIL: ${failures.length} of ${assertions} assertions:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log(`[audit-night-1] PASS: ${assertions} assertions.`);
}
main();
