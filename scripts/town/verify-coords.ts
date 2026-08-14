// Coordinate gates that need the record as well as the page.
//
//   BASE=<preview> npx tsx scripts/town/verify-coords.ts
//
// Doctrine (scripts/verify/README.md): assert values not presence · derive expected values ·
// compare against an independently derived other side. The street centroids here come from the
// generated Town file; the rooftops come from the database; the pins come from the served page.
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { PrismaClient } from "@prisma/client";
import { streetCentroidFor } from "../../src/lib/town/roadFacts";
import { identityFromSlug } from "../../src/lib/town/identity";
import { TOWN_ROAD_FACTS } from "../../src/data/townRoadFacts";

for (const f of [".env", ".env.local"]) {
  const p = path.join(process.cwd(), f);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const BASE = (process.env.BASE ?? "").replace(/\/$/, "");
const BBOX = { minLng: -80.3, maxLng: -79.6, minLat: 43.3, maxLat: 43.75 };
const inMilton = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= BBOX.minLat && lat <= BBOX.maxLat && lng >= BBOX.minLng && lng <= BBOX.maxLng;
const RAD = Math.PI / 180;
function km(aLat: number, aLng: number, bLat: number, bLng: number) {
  const dLat = (bLat - aLat) * RAD, dLng = (bLng - aLng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * RAD) * Math.cos(bLat * RAD) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const fails: string[] = [];
const assert = (label: string, actual: number, expected: number) => {
  const ok = actual === expected;
  if (!ok) fails.push(`${label}: ${actual}, expected ${expected}`);
  console.log(`   ${ok ? "PASS" : "FAIL"}  ${label}: ${actual}${ok ? "" : ` (expected ${expected})`}`);
};

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const sold = neon(process.env.SOLD_DATABASE_URL!);

  // ── GATE 1 · resolved counts, and no sentinels anywhere ────────────────────────────────────
  console.log("\n── GATE 1 · resolved rooftop coordinates");
  const lRows = await prisma.listing.findMany({ select: { mlsNumber: true, address: true, streetSlug: true, status: true, townLat: true, townLng: true } });
  const lResolved = lRows.filter((r) => r.townLat != null && r.townLng != null);
  const sRows = (await sold`SELECT mls_number, address, street_slug, town_lat, town_lng FROM sold.sold_records`) as
    Array<{ mls_number: string; address: string; street_slug: string; town_lat: number | null; town_lng: number | null }>;
  const sResolved = sRows.filter((r) => r.town_lat != null && r.town_lng != null);

  console.log(`   DB1 Listing      : ${lResolved.length} of ${lRows.length} (${(lResolved.length / lRows.length * 100).toFixed(1)}%)`);
  console.log(`   DB2 sold_records : ${sResolved.length} of ${sRows.length} (${(sResolved.length / sRows.length * 100).toFixed(1)}%)`);

  const zeroL = (await prisma.listing.count({ where: { OR: [{ townLat: 0 }, { townLng: 0 }] } }));
  const zeroS = Number(((await sold`SELECT COUNT(*)::int n FROM sold.sold_records WHERE town_lat = 0 OR town_lng = 0`) as Array<{ n: number }>)[0].n);
  assert("DB1 rows with a (0,0) sentinel", zeroL, 0);
  assert("DB2 rows with a (0,0) sentinel", zeroS, 0);

  const oobL = lResolved.filter((r) => !inMilton(r.townLat!, r.townLng!)).length;
  const oobS = sResolved.filter((r) => !inMilton(Number(r.town_lat), Number(r.town_lng))).length;
  assert("DB1 rows out of Milton's bounding box", oobL, 0);
  assert("DB2 rows out of Milton's bounding box", oobS, 0);

  // The legacy feed columns are untouched and still all-zero — stated so it is not mistaken for
  // a regression, and so the day the feed starts sending coordinates is visible.
  const feedReal = await prisma.listing.count({ where: { NOT: { latitude: 0 } } });
  console.log(`   (legacy feed latitude non-zero on ${feedReal} rows — the feed gap, unchanged)`);

  // ── GATE 2 · a rooftop lands on its own street ─────────────────────────────────────────────
  console.log("\n── GATE 2 · resolved rooftops vs their own street centroid");
  const sample = lResolved.filter((r) => streetCentroidFor(r.streetSlug)).slice(0, 5);
  let far = 0;
  for (const r of sample) {
    const c = streetCentroidFor(r.streetSlug)!;
    const d = km(r.townLat!, r.townLng!, c.lat, c.lng);
    if (d > 1.5) far++;
    console.log(`   ${r.address.slice(0, 46).padEnd(48)} ${d.toFixed(3)} km from ${r.streetSlug}`);
  }
  assert("sampled rooftops further than 1.5 km from their own street", far, 0);

  const allWithCentroid = lResolved.filter((r) => streetCentroidFor(r.streetSlug));
  const wayOff = allWithCentroid.filter((r) => {
    const c = streetCentroidFor(r.streetSlug)!;
    return km(r.townLat!, r.townLng!, c.lat, c.lng) > 2;
  });
  console.log(`   across ALL ${allWithCentroid.length} resolved listings with a street centroid:`);
  assert("rooftops more than 2 km from their own street centroid", wayOff.length, 0);
  wayOff.slice(0, 5).forEach((r) => console.log(`      ${r.address} (${r.streetSlug})`));

  // ── GATE 3 · the map ───────────────────────────────────────────────────────────────────────
  console.log("\n── GATE 3 · /listings map pins");
  const active = lRows.filter((r) => r.status === "active");
  const activePinnable = active.filter((r) => r.townLat != null && inMilton(r.townLat, r.townLng!));
  console.log(`   active listings          : ${active.length}`);
  console.log(`   with a validated rooftop : ${activePinnable.length}`);
  console.log(`   absent from the map      : ${active.length - activePinnable.length}`);
  if (BASE) {
    const html = await (await fetch(`${BASE}/listings?view=map`)).text();
    const m = html.match(/(\d+)\s+homes? on map/);
    const onMap = m ? Number(m[1]) : null;
    console.log(`   the served page says     : ${onMap ?? "(not found)"}`);
    if (onMap !== null) assert("served pin count == validated-rooftop count", onMap, activePinnable.length);
  }

  // ── GATE 4 · per-street distances ──────────────────────────────────────────────────────────
  console.log("\n── GATE 4 · per-street centroids");
  if (BASE) {
    const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
    const slugs = [...new Set([...sm.matchAll(/<loc>[^<]*\/streets\/([^<]+)<\/loc>/g)].map((x) => x[1].replace(/\/$/, "")))];
    const withCentroid = slugs.filter((s) => streetCentroidFor(s));
    console.log(`   published streets          : ${slugs.length}`);
    console.log(`   with a Town centroid       : ${withCentroid.length}`);
    console.log(`   without (stay suppressed)  : ${slugs.filter((s) => !streetCentroidFor(s)).join(", ") || "(none)"}`);
    const oob = withCentroid.filter((s) => { const c = streetCentroidFor(s)!; return !inMilton(c.lat, c.lng); });
    assert("street centroids out of Milton's bounding box", oob.length, 0);
  }

  // ── GATE 5 · the staleness guard ───────────────────────────────────────────────────────────
  console.log("\n── GATE 5 · absence is never evidence");
  const KENNEDY = "kennedy-circle-west-milton";
  const kFacts = TOWN_ROAD_FACTS[identityFromSlug(KENNEDY).key] ?? null;
  const kSales = Number(((await sold`SELECT COUNT(*)::int n FROM sold.sold_records WHERE street_slug = ${KENNEDY}`) as Array<{ n: number }>)[0].n);
  console.log(`   ${KENNEDY}: Town geometry ${kFacts ? "PRESENT" : "ABSENT"} · recorded sales ${kSales}`);
  assert("Kennedy Circle West has Town geometry (it must NOT — that is the point)", kFacts ? 1 : 0, 0);
  console.log(`   the entity exists and keeps its sales regardless of the Town's silence.`);

  console.log(`\n${fails.length === 0 ? "PASS" : "FAIL"} — ${fails.length} assertion(s) failed`);
  fails.forEach((f) => console.log(`   ${f}`));
  await prisma.$disconnect();
  process.exit(fails.length === 0 ? 0 : 1);
}

void main();
