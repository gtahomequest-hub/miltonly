// src/lib/town/polygons.ts
// ONE point-in-polygon implementation, and one length-weighted assignment, shared by the
// generator, the assignment script and the verification battery.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE BUG THIS FILE EXISTS TO PREVENT
//
// ArcGIS writes polygon rings with an orientation convention: OUTER rings clockwise, HOLES
// counter-clockwise. The obvious way to honour that is to take each ring's signed shoelace area
// and treat one sign as "hole". Both times that was written by hand here, the sign was backwards,
// so every outer ring was classified as a hole and `inPolygon` returned false for every point on
// Earth. It did not throw and it did not look broken: the analysis reported "0 of 187 streets
// assignable" — a clean, confident, completely wrong answer, twice.
//
// So orientation is not consulted at all. EVEN-ODD: a point is inside the polygon when it is
// inside an ODD number of its rings. An outer ring alone is 1 (inside); an outer ring plus a
// hole containing the point is 2 (outside). No winding convention, nothing to get backwards.
//
// The second half of the defence is the CONTROL, which lives in the battery
// (scripts/verify/checks/geometry-control.mjs): streets whose TREB neighbourhood we already know
// are run through this same code and must still agree at >= 95%. A silent zero fails that
// immediately. Never trust this file without it.
// ─────────────────────────────────────────────────────────────────────────────────────────────

export interface TownPolygon {
  /** the Town's own NAME field — never rendered, only mapped */
  name: string;
  /** WGS84 [lng, lat] rings */
  rings: number[][][];
}

/** Ray casting against a single ring. */
function inRing(pt: readonly number[], ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** EVEN-ODD across every ring. Orientation-independent by construction — see the header. */
export function inPolygon(pt: readonly number[], poly: TownPolygon): boolean {
  let crossings = 0;
  for (const ring of poly.rings) if (inRing(pt, ring)) crossings++;
  return crossings % 2 === 1;
}

/** The first polygon containing the point, or null. */
export function polygonAt(pt: readonly number[], polys: readonly TownPolygon[]): TownPolygon | null {
  for (const p of polys) if (inPolygon(pt, p)) return p;
  return null;
}

// ── length-weighted assignment ────────────────────────────────────────────────────────────────

const RAD = Math.PI / 180;
/** Metres between two WGS84 points, flat-earth at Milton's latitude. Same formula as
 *  gen-road-facts.ts — a street is hundreds of metres long, not hundreds of kilometres. */
export function metresBetween(a: readonly number[], b: readonly number[]): number {
  const dx = (b[0] - a[0]) * Math.cos(((a[1] + b[1]) / 2) * RAD) * 111_320;
  const dy = (b[1] - a[1]) * 110_540;
  return Math.hypot(dx, dy);
}

/** A street's centreline length inside each polygon, plus whatever falls outside all of them. */
export interface LengthByPolygon {
  /** polygon NAME -> metres of centreline inside it */
  metres: Map<string, number>;
  /** metres inside no polygon at all */
  outside: number;
  /** total centreline metres measured */
  total: number;
}

/**
 * Walk every segment in ~STEP-metre steps and attribute each step to the polygon containing its
 * midpoint. This is what makes the assignment DOMINANT LENGTH rather than centroid.
 *
 * The centroid is one point standing in for a line. It is cheap and it agreed with TREB 95% of
 * the time, but on a long street it can land in a polygon the street barely enters, and it can
 * never tell you that a street crosses three. Stepping the line answers both.
 */
export function lengthByPolygon(
  paths: readonly (readonly number[])[][],
  polys: readonly TownPolygon[],
  step = 20,
): LengthByPolygon {
  const metres = new Map<string, number>();
  let outside = 0, total = 0;
  for (const path of paths) {
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i];
      const segLen = metresBetween(a, b);
      if (!(segLen > 0)) continue;
      const steps = Math.max(1, Math.ceil(segLen / step));
      const each = segLen / steps;
      for (let s = 0; s < steps; s++) {
        const t = (s + 0.5) / steps;                       // midpoint of this step
        const mid = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        const p = polygonAt(mid, polys);
        if (p) metres.set(p.name, (metres.get(p.name) ?? 0) + each);
        else outside += each;
        total += each;
      }
    }
  }
  return { metres, outside, total };
}

/** The share of total length the largest polygon holds, and the ranked breakdown. */
export interface DominantResult {
  /** polygon NAME with the most length, or null when no polygon holds any */
  dominant: string | null;
  /** dominant metres / total metres, 0..1 */
  share: number;
  /** every polygon touched, most length first */
  ranked: Array<{ name: string; metres: number; share: number }>;
  total: number;
  outsideShare: number;
}

export function dominantPolygon(l: LengthByPolygon): DominantResult {
  // Array.from rather than [...map.entries()] — the repo's tsconfig target predates
  // downlevelIteration, and spreading a Map iterator does not compile under it.
  const ranked = Array.from(l.metres, ([name, m]) => ({
    name,
    metres: m,
    share: l.total > 0 ? m / l.total : 0,
  })).sort((a, b) => b.metres - a.metres);
  return {
    dominant: ranked[0]?.name ?? null,
    share: ranked[0]?.share ?? 0,
    ranked,
    total: l.total,
    outsideShare: l.total > 0 ? l.outside / l.total : 0,
  };
}

/** Below this share of centreline length, a street records its SPAN instead of an assignment. */
export const DOMINANT_SHARE_FLOOR = 0.6;
