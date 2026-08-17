// scripts/town/surfacing-delta.ts — READ-ONLY.
// What changes when the surfacing predicate stops reading a denormalised flag and starts deriving
// publication from StreetContent? Reported per surface, by name, before anything is claimed fixed.
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../../.env", "../../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }
const pad = (s: unknown, n: number) => String(s).padEnd(n);
const lp = (s: unknown, n: number) => String(s).padStart(n);

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const L = (s = "") => console.log(s);

  const streets = await prisma.residentialStreet.findMany({
    select: { slug: true, name: true, isResidential: true, recencyWeightedSold: true, hasPublishedPage: true, neighbourhoodId: true },
  });
  const nb = await prisma.neighbourhood.findMany();
  const byId = new Map(nb.map((n) => [n.id, n.slug]));
  const published = new Set(
    (await prisma.streetContent.findMany({ where: { status: "published" }, select: { streetSlug: true } })).map((r) => r.streetSlug),
  );

  const OLD = (s: (typeof streets)[number]) => s.recencyWeightedSold > 0 || s.hasPublishedPage;
  const NEW = (s: (typeof streets)[number]) => s.isResidential && (s.recencyWeightedSold > 0 || published.has(s.slug));

  const oldSet = new Set(streets.filter(OLD).map((s) => s.slug));
  const newSet = new Set(streets.filter(NEW).map((s) => s.slug));
  const gained = streets.filter((s) => newSet.has(s.slug) && !oldSet.has(s.slug));
  const lost = streets.filter((s) => oldSet.has(s.slug) && !newSet.has(s.slug));

  L("═".repeat(96));
  L("SURFACING DELTA — flag-based predicate vs derived predicate");
  L("═".repeat(96));
  L(`    ResidentialStreet rows ................... ${streets.length}`);
  L(`    surfaced under the OLD flag predicate .... ${oldSet.size}`);
  L(`    surfaced under the NEW derived predicate . ${newSet.size}`);
  L(`      GAINED surfacing ....................... ${gained.length}`);
  L(`      LOST surfacing ......................... ${lost.length}`);
  L();
  L(`    GAINED — streets with a live published page the flag called unpublished.`);
  L(`    These appear in hero search, autocomplete, the homepage count and their hub ladder.`);
  L(`    This is the fix, not a regression.`);
  L(`    ${pad("slug", 34)} ${pad("neighbourhood", 22)} ${lp("rws", 6)} ${lp("published?", 11)}`);
  for (const s of gained.sort((a, b) => a.slug.localeCompare(b.slug))) {
    L(`    ${pad(s.slug, 34)} ${pad(s.neighbourhoodId ? byId.get(s.neighbourhoodId)! : "(none)", 22)} ${lp(s.recencyWeightedSold, 6)} ${lp(published.has(s.slug) ? "yes" : "NO", 11)}`);
  }
  if (!gained.length) L(`    (none)`);
  L();
  L(`    LOST — streets the flag surfaced that the record does not support.`);
  L(`    ${pad("slug", 34)} ${pad("neighbourhood", 22)} ${lp("rws", 6)} ${lp("isResidential", 14)}`);
  for (const s of lost.sort((a, b) => a.slug.localeCompare(b.slug))) {
    L(`    ${pad(s.slug, 34)} ${pad(s.neighbourhoodId ? byId.get(s.neighbourhoodId)! : "(none)", 22)} ${lp(s.recencyWeightedSold, 6)} ${lp(String(s.isResidential), 14)}`);
  }
  if (!lost.length) L(`    (none)`);

  // per-hub ladder impact
  L();
  L(`    PER-HUB SURFACED COUNT (the "· N streets" line in autocomplete):`);
  const byHub = new Map<string, { before: number; after: number }>();
  for (const s of streets) {
    if (!s.neighbourhoodId) continue;
    const k = byId.get(s.neighbourhoodId)!;
    if (!byHub.has(k)) byHub.set(k, { before: 0, after: 0 });
    const e = byHub.get(k)!;
    if (OLD(s)) e.before++;
    if (NEW(s)) e.after++;
  }
  for (const [k, v] of [...byHub.entries()].sort()) {
    if (v.before !== v.after) L(`      ${pad(k, 24)} ${lp(v.before, 4)} -> ${lp(v.after, 4)}   CHANGED`);
  }
  if (![...byHub.values()].some((v) => v.before !== v.after)) L(`      (no hub changes)`);
  L(`      homepage total surfaced count: ${oldSet.size} -> ${newSet.size}`);

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
