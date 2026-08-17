// scripts/town/fix-treb-orphans.ts
// STEP (a), and it runs BEFORE any geometry touches anything.
//
// kelso-road-milton sat with neighbourhoodId = NULL while DB2 already carried its TREB
// neighbourhood string ("Rural Milton West") on a sold record. The declared answer had been in
// the record the whole time and simply was not applied. If one was missed, others may be — so
// this derives the population by predicate rather than fixing the one street we happen to know:
//
//   every ResidentialStreet with neighbourhoodId = NULL
//   whose DB2 sold records OR DB1 listings carry a TREB neighbourhood string
//   that maps unambiguously onto exactly one Neighbourhood.rawStrings entry
//
// A street whose records name TWO different neighbourhoods is NOT auto-applied — it is reported
// for review, because picking one would be a derived guess dressed as a declared fact.
//
// BOTH SIDES OF THE FEED ARE SWEPT, and the second one matters. A first version read only sold
// records and found exactly one street (kelso-road). Live listings carry the same
// agent-entered neighbourhood field, and three more orphans turned out to be declared there —
// blacklock-street, crewsons-line and mohawk-trail. All three sit inside the Town's single
// "Nassagaweya" polygon, and they declare THREE DIFFERENT neighbourhoods
// (brookville-haltonville, nassagaweya, campbellville). That is the clearest possible evidence
// that the polygon must stay unmapped: geometry would have put all three in one place and been
// wrong about two of them.
//
//   npx tsx --tsconfig tsconfig.test.json scripts/town/fix-treb-orphans.ts          (dry run)
//   npx tsx --tsconfig tsconfig.test.json scripts/town/fix-treb-orphans.ts --apply
//
// Writes neighbourhoodSource = 'treb'. This is a DECLARED assignment: a human MLS record placed
// the sale in that neighbourhood. It is a different and stronger claim than the geometric one
// the next script writes, and the column is what keeps them distinguishable.
import { readFileSync } from "node:fs"; import { resolve, dirname } from "node:path"; import { fileURLToPath } from "node:url";
const __d = dirname(fileURLToPath(import.meta.url));
for (const f of ["../../.env", "../../.env.local"]) { try { for (const line of readFileSync(resolve(__d, f), "utf8").split(/\r?\n/)) { const t = line.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(); let v = t.slice(eq + 1).trim(); if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1); if (!(k in process.env)) process.env[k] = v; } } catch {} }

const APPLY = process.argv.includes("--apply");
const pad = (s: unknown, n: number) => String(s).padEnd(n);
const lp = (s: unknown, n: number) => String(s).padStart(n);

async function main() {
  const { prisma } = await import("@/lib/prisma");
  const { getSoldDb } = await import("@/lib/db");
  const sold = getSoldDb();
  if (!sold) throw new Error("SOLD_DATABASE_URL is not configured");
  const L = (s = "") => console.log(s);

  L("═".repeat(100));
  L(`(a) UNAPPLIED TREB NEIGHBOURHOOD STRINGS   ${APPLY ? "[APPLY]" : "[DRY RUN]"}`);
  L("═".repeat(100));

  const nbhds = await prisma.neighbourhood.findMany();
  // raw TREB string -> our neighbourhood. The mapping already exists; nothing new is invented.
  const rawToNbhd = new Map<string, (typeof nbhds)[number]>();
  for (const n of nbhds) for (const raw of n.rawStrings) rawToNbhd.set(raw, n);

  const streets = await prisma.residentialStreet.findMany({
    select: { id: true, slug: true, neighbourhoodId: true, hasPublishedPage: true, recencyWeightedSold: true },
  });
  const orphans = streets.filter((s) => !s.neighbourhoodId);

  // Every TREB string DB2 carries per street slug, on ANY window (an old sale still declares a
  // neighbourhood, and the 12-month window is a display rule, not an identity rule).
  const rows = (await sold`
    SELECT street_slug, neighbourhood, COUNT(*)::int AS n
    FROM sold.sold_records
    WHERE perm_advertise = TRUE AND sold_date <= NOW() AND neighbourhood IS NOT NULL
    GROUP BY street_slug, neighbourhood`) as Array<{ street_slug: string; neighbourhood: string; n: number }>;
  const bySlug = new Map<string, Array<{ raw: string; n: number; from: string }>>();
  for (const r of rows) {
    if (!bySlug.has(r.street_slug)) bySlug.set(r.street_slug, []);
    bySlug.get(r.street_slug)!.push({ raw: r.neighbourhood, n: r.n, from: "sold" });
  }

  // DB1 listings declare the same field. Same class of fact, same provenance value.
  const lrows = await prisma.listing.groupBy({
    by: ["streetSlug", "neighbourhood"],
    _count: { _all: true },
    where: { permAdvertise: true },
  });
  for (const r of lrows) {
    if (!r.neighbourhood) continue;
    if (!bySlug.has(r.streetSlug)) bySlug.set(r.streetSlug, []);
    bySlug.get(r.streetSlug)!.push({ raw: r.neighbourhood, n: r._count._all, from: "listing" });
  }

  L(`    ResidentialStreet rows ................................ ${streets.length}`);
  L(`    with neighbourhoodId = NULL ........................... ${orphans.length}`);
  L(`    DB2 (street_slug, neighbourhood) pairs read ........... ${rows.length}`);
  L(`    DB1 (streetSlug, neighbourhood) pairs read ............ ${lrows.length}`);

  const applicable: Array<{ id: string; slug: string; to: string; raw: string; n: number; published: boolean; from: string }> = [];
  const ambiguous: Array<{ slug: string; opts: string }> = [];
  const unmapped: Array<{ slug: string; raw: string }> = [];

  for (const s of orphans) {
    const seen = bySlug.get(s.slug);
    if (!seen?.length) continue;                       // no record names it — geometry's problem, not this script's
    const mapped = seen.map((x) => ({ ...x, nb: rawToNbhd.get(x.raw) })).filter((x) => x.nb);
    if (!mapped.length) { unmapped.push({ slug: s.slug, raw: seen.map((x) => x.raw).join(" | ") }); continue; }
    const distinct = new Set(mapped.map((x) => x.nb!.slug));
    if (distinct.size > 1) {
      ambiguous.push({ slug: s.slug, opts: mapped.map((x) => `${x.nb!.slug}(${x.n})`).join(" | ") });
      continue;
    }
    const pick = mapped[0];
    applicable.push({ id: s.id, slug: s.slug, to: pick.nb!.slug, raw: pick.raw, n: mapped.reduce((a, x) => a + x.n, 0), published: s.hasPublishedPage, from: [...new Set(mapped.map((x) => x.from))].join("+") });
  }

  L();
  L(`    ORPHANS WITH AN UNAPPLIED, UNAMBIGUOUS TREB STRING: ${applicable.length}`);
  if (applicable.length) {
    L(`    ${pad("slug", 34)} ${pad("-> neighbourhood", 24)} ${lp("recs", 5)} ${pad("declared on", 12)} ${pad("published?", 11)} TREB string`);
    for (const a of applicable.sort((x, y) => y.n - x.n)) {
      L(`    ${pad(a.slug, 34)} ${pad(a.to, 24)} ${lp(a.n, 5)} ${pad(a.from, 12)} ${pad(a.published ? "YES" : "no", 11)} "${a.raw}"`);
    }
  } else L(`    (none)`);

  L();
  L(`    AMBIGUOUS — records name more than one neighbourhood, NOT auto-applied: ${ambiguous.length}`);
  for (const a of ambiguous) L(`    ${pad(a.slug, 34)} ${a.opts}`);
  if (!ambiguous.length) L(`    (none)`);

  L();
  L(`    UNMAPPED — records carry a TREB string we have no Neighbourhood for: ${unmapped.length}`);
  for (const u of unmapped) L(`    ${pad(u.slug, 34)} "${u.raw}"`);
  if (!unmapped.length) L(`    (none)`);

  // A second, distinct class: streets that DO have a neighbourhood which DISAGREES with DB2.
  // Reported, never auto-changed — overwriting a standing assignment is a different decision.
  const disagree: Array<{ slug: string; have: string; db2: string }> = [];
  const byId = new Map(nbhds.map((n) => [n.id, n]));
  for (const s of streets) {
    if (!s.neighbourhoodId) continue;
    const seen = bySlug.get(s.slug);
    if (!seen?.length) continue;
    const mapped = seen.map((x) => rawToNbhd.get(x.raw)).filter(Boolean);
    if (!mapped.length) continue;
    const have = byId.get(s.neighbourhoodId)!;
    if (!mapped.some((m) => m!.slug === have.slug)) {
      disagree.push({ slug: s.slug, have: have.slug, db2: [...new Set(mapped.map((m) => m!.slug))].join(" | ") });
    }
  }
  L();
  L(`    ALREADY ASSIGNED BUT DB2 DISAGREES (reported, never auto-changed): ${disagree.length}`);
  for (const d of disagree.slice(0, 30)) L(`    ${pad(d.slug, 34)} have=${pad(d.have, 20)} DB2 says=${d.db2}`);
  if (disagree.length > 30) L(`    ...(${disagree.length - 30} more)`);
  if (!disagree.length) L(`    (none)`);

  if (APPLY && applicable.length) {
    const idBySlug = new Map(nbhds.map((n) => [n.slug, n.id]));
    for (const a of applicable) {
      await prisma.residentialStreet.update({
        where: { id: a.id },
        data: { neighbourhoodId: idBySlug.get(a.to)!, neighbourhoodSource: "treb" },
      });
    }
    L();
    L(`    APPLIED ${applicable.length} assignment(s) with neighbourhoodSource='treb'.`);
  } else if (applicable.length) {
    L();
    L(`    DRY RUN — nothing written. Re-run with --apply.`);
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
