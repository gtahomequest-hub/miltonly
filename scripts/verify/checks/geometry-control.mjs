// The Town's polygon layer still reproduces what TREB already told us.
//
// WHY THIS IS A PERMANENT CHECK AND NOT A ONE-OFF
//
// Street→neighbourhood assignment now has two sources. TREB DECLARES one (a human placed a sale
// in a neighbourhood); the Town's Neighbourhoods layer INFERS the other from position. The
// inference was licensed by a single measurement: run the streets whose TREB neighbourhood we
// already know through the same geometry, and they agree 95% of the time. Every geometric
// assignment in the database rests on that number.
//
// It can rot without anyone touching our code. The Town republishes the layer; a boundary moves;
// a polygon is renamed or split. Then the mapping in src/data/townNeighbourhoodMap.ts is quietly
// describing ground that has shifted underneath it. So the measurement is re-run here, every run,
// and fails if agreement drops below the bar it was licensed at.
//
// THE POPULATION IS `neighbourhoodSource = 'treb'`, AND THAT MATTERS. Geometry has now written
// 112 assignments of its own. Including those would be verifying the inference against its own
// output — the guard-checks-its-own-predicate failure the README already warns about. The
// provenance column is what makes the control possible at all.
//
// The other half of the defence lives in src/lib/town/polygons.ts: even-odd ring testing, because
// the orientation-based version returned false for every point on Earth and reported "0 of 187
// assignable" as a clean result, twice.
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { REPO_ROOT, loadEnv, requireEnv } from '../lib/env.mjs';

// ── the generated artifacts, read from this working tree (same idea as composition.mjs) ───────

function readPolygons() {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'src/data/townNeighbourhoods.ts'), 'utf8');
  const m = src.match(/TOWN_NEIGHBOURHOODS:\s*readonly TownPolygon\[\]\s*=\s*(\[[\s\S]*?\]);\s*$/m);
  if (!m) throw new Error('could not parse src/data/townNeighbourhoods.ts — fix the parser, not the data');
  const polys = JSON.parse(m[1]);
  if (!polys.length) throw new Error('townNeighbourhoods.ts parsed to zero polygons');
  return polys;
}

function readMap() {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'src/data/townNeighbourhoodMap.ts'), 'utf8');
  const body = src.slice(src.indexOf('TOWN_POLYGON_TO_NEIGHBOURHOOD'));
  const out = {};
  for (const m of body.matchAll(/^\s*(?:"([^"]+)"|([A-Za-z][A-Za-z0-9_]*)):\s*(?:"([^"]+)"|null),/gm)) {
    out[m[1] ?? m[2]] = m[3] ?? null;
  }
  if (!Object.keys(out).length) throw new Error('townNeighbourhoodMap.ts parsed to zero entries');
  return out;
}

function readCentroids() {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'src/data/townRoadFacts.ts'), 'utf8');
  const out = new Map();
  for (const m of src.matchAll(/"([^"]+)":\s*\{\s*lat:\s*(-?[\d.]+),\s*lng:\s*(-?[\d.]+)/g)) {
    out.set(m[1], [Number(m[3]), Number(m[2])]);   // [lng, lat]
  }
  if (!out.size) throw new Error('townRoadFacts.ts parsed to zero centroids');
  return out;
}

// ── identity, ported from src/lib/town/identity.ts ────────────────────────────────────────────
// A faithful port, not a clever re-derivation: this check is measuring the GEOMETRY, and a
// parser that drifts from the real one would fail it for the wrong reason. The coverage
// assertion below is the guard — if this port stops resolving streets to centroids, the check
// fails on coverage rather than quietly measuring a shrinking sample.
const DIRECTIONS = new Set(['n','s','e','w','ne','nw','se','sw','north','south','east','west','northeast','northwest','southeast','southwest']);
const WORD_NUMBER = { one:'1',two:'2',three:'3',four:'4',five:'5',six:'6',seven:'7',eight:'8',nine:'9',ten:'10',eleven:'11',twelve:'12',fourteen:'14',fifteen:'15',seventeen:'17',twenty:'20',thirty:'30',first:'1',second:'2',third:'3',fourth:'4',fifth:'5',sixth:'6',seventh:'7',eighth:'8',ninth:'9',tenth:'10',fourteenth:'14',fifteenth:'15',seventeenth:'17',twentieth:'20',thirtieth:'30' };
const MULTI = [[/side-?road$/, 'side-road'], [/side-rd$/, 'side-road'], [/town-?line$/, 'townline'], [/ring-road$/, 'road']];
const ALIAS = { st:'street',str:'street',rd:'road',dr:'drive',drv:'drive',ave:'avenue',av:'avenue',crt:'court',ct:'court',cres:'crescent',cr:'crescent',crescent:'crescent',blvd:'boulevard',pl:'place',ln:'lane',ter:'terrace',terr:'terrace',trl:'trail',hts:'heights',ht:'heights',pt:'point',gt:'gate',cir:'circle',sq:'square',pkwy:'parkway',gdns:'garden',gdn:'garden',gardens:'garden',grv:'grove',cmn:'common',xing:'crossing',lndg:'landing',hwy:'highway',hy:'highway',sr:'side-road',cross:'crossing' };
const TYPES = new Set(['street','road','drive','avenue','court','crescent','boulevard','terrace','trail','way','gate','circle','heights','place','lane','line','crossing','landing','garden','point','parkway','path','close','common','highway','square','grove','centre','townline','side-road']);
const canonType = (raw) => { const t = String(raw).trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); if (!t) return ''; const m = ALIAS[t] ?? t; return TYPES.has(m) ? m : ''; };
const canonBase = (raw) => String(raw).trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').replace(/^no-/,'')
  .split('-').filter(Boolean).filter((t) => !DIRECTIONS.has(t)).map((t) => WORD_NUMBER[t] ?? t.replace(/^(\d+)(st|nd|rd|th)$/,'$1')).join('-');
function identityKeyFromSlug(slug) {
  const s = String(slug ?? '').toLowerCase().replace(/-milton$/, '');
  for (const [re, type] of MULTI) {
    if (re.test(s)) return `${canonBase(s.replace(re, ''))}||${type}`;
    const lead = s.match(/^(side-?road|side-rd)-(.+)$/);
    if (lead) return `${canonBase(lead[2])}||side-road`;
  }
  const parts = s.split('-');
  const tail = canonType(parts[parts.length - 1] ?? '');
  if (tail && parts.length > 1) return `${canonBase(parts.slice(0, -1).join('-'))}||${tail}`;
  return `${canonBase(s)}||`;
}

// ── even-odd point-in-polygon, mirroring src/lib/town/polygons.ts ─────────────────────────────
function inRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inPoly = (pt, poly) => poly.rings.reduce((n, r) => n + (inRing(pt, r) ? 1 : 0), 0) % 2 === 1;

/** The bar the geometric assignments were licensed at. */
const AGREEMENT_FLOOR = 0.95;

export default {
  id: 'geometry-control',
  title: 'Town polygons still reproduce the TREB assignments they were licensed against',
  wholeCorpusOnly: true,

  async finish() {
    loadEnv();
    requireEnv('DATABASE_URL');
    const app = neon(process.env.DATABASE_URL);

    const polys = readPolygons();
    const map = readMap();
    const centroids = readCentroids();

    // Every polygon must have an entry in the map, in both directions — a Town refresh that adds
    // or renames a polygon shows up HERE rather than as a silently skipped street.
    const polyNames = new Set(polys.map((p) => p.name));
    const mapKeys = new Set(Object.keys(map));
    const polysWithoutEntry = [...polyNames].filter((n) => !mapKeys.has(n));
    const entriesWithoutPolygon = [...mapKeys].filter((n) => !polyNames.has(n));

    const rows = await app`SELECT r.slug, n.slug AS nbhd
                           FROM public."ResidentialStreet" r
                           JOIN public."Neighbourhood" n ON n.id = r."neighbourhoodId"
                           WHERE r."neighbourhoodSource" = 'treb'`;
    if (!rows.length) throw new Error('no treb-sourced assignments read from DB1 — check the credential, not the data');

    let resolved = 0, agree = 0, disagree = 0, outside = 0, noCentroid = 0, unmapped = 0;
    const examples = [];
    for (const r of rows) {
      const c = centroids.get(identityKeyFromSlug(r.slug));
      if (!c) { noCentroid++; continue; }
      resolved++;
      const hit = polys.find((p) => inPoly(c, p));
      if (!hit) { outside++; continue; }
      const ours = map[hit.name];
      if (ours === null || ours === undefined) { unmapped++; continue; }
      if (ours === r.nbhd) agree++;
      else { disagree++; if (examples.length < 8) examples.push(`${r.slug}: TREB=${r.nbhd} Town=${hit.name} -> ${ours}`); }
    }
    const comparable = agree + disagree;
    const rate = comparable ? agree / comparable : 0;

    return {
      coverage: [
        ['polygons read', polys.length],
        ['map entries read', Object.keys(map).length],
        ['road centroids read', centroids.size],
        ['treb-sourced assignments in DB1', rows.length],
        ['resolved to a centroid', resolved],
        ['comparable (landed in a mapped polygon)', comparable],
        ['agreement', `${agree}/${comparable} = ${(rate * 100).toFixed(1)}%`],
        ['landed in a deliberately unmapped polygon', unmapped],
        ['centroid outside every polygon', outside],
        ['absent from the Town road layer', noCentroid],
      ],
      assertions: [
        // Coverage first: a port that stopped resolving slugs would otherwise measure a tiny
        // sample and pass. Both bounds are derived from what was read, never from a literal count.
        ['centroid resolution below 90% of the population', resolved / rows.length < 0.9 ? 1 : 0, 0],
        ['comparable sample is empty', comparable === 0 ? 1 : 0, 0],
        [`TREB/geometry agreement below ${AGREEMENT_FLOOR * 100}%`, rate < AGREEMENT_FLOOR ? 1 : 0, 0],
        ['polygons with no entry in the map', polysWithoutEntry.length, 0],
        ['map entries with no matching polygon', entriesWithoutPolygon.length, 0],
      ],
      notes: [
        `agreement ${(rate * 100).toFixed(1)}% over ${comparable} streets (floor ${AGREEMENT_FLOOR * 100}%)`,
        ...(polysWithoutEntry.length ? [`polygons missing from the map: ${polysWithoutEntry.join(', ')}`] : []),
        ...(entriesWithoutPolygon.length ? [`map entries with no polygon: ${entriesWithoutPolygon.join(', ')}`] : []),
      ],
      examples,
    };
  },
};
