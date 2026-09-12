// Prebuild case for the seven MC-012 changes (fix/core-batch-3, 2026-09-12).
//
//   (a) both prompts: name the board, never the family
//   (b) the judge cannot fail a page on a finding it labels not a violation
//   (c) hubMeta carries no em-dash, and the hub-meta check asserts it
//   (d) /rentals scopes by ?neighbourhood= through the hub's rawStrings; the hub's square points there
//   (e) /neighbourhoods/<slug>/streets 301s to the hub's #streets and is out of the sitemap
//   (f) parking and GO up-links from streets and hubs, from the guides' own hub rules
//   (g) the sources-fresh battery check fails a closed window and passes an open one
//
// Pure where the code is pure (b, c, f, g); structural where the change is a route, a
// redirect or a prompt (a, d, e): the source is read, so a later edit that drops the change
// fails here rather than on a page.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseJudgeReply, NOT_A_VIOLATION } from "../src/lib/ai/compliance";
import { buildHubMeta } from "../src/lib/ai/hub/hubMeta";
import { guidesForHub, guidesForStreet, hubCarriesGoGuide, hubCarriesParkingGuide, GUIDE_SLUG } from "../src/lib/guides/uplinks";
import { hubSlugAt, hubSlugsNear } from "../src/lib/guides/hubLookup";
import { PILOT_PARKS } from "../src/data/sources/miltonParking";
import { TOWN_PARKS } from "../src/data/townPlaces";

let assertions = 0;
const failures: string[] = [];
const ok = (cond: boolean, label: string) => { assertions++; if (!cond) failures.push(label); };
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/.*$/gm, " ");

async function main() {
  // (a)
  for (const doc of ["docs/phase-4.1/01-system-prompt.md", "docs/phase-4.1/03-evaluative-prompt.md"]) {
    const d = read(doc);
    ok(/\*\*Name the board, never the family\.\*\*/.test(d), `${doc}: the board rule is stated`);
    ok(/never "for Catholic families"/.test(d), `${doc}: the rule names the refused phrase`);
  }

  // (b)
  const onlyLabel = '{"pass": false, "findings": [{"span": "which suits short daily walks", "class": "amenity fact, not a violation"}]}';
  ok(parseJudgeReply(onlyLabel).pass === true, "judge: a refusal whose only finding is labelled not a violation passes");
  ok(parseJudgeReply(onlyLabel).findings.length === 0, "judge: the non-violation finding is dropped");
  const mixed = '{"pass": false, "findings": [{"span": "x", "class": "amenity fact, not a violation"}, {"span": "For families", "class": "family status"}]}';
  ok(parseJudgeReply(mixed).pass === false && parseJudgeReply(mixed).findings.length === 1, "judge: a real finding beside a non-violation label still refuses, on the real one");
  ok(parseJudgeReply('{"pass": false, "findings": []}').pass === false, "judge: a refusal with no findings stays a refusal (fail-closed)");
  ok(parseJudgeReply('{"pass": true, "findings": []}').pass === true, "judge: a pass is a pass");
  ok(NOT_A_VIOLATION.test("no violation here") && !NOT_A_VIOLATION.test("tenure characterization"), "judge: the label pattern matches the judge's own wording only");

  // (c)
  const meta = buildHubMeta("Beaty", { typicalPrice: 941_341, salesCount: 119 } as never, "urban");
  const rural = buildHubMeta("Nassagaweya", { typicalPrice: null, salesCount: 0 } as never, "rural");
  for (const [k, v] of Object.entries({ ...meta, ruralTitle: rural.metaTitle, ruralDesc: rural.metaDescription })) {
    ok(!v.includes("—"), `hubMeta ${k} carries no em-dash: ${v}`);
  }
  ok(meta.metaDescription.includes("typically $940,000"), "hubMeta: the hook still carries the rounded typical");
  const hubLive = stripComments(read("src/lib/hubLive.ts"));
  ok(/title: metaTitle,/.test(hubLive) && !/content\.metaTitle \?\? metaTitle/.test(hubLive), "hubLive: the title is the live formula, not the stored snapshot");
  const hubMetaCheck = stripComments(read("scripts/verify/checks/hub-meta.mjs"));
  ok(/carrying an em-dash/.test(hubMetaCheck) && /<title>/.test(hubMetaCheck), "hub-meta check: asserts no em-dash on title and description");

  // (d)
  const hubData = stripComments(read("src/lib/hubData.ts"));
  ok(/href: `\/rentals\?neighbourhood=\$\{slug\}`/.test(hubData), "hub: the renting square is scoped to the hub");
  const rentals = stripComments(read("src/app/rentals/page.tsx"));
  ok(/resolveRentalScope\(searchParams\?\.neighbourhood\)/.test(rentals) && /\.\.\.scopeWhere/.test(rentals), "/rentals: reads ?neighbourhood= and scopes every query");
  const scopeLib = stripComments(read("src/lib/rentalScope.ts"));
  ok(/rawStrings/.test(scopeLib) && /findUnique\(\{ where: \{ slug \}/.test(scopeLib), "/rentals: the scope resolves through the hub's rawStrings");
  const client = stripComments(read("src/app/rentals/RentalsClient.tsx"));
  ok(/scope \? "rentals-available-in-hub" : "rentals-available"/.test(client), "/rentals: the town-wide data-fig is emitted only unscoped");

  // (e)
  ok(!existsSync(join(process.cwd(), "src/app/neighbourhoods/[slug]/streets/page.tsx")), "overflow route: the page is gone");
  const mw = stripComments(read("src/middleware.ts"));
  ok(/\/neighbourhoods\\\/\(\[\^\/\]\+\)\\\/streets/.test(mw) && /url\.hash = "streets"/.test(mw) && /NextResponse\.redirect\(url, 301\)/.test(mw), "middleware: /neighbourhoods/<slug>/streets 301s to the hub's #streets");
  const sitemap = stripComments(read("src/app/sitemap.ts"));
  ok(!/\/neighbourhoods\/\$\{hubSlug\}\/streets/.test(sitemap), "sitemap: the overflow page is not declared");
  const hubSections = stripComments(read("src/components/hub/sections.tsx"));
  ok(!/\/neighbourhoods\/\$\{data\.slug\}\/streets/.test(hubSections), "hub: no link to the retired overflow page");

  // (f)
  const parkingHubs = new Set<string>();
  for (const p of PILOT_PARKS) {
    const row = p.townPark ? TOWN_PARKS.find((t) => t.name.startsWith(p.townPark as string)) : undefined;
    const slug = row ? hubSlugAt(row.lng, row.lat) : null;
    if (slug) parkingHubs.add(slug);
  }
  const goHubs = new Set(hubSlugsNear(-79.867172, 43.52364, 1600).map((n) => n.slug));
  ok(parkingHubs.size >= 5 && goHubs.size >= 3, `up-links: the pilot parks reach ${parkingHubs.size} hubs and the station ${goHubs.size}`);
  for (const h of parkingHubs) ok(hubCarriesParkingGuide(h), `up-links: ${h} holds a pilot park and carries the parking guide`);
  for (const h of goHubs) ok(hubCarriesGoGuide(h), `up-links: ${h} is within 1.6 km of the station and carries the GO guide`);
  const [aParking] = [...parkingHubs];
  const hubGuides = guidesForHub({ condoHeavy: false, hubSlug: aParking }).map((g) => g.slug);
  ok(hubGuides.includes(GUIDE_SLUG.parking), "guidesForHub: a parking hub gets the parking guide");
  ok(!guidesForHub({ condoHeavy: false, hubSlug: "no-such-hub" }).map((g) => g.slug).includes(GUIDE_SLUG.parking), "guidesForHub: an unknown hub gets no parking guide");
  const [aGo] = [...goHubs];
  ok(guidesForStreet({ condoHeavy: false, hubSlugs: [aGo] }).map((g) => g.slug).includes(GUIDE_SLUG.goTrain), "guidesForStreet: a street in a GO hub gets the GO guide");
  ok(!guidesForStreet({ condoHeavy: false, hubSlugs: [] }).map((g) => g.slug).includes(GUIDE_SLUG.goTrain), "guidesForStreet: a street with no hub gets no GO guide");
  const check = stripComments(read("scripts/verify/checks/guide-links.mjs"));
  ok(/hubsLinkedFrom\(parkingPage\.body\)/.test(check) && /data-hubs/.test(check), "guide-links check: derives the sets from the guide pages and reads the ledger's declared hubs");

  // (g)
  const { sourceWindows } = await import("./verify/checks/sources-fresh.mjs");
  const gtfs = '{ "feed": { "version": "20260910145058", "startDate": "20260910", "endDate": "20261127" } }';
  const parking = 'export const PARKING_FETCHED_ON_ISO = "2026-09-11";\nfile: "milton-parking/a.txt"\nfile: "milton-parking/b.txt"';
  const open = sourceWindows("2026-10-01", { gtfs, parking });
  ok(open.every((r) => r.ok), "sources-fresh: both sources open on 2026-10-01");
  const gtfsClosed = sourceWindows("2026-11-28", { gtfs, parking });
  ok(!gtfsClosed[0].ok && gtfsClosed[0].why.includes("feed ended 2026-11-27"), "sources-fresh: the GTFS window closes the day after endDate");
  ok(gtfsClosed[1].ok, "sources-fresh: the parking pages (78 days) are still inside their window that day");
  ok(sourceWindows("2026-12-10", { gtfs, parking })[1].ok === true, "sources-fresh: 90 days old is the last allowed age");
  const past = sourceWindows("2026-12-11", { gtfs, parking });
  ok(!past[1].ok && past[1].why === "91 days old", "sources-fresh: 91 days old is past the window");
  const real = sourceWindows(new Date().toISOString().slice(0, 10));
  ok(real.length === 2, "sources-fresh: reads both real sources");
  const runner = stripComments(read("scripts/verify/run.mjs"));
  ok(/sourcesFresh/.test(runner), "sources-fresh: registered in the battery");

  if (failures.length > 0) {
    console.error(`[core-batch-3] FAIL: ${failures.length} of ${assertions} assertions:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log(`[core-batch-3] PASS: ${assertions} assertions across the seven MC-012 changes.`);
}
main();
