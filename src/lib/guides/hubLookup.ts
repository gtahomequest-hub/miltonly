// src/lib/guides/hubLookup.ts
//
// WHICH HUB A POINT SITS IN, AND WHICH HUBS ARE NEAR ONE. The two source-grounded guides
// link down to neighbourhood pages the same way the others do: from the same data that
// produced the sentence. A pilot park's hub is the polygon its Town-published centroid sits
// in; the hubs near Milton GO are the polygons whose edge is within walking reach of the
// station. Both go through TOWN_POLYGON_TO_NEIGHBOURHOOD, the only place a Town polygon name
// may become one of our slugs, and both are filtered to hubs that are actually published, so a
// guide can never link to a hub that answers 404.

import "server-only";
import { prisma } from "@/lib/prisma";
import { TOWN_NEIGHBOURHOODS } from "@/data/townNeighbourhoods";
import { TOWN_POLYGON_TO_NEIGHBOURHOOD } from "@/data/townNeighbourhoodMap";
import { polygonAt, metresBetween } from "@/lib/town/polygons";

export interface PublishedHub {
  slug: string;
  name: string;
}

export async function publishedHubs(): Promise<Map<string, PublishedHub>> {
  const rows = await prisma.hubContent.findMany({
    where: { status: "published" },
    select: { neighbourhoodSlug: true, neighbourhoodName: true },
  });
  return new Map(rows.map((r) => [r.neighbourhoodSlug, { slug: r.neighbourhoodSlug, name: r.neighbourhoodName }]));
}

/** Our hub slug for a WGS84 point, or null when the point sits in no mapped polygon. */
export function hubSlugAt(lng: number, lat: number): string | null {
  const poly = polygonAt([lng, lat], TOWN_NEIGHBOURHOODS);
  if (!poly) return null;
  return TOWN_POLYGON_TO_NEIGHBOURHOOD[poly.name] ?? null;
}

/**
 * Hub slugs whose polygon edge lies within `metres` of the point, nearest first, deduplicated
 * (several Town polygons map to one hub). The containing polygon is at distance 0.
 */
export function hubSlugsNear(lng: number, lat: number, metres: number): Array<{ slug: string; metres: number }> {
  const pt = [lng, lat] as const;
  const best = new Map<string, number>();
  for (const poly of TOWN_NEIGHBOURHOODS) {
    const slug = TOWN_POLYGON_TO_NEIGHBOURHOOD[poly.name];
    if (!slug) continue;
    let d = polygonAt(pt, [poly]) ? 0 : Infinity;
    if (d > 0) for (const ring of poly.rings) for (const v of ring) d = Math.min(d, metresBetween(pt, v));
    if (d <= metres && d < (best.get(slug) ?? Infinity)) best.set(slug, d);
  }
  return Array.from(best.entries())
    .map(([slug, m]) => ({ slug, metres: Math.round(m) }))
    .sort((a, b) => a.metres - b.metres);
}
