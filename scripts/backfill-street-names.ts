// scripts/backfill-street-names.ts
//
// Repairs StreetContent.streetName to the value the registry gives, for every row where the two
// disagree. No LLM, no network beyond DB1, and no other column is touched.
//
// WHY THIS EXISTS. DEC-NAME-SOURCE Build 1 wired resolveStreetName into the UPDATE branch of the
// StreetContent upsert but not the CREATE branch, so a row's first write took whatever MLS last
// wrote and only a later regeneration repaired it. That gap predates almost the whole corpus: at
// the time of writing, 380 of 472 rows still carried an abbreviated stored name ("Williams Ave",
// "Winter Cres"). The create branch is fixed now, which stops new rows from being born wrong; this
// repairs the ones that already were.
//
// NOT A DISPLAY BUG. The renderer and buildGeneratorInput both call the resolver, so pages read
// correctly either way. What this fixes is the column itself, which the DEC-PH41-DUALWRITE
// non-renderer read paths trust.
//
// IDEMPOTENT BY CONSTRUCTION: it only writes rows where stored !== resolved, so a second run finds
// nothing to do. The resolver is pure and slug-keyed, so the target value does not drift between
// runs.
//
// Usage:
//   npx tsx scripts/backfill-street-names.ts            # dry run: report only, no writes
//   npx tsx scripts/backfill-street-names.ts --write    # apply

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveStreetName } from "../src/lib/streetName";

const __dirname = dirname(fileURLToPath(import.meta.url));
function loadEnvLocal() {
  const content = readFileSync(resolve(__dirname, "..", ".env.local"), "utf8");
  for (const line of content.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
loadEnvLocal();

const DB1_URL = (process.env.DATABASE_URL || "").trim();
if (!DB1_URL) {
  console.error("Missing DATABASE_URL in .env.local");
  process.exit(1);
}

const WRITE = process.argv.includes("--write");
const db1 = neon(DB1_URL);

type Row = { streetSlug: string; streetName: string };

async function main() {
  const rows = (await db1`
    SELECT "streetSlug", "streetName" FROM public."StreetContent" ORDER BY "streetSlug"
  `) as unknown as Row[];

  const drift = rows
    .map((r) => ({ slug: r.streetSlug, before: r.streetName, after: resolveStreetName(r.streetSlug, r.streetName).name }))
    .filter((r) => r.after !== r.before);

  console.log(`StreetContent rows read: ${rows.length}`);
  console.log(`rows where stored != resolver: ${drift.length}`);
  console.log("");
  console.log("sample (up to 10):");
  for (const d of drift.slice(0, 10)) {
    console.log(`  ${d.slug.padEnd(32)} "${d.before}"  ->  "${d.after}"`);
  }
  console.log("");

  if (!WRITE) {
    console.log("dry run — pass --write to apply. No column other than streetName is touched.");
    return;
  }

  let changed = 0;
  for (const d of drift) {
    // streetName ONLY. description, faqJson, metaDescription, status and the timestamps are the
    // generator's to own; this script has no business rewriting prose it did not produce.
    const res = await db1`
      UPDATE public."StreetContent"
      SET "streetName" = ${d.after}
      WHERE "streetSlug" = ${d.slug} AND "streetName" IS DISTINCT FROM ${d.after}
    `;
    changed += (res as unknown as { rowCount?: number }).rowCount ?? 1;
  }
  console.log(`rows changed: ${changed}`);
}

main().catch((e) => {
  console.error("FATAL", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
