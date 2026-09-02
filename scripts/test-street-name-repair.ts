// Regression guard for the street naming authority.
//
// WHY THIS EXISTS, AND WHY IT CHANGED. Build 1 of DEC-NAME-SOURCE made the Town registry the single
// naming authority. The previous version of this file asserted a HAND-WRITTEN list of names — which
// meant it went green on "Buckthorn", the exact truncation it should have caught. A guard whose
// expected values are typed by the same person who typed the bug is not a guard.
//
// It now asserts against MILTON_STREET_REGISTRY itself: every registry slug must resolve to exactly
// titleCaseOfficial(reg.name). That invariant is what makes the 13 directional and 2 truncated-Garden
// defects impossible to reintroduce.
//
// Deliberately pure and registry-wide rather than DB-backed: prebuild runs on every build, and the
// rendered-vs-resolver half of the assertion needs one page load per street. That half is verified in
// the Gate B diff, not here. What this guards is the derivation.
import { displayStreetName, resolveStreetName, titleCaseOfficial } from "../src/lib/streetName";
import { cleanNeighbourhoodName } from "../src/lib/format";
import { MILTON_STREET_REGISTRY } from "../src/data/miltonStreetRegistry";

const failures: string[] = [];

// ── 1. Every registry slug resolves to its official name ────────────────────────────────────────
let regChecked = 0;
for (const r of MILTON_STREET_REGISTRY) {
  regChecked++;
  const resolved = resolveStreetName(r.slug, "IGNORED RAW NAME");
  const want = titleCaseOfficial(r.name);
  if (resolved.source !== "registry") {
    failures.push("  " + r.slug + ": source '" + resolved.source + "', expected 'registry'");
  } else if (resolved.name !== want) {
    failures.push("  " + r.slug + ": resolved '" + resolved.name + "', expected '" + want + "'");
  }
}

// ── 2. A raw MLS name must NEVER beat the registry ──────────────────────────────────────────────
// These are the exact live defects Build 1 removes, plus the casing pages it must NOT regress.
const OVERRIDE_CASES: { slug: string; raw: string; want: string; why: string }[] = [
  { slug: "kennedy-circle-milton", raw: "Kennedy Cir W", want: "Kennedy Circle", why: "directional the registry does not carry" },
  { slug: "main-street-milton", raw: "Main St E", want: "Main Street", why: "directional belongs in street_direction, not the name" },
  { slug: "bronte-street-milton", raw: "Bronte St S", want: "Bronte Street", why: "directional" },
  { slug: "trafalgar-road-milton", raw: "Trafalgar Rd W", want: "Trafalgar Road", why: "directional" },
  { slug: "buckthorn-garden-milton", raw: "Buckthorn", want: "Buckthorn Garden", why: "junk regex truncated the type word" },
  { slug: "sycamore-garden-milton", raw: "Sycamore Gardens E", want: "Sycamore Garden", why: "truncated in one store, over-decorated in the other" },
  { slug: "mcdougall-crossing-milton", raw: "Mcdougall Crossing", want: "McDougall Crossing", why: "CASING MUST NOT REGRESS" },
  { slug: "mackenzie-drive-milton", raw: "Mackenzie Dr", want: "MacKenzie Drive", why: "CASING MUST NOT REGRESS" },
  { slug: "mclaughlin-avenue-milton", raw: "Mclaughlin Ave N", want: "McLaughlin Avenue", why: "casing plus a directional" },
  { slug: "kennedy-circle-east-milton", raw: "Kennedy Cir", want: "Kennedy Circle East", why: "East/West remain three separate streets" },
  { slug: "kennedy-circle-west-milton", raw: "Kennedy Cir", want: "Kennedy Circle West", why: "East/West remain three separate streets" },
];
for (const c of OVERRIDE_CASES) {
  const got = resolveStreetName(c.slug, c.raw).name;
  if (got !== c.want) {
    failures.push("  " + c.slug + ": raw '" + c.raw + "' resolved '" + got + "', want '" + c.want + "' — " + c.why);
  }
}

// ── 3. Off-registry streets PASS THROUGH — null canonicalName means pass-through, not empty ─────
for (const slug of ["second-line-milton", "nipissing-road-milton", "25-side-road-milton"]) {
  const r = resolveStreetName(slug, null);
  if (r.source !== "off-registry" || !r.name || r.name.includes("-")) {
    failures.push("  " + slug + ": off-registry pass-through broken — source '" + r.source + "', name '" + r.name + "'");
  }
}
// 25 Side Road keeps its leading number: the slug begins with a digit, so it is part of the name.
if (resolveStreetName("25-side-road-milton", "25 Side Rd").name !== "25 Side Road") {
  failures.push("  25-side-road-milton: leading number was stripped; the slug proves it belongs");
}

// ── 4. The fallback never returns a bare slug ───────────────────────────────────────────────────
const noRaw = resolveStreetName("clitherow-drive-milton", null);
if (noRaw.name.includes("-") || !noRaw.name) {
  failures.push("  clitherow-drive-milton: fallback produced a slug-like name '" + noRaw.name + "'");
}

// ── 5. displayStreetName artifact repairs still hold ────────────────────────────────────────────
const ARTIFACTS: { input: string; slug: string; want: string; why: string }[] = [
  { input: "Kovachik Boulevard #bsmt", slug: "kovachik-boulevard-milton", want: "Kovachik Boulevard", why: "unit designator leaked in" },
  { input: "420 Hincks Drive", slug: "hincks-drive-milton", want: "Hincks Drive", why: "house number leaked in; slug carries no number" },
  { input: "25 Side Rd", slug: "25-side-road-milton", want: "25 Side Rd", why: "MUST NOT strip — slug begins with the number" },
  { input: "15 Side Road Side Road", slug: "15-side-road-side-road-milton", want: "15 Side Road", why: "adjacent repeated phrase" },
  { input: "First Line Nassagaweya Line", slug: "first-line-nassagaweya-line-milton", want: "First Line Nassagaweya", why: "trailing type word already present" },
  { input: "Rose Way", slug: "rose-way-milton", want: "Rose Way", why: "clean name passes through untouched" },
];
for (const c of ARTIFACTS) {
  const got = displayStreetName(c.input, c.slug);
  if (got !== c.want) {
    failures.push("  artifact '" + c.input + "': got '" + got + "', want '" + c.want + "' — " + c.why);
  }
}

// ── 6. MLS-code strip on neighbourhoods ─────────────────────────────────────────────────────────
const NBHD: { input: string; want: string }[] = [
  { input: "1051 - Walker", want: "Walker" },
  { input: "1032 - FO Ford", want: "Ford" },
  { input: "Dempsey", want: "Dempsey" },
  { input: "1051 - Walker, Dempsey", want: "Walker, Dempsey" },
];
for (const c of NBHD) {
  const got = cleanNeighbourhoodName(c.input);
  if (got !== c.want) failures.push("  nbhd '" + c.input + "': got '" + got + "', want '" + c.want + "'");
}

if (failures.length > 0) {
  console.error("[street-name-repair] FAIL — " + failures.length + " assertion(s) broken:");
  failures.slice(0, 25).forEach((f) => console.error(f));
  if (failures.length > 25) console.error("  ... and " + (failures.length - 25) + " more");
  console.error("");
  console.error("The registry is the naming authority. These strings ship in the H1, the <title>,");
  console.error("the meta description and the JSON-LD simultaneously.");
  process.exit(1);
}
const extra = OVERRIDE_CASES.length + ARTIFACTS.length + NBHD.length + 5;
console.log(
  "[street-name-repair] PASS — " + regChecked + " registry slugs resolve to their official name, " +
  "plus " + extra + " override/artifact/neighbourhood cases.",
);
