// One-shot incident action, 2026-09-04. Holds the two published zero-tier pages whose
// prose states neighbourhood price figures that appear nowhere in their generator input.
// Not a k-anon leak: no street-level price is published on either. The figures are
// invented, which is a different and worse failure than an over-precise real one.
//
// Reversible on purpose. status=draft keeps the StreetContent row, so DEC-PH41-DUALWRITE
// is unaffected (it binds published streets) and a regeneration can lift the hold.
import { readFileSync } from "node:fs";
function loadEnvLocal(): void {
  try {
    const raw = readFileSync(".env.local", "utf-8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) {
        let v = m[2].replace(/\\n$/, "");
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  } catch {}
}
loadEnvLocal();
import { prisma } from "@/lib/prisma";

const SLUGS = ["miller-way-milton"];
const NOTE = "fabricated neighbourhood rent range under thin tier, 2026-09-05";

async function main() {
  for (const slug of SLUGS) {
    const before = await prisma.streetContent.findUnique({
      where: { streetSlug: slug },
      select: { status: true, publishedAt: true },
    });
    if (!before) { console.log(`${slug}: NO ROW`); continue; }
    const after = await prisma.streetContent.update({
      where: { streetSlug: slug },
      data: { status: "draft", publishedAt: null, needsReview: true, reviewNotes: NOTE },
      select: { status: true, publishedAt: true, needsReview: true, reviewNotes: true },
    });
    console.log(`${slug}\n  before ${JSON.stringify(before)}\n  after  ${JSON.stringify(after)}`);
  }
  console.log(`\npublished StreetContent rows: ${await prisma.streetContent.count({ where: { status: "published" } })}`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
