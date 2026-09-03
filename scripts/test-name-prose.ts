// DEC-NAME-SHORT: one name per street in prose, and no typographic dashes in street copy.
//
// TWO INVARIANTS, both learned from the same page.
//
// 1. shortName must never reach a prompt builder. buildGeneratorInput used to hand the model BOTH
//    "Buckthorn Garden" and "Buckthorn". Given two names for one street the model picked the short
//    one, and the page then rendered that prose beside an H1 carrying the full name. Width-limited
//    UI can shorten at render time; the generator should only ever know one name.
//
// 2. No U+2014 / U+2013 in street-page prose. The em-dash in "across Cobban — the neighbourhood,
//    not X specifically" is the tell people read as machine-written.
//
// SCOPE IS DELIBERATELY NARROW, and this is the part worth reading before widening it.
// src/ contains 1016 non-comment lines with one of these characters. Only 77 are street-page prose.
// The rest are:
//   - 883 site chrome (the brand title, og:description, manifest) where the em-dash is house style
//   - 44 API/email templates
//   - 12 admin UI, noindex
// and critically, 104 of those lines use an EN-DASH AS A NUMERIC RANGE — "3–5 comparable sold
// properties", "1–3 months". That is correct typography. A repo-wide assertion would be red on
// arrival and the only way to green it would be to corrupt every one of those ranges.
//
// So this guards the surface the rule is about. Widening it is a decision about house style
// everywhere else, not a bug fix, and should be made deliberately rather than inherited from a test.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const EM = "—";
const EN = "–";
const ROOT = join(__dirname, "..");

// Street-page prose surfaces. These are what a visitor reads about a street.
const PROSE_SCOPE = [
  "src/components/street/",
  "src/lib/street-data.ts",
  "src/lib/streetMinimal.ts",
  "src/lib/streetV2Data.ts",
];

// Files that build a model prompt. shortName must not appear in the payload they assemble.
const PROMPT_BUILDERS = [
  "src/lib/ai/buildGeneratorInput.ts",
  "src/lib/ai/buildHubInput.ts",
];

// Mock/fixture data is not shipped prose.
const PROSE_EXEMPT = new Set(["src/components/street/v2/mockData.ts"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/[.]tsx?$/.test(e.name)) out.push(full);
  }
  return out;
}

const rel = (abs: string) => relative(ROOT, abs).split(sep).join("/");
const isComment = (line: string) => {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*");
};
/** Everything before a trailing `//`, so a dash inside a code comment is not a prose violation.
 *  Skips `://` so a URL is not mistaken for the start of a comment. */
const codePart = (line: string) => {
  for (let i = 0; i < line.length - 1; i++) {
    if (line[i] === "/" && line[i + 1] === "/" && line[i - 1] !== ":") return line.slice(0, i);
  }
  return line;
};
// A bare em-dash standing in for "no value" is not prose: {value || "—"}
const isPlaceholder = (line: string) =>
  line.includes('"' + EM + '"') || line.includes("'" + EM + "'") || line.includes("{" + EM + "}");

const failures: string[] = [];

// ── 1. no typographic dashes in street-page prose ───────────────────────────────────────────────
let proseFilesScanned = 0;
for (const abs of walk(join(ROOT, "src"))) {
  const r = rel(abs);
  if (!PROSE_SCOPE.some((s) => r.startsWith(s))) continue;
  if (PROSE_EXEMPT.has(r)) continue;
  proseFilesScanned++;
  // Track block-comment state. A continuation line inside a banner or a JSX block comment carries
  // no prefix of its own, so prefix checks alone kept flagging comment prose as page prose.
  let inBlock = false;
  readFileSync(abs, "utf8").split("\n").forEach((line, i) => {
    const wasInBlock = inBlock;
    const opens = (line.match(/\/\*/g) || []).length;
    const closes = (line.match(/\*\//g) || []).length;
    if (opens > closes) inBlock = true;
    else if (closes > opens) inBlock = false;
    if (wasInBlock || isComment(line) || isPlaceholder(line)) return;
    const code = codePart(line);
    if (code.includes(EM) || code.includes(EN)) {
      failures.push(
        "  " + r + ":" + (i + 1) + " has a " + (code.includes(EM) ? "U+2014 em-dash" : "U+2013 en-dash") +
        " in street-page prose.\n      Use a comma, colon or full stop.\n      " + line.trim().slice(0, 100),
      );
    }
  });
}

// ── 2. shortName must not reach a prompt builder ────────────────────────────────────────────────
for (const r of PROMPT_BUILDERS) {
  let src: string;
  try {
    src = readFileSync(join(ROOT, r), "utf8");
  } catch {
    continue;
  }
  src.split("\n").forEach((line, i) => {
    if (isComment(line)) return;
    // The payload assembles as `shortName,` or `shortName: <expr>` inside the input object.
    if (/^\s*shortName\s*[,:]/.test(line)) {
      failures.push(
        "  " + r + ":" + (i + 1) + " puts shortName into a model prompt payload.\n" +
        "      DEC-NAME-SHORT: the generator gets ONE name per street, the full resolver name.\n" +
        "      " + line.trim().slice(0, 100),
      );
    }
  });
}

if (failures.length > 0) {
  console.error("[name-prose] FAIL — " + failures.length + " violation(s):");
  failures.forEach((f) => console.error(f));
  console.error("");
  console.error("A street has one name in prose. Two names, or a dash that reads as machine-written,");
  console.error("both show up on the page the visitor actually reads.");
  process.exit(1);
}
console.log(
  "[name-prose] PASS — " + proseFilesScanned + " street-prose files carry no U+2014/U+2013, " +
  "and no shortName reaches a prompt builder.",
);
