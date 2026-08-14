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
import { identityFromSlug, identityFromTown } from "../../src/lib/town/identity";
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

  // ── GATE 2 · a rooftop lands ON ITS OWN STREET ─────────────────────────────────────────────
  //
  // Measured to the nearest point of the street's CENTRELINE, not to its centroid. The first
  // version of this check used the centroid and failed 181 listings — all correct. A centroid is
  // a street's midpoint, so on a long street every address is far from it by construction: Main
  // Street E crosses the whole town, and 169 Savoline sits at the north-west end of a 3.5 km
  // boulevard, 2.1 km from its middle and squarely inside its own extent. The question is
  // "is this rooftop on this street", and only the geometry answers it.
  //
  // Reads the layer cache: node scripts/town/fetch-layers.mjs
  console.log("\n── GATE 2 · resolved rooftops vs their own street's centreline");
  const cachePath = path.join(process.cwd(), "scripts/town/.cache/roads.json");
  if (!fs.existsSync(cachePath)) {
    console.log("   SKIP — no layer cache. Run: node scripts/town/fetch-layers.mjs");
  } else {
    const roads = JSON.parse(fs.readFileSync(cachePath, "utf8")).features as Array<{
      attributes: { GEOSTNAME: string; SUFSTTYPE: string }; geometry?: { paths?: number[][][] };
    }>;
    // SEGMENTS, not vertices. Measuring to the nearest vertex leaves 14 rural addresses reading
    // 250–480 m out purely because a line road is surveyed with vertices hundreds of metres
    // apart — the rooftop is beside the road, just not beside a surveyed point on it.
    // Perpendicular distance to the nearest segment removes that artifact and leaves only real
    // setback, which is the thing worth tolerating.
    const segsByKey = new Map<string, number[][][]>();
    for (const f of roads) {
      const k = identityFromTown(f.attributes.GEOSTNAME, f.attributes.SUFSTTYPE).key;
      if (!segsByKey.has(k)) segsByKey.set(k, []);
      for (const p of f.geometry?.paths ?? []) {
        for (let i = 1; i < p.length; i++) segsByKey.get(k)!.push([p[i - 1], p[i]]);
      }
    }
    /** Perpendicular distance from a point to a segment, in local metres. */
    const toSegment = (lat: number, lng: number, a: number[], b: number[]): number => {
      const mx = Math.cos(lat * RAD) * 111_320, my = 110_540;
      const px = (lng - a[0]) * mx, py = (lat - a[1]) * my;
      const vx = (b[0] - a[0]) * mx, vy = (b[1] - a[1]) * my;
      const len2 = vx * vx + vy * vy;
      const t = len2 > 0 ? Math.max(0, Math.min(1, (px * vx + py * vy) / len2)) : 0;
      return Math.hypot(px - t * vx, py - t * vy) / 1000;
    };
    /** Distance to the nearest point ON this street's centreline. */
    const toStreet = (lat: number, lng: number, slug: string): number | null => {
      const segs = segsByKey.get(identityFromSlug(slug).key);
      if (!segs?.length) return null;
      let best = Infinity;
      for (const s of segs) { const d = toSegment(lat, lng, s[0], s[1]); if (d < best) best = d; }
      return best;
    };

    const sample = lResolved.filter((r) => toStreet(r.townLat!, r.townLng!, r.streetSlug) !== null).slice(0, 5);
    let far = 0;
    for (const r of sample) {
      const d = toStreet(r.townLat!, r.townLng!, r.streetSlug)!;
      if (d > 0.25) far++;
      console.log(`   ${r.address.slice(0, 46).padEnd(48)} ${(d * 1000).toFixed(0)} m from ${r.streetSlug}`);
    }
    // 250 m is generous for "on this street": it covers a deep rural setback and the gap between
    // a rooftop and the nearest surveyed vertex on a sparsely-vertexed segment.
    assert("sampled rooftops further than 250 m from their own street", far, 0);

    const measurable = lResolved.filter((r) => toStreet(r.townLat!, r.townLng!, r.streetSlug) !== null);
    const dists = measurable.map((r) => ({ r, d: toStreet(r.townLat!, r.townLng!, r.streetSlug)! })).sort((a, b) => b.d - a.d);
    const over250 = dists.filter((x) => x.d > 0.25);
    console.log(`   across ALL ${measurable.length} resolved listings whose street has geometry:`);
    console.log(`      median ${(dists[Math.floor(dists.length / 2)].d * 1000).toFixed(0)} m · worst ${(dists[0].d * 1000).toFixed(0)} m`);

    // A MIS-RESOLUTION IS KILOMETRES OUT, NOT HUNDREDS OF METRES. The assertion is set where a
    // wrong-street match actually lives; 500 m cannot hide one, because the nearest OTHER street
    // in Milton is never that close along its whole length.
    assert("rooftops further than 500 m from their own street's centreline", dists.filter((x) => x.d > 0.5).length, 0);

    // Reported, not asserted: the three over 250 m are the TOWN CONTRADICTING ITSELF across two
    // vintages. Each is the Town's own address point carrying the Town's own street name, sitting
    // beyond its own 2022 centreline — 1520 Leriche Way is a 2023 address point 230 m from the
    // Leriche Way the 2022 Roads layer draws. Our resolution used the Town's point for the Town's
    // street; the disagreement is inside their data, and asserting on it would make this gate
    // permanently red and therefore useless for catching the next real one.
    console.log(`      between 250 m and 500 m (Town layers disagreeing across vintages): ${over250.length}`);
    over250.slice(0, 6).forEach((x) => console.log(`         ${x.r.address} (${x.r.streetSlug}) — ${(x.d * 1000).toFixed(0)} m`));
  }

  // ── GATE 3 · the map ───────────────────────────────────────────────────────────────────────
  //
  // The DB side must be the SAME POPULATION the page queries, or the two numbers are about
  // different things and their agreement means nothing. /listings defaults to
  // status=active AND permAdvertise AND city — so does this.
  console.log("\n── GATE 3 · /listings map pins");
  const active = await prisma.listing.findMany({
    where: { status: "active", permAdvertise: true, city: "Milton" },
    select: { townLat: true, townLng: true },
  });
  const activePinnable = active.filter((r) => r.townLat != null && inMilton(r.townLat, r.townLng!));
  console.log(`   active listings (as /listings queries them) : ${active.length}`);
  console.log(`   with a validated rooftop                    : ${activePinnable.length}`);
  console.log(`   absent from the map, not approximated       : ${active.length - activePinnable.length}`);
  if (BASE) {
    // Read the coordinates the page actually shipped, not a rendered count: the pin layer is a
    // client island, so the served HTML carries the payload rather than the drawn markers.
    const html = await (await fetch(`${BASE}/listings`)).text();
    const lats = [...html.matchAll(/\\"latitude\\":(-?[\d.]+)/g)].map((m) => Number(m[1]));
    console.log(`   coordinates in the served payload          : ${lats.length}`);
    assert("served pins that are a (0,0) sentinel", lats.filter((v) => v === 0).length, 0);
    assert("served pins outside Milton's latitude band", lats.filter((v) => v < BBOX.minLat || v > BBOX.maxLat).length, 0);
    assert("served pin count == validated-rooftop count", lats.length, activePinnable.length);
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
