// scripts/test-street-notfound-head.ts, MC-047 (MC-050's proposal 2): the street page's no-data
// head is noindex, follow.
//
// generateMetadata in src/app/streets/[slug]/page.tsx answers before the page's notFound(). Its
// no-data branch returned a title alone: no canonical, no robots. MC-050 found 12 of 256 crawled
// street pages had declared no canonical at crawl, and this was the one code path that emits none.
// Held here: the branch returns STREET_NOT_FOUND_METADATA, which is robots index false, follow
// true, and carries no canonical or description to be indexed with; and the served head keeps
// its canonical (the branch is the only early return).
import fs from "node:fs";
import { STREET_NOT_FOUND_METADATA } from "../src/lib/streetHead";

let assertions = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string) {
  assertions++;
  if (!cond) failures.push(msg);
}

const robots = STREET_NOT_FOUND_METADATA.robots;
ok(typeof robots === "object" && robots !== null, "the no-data head declares robots as an object");
if (typeof robots === "object" && robots !== null) {
  ok(robots.index === false, "the no-data head is noindex");
  ok(robots.follow === true, "the no-data head is follow");
}
ok(STREET_NOT_FOUND_METADATA.title === "Street Not Found", "the no-data head keeps its title");
ok(STREET_NOT_FOUND_METADATA.alternates === undefined && STREET_NOT_FOUND_METADATA.description === undefined, "the no-data head carries no canonical and no description");

const page = fs.readFileSync("src/app/streets/[slug]/page.tsx", "utf8");
const gm = page.slice(page.indexOf("export async function generateMetadata"), page.indexOf("export default async function"));
ok(gm.length > 0, "generateMetadata found");
ok(/if \(!data\) return STREET_NOT_FOUND_METADATA;/.test(gm), "generateMetadata's no-data branch returns the noindex head");
ok((gm.match(/\breturn\b/g) ?? []).length === 2, "generateMetadata has exactly two returns: the no-data head and the served head");
ok(/alternates:\s*\{\s*canonical:\s*canonicalUrlFor\(params\.slug\)\s*\}/.test(gm), "the served head keeps its self canonical");
ok(!/robots:/.test(gm.slice(gm.indexOf("if (!data)") + 40)), "the served head sets no robots (it stays indexable)");

if (failures.length) {
  console.error(`test-street-notfound-head: ${failures.length} of ${assertions} assertions failed`);
  for (const f of failures) console.error(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`test-street-notfound-head: ${assertions} assertions passed`);
