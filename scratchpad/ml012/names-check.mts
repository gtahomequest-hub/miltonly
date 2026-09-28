// ML-012 evidence: for the 48 newest public leases of each measured view, resolve the street link the
// way src/lib/rentalStreetPage.ts does (exact, then the curated map, then the identity rule, kept only
// when published) and compare the anchor text with the heading the street page produces
// (src/lib/street-data.ts:449-461). Read only. Expect 0 mismatches.
import fs from "node:fs";
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (m && !process.env[m[1]]) { let v = m[2].replace(/\r$/, ""); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); process.env[m[1]] = v; }
}
const { prisma } = await import("@/lib/prisma");
const { resolveStreetName } = await import("@/lib/streetName");
const { ruralSideRoadName, extractStreetName, deriveIdentity } = await import("@/lib/streetUtils");
const canonicalMap = (await import("@/lib/_generated/canonical-map.json")).default as Record<string, string>;
const PUBLIC_LEASE_WHERE = { permAdvertise: true, city: "Milton", transactionType: "For Lease", leaseStatus: "active" } as const;
const [pubRows, entRows] = await Promise.all([
  prisma.streetContent.findMany({ where: { status: "published" }, select: { streetSlug: true, streetName: true } }),
  prisma.residentialStreet.findMany({ select: { slug: true } }),
]);
const entSet = new Set(entRows.map((r) => r.slug));
const published = new Set(pubRows.map((r) => r.streetSlug).filter((s) => entSet.has(s)));
const contentName = new Map(pubRows.map((r) => [r.streetSlug, r.streetName]));
const pageFor = (slug: string) => { if (published.has(slug)) return { slug, how: "exact" }; const m = canonicalMap[slug]; if (m && published.has(m)) return { slug: m, how: "map" }; const d = deriveIdentity(slug)?.canonicalSlug; if (d && published.has(d)) return { slug: d, how: "identity" }; return null; };
const deslug = (slug: string) => slug.replace(/-milton$/, "").split("-").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const views: Array<[string, Record<string, unknown> | null]> = [["all", {}]];
for (const slug of ["timberlea", "harrison"]) { const n = await prisma.neighbourhood.findUnique({ where: { slug }, select: { rawStrings: true } }); views.push([slug, n ? { neighbourhood: { in: n.rawStrings } } : null]); }
let mismatches = 0, checked = 0; const out: Record<string, unknown> = {};
for (const [name, scopeWhere] of views) {
  if (!scopeWhere) continue;
  const rows = await prisma.listing.findMany({ where: { ...PUBLIC_LEASE_WHERE, ...scopeWhere }, orderBy: { listedAt: "desc" }, take: 48, select: { address: true, streetSlug: true, streetName: true, displayAddress: true } });
  const withheld = rows.filter((r) => !r.displayAddress).length;
  const resolved = rows.map((r) => (r.displayAddress ? pageFor(r.streetSlug) : null));
  const linked = resolved.filter(Boolean).length, rescued = resolved.filter((p) => p && p.how !== "exact").length;
  const noPage = rows.filter((r, i) => r.displayAddress && !resolved[i]).map((r) => r.streetSlug);
  const diffs: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const p = resolved[i]; if (!p) continue; checked++;
    const card = resolveStreetName(p.slug, ruralSideRoadName(p.slug) ?? contentName.get(p.slug) ?? null).name;
    const sample = await prisma.listing.findFirst({ where: { streetSlug: p.slug, permAdvertise: true }, orderBy: { listedAt: "desc" }, select: { streetName: true, address: true } });
    const page = resolveStreetName(p.slug, ruralSideRoadName(p.slug) ?? contentName.get(p.slug) ?? sample?.streetName ?? extractStreetName(sample?.address ?? deslug(p.slug))).name;
    if (card !== page) { mismatches++; diffs.push(`${p.slug}: card "${card}" page "${page}"`); }
  }
  console.log(`== ${name}: rows ${rows.length}, withheld ${withheld}, linked ${linked} (rescued by map/identity ${rescued}), no page ${noPage.length}${noPage.length ? " [" + [...new Set(noPage)].join(", ") + "]" : ""}${diffs.length ? "\n   DIFF " + diffs.join("\n   DIFF ") : ""}`);
  out[name] = { rows: rows.length, withheld, linked, rescued, noPage: [...new Set(noPage)], rescuedFrom: rows.filter((r, i) => resolved[i] && resolved[i]!.how !== "exact").map((r, i) => r.streetSlug) };
}
console.log(`checked ${checked} linked cards, ${mismatches} anchor/heading mismatches`);
fs.writeFileSync("scratchpad/ml012/names-check.json", JSON.stringify({ checked, mismatches, views: out }, null, 1));
await prisma.$disconnect();
