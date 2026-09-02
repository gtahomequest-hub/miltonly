// Regression guard for displayStreetName (src/lib/street-data.ts) and the MLS-code strip in
// cleanOneNeighbourhood (src/lib/format.ts).
//
// WHY THIS EXISTS. Both repairs are pattern work, and pattern work fails SILENTLY: a lost
// backslash turns \s into a literal "s" and the rule simply never fires — no error, no crash, just
// an artifact back in the <title> and the H1. That happened twice while writing this code. Every
// case below is a real value measured off the live data, not an invented example.
//
// These names feed BOTH the H1 and generateMetadata's <title>, so a regression here puts the two
// out of sync on the affected pages.
import { displayStreetName } from "../src/lib/street-data";
import { cleanNeighbourhoodName } from "../src/lib/format";

type Case = { input: string; slug: string; want: string; why: string };

const NAMES: Case[] = [
  { input: "Kovachik Boulevard #bsmt", slug: "kovachik-boulevard-milton", want: "Kovachik Boulevard",
    why: "a listing's unit designator leaked into the street name" },
  { input: "420 Hincks Drive", slug: "hincks-drive-milton", want: "Hincks Drive",
    why: "house number leaked in; the slug carries no number, so it is not part of the name" },
  { input: "25 Side Rd", slug: "25-side-road-milton", want: "25 Side Rd",
    why: "MUST NOT strip: the slug begins with the number, so the 25 is part of the name" },
  { input: "15 Side Road Side Road", slug: "15-side-road-side-road-milton", want: "15 Side Road",
    why: "adjacent repeated phrase" },
  { input: "First Line Nassagaweya Line", slug: "first-line-nassagaweya-line-milton", want: "First Line Nassagaweya",
    why: "trailing type word already present earlier" },
  { input: "Mcdougall Crossing", slug: "mcdougall-crossing-milton", want: "McDougall Crossing", why: "Mc casing" },
  { input: "Mcphail Way", slug: "mcphail-way-milton", want: "McPhail Way", why: "Mc casing" },
  { input: "Mclaughlin Avenue", slug: "mclaughlin-avenue-milton", want: "McLaughlin Avenue", why: "Mc casing" },
  { input: "Rose Way", slug: "rose-way-milton", want: "Rose Way", why: "clean name must pass through untouched" },
  { input: "Main Street East", slug: "main-street-east-milton", want: "Main Street East",
    why: "directional suffix must survive; these are distinct streets" },
  { input: "Nassagaweya Esquesing Townline", slug: "nassagaweya-esquesing-townline-milton",
    want: "Nassagaweya Esquesing Townline", why: "no repeated token — must not be shortened" },
];

const NBHD: { input: string; want: string; why: string }[] = [
  { input: "1051 - Walker", want: "Walker", why: "bare numeric prefix, no letter code — the case that used to fall through" },
  { input: "1032 - FO Ford", want: "Ford", why: "numeric prefix plus area code" },
  { input: "Dempsey", want: "Dempsey", why: "clean value untouched" },
  { input: "1051 - Walker, Dempsey", want: "Walker, Dempsey", why: "comma-separated multi-value" },
];

const failures: string[] = [];
for (const c of NAMES) {
  const got = displayStreetName(c.input, c.slug);
  if (got !== c.want) failures.push(`  name "${c.input}" (${c.slug})\n    got  "${got}"\n    want "${c.want}"  — ${c.why}`);
}
for (const c of NBHD) {
  const got = cleanNeighbourhoodName(c.input);
  if (got !== c.want) failures.push(`  nbhd "${c.input}"\n    got  "${got}"\n    want "${c.want}"  — ${c.why}`);
}

if (failures.length > 0) {
  console.error(`[street-name-repair] FAIL — ${failures.length} of ${NAMES.length + NBHD.length} cases:`);
  failures.forEach((f) => console.error(f));
  console.error("\nThese strings ship in both the <title> and the H1. A miss puts them out of sync.");
  process.exit(1);
}
console.log(`[street-name-repair] PASS — ${NAMES.length + NBHD.length} cases (${NAMES.length} names, ${NBHD.length} neighbourhoods).`);
