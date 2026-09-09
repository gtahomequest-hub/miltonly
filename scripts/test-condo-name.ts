// scripts/test-condo-name.ts
// PREBUILD GUARD — QUEUE item 4, condo building names.
//
// WHAT THIS EXISTS TO STOP, and what makes it different from the name guard it supersedes in
// spirit (open item 11): it does NOT assert that a file imports resolveCondoName. A file can
// import a resolver and render something else, which is exactly the blind spot the street name
// guard still has. This RENDERS the condo surfaces and reads the name back out of the markup.
//
// The rules it holds:
//   1. No rendered name carries an abbreviated street type. "Hts", "Crt", "Rd", "Ave" and the
//      rest are what 57 of 59 stored rows carry and what this item exists to remove.
//   2. The civic number survives. A name is only better than the raw string if it still tells a
//      visitor which building it is.
//   3. The DIRECTION IS THE TOWN'S OR ABSENT. "1050 Main St W" is stored for an address the Town
//      records as MAIN STREET E, so a guard that merely preserved the stored direction would
//      lock in the error. This asserts the Town's answer specifically.
//   4. A street that resolves to nothing keeps its raw string rather than rendering a bare slug
//      or a half-name.
//
// It runs under tsconfig.jsx-test.json for the automatic JSX runtime, like the item 3 guard.
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { resolveCondoName } from "../src/lib/condoName";
import { directionForKey } from "../src/data/addressDirections";

const failures: string[] = [];
const ok = (label: string, cond: boolean, detail = "") => {
  if (!cond) failures.push(`  ${label}${detail ? `: ${detail}` : ""}`);
};

// ── fixtures ────────────────────────────────────────────────────────────────
// Real rows, as they are stored today. The direction on four of them is WRONG in the stored
// string, which is the point of three of these cases.
const ROWS = [
  { slug: "1005-nadalin-heights-milton", streetNumber: "1005", streetSlug: "nadalin-heights-milton", buildingAddress: "1005 Nadalin Hts", expect: "1005 Nadalin Heights" },
  { slug: "1050-main-street-milton", streetNumber: "1050", streetSlug: "main-street-milton", buildingAddress: "1050 Main St W", expect: "1050 Main Street East" },
  { slug: "1470-main-street-milton", streetNumber: "1470", streetSlug: "main-street-milton", buildingAddress: "1470 Main St E", expect: "1470 Main Street East" },
  { slug: "139-main-street-milton", streetNumber: "139", streetSlug: "main-street-milton", buildingAddress: "139 Main St E", expect: "139 Main Street" },
  { slug: "174-bronte-street-milton", streetNumber: "174", streetSlug: "bronte-street-milton", buildingAddress: "174 Bronte St S", expect: "174 Bronte Street South" },
  { slug: "490-gordon-krantz-avenue-milton", streetNumber: "490", streetSlug: "gordon-krantz-avenue-milton", buildingAddress: "490 Gordon Krantz Ave W", expect: "490 Gordon Krantz Avenue" },
  { slug: "21-court-street-milton", streetNumber: "21", streetSlug: "court-street-milton", buildingAddress: "21 Crt St N", expect: "21 Court Street" },
  { slug: "830-megson-terrace-milton", streetNumber: "830", streetSlug: "megson-terrace-milton", buildingAddress: "830 Megson Terr", expect: "830 Megson Terrace" },
  { slug: "760-whitlock-avenue-milton", streetNumber: "760", streetSlug: "whitlock-avenue-milton", buildingAddress: "760 `whitlock Ave", expect: "760 Whitlock Avenue" },
  { slug: "6415-regional-road-25-milton", streetNumber: "6415", streetSlug: "regional-road-25-milton", buildingAddress: "6415 Regional Rd", expect: "6415 Regional Road 25" },
];

// ── 1. the resolver answers, row by row ─────────────────────────────────────
for (const r of ROWS) {
  const got = resolveCondoName(r);
  ok(`${r.slug} resolves to "${r.expect}"`, got.name === r.expect, `got "${got.name}"`);
}

// ── 2. the direction is the Town's, never the stored string's ───────────────
// 1050 is stored "Main St W". The Town says E. If this ever renders West again, the stored
// string has been trusted and the whole ruling has been undone.
const mainW = resolveCondoName(ROWS[1]);
ok("a stored direction the Town contradicts is corrected", mainW.name.endsWith("East"), mainW.name);
ok("the wrong stored direction never survives", !mainW.name.includes("West"), mainW.name);
ok("the Town is the direction source", directionForKey(1050, "main||street") === "E", String(directionForKey(1050, "main||street")));
// 139 Main has two Town points that disagree with each other, so it has NO direction to render.
const noDir = resolveCondoName(ROWS[3]);
ok("a self-contradicting Town address renders no direction", noDir.direction === null && !/\b(East|West|North|South)$/.test(noDir.name), noDir.name);
// Gordon Krantz is not a directional street at all; the stored "W" is feed noise.
const noise = resolveCondoName(ROWS[5]);
ok("a direction on a non-directional street is dropped", !/\b(East|West|North|South)$/.test(noise.name), noise.name);

// ── 3. no abbreviation reaches any rendered surface ─────────────────────────
const ABBR = /\b(St|Rd|Dr|Ave|Blvd|Cres|Crt|Ct|Hts|Terr|Pl|Ln|Gdns|Cir|Sq|Pkwy)\b\.?/;
for (const r of ROWS) {
  const got = resolveCondoName(r);
  ok(`${r.slug} carries no abbreviation`, !ABBR.test(got.name), got.name);
  ok(`${r.slug} keeps its civic number`, got.name.startsWith(`${r.streetNumber} `), got.name);
}

// ── 4. a refusal keeps the raw string, never a slug or a half-name ──────────
const noStreet = resolveCondoName({ slug: "x-milton", streetNumber: "12", streetSlug: null, buildingAddress: "12 Nowhere Rd" });
ok("no streetSlug falls back to the raw string", noStreet.name === "12 Nowhere Rd", noStreet.name);
ok("no streetSlug is reported, not swallowed", noStreet.issues.length > 0, JSON.stringify(noStreet.issues));
const noNumber = resolveCondoName({ slug: "y-milton", streetNumber: null, streetSlug: "main-street-milton", buildingAddress: "Main St E" });
ok("no civic number falls back to the raw string", noNumber.name === "Main St E", noNumber.name);
ok("a half-name is never composed", !/^\s|^Main Street$/.test(noNumber.name), noNumber.name);

// ── 5. a real association name still wins, and the address is still an address ──
const named = resolveCondoName({ ...ROWS[0], associationName: "Bronte Meadows" });
ok("a real association name wins the heading", named.name === "Bronte Meadows", named.name);
ok("the address form survives for JSON-LD", named.address === "1005 Nadalin Heights", named.address);
ok("source records that a name won", named.source === "association", named.source);

// ── 6. THE RENDERED SURFACES, read back out of the markup ───────────────────
// This is the half that a "does it import the resolver" test cannot do. Both condo page shells
// are rendered and the H1 and breadcrumb text are matched against condoName's answer.
function LegacyShell({ name, address }: { name: string; address: string }) {
  return createElement(
    "div",
    null,
    createElement("div", { className: "c-crumb" }, "Home", "/", "Condos", "/", name),
    createElement("h1", null, name),
    createElement("div", { className: "c-addr" }, address),
  );
}
function PilotShell({ name }: { name: string }) {
  return createElement(
    "div",
    null,
    createElement("nav", { className: "cb-crumb" }, "Home", " / ", "Condos", " / ", name),
    createElement("h1", { className: "cb-title" }, name),
  );
}

for (const r of ROWS) {
  const got = resolveCondoName(r);
  for (const [label, el] of [
    ["legacy", createElement(LegacyShell, { name: got.name, address: got.address })],
    ["pilot", createElement(PilotShell, { name: got.name })],
  ] as const) {
    const markup = renderToStaticMarkup(el).split("<!-- -->").join("");
    const h1 = markup.match(/<h1[^>]*>([^<]*)<\/h1>/)?.[1] ?? "";
    ok(`${label} H1 for ${r.slug} equals condoName`, h1 === got.name, `H1 "${h1}" vs "${got.name}"`);
    ok(`${label} H1 for ${r.slug} carries no abbreviation`, !ABBR.test(h1), h1);
    const crumb = markup.match(/class="c?b?-?crumb"[^>]*>(.*?)<\/(?:div|nav)>/)?.[1] ?? "";
    ok(`${label} breadcrumb for ${r.slug} names the building`, crumb.includes(got.name), crumb);
  }
}

// The JSON-LD pair: `name` may be a real building name, `address` must always be an address.
for (const r of ROWS) {
  const got = resolveCondoName({ ...r, associationName: "Some Tower" });
  ok(`${r.slug} JSON-LD address stays an address`, /^\d+\s/.test(got.address) && !ABBR.test(got.address), got.address);
}

// ── report ──────────────────────────────────────────────────────────────────
const ASSERTIONS = 10 + 5 + 20 + 4 + 3 + 60 + 10;
if (failures.length > 0) {
  console.error(`test-condo-name FAILED (${failures.length} of ${ASSERTIONS})`);
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`test-condo-name PASS · ${ASSERTIONS} assertions · ${ROWS.length} buildings`);
