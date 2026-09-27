// MC-037 item 7. Nineteen StreetContent rows (sixteen published, three draft) still carry the
// legacy FAQ template's "Register for full MLS® access …" answer, written by the pre-phase41
// path on 2026-04-17 (src/lib/generateStreet.ts buildFaqJson, reworded by MC-036). A scrub, not a
// regeneration: the sentence is a fixed template string, the rows have attempts=4 and
// needsReview=true so the hourly cron never regenerates them, and nothing renders faqJson
// today (the page passes [] without a generation). The scrub rewrites the one sentence in place,
// keeps the generation, and revalidates the page through /api/revalidate, as every StreetContent
// write must (DEC-REGEN-REVALIDATE).
//
//   npx tsx --tsconfig tsconfig.test.json --require ./scripts/_server-only-shim.cjs scripts/scrub-legacy-faq.ts          (dry run)
//   npx tsx --tsconfig tsconfig.test.json --require ./scripts/_server-only-shim.cjs scripts/scrub-legacy-faq.ts --write
import { readFileSync } from "node:fs";
import path from "node:path";

function loadEnvLocal() {
  const f = path.join(process.cwd(), ".env.local");
  for (const l of readFileSync(f, "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m || process.env[m[1]] != null) continue;
    process.env[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
  }
}
loadEnvLocal();

const OLD = /Register for full MLS® access to see detailed market data for this street, including historical transaction records\./g;
const NEW = "Sign in free to see recent closed sales on this street.";
const WRITE = process.argv.includes("--write");

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const rows = await prisma.streetContent.findMany({
    where: { faqJson: { contains: "Register for full MLS" } },
    select: { id: true, streetSlug: true, status: true, faqJson: true },
    orderBy: { streetSlug: "asc" },
  });
  console.log(`[scrub-legacy-faq] ${rows.length} rows carry the legacy sentence (${rows.filter((r) => r.status === "published").length} published)`);
  let changed = 0, revalidated = 0;
  for (const r of rows) {
    const before = r.faqJson ?? "";
    const after = before.replace(OLD, NEW);
    const n = (before.match(OLD) || []).length;
    console.log(`  ${r.streetSlug.padEnd(40)} ${r.status.padEnd(10)} ${n} occurrence(s)${after === before ? " (no match, left alone)" : ""}`);
    if (!WRITE || after === before) continue;
    await prisma.streetContent.update({ where: { id: r.id }, data: { faqJson: after } });
    changed++;
    if (r.status === "published") {
      const secret = process.env.REVALIDATION_SECRET;
      const base = process.env.SITE_URL || "https://miltonly.com";
      if (secret) {
        const res = await fetch(`${base}/api/revalidate?secret=${encodeURIComponent(secret)}`, {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: `/streets/${r.streetSlug}` }),
        });
        if (res.status === 200) revalidated++;
      }
    }
  }
  const left = await prisma.streetContent.count({ where: { faqJson: { contains: "Register for full MLS" } } });
  console.log(WRITE ? `[scrub-legacy-faq] rewrote ${changed}, revalidated ${revalidated} published pages, ${left} rows still carry the sentence` : `[scrub-legacy-faq] dry run; --write rewrites them`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
