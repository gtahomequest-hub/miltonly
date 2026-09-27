// MC-045 class 2, step 3: ground every parsed COMPASS / POSITION claim in Town geometry.
//
//   MARGIN=700 node scratchpad/mc045/method/class2-verdict.mjs <workDir> <outDir>
//
// INPUTS
//   class2-candidates.json   the candidate sentences (step 1)
//   c2-parse.json            two independent agent parses of every candidate (step 2)
//   street-vertices.json     every vertex of each street's Town centreline (street-vertices.ts;
//                            Town Road Segments, scripts/town/.cache/roads.json, pulled 2026-09-11)
//   scripts/town/.cache/neighbourhoods.json and roads.json (Town layers)
//
// THE REFERENCE. Downtown Milton = the Main St E x Martin St intersection, 43.513465, -79.882820:
// a vertex shared by MAIN STREET E and MARTIN STREET in the Town road layer, rebuildable from Town
// data, 69 m from the Old Milton polygon centroid and 325 m from Town Hall. MARGIN (default 700 m)
// is larger than the distance to every other defensible downtown point (Town Hall 325 m, Main x
// Bronte 690 m), so no verdict changes if the reference moves to one of them.
// Whole-town claims ("west Milton", "the town's north end") are also tested from the urban centroid
// (length-weighted Town road midpoints outside the 5 rural polygons): WRONG needs both.
//
// TWO FRAMES. The Town grid is rotated: its east-west roads run at 39 deg true, its north-south
// roads at 315/135. A claim is WRONG only if it is wrong in the TRUE frame and in the GRID frame.
//
// TESTS
//   T1 half-plane (town-compass, anchor-compass to downtown): WRONG iff, for every frame and every
//      applicable origin, the subject's MOST FAVOURABLE vertex still lies at least MARGIN on the
//      opposite side (max over vertices of (v - origin) . u < -MARGIN). A long street or polygon
//      that crosses the line can never be WRONG. errM = how far the best vertex misses.
//   T2 sector (reported, not headline): every vertex beyond MARGIN lies outside +-45 deg of the
//      claimed direction, in both frames and from every applicable origin: MISPLACED.
//   T3 road side (anchor-compass to a road): each subject vertex whose nearest point on the road is
//      not at the road's free end is counted; the claimed direction must lie within 67.5 deg of the
//      local road normal in both frames (else untestable); WRONG iff every counted vertex is at least
//      ROAD_MARGIN (100 m) on the other side.
//   T4 proximity to downtown: WRONG iff the subject's nearest vertex is more than NEAR_M (2,000 m)
//      from the reference.
//   T5 anchor-compass to a neighbourhood: WRONG iff the subject lies entirely beyond the anchor
//      polygon on the opposite side by at least MARGIN (max(subject.u) < min(anchor.u) - MARGIN).
//   within-area-compass ("the western edge of Timberlea"): tested against the area polygon's
//      centroid with AREA_MARGIN (200 m), reported as its own row.
// SUBJECT GEOMETRY: this-street = the street's vertices; its-neighbourhood / other-neighbourhood =
//   the Town polygon(s) mapped to that neighbourhood (union), which is larger than the street and
//   so harder to call WRONG; an unmappable neighbourhood falls back to the street (flagged).
// NOT CHECKABLE (counted, never judged): edge-of-town (no urban boundary polygon exists in any
//   repo or Town layer), orientation, other-position, and anchors with no geometry (the escarpment,
//   the GO/rail line, "the commercial spine", "the built-up area", water/parks, other).
// AGREEMENT: a claim is judged only when BOTH parsers produced it (same relation, direction,
//   anchor kind and anchor name for roads). One-parser claims are listed for a tie-break.
import fs from 'node:fs';
import path from 'node:path';

const [workDir, outDir] = process.argv.slice(2);
const MARGIN = +(process.env.MARGIN ?? 700), ROAD_MARGIN = 100, NEAR_M = +(process.env.NEAR_M ?? 2000), AREA_MARGIN = 200;
const FRAMES = (process.env.FRAMES ?? 'both');
const J = (f) => JSON.parse(fs.readFileSync(path.join(workDir, f), 'utf8'));
const cands = J('class2-candidates.json');
const parse = J('c2-parse.json'); // { [id]: [claimsA, claimsB] }
const SV = J('street-vertices.json');
const roads = JSON.parse(fs.readFileSync('D:/miltonly/scripts/town/.cache/roads.json', 'utf8')).features;
const nbf = JSON.parse(fs.readFileSync('D:/miltonly/scripts/town/.cache/neighbourhoods.json', 'utf8')).features;

// ── plane at the reference ──
const REF = [43.513465, -79.88282];
const KX = 111320 * Math.cos((REF[0] * Math.PI) / 180), KY = 110540;
const P = ([lat, lng]) => [(lng - REF[1]) * KX, (lat - REF[0]) * KY];
const unit = (deg) => [Math.sin((deg * Math.PI) / 180), Math.cos((deg * Math.PI) / 180)];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const TRUE = { north: 0, northeast: 45, east: 90, southeast: 135, south: 180, southwest: 225, west: 270, northwest: 315 };
const GRID = { north: 315, northeast: 357, east: 39, southeast: 87, south: 135, southwest: 177, west: 219, northwest: 267 };
const frames = FRAMES === 'true' ? [TRUE] : FRAMES === 'grid' ? [GRID] : [TRUE, GRID];
const angDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

// ── neighbourhood polygons, mapped to our neighbourhood names ──
// our neighbourhood names -> Town polygons, per src/data/townNeighbourhoodMap.ts (the repo's evidenced
// map). Nassagaweya is one Town polygon over all of rural Milton, which the map deliberately leaves
// unassigned; for POSITION tests only, it stands as a superset for the rural hamlets (nassagaweya,
// campbellville, brookville-haltonville, moffat), which makes a WRONG verdict harder, not easier.
const NB_POLYS = {
  Beaty: ['Beaty'], Bowes: ['Bowes'], Clarke: ['Clarke'], Coates: ['Coates'], Cobban: ['Cobban'], Dempsey: ['Dempsey'],
  'Dorset Park': ['Dorset Park'], Ford: ['Ford'], Harrison: ['Harrison'], Scott: ['Scott'], Timberlea: ['Timberlea'],
  Walker: ['Walker'], Willmott: ['Willmott'], 'Bronte Meadows': ['Bronte Meadows'],
  'Old Milton': ['Old Milton', 'Fallingbrook', 'Mountain View', 'Valley View', 'Forest Grove'],
  'Rural Milton West': ['Nelson'], 'Rural Trafalgar': ['Trafalgar'], 'Milton North': ['Esquesing', 'Milton Heights'],
  'Milton Heights': ['Milton Heights'], Nassagaweya: ['Nassagaweya'],
};
const polyByName = Object.fromEntries(nbf.map((f) => [f.attributes.NAME, f.geometry.rings.flat().map(([x, y]) => P([y, x]))]));
const nbVerts = Object.fromEntries(Object.entries(NB_POLYS).map(([k, names]) => [k, names.flatMap((n) => polyByName[n] ?? [])]));
const nbKey = (name) => {
  if (!name) return null;
  const n = name.replace(/^(?:the|Milton's)\s+/i, '').replace(/\s+(?:area|neighbourhood|pocket|hub)$/i, '').trim().toLowerCase();
  const hit = Object.keys(nbVerts).sort((a, b) => b.length - a.length).find((k) => n === k.toLowerCase() || n.startsWith(k.toLowerCase()));
  if (hit) return hit;
  if (/^(?:rural )?nassagaweya|campbellville|brookville|haltonville|moffat/.test(n)) return 'Nassagaweya';
  if (/^rural (?:milton )?west|^nelson/.test(n)) return 'Rural Milton West';
  if (/^rural trafalgar|^trafalgar/.test(n)) return 'Rural Trafalgar';
  if (/^esquesing/.test(n)) return 'Milton North';
  return null;
};
const centroid = (pts) => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];

// ── urban centroid: length-weighted Town road midpoints outside the 5 rural polygons ──
const RURAL = new Set(['Nassagaweya', 'Trafalgar', 'Nelson', 'Esquesing', 'Milton Heights']);
const ruralRings = nbf.filter((f) => RURAL.has(f.attributes.NAME)).map((f) => f.geometry.rings);
const pip = (pt, rings) => { let inside = false; for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside; } return inside; };
let sw = 0, sx = 0, sy = 0;
for (const f of roads) for (const pth of f.geometry.paths) for (let i = 1; i < pth.length; i++) {
  const a = pth[i - 1], b = pth[i], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (ruralRings.some((r) => pip(mid, r))) continue;
  const pa = P([a[1], a[0]]), pb = P([b[1], b[0]]), w = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
  sw += w; sx += (w * (pa[0] + pb[0])) / 2; sy += (w * (pa[1] + pb[1])) / 2;
}
const URB = [sx / sw, sy / sw];

// ── road resolver: an anchor name to its Town polyline segments (ramps excluded) ──
const TYPE = { road: 'ROAD', rd: 'ROAD', street: 'STREET', st: 'STREET', avenue: 'AVENUE', ave: 'AVENUE', parkway: 'PARKWAY', line: 'LINE', drive: 'DRIVE', boulevard: 'BOULEVARD', way: 'WAY', crescent: 'CRESCENT', highway: 'HIGHWAY' };
const roadCache = {};
function roadSegs(name) {
  if (roadCache[name] !== undefined) return roadCache[name];
  const n = name.replace(/^the\s+/i, '').replace(/\./g, '').trim();
  let feats = [];
  const hw = n.match(/^(?:highway|hwy)\s*(\d+)$|^(\d+)$/i);
  if (hw) feats = roads.filter((f) => f.attributes.GEOSTNAME === (hw[1] || hw[2]) && f.attributes.SUFSTTYPE === 'HIGHWAY');
  else {
    const words = n.split(/\s+/); let type = TYPE[words[words.length - 1].toLowerCase()]; let base = type ? words.slice(0, -1) : words;
    let dir = null; if (/^(?:east|west|north|south|e|w|n|s)$/i.test(base[base.length - 1] ?? '')) { dir = base.pop()[0].toUpperCase(); }
    const b = base.join(' ').toUpperCase().replace(/^ST /, 'ST ').replace(/^SAINT /, 'ST ');
    feats = roads.filter((f) => f.attributes.GEOSTNAME === b && (!type || f.attributes.SUFSTTYPE === type) && !/^EXIT/.test(f.attributes.GEOSTNAME) && (!dir || !f.attributes.SUFSTDIR || f.attributes.SUFSTDIR === dir));
    if (b === 'MAIN') feats = feats.filter((f) => ['E', 'W', null].includes(f.attributes.SUFSTDIR) && f.geometry.paths.flat().every(([x, y]) => Math.hypot(...P([y, x])) < 8000));
  }
  const segs = [];
  const deg = new Map(); const key = (p) => `${Math.round(p[0])},${Math.round(p[1])}`;
  for (const f of feats) for (const pth of f.geometry.paths) { const pts = pth.map(([x, y]) => P([y, x])); for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1], pts[i]]); deg.set(key(pts[0]), (deg.get(key(pts[0])) ?? 0) + 1); deg.set(key(pts[pts.length - 1]), (deg.get(key(pts[pts.length - 1])) ?? 0) + 1); }
  const ends = new Set([...deg].filter(([, d]) => d === 1).map(([k]) => k));
  roadCache[name] = segs.length ? { segs, ends, key } : null;
  return roadCache[name];
}

// ── subject geometry ──
function subjectVerts(c, cand) {
  if (c.subjectKind === 'generic') return { verts: null, why: "generic subject (not this page street or a named place)" };
  if (c.subjectKind === 'this-street') {
    const s = SV[cand.slug]; if (!s) return { verts: null, why: 'no street geometry' };
    let v = s.vertices; if (cand.slug === 'main-street-milton') v = v.filter(([, lng]) => lng > -79.95);
    return { verts: v.map(P), kind: 'street' };
  }
  if (c.subjectKind === 'its-neighbourhood' || c.subjectKind === 'other-neighbourhood') {
    const k = nbKey(c.subjectName) ?? (c.subjectKind === 'its-neighbourhood' ? nbKey((cand.containedIn ?? []).find((n) => n !== 'Milton')) : null);
    if (k && nbVerts[k]) return { verts: nbVerts[k], kind: `polygon:${k}` };
    if (c.subjectKind === 'its-neighbourhood' && SV[cand.slug]) return { verts: SV[cand.slug].vertices.map(P), kind: 'street(fallback)' };
    return { verts: null, why: `no polygon for ${c.subjectName}` };
  }
  return { verts: null, why: 'other-street subject' };
}

// ── tests ──
function halfPlane(verts, dir, origins, margin = MARGIN) {
  let wrong = true, err = Infinity, misplaced = true;
  for (const o of origins) for (const F of frames) {
    const u = unit(F[dir]);
    const projs = verts.map((v) => dot([v[0] - o[0], v[1] - o[1]], u));
    const max = Math.max(...projs);
    if (!(max < -margin)) wrong = false;
    err = Math.min(err, -max);
    const out = verts.every((v) => { const d = [v[0] - o[0], v[1] - o[1]]; if (Math.hypot(...d) <= margin) return false; const b = (Math.atan2(d[0], d[1]) * 180) / Math.PI; return angDiff((b + 360) % 360, F[dir]) > 45; });
    if (!out) misplaced = false;
  }
  return { v: wrong ? 'WRONG' : misplaced ? 'MISPLACED' : 'not-refuted', errM: Math.round(err) };
}
function roadSide(verts, dir, road) {
  let counted = 0, allWrong = true, minOff = Infinity, untestable = 0;
  for (const v of verts) {
    let best = null;
    for (const [a, b] of road.segs) { const ab = [b[0] - a[0], b[1] - a[1]], L = dot(ab, ab); if (!L) continue; const t = Math.max(0, Math.min(1, dot([v[0] - a[0], v[1] - a[1]], ab) / L)); const q = [a[0] + t * ab[0], a[1] + t * ab[1]]; const d = Math.hypot(v[0] - q[0], v[1] - q[1]); if (!best || d < best.d) best = { d, q, ab, t, a, b }; }
    if (!best) continue;
    const atEnd = (best.t === 0 && road.ends.has(road.key(best.a))) || (best.t === 1 && road.ends.has(road.key(best.b)));
    if (atEnd) continue;
    const n0 = [best.ab[1], -best.ab[0]]; const nl = Math.hypot(...n0); let n = [n0[0] / nl, n0[1] / nl];
    const okFrames = frames.every((F) => { const u = unit(F[dir]); if (dot(n, u) < 0) n = [-n[0], -n[1]]; return (Math.acos(Math.max(-1, Math.min(1, dot(n, u)))) * 180) / Math.PI <= 67.5; });
    if (!okFrames) { untestable++; continue; }
    const u = unit(frames[0][dir]); if (dot(n, u) < 0) n = [-n[0], -n[1]];
    const off = dot([v[0] - best.q[0], v[1] - best.q[1]], n);
    counted++; minOff = Math.min(minOff, -off);
    if (!(off <= -ROAD_MARGIN)) allWrong = false;
  }
  if (!counted) return { v: untestable ? 'untestable-orientation' : 'untestable-beyond-road', errM: null };
  return { v: allWrong ? 'WRONG' : 'not-refuted', errM: Math.round(minOff) };
}
function judge(c, cand) {
  const REL = c.relation, dir = c.direction;
  if (c.negated) return { v: 'negated-not-judged' };
  if (['edge-of-town', 'orientation', 'other-position'].includes(REL)) return { v: 'not-checkable', why: REL };
  const sub = subjectVerts(c, cand);
  if (!sub.verts) return { v: 'no-geometry', why: sub.why };
  if (REL === 'town-compass' && dir !== 'none') return { ...halfPlane(sub.verts, dir, [[0, 0], URB]), test: 'T1 town', subject: sub.kind };
  if (REL === 'anchor-compass' && dir !== 'none') {
    if (c.anchorKind === 'downtown' || c.anchorKind === 'town') return { ...halfPlane(sub.verts, dir, [[0, 0]]), test: 'T1 downtown', subject: sub.kind };
    if (c.anchorKind === 'road') { const r = roadSegs(c.anchorName); if (!r) return { v: 'no-geometry', why: `road not resolved: ${c.anchorName}` }; return { ...roadSide(sub.verts, dir, r), test: 'T3 road', subject: sub.kind }; }
    if (c.anchorKind === 'neighbourhood') { const k = nbKey(c.anchorName); if (!k || !nbVerts[k]) return { v: 'no-geometry', why: `no polygon for ${c.anchorName}` }; let wrong = true, err = Infinity; for (const F of frames) { const u = unit(F[dir]); const smax = Math.max(...sub.verts.map((v) => dot(v, u))); const amin = Math.min(...nbVerts[k].map((v) => dot(v, u))); if (!(smax < amin - MARGIN)) wrong = false; err = Math.min(err, amin - smax); } return { v: wrong ? 'WRONG' : 'not-refuted', errM: Math.round(err), test: 'T5 neighbourhood', subject: sub.kind }; }
    return { v: 'not-checkable', why: `anchor ${c.anchorKind}` };
  }
  if (REL === 'proximity') {
    if (c.anchorKind !== 'downtown') return { v: 'not-checkable', why: `proximity to ${c.anchorKind}` };
    // no stated distance or a comparison: "within easy reach", "closer to", "more central", "access to", "a drive"
    if (/\b(?:reach|closer|nearer|more central|access|minutes?|drive|commute)\b/i.test(c.quote)) return { v: 'not-checkable', why: 'vague or comparative proximity' };
    // "near downtown / the core / the historic centre" is measured from the downtown reference only.
    // "central" / "the centre of town" names the town's middle, which is not its downtown (the urban
    // centroid sits 1.9 km east of it), so such a claim is WRONG only if it is far from BOTH.
    const coreNamed = /\b(?:downtown|core|historic|main street|older)\b/i.test(`${c.anchorName} ${c.quote}`) && !/\bcentral\b/i.test(c.quote);
    const origins = coreNamed ? [[0, 0]] : [[0, 0], URB];
    const near = Math.min(...origins.map((o) => Math.min(...sub.verts.map((v) => Math.hypot(v[0] - o[0], v[1] - o[1])))));
    return { v: near > NEAR_M ? 'WRONG' : 'not-refuted', errM: Math.round(near - NEAR_M), nearestM: Math.round(near), test: coreNamed ? 'T4 proximity (downtown)' : 'T4 proximity (central)', subject: sub.kind };
  }
  if (REL === 'within-area-compass' && dir !== 'none') {
    const k = nbKey(c.anchorName); if (!k || !nbVerts[k]) return { v: 'no-geometry', why: `no polygon for ${c.anchorName}` };
    const sv = SV[cand.slug]; if (!sv) return { v: 'no-geometry', why: 'no street geometry' };
    return { ...halfPlane(sv.vertices.map(P), dir, [centroid(nbVerts[k])], AREA_MARGIN), test: 'within-area', subject: 'street' };
  }
  return { v: 'not-checkable', why: `${REL}/${dir}` };
}

// ── agreement between the two parsers ──
const sig = (c) => [c.relation, c.direction, c.anchorKind, c.anchorKind === 'road' ? (c.anchorName || '').toLowerCase().replace(/^the\s+/, '') : '', c.subjectKind === 'this-street' || c.subjectKind === 'generic' ? 'street' : c.subjectKind].join('|');
const judged = [], oneParser = [];
for (const cand of cands) {
  const [A = [], B = []] = parse[cand.id] ?? [];
  const bs = new Map(B.map((c) => [sig(c), c]));
  const as = new Map(A.map((c) => [sig(c), c]));
  for (const [k, c] of as) {
    if (bs.has(k)) judged.push({ id: cand.id, slug: cand.slug, surfaces: cand.surfaces, text: cand.text, claim: c, ...judge(c, cand) });
    else oneParser.push({ id: cand.id, slug: cand.slug, text: cand.text, parser: 'A', claim: c, ...judge(c, cand) });
  }
  for (const [k, c] of bs) if (!as.has(k)) oneParser.push({ id: cand.id, slug: cand.slug, text: cand.text, parser: 'B', claim: c, ...judge(c, cand) });
}
const pagesWith = (f) => new Set(judged.filter(f).map((x) => x.slug));
const summary = {
  params: { MARGIN, ROAD_MARGIN, NEAR_M, AREA_MARGIN, FRAMES, reference: '43.513465,-79.882820 (Main St E x Martin St)', urbanCentroid: [+(REF[0] + URB[1] / KY).toFixed(6), +(REF[1] + URB[0] / KX).toFixed(6)] },
  candidates: cands.length, agreedClaims: judged.length, oneParserClaims: oneParser.length,
  pagesWithAnyAgreedClaim: pagesWith(() => true).size,
  pagesWithCheckableClaim: pagesWith((x) => ['WRONG', 'MISPLACED', 'not-refuted'].includes(x.v)).size,
  pagesWrong: pagesWith((x) => x.v === 'WRONG').size,
  pagesMisplacedOnly: [...pagesWith((x) => x.v === 'MISPLACED')].filter((s) => !pagesWith((x) => x.v === 'WRONG').has(s)).length,
  byVerdict: judged.reduce((a, x) => ((a[x.v] = (a[x.v] ?? 0) + 1), a), {}),
  byTestWrong: judged.filter((x) => x.v === 'WRONG').reduce((a, x) => ((a[x.test] = (a[x.test] ?? 0) + 1), a), {}),
  notCheckable: judged.filter((x) => x.v === 'not-checkable').reduce((a, x) => ((a[x.why] = (a[x.why] ?? 0) + 1), a), {}),
  wrongPagesBySurface: (() => { const o = {}; for (const x of judged.filter((y) => y.v === 'WRONG')) for (const s of new Set(x.surfaces.map((q) => (q.startsWith('sec:') ? 'profile' : q)))) (o[s] ??= new Set()).add(x.slug); return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.size])); })(),
  oneParserWrong: oneParser.filter((x) => x.v === 'WRONG').length,
};
fs.mkdirSync(outDir, { recursive: true });
const tag = process.env.TAG ?? '';
fs.writeFileSync(path.join(workDir, `class2-judged${tag}.json`), JSON.stringify({ summary, judged, oneParser }));
if (!tag) {
  const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = judged.filter((x) => ['WRONG', 'MISPLACED'].includes(x.v)).sort((a, b) => (b.errM ?? 0) - (a.errM ?? 0));
  fs.writeFileSync(path.join(outDir, 'class2-wrong-and-misplaced.csv'), ['verdict,slug,errM,test,subject,relation,direction,anchor,surfaces,quote,text', ...rows.map((x) => [x.v, x.slug, x.errM, x.test, x.subject, x.claim.relation, x.claim.direction, x.claim.anchorName || x.claim.anchorKind, x.surfaces.join(' '), x.claim.quote, x.text].map(csv).join(','))].join('\n') + '\n');
  fs.writeFileSync(path.join(outDir, 'class2-all-claims.csv'), ['verdict,slug,errM,test,subject,relation,direction,anchorKind,anchorName,negated,hedged,surfaces,quote', ...judged.map((x) => [x.v, x.slug, x.errM, x.test, x.subject, x.claim.relation, x.claim.direction, x.claim.anchorKind, x.claim.anchorName, x.claim.negated, x.claim.hedged, x.surfaces.join(' '), x.claim.quote].map(csv).join(','))].join('\n') + '\n');
  fs.writeFileSync(path.join(outDir, 'class2-summary.json'), JSON.stringify(summary, null, 1));
}
console.log(JSON.stringify(summary, null, 1));
