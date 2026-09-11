// MC-003 Gate A · QUEUE item 5 (geometry backfill). READ-ONLY. Measures, over the published
// street set, which of the seven asked-for fields each layer can supply and for how many streets.
import { readFileSync } from "node:fs";
import { identityFromSlug, identityFromTown } from "@/lib/town/identity";
import { deriveIdentity, streetNameToSlug } from "@/lib/streetUtils";

const WORD_NUMBER: Record<string, string> = {
  first: "1", second: "2", third: "3", fourth: "4", fifth: "5", sixth: "6", seventh: "7",
  eighth: "8", ninth: "9", tenth: "10", eleventh: "11", twelfth: "12", fourteenth: "14",
  fifteenth: "15", sixteenth: "16", seventeenth: "17", twentieth: "20",
  one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8",
  nine: "9", ten: "10", eleven: "11", twelve: "12", fourteen: "14", fifteen: "15", sixteen: "16",
  seventeen: "17", twenty: "20",
};
const normBase = (base: string) => base.split("-").filter(Boolean).map((t) => WORD_NUMBER[t] ?? t.replace(/^(\d+)(st|nd|rd|th)$/, "$1")).join("-");
function osmKeyForSlug(slug: string): string | null {
  const id = deriveIdentity(slug);
  return id ? `${normBase(id.base)}|${id.suffixCanonical}` : null;
}

const RAD = Math.PI / 180;
function metres(a: number[], b: number[]): number {
  const dx = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * RAD) * 111_320;
  const dy = (b[1] - a[1]) * 110_540;
  return Math.hypot(dx, dy);
}
/** axial bearing 0..180 (a street has no direction of travel for this purpose) */
function axialBearing(a: number[], b: number[]): number {
  const dx = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * RAD);
  const dy = b[1] - a[1];
  let deg = (Math.atan2(dx, dy) * 180) / Math.PI; // 0 = north
  deg = ((deg % 180) + 180) % 180;
  return deg;
}
const nodeKey = (pt: number[]) => `${pt[0].toFixed(5)},${pt[1].toFixed(5)}`;

interface Line { pts: number[][] }
interface Geo { lengthM: number; orientation: string; deadEnds: number; endpoints: number; }

/** Orientation from the length-weighted axial bearing. "curved" when the spread is wide. */
function geoOf(lines: Line[], otherStreetNodes: Map<string, Set<string>>, selfKey: string): Geo {
  let len = 0;
  // doubled-angle vector mean for axial data
  let sx = 0, sy = 0;
  const endpointCount = new Map<string, number>();
  for (const l of lines) {
    for (let i = 1; i < l.pts.length; i++) {
      const d = metres(l.pts[i - 1], l.pts[i]);
      len += d;
      const b = axialBearing(l.pts[i - 1], l.pts[i]) * 2 * RAD;
      sx += Math.cos(b) * d; sy += Math.sin(b) * d;
    }
    if (l.pts.length) {
      for (const e of [l.pts[0], l.pts[l.pts.length - 1]]) {
        const k = nodeKey(e);
        endpointCount.set(k, (endpointCount.get(k) ?? 0) + 1);
      }
    }
  }
  const R = len > 0 ? Math.hypot(sx, sy) / len : 0; // 1 = perfectly straight axis, 0 = no dominant axis
  const mean = ((Math.atan2(sy, sx) / RAD) / 2 + 180) % 180;
  let orientation: string;
  if (R < 0.6) orientation = "curved";
  else if (mean < 22.5 || mean >= 157.5) orientation = "N-S";
  else if (mean >= 67.5 && mean < 112.5) orientation = "E-W";
  else orientation = "diagonal";
  // a dead end: an endpoint used by exactly one of this street's segments and touched by no other street
  let deadEnds = 0;
  for (const [k, n] of endpointCount) {
    if (n !== 1) continue;
    const others = otherStreetNodes.get(k);
    if (!others || [...others].every((o) => o === selfKey)) deadEnds++;
  }
  return { lengthM: Math.round(len), orientation, deadEnds, endpoints: endpointCount.size };
}

async function main() {
  // published set: the live sitemap, same derivation the battery uses
  const sm = await (await fetch("https://miltonly.com/sitemap.xml")).text();
  const slugs = [...new Set([...sm.matchAll(/<loc>[^<]*\/streets\/([^<]+)<\/loc>/g)].map((m) => m[1].replace(/\/$/, "")))];
  console.log(`published street pages (sitemap): ${slugs.length}`);

  // ── Town Roads ──
  const roads = JSON.parse(readFileSync("scripts/town/.cache/roads.json", "utf8")) as { features: Array<{ attributes: Record<string, unknown>; geometry?: { paths: number[][][] } }> };
  const townByKey = new Map<string, typeof roads.features>();
  const townNodes = new Map<string, Set<string>>();
  for (const f of roads.features) {
    const id = identityFromTown(f.attributes.GEOSTNAME as string, f.attributes.SUFSTTYPE as string);
    if (!id.base) continue;
    if (!townByKey.has(id.key)) townByKey.set(id.key, []);
    townByKey.get(id.key)!.push(f);
    for (const p of f.geometry?.paths ?? []) for (const e of p) {
      const k = nodeKey(e); if (!townNodes.has(k)) townNodes.set(k, new Set()); townNodes.get(k)!.add(id.key);
    }
  }
  const townAttrCoverage: Record<string, number> = {};
  for (const f of roads.features) for (const [k, v] of Object.entries(f.attributes)) if (v !== null && v !== "" && v !== 0) townAttrCoverage[k] = (townAttrCoverage[k] ?? 0) + 1;
  console.log(`Town road segments: ${roads.features.length}; non-empty per attribute:`, Object.fromEntries(Object.entries(townAttrCoverage).filter(([k]) => ["LANES","SPEED_LIMIT","CATEGORY","ROADCLASS","ONEWAY","PLOWCLASS","OWNERSHIP","WINTER_MTN"].includes(k))));
  const cats: Record<string, number> = {}; for (const f of roads.features) { const c = String(f.attributes.CATEGORY ?? "null"); cats[c] = (cats[c] ?? 0) + 1; }
  console.log("Town CATEGORY values:", cats);
  const spd: Record<string, number> = {}; for (const f of roads.features) { const c = String(f.attributes.SPEED_LIMIT ?? "null"); spd[c] = (spd[c] ?? 0) + 1; }
  console.log("Town SPEED_LIMIT values:", spd);
  const lanesV: Record<string, number> = {}; for (const f of roads.features) { const c = String(f.attributes.LANES ?? "null"); lanesV[c] = (lanesV[c] ?? 0) + 1; }
  console.log("Town LANES values:", lanesV);

  // ── OSM ──
  const gj = JSON.parse(readFileSync("D:/dashcam/work/milton-roads.geojson", "utf8")) as { features: Array<{ properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }> };
  const osmByKey = new Map<string, typeof gj.features>();
  const osmNodes = new Map<string, Set<string>>();
  const linesOf = (g: { type: string; coordinates: unknown }): number[][][] => g.type === "LineString" ? [g.coordinates as number[][]] : g.type === "MultiLineString" ? (g.coordinates as number[][][]) : [];
  for (const f of gj.features) {
    const name = String(f.properties?.name ?? "");
    if (!name) continue;
    const key = osmKeyForSlug(streetNameToSlug(name));
    if (!key) continue;
    if (!osmByKey.has(key)) osmByKey.set(key, []);
    osmByKey.get(key)!.push(f);
    for (const p of linesOf(f.geometry)) for (const e of p) {
      const k = nodeKey(e); if (!osmNodes.has(k)) osmNodes.set(k, new Set()); osmNodes.get(k)!.add(key);
    }
  }
  const surfaceV: Record<string, number> = {}; for (const f of gj.features) { const c = String(f.properties.surface ?? "null"); surfaceV[c] = (surfaceV[c] ?? 0) + 1; }
  console.log("OSM surface values (segments):", surfaceV);
  const sidewalkV: Record<string, number> = {}; for (const f of gj.features) { const c = String(f.properties.sidewalk ?? (f.properties["sidewalk:both"] ? `both:${f.properties["sidewalk:both"]}` : f.properties["sidewalk:left"] || f.properties["sidewalk:right"] ? `l/r:${f.properties["sidewalk:left"] ?? "-"}/${f.properties["sidewalk:right"] ?? "-"}` : "null")); sidewalkV[c] = (sidewalkV[c] ?? 0) + 1; }
  console.log("OSM sidewalk values (segments):", sidewalkV);
  const maxV: Record<string, number> = {}; for (const f of gj.features) { const c = String(f.properties.maxspeed ?? "null"); maxV[c] = (maxV[c] ?? 0) + 1; }
  console.log("OSM maxspeed values (segments):", maxV);

  // ── per published street ──
  const c = { townMatch: 0, townLanes: 0, townSpeed: 0, townCategory: 0, townLength: 0, townDeadEnd: 0, townOrientation: {} as Record<string, number>,
              osmMatch: 0, osmSurface: 0, osmLanes: 0, osmSidewalk: 0, osmMaxspeed: 0, osmLit: 0, osmLength: 0, osmDeadEnd: 0, osmOrientation: {} as Record<string, number>,
              neither: 0, either: 0, both: 0, lengthDisagree20pct: 0, lanesDisagree: 0, speedDisagree: 0,
              osmSurfaceMixed: 0, osmSidewalkMixed: 0, osmMaxspeedMixed: 0, townSpeedMixed: 0, townLanesMixed: 0 };
  const unmatched: string[] = [];
  const cul: string[] = [];
  for (const slug of slugs) {
    const tid = identityFromSlug(slug);
    const tf = townByKey.get(tid.key) ?? [];
    const ok = osmKeyForSlug(slug);
    const of = (ok && osmByKey.get(ok)) ?? [];
    const hasT = tf.length > 0, hasO = of.length > 0;
    if (hasT) c.townMatch++; if (hasO) c.osmMatch++;
    if (hasT && hasO) c.both++; if (hasT || hasO) c.either++; if (!hasT && !hasO) { c.neither++; unmatched.push(slug); }
    let tGeo: Geo | null = null, oGeo: Geo | null = null;
    let tLanes: number | null = null, tSpeed: number | null = null, oLanes: number | null = null, oSpeed: number | null = null;
    if (hasT) {
      const lanesSet = new Set(tf.map((f) => f.attributes.LANES).filter((v) => v !== null && v !== 0));
      const speedSet = new Set(tf.map((f) => f.attributes.SPEED_LIMIT).filter((v) => v !== null && v !== 0));
      if (lanesSet.size) { c.townLanes++; if (lanesSet.size > 1) c.townLanesMixed++; tLanes = Number([...lanesSet][0]); }
      if (speedSet.size) { c.townSpeed++; if (speedSet.size > 1) c.townSpeedMixed++; tSpeed = Number([...speedSet][0]); }
      if (tf.some((f) => f.attributes.CATEGORY)) c.townCategory++;
      tGeo = geoOf(tf.flatMap((f) => (f.geometry?.paths ?? []).map((p) => ({ pts: p }))), townNodes, tid.key);
      c.townLength++;
      if (tGeo.deadEnds > 0) { c.townDeadEnd++; cul.push(slug); }
      c.townOrientation[tGeo.orientation] = (c.townOrientation[tGeo.orientation] ?? 0) + 1;
    }
    if (hasO) {
      const val = (k: string) => new Set(of.map((f) => f.properties[k]).filter((v) => v !== undefined && v !== null && v !== ""));
      const sf = val("surface"); if (sf.size) { c.osmSurface++; if (sf.size > 1) c.osmSurfaceMixed++; }
      const ln = val("lanes"); if (ln.size) { c.osmLanes++; oLanes = Number([...ln][0]); }
      const sw = new Set(of.map((f) => f.properties.sidewalk ?? f.properties["sidewalk:both"] ?? (f.properties["sidewalk:left"] || f.properties["sidewalk:right"] ? "l/r" : null)).filter(Boolean));
      if (sw.size) { c.osmSidewalk++; if (sw.size > 1) c.osmSidewalkMixed++; }
      const ms = val("maxspeed"); if (ms.size) { c.osmMaxspeed++; if (ms.size > 1) c.osmMaxspeedMixed++; oSpeed = parseInt(String([...ms][0]), 10); }
      if (val("lit").size) c.osmLit++;
      oGeo = geoOf(of.flatMap((f) => linesOf(f.geometry).map((p) => ({ pts: p }))), osmNodes, ok!);
      c.osmLength++;
      if (oGeo.deadEnds > 0) c.osmDeadEnd++;
      c.osmOrientation[oGeo.orientation] = (c.osmOrientation[oGeo.orientation] ?? 0) + 1;
    }
    if (tGeo && oGeo && Math.abs(tGeo.lengthM - oGeo.lengthM) / Math.max(tGeo.lengthM, 1) > 0.2) c.lengthDisagree20pct++;
    if (tLanes !== null && oLanes !== null && tLanes !== oLanes) c.lanesDisagree++;
    if (tSpeed !== null && oSpeed !== null && tSpeed !== oSpeed) c.speedDisagree++;
  }
  console.log("\nPER PUBLISHED STREET:", JSON.stringify(c, null, 1));
  console.log("unmatched by both layers:", unmatched.length, unmatched.slice(0, 20).join(", "));
  console.log("Town dead-end sample:", cul.slice(0, 12).join(", "));
}
main().catch((e) => { console.error(e); process.exit(1); });
