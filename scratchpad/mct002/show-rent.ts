// MCT-002 spot check: print every stored sentence with a lease word for the named slugs.
//   npx tsx --tsconfig tsconfig.test.json scratchpad/mct002/show-rent.ts slug1 slug2 ...
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
const LEASE = /\b(?:rent(?:ed|s|al|als|ing)?|leas(?:e|ed|es|ing)|tenan(?:t|ts|cy))\b/i;
async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  for (const slug of process.argv.slice(2)) {
    const r = await prisma.streetContent.findUnique({ where: { streetSlug: slug }, select: { description: true, generatedAt: true, status: true } });
    console.log(`\n== ${slug} ${r?.status} generatedAt=${r?.generatedAt?.toISOString()}`);
    if (!r) continue;
    for (const p of r.description.split(/\n\n+/)) if (LEASE.test(p)) console.log("  ¶ " + p);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
