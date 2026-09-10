// Prebuild gate: NO FORM IN src/ POSTS ANYWHERE BUT THE ONE HELPER.
//
// Phase 1 moved nine surfaces onto src/lib/postLeadClient.ts and left sixteen behind, and the
// only thing holding the line was a list of seven filenames hard-coded in
// test-lead-guards.ts. A new form could hand-roll a fetch to a lead ingress and the build
// would pass, which is exactly how the site came to have four ingress routes in the first
// place. This test does not read a list. It walks every file under src/, finds every string
// literal handed to fetch(), every form `action=`, and every `<form method=`, and fails on
// anything that looks like a lead ingress unless it is the helper itself.
//
// It also asserts the three retired routes are gone from disk, because a retired route left
// in place is a route something will find again.
//
// Zero I/O beyond reading files. No database, no network, no env.

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = "src";

/** The ONE ingress, and the ONE file allowed to name it. */
const THE_PATH = "/api/leads/create";
const THE_HELPER = join("src", "lib", "postLeadClient.ts");

/** Anything matching this in a fetch target or a form action is a lead ingress. */
const LEAD_INGRESS = /\/api\/(leads|off-market-leads|exclusive-inquiry)(\/|\?|$|["'`])/;

/** Routes Phase 2 retired. A file here means something can still reach the old behaviour. */
const RETIRED_ROUTES = [
  join("src", "app", "api", "leads", "route.ts"),
  join("src", "app", "api", "off-market-leads", "route.ts"),
  join("src", "app", "api", "exclusive-inquiry", "route.ts"),
];

/** The surfaces this gate knows by name, each of which must use the helper. The walk above is
 *  what catches a NEW form; this list is what catches one of these being quietly rewritten. */
const SURFACES = [
  // Phase 1
  "src/components/street/v2/StreetAlertCTA.tsx",
  "src/components/condo/CondoCTAs.tsx",
  "src/components/sold/SoldValuationCTA.tsx",
  "src/components/street/ExitIntent.tsx",
  "src/components/street/CornerWidget.tsx",
  "src/components/places/PlaceAlertForm.tsx",
  "src/components/lead/DailyBriefSignup.tsx",
  // Phase 2
  "src/components/home/DailyBrief.tsx",
  "src/components/sections/PreFooterCTA.tsx",
  "src/components/sections/PersonaRouter.tsx",
  "src/components/sections/SoldOnMyStreet.tsx",
  "src/components/sections/MortgageCalculator.tsx",
  "src/components/sections/OffMarketForm.tsx",
  "src/components/landing/LeadCaptureForm.tsx",
  "src/components/landing/HomeValuationCard.tsx",
  "src/components/landing/MarketPulseUnlockCard.tsx",
  "src/components/landing/AamirTrustCard.tsx",
  "src/components/listings/v2/ResultsClient.tsx",
  "src/app/rentals/ads/UnlockModal.tsx",
  "src/app/rentals/RentalsClient.tsx",
  "src/app/listings/ListingsCardsClient.tsx",
  "src/app/listings/[mlsNumber]/ListingDetailClient.tsx",
  "src/app/listings/[mlsNumber]/ListingExtras.tsx",
  "src/app/exclusive/[slug]/InquiryForm.tsx",
];

/** Surfaces whose lead capture renders inside a <form>. Those must carry the honeypot: a
 *  bot submits a form, and a form with no trap is the one a bot gets through. */
const FORM_SURFACES = SURFACES.filter(
  (f) =>
    // Every listed surface renders a form EXCEPT these, whose capture is a button reading
    // fields off the DOM or out of component state with no <form> element at all.
    ![
      "src/app/listings/ListingsCardsClient.tsx",
      "src/app/listings/[mlsNumber]/ListingDetailClient.tsx",
      "src/components/listings/v2/ResultsClient.tsx",
      "src/app/listings/[mlsNumber]/ListingExtras.tsx",
      "src/components/condo/CondoCTAs.tsx",
    ].includes(f),
);

let assertions = 0;
const failures: string[] = [];

function ok(cond: boolean, label: string) {
  assertions++;
  if (!cond) failures.push(label);
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

/** Strip // line comments and block comments so a comment naming a retired route is not a
 *  failure. What matters is what the code calls, not what it says about history. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^[ \t]*\/\/.*$/gm, " ")
    .replace(/([^:"'`\\])\/\/[^\n"'`]*$/gm, "$1 ");
}


/** Every object literal handed to the helper, by brace matching from the call site. Used so
 *  the vocabulary rule reads the SUBMISSION and not every `intent:` key in the file. */
function leadPayloads(code: string): string[] {
  const out: string[] = [];
  const call = /\bpostLead(?:Detailed)?\s*\(\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = call.exec(code)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    for (; i < code.length && depth > 0; i++) {
      if (code[i] === "{") depth++;
      else if (code[i] === "}") depth--;
    }
    out.push(code.slice(m.index + m[0].length, i - 1));
  }
  return out;
}

function main() {
  // ── the retired routes are gone ────────────────────────────────────────────────
  for (const route of RETIRED_ROUTES) {
    ok(!existsSync(route), `retired route still on disk: ${route}`);
  }
  ok(existsSync(join("src", "app", "api", "leads", "create", "route.ts")), "the one ingress route exists");
  ok(existsSync(THE_HELPER), "the one client helper exists");

  // ── the walk: no lead ingress named anywhere but the helper ────────────────────
  const files = walk(SRC);
  ok(files.length > 200, `the walk found ${files.length} files under src/, which looks like the whole tree`);

  for (const file of files) {
    const rel = relative(".", file);
    const isHelper = rel.split(sep).join("/") === THE_HELPER.split(sep).join("/");
    const code = stripComments(readFileSync(file, "utf-8"));

    // Every fetch target that is a string literal.
    const fetchRe = /\bfetch\s*\(\s*(["'`])([^"'`\n]*)\1/g;
    let m: RegExpExecArray | null;
    while ((m = fetchRe.exec(code)) !== null) {
      const target = m[2];
      if (!LEAD_INGRESS.test(`${target}"`)) continue;
      if (isHelper && target === THE_PATH) continue;
      failures.push(`${rel}: fetch("${target}") — a lead ingress reached outside ${THE_HELPER}`);
      assertions++;
    }

    // A form `action` pointing at a lead ingress. These were dead code (the submit handler
    // always preventDefault'd) but a dead action is a live promise to a bot with no JS.
    const actionRe = /\baction\s*=\s*(?:\{\s*)?(["'`])([^"'`\n]*)\1/g;
    while ((m = actionRe.exec(code)) !== null) {
      if (!LEAD_INGRESS.test(`${m[2]}"`)) continue;
      failures.push(`${rel}: form action="${m[2]}" — a lead ingress reached outside ${THE_HELPER}`);
      assertions++;
    }

    // An axios/XHR-shaped call at a lead ingress. Nothing in this repo uses either today;
    // the assertion exists so adopting one does not silently open a second path.
    for (const pattern of [/\baxios\s*\.\s*post\s*\(\s*["'`]([^"'`\n]*)/g, /\.open\s*\(\s*["'`]POST["'`]\s*,\s*["'`]([^"'`\n]*)/g]) {
      while ((m = pattern.exec(code)) !== null) {
        if (!LEAD_INGRESS.test(`${m[1]}"`)) continue;
        failures.push(`${rel}: ${m[0].slice(0, 40)} — a lead ingress reached outside ${THE_HELPER}`);
        assertions++;
      }
    }
  }
  ok(true, "no surface reaches a lead ingress except through the helper");

  // ── the helper names the one path, once ───────────────────────────────────────
  const helper = readFileSync(THE_HELPER, "utf-8");
  ok(helper.includes(`fetch("${THE_PATH}"`), `the helper posts to ${THE_PATH}`);
  ok(
    (stripComments(helper).match(/fetch\s*\(/g) ?? []).length === 1,
    "the helper makes exactly one fetch call",
  );
  ok(helper.includes('from "@/lib/lead/honeypot"'), "the helper reads the honeypot name from the shared module");
  ok(helper.includes("[HONEYPOT_FIELD]"), "the helper sends the honeypot field");
  ok(helper.includes("attributionPayload()"), "the helper sends first-touch and last-touch attribution");

  // ── each known surface uses the helper, and says what it is ───────────────────
  for (const rel of SURFACES) {
    if (!existsSync(rel)) {
      failures.push(`${rel}: listed surface does not exist — update this list or restore the file`);
      assertions++;
      continue;
    }
    const src = readFileSync(rel, "utf-8");
    ok(/from ["']@\/lib\/postLeadClient["']/.test(src), `${rel}: imports the shared client helper`);
    // The vocabulary, checked INSIDE the submission payload only. Several of these surfaces
    // pass a different `intent` to gtag on purpose: the GA4 param is an analytics token
    // ("home-valuation", "buyer-question") and the lead row carries the economic bucket. A
    // blunt file-wide grep cannot tell those apart and would force one of the two to be
    // renamed to satisfy a test, which is the test bending the code.
    for (const payload of leadPayloads(stripComments(src))) {
      // Read every quoted token on the intent line, so a ternary
      // ("isSales ? 'buy' : 'rent'") is checked on both arms rather than skipped.
      const line = payload.match(/\bintent:[^,}\n]*/);
      const tokens = line ? line[0].match(/["'][a-z-]+["']/g) ?? [] : [];
      for (const quoted of tokens) {
        const token = quoted.slice(1, -1);
        ok(
          ["buy", "sell", "rent"].includes(token),
          `${rel}: submission sends intent "${token}", not the vocabulary estimateLeadValue understands`,
        );
      }
      // `source:`, or the shorthand `source,` where the surface takes the tag as a prop. A
      // spread of a PostLeadPayload also passes: `source` is required on that type, so the
      // compiler is already the gate and a stricter rule here would only catch the spread.
      ok(
        /\bsource\s*[:,}]/.test(payload) || payload.includes("..."),
        `${rel}: submission is source-tagged`,
      );
    }
  }

  for (const rel of FORM_SURFACES) {
    if (!existsSync(rel)) continue;
    const src = readFileSync(rel, "utf-8");
    ok(/honeypotInputProps|honeypot:/.test(src), `${rel}: carries the honeypot`);
  }

  // ── the ingest path still owns the write ──────────────────────────────────────
  const route = readFileSync(join("src", "app", "api", "leads", "create", "route.ts"), "utf-8");
  ok(route.includes("ingestLead("), "the one route delegates to the one ingest path");
  ok(!route.includes("prisma."), "the one route does not write the database itself");

  if (failures.length > 0) {
    console.error(`[lead-forms] FAIL — ${failures.length} of ${assertions} assertions:`);
    for (const f of failures) console.error(`  ${f}`);
    process.exit(1);
  }
  console.log(
    `[lead-forms] PASS — ${assertions} assertions. ${SURFACES.length} surfaces on one helper, one ingress, three retired routes gone.`,
  );
}

main();
