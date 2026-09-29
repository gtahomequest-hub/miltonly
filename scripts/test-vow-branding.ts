// scripts/test-vow-branding.ts, MC-047: who the VOW is branded to, and the notices it carries.
//
// Five things, held from source so a regression fails the build rather than the next audit:
//   1. THE STRINGS. The header names "Aamir Yaqoob, Sales Representative" and "RE/MAX Realty
//      Specialists Inc., Brokerage" (item 10, as TRREB's auditor read it on 2026-09-28). The
//      item 22 notice is PropTx's recommended wording verbatim, ending "or any other purpose.".
//      The copyright line (item 31) names TRREB and PropTx with the year computed. The listing
//      page's 8.24, 8.12 and 8.16 sentences say what they must.
//   2. EVERY PAGE HAS THE HEADER. Every src/app page.tsx reaches, through its imports, the forest
//      nav (whose strip names both) or the RegistrantStrip the self-headed pages carry, unless it
//      only redirects or is a noindex design preview. A new page with a header of its own and no
//      strip fails here.
//   3. NO TREB-ERA WORDING. "TREB" (the board's name before 2018; "TRREB" and "PropTx" now) appears
//      in no string or JSX text under src/. Comments and identifiers (TREB_API_URL) are not copy.
//   4. THE REGISTERED NAME. Every rendered "RE/MAX Realty Specialists Inc." carries ", Brokerage",
//      and the listing card's line (ListingDetailClient) renders config.brokerage.name.
//   5. NO BAKED YEAR. No "© 2026" literal: a footer's year is computed.
import fs from "node:fs";
import path from "node:path";
import { REGISTRANT_NAME_LINE, REGISTRANT_BROKERAGE_LINE, REGISTRANT_FULL_LINE, AUGMENTATION_LABEL, contactLine, reportInaccuracyLine, OG_SITE_NAME, HOME_TITLE } from "../src/lib/compliance/registrant";
import { VOW_BONA_FIDE_NOTICE, VOW_RELIABILITY_NOTICE, MLS_COPYRIGHT_NOTICE } from "../src/lib/vowNotice";
import { config } from "../src/lib/config";

let assertions = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string) {
  assertions++;
  if (!cond) failures.push(msg);
}

const ROOT = process.cwd();
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) walk(rel, out);
    else if (/\.(tsx?|mjs)$/.test(e.name)) out.push(rel);
  }
  return out;
}
/** Source with comments blanked (block, JSX and line comments), strings kept. Approximate, and
 *  deliberately so: a "//" inside a string survives because it is preceded by a quote or colon. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[\s;{}(),])\/\/[^\n]*/g, (_m, lead) => lead);
}

// ── 1. the strings ──────────────────────────────────────────────────────────────────────────────
ok(REGISTRANT_NAME_LINE === "Aamir Yaqoob, Sales Representative", `registrant line is "${REGISTRANT_NAME_LINE}"`);
ok(REGISTRANT_BROKERAGE_LINE === "RE/MAX Realty Specialists Inc., Brokerage", `brokerage line is "${REGISTRANT_BROKERAGE_LINE}"`);
ok(REGISTRANT_FULL_LINE.startsWith(`${REGISTRANT_NAME_LINE} · ${REGISTRANT_BROKERAGE_LINE} · `), "the footer's full line opens with both names");
const ITEM_22 =
  "The information provided herein must only be used by consumers that have a bona fide interest in the purchase, sale or lease of real estate and may not be used for any commercial purpose or any other purpose.";
ok(VOW_BONA_FIDE_NOTICE === ITEM_22, "the item 22 notice is PropTx's recommended wording, verbatim");
ok(VOW_BONA_FIDE_NOTICE.endsWith("or any other purpose."), "the item 22 notice ends \"or any other purpose.\"");
ok(VOW_RELIABILITY_NOTICE.includes("deemed reliable but is not guaranteed accurate by PropTx"), "the reliability notice names PropTx");
ok(
  MLS_COPYRIGHT_NOTICE(2031) === "MLS® listing data © 2031 Toronto Regional Real Estate Board (TRREB) and PropTx Innovations Inc. All rights reserved.",
  "the copyright line, exactly, for a given year",
);
ok(MLS_COPYRIGHT_NOTICE().includes(`© ${new Date().getFullYear()} `), "the copyright line defaults to the current year");
ok(AUGMENTATION_LABEL.includes("not part of the MLS® listing") && AUGMENTATION_LABEL.includes("Open Government Licence") && AUGMENTATION_LABEL.includes("PropTx MLS® System"), "the 8.24 label says what is added and names each source");
ok(contactLine("hello@miltonly.com").includes(REGISTRANT_NAME_LINE) && contactLine("hello@miltonly.com").includes(REGISTRANT_BROKERAGE_LINE) && contactLine("hello@miltonly.com").includes(config.realtor.phone) && contactLine("hello@miltonly.com").includes("hello@miltonly.com"), "the 8.12 line names the Member, the brokerage, the phone and the address");
ok(!contactLine(null).includes("null") && contactLine(null).includes(config.realtor.phone), "the 8.12 line without CONTACT_EMAIL still gives the phone");
ok(reportInaccuracyLine("hello@miltonly.com").includes("hello@miltonly.com") && reportInaccuracyLine("hello@miltonly.com").includes("48 hours") && reportInaccuracyLine("x@y.ca").startsWith("Listing brokerage"), "the 8.16 line addresses the listing brokerage, names the address and the 48 hours");
ok(!reportInaccuracyLine(null).includes("null") && reportInaccuracyLine(null).includes(config.realtor.phone), "the 8.16 line without CONTACT_EMAIL gives the phone");
for (const [name, s] of [["registrant", REGISTRANT_FULL_LINE], ["8.24", AUGMENTATION_LABEL], ["8.12", contactLine("a@b.ca")], ["8.16", reportInaccuracyLine("a@b.ca")]] as const) {
  ok(!s.includes("—"), `the ${name} sentence carries no em-dash`);
}

// ── the header: SiteNav's strip, its spacer, and the self-headed pages ──────────────────────────
const siteNav = read("src/components/nav/SiteNav.tsx");
ok(/className="sn-reg" data-registrant>/.test(siteNav), "SiteNav renders the registrant strip");
ok(siteNav.includes("{REGISTRANT_NAME_LINE}") && siteNav.includes("{REGISTRANT_BROKERAGE_LINE}"), "SiteNav's strip renders both names from the one module");
ok(siteNav.indexOf('data-registrant>') < siteNav.indexOf('<div className="m-wrap">'), "the strip sits above the bar");
ok(/<div className="sn-strip-space" aria-hidden="true" \/>/.test(siteNav), "SiteNav renders the in-flow spacer that keeps each page's clearance");
const navCss = read("src/components/nav/site-nav.css");
const strip = read("src/components/compliance/RegistrantStrip.tsx");
ok(/--sn-strip-h:\s*30px/.test(navCss) && /\.sn-strip-space\s*\{\s*height:\s*var\(--sn-strip-h\)/.test(navCss), "the strip and the spacer share one height variable");
ok(/nav \.sn-panel \{[^}]*top: calc\(66px \+ var\(--sn-strip-h\)\)/.test(navCss), "the phone panel opens under the strip and the bar");
{
  // A1: 14px or larger at every width, the strip's own rule and every media override of it
  const sizes = [...navCss.matchAll(/nav \.sn-reg \{([^}]*)\}/g)].map((m) => m[1].match(/font-size:\s*(\d+(?:\.\d+)?)px/)?.[1]).filter(Boolean).map(Number);
  ok(sizes.length >= 1 && sizes.every((n) => n >= 14), `the header strip is 14px or larger at every width (font sizes ${sizes.join(", ")})`);
  const tw = [...strip.matchAll(/text-\[(\d+)px\]/g)].map((m) => Number(m[1]));
  ok(tw.length >= 1 && tw.every((n) => n >= 14), `RegistrantStrip is 14px or larger (${tw.join(", ")})`);
}
ok(strip.includes("{REGISTRANT_NAME_LINE}") && strip.includes("{REGISTRANT_BROKERAGE_LINE}") && strip.includes("data-registrant"), "RegistrantStrip renders both names");
const OWN_HEADER = [
  "src/app/rentals/ads/AdsClient.tsx",
  "src/app/rentals/ads/[mlsNumber]/RentalsAdsClient.tsx",
  "src/app/sales/ads/[mlsNumber]/SalesAdsClient.tsx",
  "src/app/rentals/thank-you/ThankYouClient.tsx",
  "src/app/sales/thank-you/ThankYouClient.tsx",
];
for (const f of OWN_HEADER) {
  const s = read(f);
  const h = s.indexOf("<header");
  ok(h >= 0 && s.indexOf("<RegistrantStrip />", h) > h && s.indexOf("<RegistrantStrip />", h) < s.indexOf("</header>", h), `${f}: the strip is inside its <header>`);
  ok(s.includes("MLS_COPYRIGHT_NOTICE()") && s.includes("{VOW_NOTICES}"), `${f}: its footer carries the notices and the copyright line`);
}
ok(read("src/app/coming-soon/page.tsx").includes("<RegistrantStrip />"), "coming-soon carries the strip");

// ── 2. every page reaches a header ──────────────────────────────────────────────────────────────
const HEADER_MARKS = [/<SiteNav\b/, /<SiteNavLive\b/, /<SiteChrome\b/, /<RegistrantStrip\b/];
const resolveImport = (from: string, spec: string): string | null => {
  let base: string;
  if (spec.startsWith("@/")) base = path.posix.join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.posix.join(path.posix.dirname(from), spec);
  else return null;
  for (const c of [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) {
    if (fs.existsSync(path.join(ROOT, c)) && fs.statSync(path.join(ROOT, c)).isFile()) return c;
  }
  return null;
};
function reachesHeader(file: string, depth: number, seen: Set<string>): boolean {
  if (seen.has(file)) return false;
  seen.add(file);
  const src = stripComments(read(file));
  if (HEADER_MARKS.some((re) => re.test(src))) return true;
  if (depth === 0) return false;
  for (const m of src.matchAll(/^import\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']/gm)) {
    if (/\.css$/.test(m[1])) continue;
    const r = resolveImport(file, m[1]);
    if (r && /\.tsx$/.test(r) && reachesHeader(r, depth - 1, seen)) return true;
  }
  return false;
}
// design previews (noindex, mock data, never linked) and the admin desk are not consumer pages
const EXEMPT = new Set(["src/app/guide-preview/page.tsx", "src/app/guides-preview/page.tsx", "src/app/design-preview/street/page.tsx"]);
const pages = walk("src/app").filter((f) => /\/page\.tsx$/.test(f) && !f.startsWith("src/app/api/"));
let pagesChecked = 0;
for (const p of pages) {
  if (EXEMPT.has(p)) continue;
  const src = stripComments(read(p));
  const redirectOnly = /\b(redirect|permanentRedirect)\(/.test(src) && !/return\s*\(?\s*</.test(src);
  if (redirectOnly) continue;
  pagesChecked++;
  // a layout between the page and the root (admin/layout.tsx wraps the desk in SiteChrome)
  const layouts: string[] = [];
  for (let d = path.posix.dirname(p); d !== "src/app" && d.startsWith("src/app"); d = path.posix.dirname(d)) {
    if (fs.existsSync(path.join(ROOT, d, "layout.tsx"))) layouts.push(`${d}/layout.tsx`);
  }
  ok([p, ...layouts].some((f) => reachesHeader(f, 4, new Set())), `${p}: renders no header that carries the registrant (SiteNav, SiteChrome or RegistrantStrip)`);
}
ok(pagesChecked >= 40, `the page walk found ${pagesChecked} pages (expected at least 40)`);

// ── the footer and the listing page ─────────────────────────────────────────────────────────────
const footer = read("src/components/home/HomeFooter.tsx");
ok(footer.includes("<span data-vow-notice>{VOW_NOTICES}</span>"), "the footer carries the item 22 notice");
ok(footer.includes("<span data-copyright>{MLS_COPYRIGHT_NOTICE()}</span>"), "the footer carries the copyright line");
ok(footer.includes("<span data-registrant-full>{REGISTRANT_FULL_LINE}</span>"), "the footer keeps the full registrant line");
const ldc = read("src/app/listings/[mlsNumber]/ListingDetailClient.tsx");
ok(ldc.includes("data-augmented-label>{AUGMENTATION_LABEL}</p>"), "the listing page labels what it adds (8.24)");
ok(ldc.indexOf("data-augmented-label") < ldc.indexOf("<WhatsNearby"), "the 8.24 label sits above the first added block");
ok(ldc.includes("<p data-contact-line>{contactLine(extras.contactEmail)}</p>"), "the listing page carries the 8.12 contact line");
ok(ldc.includes("<p data-report-inaccuracy>{reportInaccuracyLine(extras.contactEmail)}</p>"), "the listing page carries the 8.16 report line");
ok(ldc.includes("<p>{VOW_NOTICES}</p>"), "the listing page carries the item 22 notice");
ok(read("src/app/listings/[mlsNumber]/page.tsx").includes("contactEmail: contactEmail(),"), "the listing page reads CONTACT_EMAIL on the server");

// the generators' ban lists name "our team" as a thing to refuse; they are not copy
const SWEEP_SKIP_PARTY = [/^src\/lib\/ai\//];
// ── the homesly.ca audit's findings, held (MC-047 addendum) ──────────────────────────────────────
{
  // A1: the footer leads with the Member; og:site_name and the homepage title name him
  const fStart = footer.indexOf('<div className="m-wrap">');
  ok(fStart > 0 && footer.indexOf("data-footer-member", fStart) > fStart && footer.indexOf("data-footer-member", fStart) < footer.indexOf('<div className="m-ftop">'), "the footer's first element is the Member line (A1)");
  for (const f of OWN_HEADER) {
    const s = read(f);
    const open = s.indexOf("<footer");
    ok(open > 0 && s.indexOf("data-footer-member", open) > open && s.indexOf("data-footer-member", open) < s.indexOf("<Link", open), `${f}: the footer leads with the Member (A1)`);
  }
  ok(OG_SITE_NAME.includes("Aamir Yaqoob"), `og:site_name names the Member ("${OG_SITE_NAME}")`);
  for (const f of ["src/app/layout.tsx", "src/lib/seo.ts", "src/app/rentals/ads/[mlsNumber]/page.tsx", "src/app/sales/ads/[mlsNumber]/page.tsx"]) {
    const s = read(f);
    ok(s.includes("siteName: OG_SITE_NAME,") && !s.includes("siteName: config.SITE_NAME"), `${f}: og:site_name is OG_SITE_NAME`);
  }
  ok(HOME_TITLE.includes("Aamir Yaqoob") && HOME_TITLE.length <= 60, `the homepage title names the Member within 60 characters ("${HOME_TITLE}")`);
  ok(read("src/app/page.tsx").includes("title: HOME_TITLE,"), "the homepage uses HOME_TITLE");
  const party: string[] = [];
  for (const f of walk("src")) {
    if (SWEEP_SKIP_PARTY.some((re) => re.test(f))) continue;
    const code = stripComments(read(f));
    if (/\bour team\b|\bthe team\b|Miltonly (agent|team|realtor)s?\b|(Contact|Ask|Send to) Miltonly\b|Miltonly will be in touch/i.test(code)) party.push(f);
  }
  ok(party.length === 0, `copy presenting Miltonly or a team as the party: ${party.join(", ")}`);

  // A2: /terms is titled "VOW Terms of Use", names the Member as the party, renders the clauses
  const terms = read("src/app/terms/page.tsx");
  ok(terms.includes('title: "VOW Terms of Use",') && terms.includes(">VOW Terms of Use</h1>"), "/terms is titled VOW Terms of Use, head and H1 (A2)");
  ok(terms.includes("data-terms-party") && terms.includes("{REGISTRANT_NAME_LINE}") && terms.includes("(the Member)"), "/terms names the Member as the party (A2)");
  ok(terms.includes("VOW_TERMS_CLAUSES.map(") && terms.includes("Version {VOW_TERMS_VERSION}"), "/terms renders the stored clauses and their version (A2)");

  // A4: no computed figure in the listing's MLS fields; the living area sits under the 8.24 label
  ok(!/pricePerSqft|\/sqft</.test(ldc), "no price per square foot on the listing page (A4)");
  ok(!/l\.sqft\.toLocaleString\(\)\} sqft/.test(ldc), "the living-area midpoint is not in the listing's fact line (A4)");
  ok(ldc.indexOf("data-derived-area") > ldc.indexOf("data-augmented-label"), "the living-area midpoint sits under the 8.24 label (A4)");
  for (const f of ["src/app/sales/ads/[mlsNumber]/SalesAdsClient.tsx", "src/app/rentals/ads/[mlsNumber]/RentalsAdsClient.tsx", "src/components/listings/v2/ListingCard.tsx", "src/lib/schema.ts", "src/app/listings/[mlsNumber]/page.tsx"]) {
    ok(!/\.sqft\b/.test(stripComments(read(f)).replace(/sqft: (true|number \| null)/g, "")), `${f}: renders no living-area midpoint (A4)`);
  }
}

// ── 4. the registered name ──────────────────────────────────────────────────────────────────────
ok(config.brokerage.name.endsWith(", Brokerage"), "config.brokerage.name carries \", Brokerage\"");
ok(ldc.includes("{config.realtor.name} · {config.brokerage.name}</p>"), "ListingDetailClient's card line renders config.brokerage.name (MC-043, line 438)");

// ── 3, 4, 5: a sweep of src/ ────────────────────────────────────────────────────────────────────
// Not copy: the sync routes' own logs and env names, and the generators' ban lists and comments.
const SWEEP_SKIP = [/^src\/app\/api\/sync\//, /^src\/lib\/sync\//, /^src\/lib\/ai\//, /^src\/app\/api\/content\//];
const trebHits: string[] = [];
const bareBrokerage: string[] = [];
const bakedYear: string[] = [];
for (const f of walk("src")) {
  const code = stripComments(read(f));
  if (!SWEEP_SKIP.some((re) => re.test(f))) {
    code.split("\n").forEach((line, i) => {
      if (/\bTREB\b/.test(line)) trebHits.push(`${f}:${i + 1}: ${line.trim().slice(0, 100)}`);
    });
  }
  // join "a" + "b" so a name split across a concatenation is read whole
  const joined = code.replace(/["'`]\s*\+\s*\n?\s*["'`]/g, "");
  for (const m of joined.matchAll(/RE\/MAX Realty Specialists Inc\.(.{0,12})/g)) {
    if (!m[1].startsWith(", Brokerage")) bareBrokerage.push(`${f}: "RE/MAX Realty Specialists Inc.${m[1]}"`);
  }
  if (/©\s*2026\b/.test(code)) bakedYear.push(f);
}
ok(trebHits.length === 0, `TREB-era wording in copy:\n    ${trebHits.join("\n    ")}`);
ok(bareBrokerage.length === 0, `the brokerage without ", Brokerage":\n    ${bareBrokerage.join("\n    ")}`);
ok(bakedYear.length === 0, `a baked "© 2026": ${bakedYear.join(", ")}`);

if (failures.length) {
  console.error(`test-vow-branding: ${failures.length} of ${assertions} assertions failed`);
  for (const f of failures) console.error(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`test-vow-branding: ${assertions} assertions passed (${pagesChecked} pages reach the registrant header)`);
