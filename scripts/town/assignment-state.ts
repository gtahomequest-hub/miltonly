// READ-ONLY. The state of street->neighbourhood assignment after this pass, by provenance.
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../../.env", "../../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }
const pad = (s: unknown, n: number) => String(s).padEnd(n);
const lp = (s: unknown, n: number) => String(s).padStart(n);

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const L = (s = "") => console.log(s);
  const streets = await prisma.residentialStreet.findMany({
    select: { slug: true, neighbourhoodId: true, neighbourhoodSource: true, neighbourhoodSpan: true, hasPublishedPage: true, recencyWeightedSold: true },
  });
  const nb = await prisma.neighbourhood.findMany();
  const byId = new Map(nb.map((n) => [n.id, n.slug]));

  const bySource = new Map<string, number>();
  for (const s of streets) bySource.set(s.neighbourhoodSource ?? "(null)", (bySource.get(s.neighbourhoodSource ?? "(null)") ?? 0) + 1);

  L("═".repeat(90));
  L("ASSIGNMENT STATE BY PROVENANCE");
  L("═".repeat(90));
  L(`    ResidentialStreet rows ............... ${streets.length}`);
  for (const [k, v] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) L(`      neighbourhoodSource=${pad(k, 18)} ${lp(v, 5)}`);
  L(`    with a neighbourhood ................. ${streets.filter((s) => s.neighbourhoodId).length}`);
  L(`    still unassigned ..................... ${streets.filter((s) => !s.neighbourhoodId).length}`);
  L(`    spans recorded ....................... ${streets.filter((s) => s.neighbourhoodSpan.length).length}`);
  L();
  L(`    INVARIANT CHECKS:`);
  const srcNoId = streets.filter((s) => s.neighbourhoodSource && !s.neighbourhoodId).length;
  const idNoSrc = streets.filter((s) => s.neighbourhoodId && !s.neighbourhoodSource).length;
  const spanAndId = streets.filter((s) => s.neighbourhoodSpan.length && s.neighbourhoodId).length;
  const badSrc = streets.filter((s) => s.neighbourhoodSource && !["treb", "town-geometry", "manual"].includes(s.neighbourhoodSource)).length;
  L(`      source set but no neighbourhoodId .............. ${srcNoId}  (expect 0)`);
  L(`      neighbourhoodId set but no source .............. ${idNoSrc}  (expect 0)`);
  L(`      span recorded AND assigned (must be either/or) . ${spanAndId}  (expect 0)`);
  L(`      source outside the allowed vocabulary .......... ${badSrc}  (expect 0)`);
  L();
  L(`    GEOMETRY-ASSIGNED STREETS ARE ALL DORMANT (they cannot enter a hub ladder):`);
  const geo = streets.filter((s) => s.neighbourhoodSource === "town-geometry");
  const geoSurfaced = geo.filter((s) => s.recencyWeightedSold > 0 || s.hasPublishedPage);
  L(`      town-geometry assignments ...................... ${geo.length}`);
  L(`      of those, SURFACED (rws>0 OR hasPublishedPage) . ${geoSurfaced.length}  (expect 0)`);
  for (const s of geoSurfaced) L(`        !! ${s.slug}`);
  L();
  L(`    SPANS:`);
  for (const s of streets.filter((x) => x.neighbourhoodSpan.length)) L(`      ${pad(s.slug, 36)} [${s.neighbourhoodSpan.join(", ")}]`);
  L();
  L(`    town-geometry ASSIGNMENTS BY NEIGHBOURHOOD:`);
  const byN = new Map<string, number>();
  for (const s of geo) { const k = byId.get(s.neighbourhoodId!)!; byN.set(k, (byN.get(k) ?? 0) + 1); }
  for (const [k, v] of [...byN.entries()].sort((a, b) => b[1] - a[1])) L(`      ${pad(k, 24)} ${lp(v, 4)}`);
  L();
  L(`    treb ASSIGNMENTS MADE IN THIS PASS (the 4 that were sitting unapplied):`);
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
