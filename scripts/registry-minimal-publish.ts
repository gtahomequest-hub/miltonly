// scripts/registry-minimal-publish.ts
// Toggle the registry MINIMAL-template pages between draft and published.
// The set is derived from StreetContent.template='minimal' (no hardcoded slugs).
//   --draft    : status -> draft  (pulls them from sitemap / generateStaticParams;
//                used pre-merge so the "Profile in preparation" placeholder that
//                prod's OLD code renders is never indexed)
//   --publish  : status -> published + hasPublishedPage=true on their entities
//                (used at merge, once the minimal renderer ships)
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../.env", "../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }
const MODE = process.argv.includes("--publish") ? "publish" : process.argv.includes("--draft") ? "draft" : null;
async function main() {
  if (!MODE) { console.error("pass --draft or --publish"); process.exit(2); }
  const { PrismaClient } = await import("@prisma/client");
  const p = new PrismaClient();
  const minimal = await p.streetContent.findMany({ where: { template: "minimal" }, select: { streetSlug: true, status: true } });
  const slugs = minimal.map(m => m.streetSlug);
  console.log(`minimal-template pages: ${slugs.length} (current statuses: ${[...new Set(minimal.map(m => m.status))].join(", ")})`);
  if (MODE === "draft") {
    const r = await p.streetContent.updateMany({ where: { template: "minimal" }, data: { status: "draft", publishedAt: null } });
    console.log(`-> set ${r.count} minimal pages to DRAFT (removed from sitemap + static params). Entities' hasPublishedPage left as-is; republish at merge.`);
  } else {
    const r = await p.streetContent.updateMany({ where: { template: "minimal" }, data: { status: "published", publishedAt: new Date() } });
    const e = await p.residentialStreet.updateMany({ where: { slug: { in: slugs } }, data: { hasPublishedPage: true } });
    console.log(`-> set ${r.count} minimal pages to PUBLISHED; hasPublishedPage=true on ${e.count} entities.`);
  }
  const after = await p.streetContent.groupBy({ by: ["status"], where: { template: "minimal" }, _count: { _all: true } });
  console.log("after:", after.map(a => `${a.status}=${a._count._all}`).join(" "));
  await p.$disconnect(); process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
