// scripts/generate-market-edition.ts
//
// The Market Watch edition runner. Mirrors the discipline of
// regen-058-local.ts and regen-condo-local.ts: explicit provider assertions, a
// refusal to start on a Claude primary, a cost ceiling, and a report of what it
// wrote rather than a claim that it worked.
//
// USAGE
//   npx tsx --tsconfig tsconfig.test.json scripts/generate-market-edition.ts
//   WEEK_OF=2026-08-31 ... --publish
//   ... --skip-paragraph      write sections 1 to 6 only, no provider call
//   ... --revalidate=<url>    POST /api/revalidate for the three paths
//
// REWRITING A PUBLISHED EDITION. An edition is immutable once published, and
// `generateEdition` throws rather than overwrite one. The single override is a
// correction note, which is not a flag to get past the gate: it is the sentence
// the page will carry, above every figure, telling a reader who already saw the
// old numbers that they changed and why.
//
//   CORRECTION_NOTE="one line, why this edition was rewritten"
//   WEEK_OF=2026-08-31 npx tsx ... --publish
//
// `--correction=<text>` does the same; the environment variable wins, and is
// the one to use on Windows, where quoting a sentence into argv is its own
// small trap.
//
// NOT with NODE_OPTIONS=--conditions=react-server: React's shared-subset entry
// throws "not yet supported outside of experimental channels" before anything
// runs. Same trap the condo runner documents.
import { readFileSync } from "node:fs";

function loadEnvLocal(): void {
  try {
    const raw = readFileSync(".env.local", "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        let v = m[2].replace(/\r$/, "");
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  } catch {}
}
loadEnvLocal();

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const valOf = (p: string) => args.find((a) => a.startsWith(p))?.slice(p.length) ?? null;

const WEEK_OF = process.env.WEEK_OF || undefined;
const PUBLISH = has("--publish");
const SKIP_PARAGRAPH = has("--skip-paragraph");
const REVALIDATE_BASE = valOf("--revalidate=");
const CORRECTION_NOTE = (process.env.CORRECTION_NOTE || valOf("--correction=") || "").trim() || undefined;
const COST_CEILING_USD = 0.25;

async function main() {
  // ── provider assertions, before anything costs money ────────────────────
  // Cheap-first is the rule and this runner will not quietly break it. The
  // Anthropic account has no credit (root HANDOFF open item 1), so a Claude
  // primary here fails on a balance rather than on a figure.
  const claudeish = ["claude", "opus", "sonnet", "haiku"];
  for (const knob of ["AI_PROVIDER_MARKET", "AI_PROVIDER_AHA", "AI_PROVIDER_EVAL"]) {
    const v = (process.env[knob] || "").trim().toLowerCase();
    if (claudeish.includes(v)) {
      console.error(`REFUSING TO START: ${knob}="${v}" names a Claude model. This runner is DeepSeek only.`);
      process.exit(1);
    }
  }
  if (!SKIP_PARAGRAPH && !process.env.DEEPSEEK_API_KEY) {
    console.error("DEEPSEEK_API_KEY is not set. Pass --skip-paragraph to write sections 1 to 6 without it.");
    process.exit(1);
  }
  if (!process.env.SOLD_DATABASE_URL) {
    console.error("SOLD_DATABASE_URL is not set. Every figure in an edition comes from it.");
    process.exit(1);
  }

  // A correction note without --publish would write a draft nobody reads and
  // leave the published row it was meant to correct exactly as it was.
  if (CORRECTION_NOTE && !PUBLISH) {
    console.error("A correction note only means something with --publish. Without it this writes a draft and the published edition stands uncorrected.");
    process.exit(1);
  }

  // The note is prose on a content page, so it answers to the same voice rule
  // as every other line on it. The production battery counts em-dashes across
  // the content pages and a hand-typed note is exactly where one gets in.
  if (CORRECTION_NOTE && /\u2014/.test(CORRECTION_NOTE)) {
    console.error("The correction note contains an em-dash. This tier does not use them; a comma, a semicolon or a full stop instead.");
    process.exit(1);
  }
  if (CORRECTION_NOTE && CORRECTION_NOTE.length > 240) {
    console.error(`The correction note is ${CORRECTION_NOTE.length} characters. It renders as one line above the figures; keep it under 240.`);
    process.exit(1);
  }

  console.log(`[market-watch] week=${WEEK_OF ?? "last complete"} publish=${PUBLISH} paragraph=${!SKIP_PARAGRAPH} provider=deepseek ceiling=$${COST_CEILING_USD}`);
  if (CORRECTION_NOTE) {
    console.log(`[market-watch] REWRITE. This will overwrite a published edition and stamp it:`);
    console.log(`[market-watch]   "${CORRECTION_NOTE}"`);
  }

  const { generateEdition, revalidateEdition } = await import("../src/lib/marketWatch/generate");

  const res = await generateEdition({
    weekOf: WEEK_OF,
    skipParagraph: SKIP_PARAGRAPH,
    publish: PUBLISH,
    correctionNote: CORRECTION_NOTE,
  });

  if (!res) {
    console.error("No edition built. A WEEK_OF must be a Monday in YYYY-MM-DD form.");
    process.exit(1);
  }

  const s = res.built.sections;
  console.log("");
  console.log(`WEEK        ${res.weekOf}  (${s.weekLabel})`);
  console.log(`WINDOW      ${s.windowStartIso} .. ${s.windowEndIso}`);
  console.log(`SOLD        ${s.sales.count}   (previous week ${s.previous.count})`);
  console.log(`NEW         ${s.newListings}`);
  console.log(`TYPICAL     ${s.sales.typicalPrice ?? "SUPPRESSED (k<5)"}`);
  console.log(`BAND        ${s.sales.bandLow ?? "SUPPRESSED (k<10)"} .. ${s.sales.bandHigh ?? "SUPPRESSED (k<10)"}`);
  console.log(`DOM         ${s.sales.avgDom ?? "SUPPRESSED"}`);
  console.log(`SOLD/ASK    ${s.sales.soldToAskPct ?? "SUPPRESSED"}`);
  console.log(`FORMS       ${s.forms.rows.map((f) => `${f.slug}=${f.count}${f.typicalPrice === null ? "(no price)" : ""}`).join(" ")}`);
  console.log(`NBHDS       ${s.neighbourhoods.length} with a sale`);
  console.log(`STREETS     ${s.streets.length} with a published page`);
  console.log(`PARAGRAPH   ${res.interpretation ? "written" : "NOT written"} — ${res.note}`);
  if (res.violations.length) {
    console.log(`VIOLATIONS  ${res.violations.map((v) => v.rule).join(", ")}`);
    for (const v of res.violations.slice(0, 5)) console.log(`   ${v.rule}: ${v.detail}`);
  }
  console.log(`COST        $${res.costUsd.toFixed(4)}`);
  if (res.costUsd > COST_CEILING_USD) {
    console.log(`WARNING: cost exceeded the $${COST_CEILING_USD} ceiling.`);
  }
  console.log(`STATUS      ${PUBLISH ? "published" : "draft"}${res.rewroteAPublishedEdition ? ", REWRITTEN over a published edition" : ""}`);
  console.log(`CORRECTION  ${res.correctionNote ?? "none, this was a first write"}`);

  if (REVALIDATE_BASE) {
    const secret = process.env.REVALIDATION_SECRET;
    if (!secret) {
      console.log("REVALIDATE  skipped, REVALIDATION_SECRET is not set");
    } else {
      const out = await revalidateEdition(res.weekOf, REVALIDATE_BASE.replace(/\/$/, ""), secret);
      // A revalidate that 401s does not fail the write, so it is silent unless
      // the status is read. Root HANDOFF learned this on 52 pages.
      for (const r of out) console.log(`REVALIDATE  ${r.status}  ${r.path}`);
    }
  }

  const { PrismaClient } = await import("@prisma/client");
  await new PrismaClient().$disconnect().catch(() => {});
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
