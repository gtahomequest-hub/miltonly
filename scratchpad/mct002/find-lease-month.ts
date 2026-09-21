// MCT-002. The test MC-036 used, made repeatable: which published street descriptions name
// a leased price tied to a month. A sentence with a dollar figure, a month name, and a
// lease word ("rent", "rented", "lease", "leased", "tenant", "/month", "a month"). Read-only.
// Prints one slug per line to stdout; a summary to stderr. Exit 0.
//   npx tsx --tsconfig tsconfig.test.json scratchpad/mct002/find-lease-month.ts [--show]
import { readFileSync } from "node:fs";
function loadEnvLocal(): void {
  for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      let v = m[2].replace(/\r$/, "");
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
}
loadEnvLocal();

// MC-036's test verbatim (D:\miltonly\scratchpad\mc036\q4.mjs, a Postgres ~* on the column):
// a lease verb, then within 80 non-period characters a month named after in/during/this past/last.
const MC036 = /(rented|leased)[^.]{0,80}(in|during|this past|last) (January|February|March|April|May|June|July|August|September|October|November|December)/i;
// The broader check: any sentence with a dollar figure, a month name and a lease word.
const MONTH = /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b\.?(?:\s+20\d\d)?/;
const DOLLAR = /\$\s?\d[\d,]*(?:\.\d+)?(?:\s?[kK])?/;
const LEASE = /\b(?:rent(?:ed|s|al|als)?|leas(?:e|ed|es|ing)|tenan(?:t|ts|cy)|let\b|per month|a month|\/month|monthly)\b/i;

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+(?=[A-Z"“(])/).map((s) => s.trim()).filter(Boolean);
}

async function main() {
  const show = process.argv.includes("--show");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const rows = await prisma.streetContent.findMany({
    where: { status: "published" },
    select: { streetSlug: true, description: true },
    orderBy: { streetSlug: "asc" },
  });
  const broad = process.argv.includes("--broad");
  const hits: Array<{ slug: string; sentences: string[] }> = [];
  let broadOnly: string[] = [];
  for (const r of rows) {
    const mc036 = MC036.test(r.description);
    const sents = splitSentences(r.description).filter((s) => DOLLAR.test(s) && MONTH.test(s) && LEASE.test(s));
    if (mc036 || (broad && sents.length)) hits.push({ slug: r.streetSlug, sentences: sents });
    if (!mc036 && sents.length) broadOnly.push(r.streetSlug);
  }
  for (const h of hits) {
    console.log(h.slug);
    if (show) for (const s of h.sentences) console.log("    " + s);
  }
  console.error(`published=${rows.length} mc036_hits=${hits.filter((h) => MC036.test(rows.find((r) => r.streetSlug === h.slug)!.description)).length} broad_only=${broadOnly.length}${broadOnly.length ? " [" + broadOnly.join(", ") + "]" : ""}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
