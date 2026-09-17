// src/lib/hubSchools.ts
// Which schools stand inside a neighbourhood, decided by POSITION rather than by a label.
//
// WHY POSITION. `School.neighbourhood` is a declared string, and it is nearly useless at hub
// grain: of 29 schools, **20 declare the generic "Milton"**. Grouping by that field gives
// Timberlea 3, seven hubs 1 each, and fourteen hubs nothing, while the twenty biggest schools
// in town sit in a bucket that belongs to no hub. The Town's neighbourhood polygons are a
// position oracle (see src/data/townNeighbourhoodMap.ts), and a school has coordinates, so the
// question "is this school inside this neighbourhood" has a real answer.
//
// THE COORDINATE CAVEAT, AND WHY IT DOES NOT SINK THIS. src/lib/schools.ts is explicit that
// coordinates come from one of two places: a neighbourhood centroid, or a known landmark
// address. For a school that already declares a specific neighbourhood, a centroid-derived
// coordinate makes containment CIRCULAR: it re-derives the label it came from. But those are
// exactly the schools whose label already answers the question. For the 20 generic-"Milton"
// schools, the file only assigns coordinates where a landmark address is known, so containment
// is doing real work precisely where the label does none.
//
// So the figure is honest but approximate, and the page says so: it is stated as schools
// standing inside the Town's boundary for this neighbourhood, not as a catchment. A catchment
// is a different fact owned by the school boards, and we do not have it. Seven schools carry no
// coordinates at all and are simply absent rather than guessed at.
//
// NOTHING STATIC. A hub with no school inside its polygon renders no school fact at all,
// rather than a sentence like "Public & Catholic options nearby", which was true of every
// neighbourhood in Milton and therefore told a reader nothing about any of them.
import { schools, type School } from "@/lib/schools";
import { TOWN_NEIGHBOURHOODS } from "@/data/townNeighbourhoods";
import { TOWN_POLYGON_TO_NEIGHBOURHOOD } from "@/data/townNeighbourhoodMap";
import { inPolygon } from "@/lib/town/polygons";

export interface HubSchool {
  slug: string;
  name: string;
  board: School["board"];
  level: School["level"];
  fraserScore: string | null;
}

/** Schools whose coordinates fall inside a Town polygon mapped to this neighbourhood slug. */
export function schoolsInHub(neighbourhoodSlug: string): HubSchool[] {
  const polys = TOWN_NEIGHBOURHOODS.filter(
    (p) => TOWN_POLYGON_TO_NEIGHBOURHOOD[p.name] === neighbourhoodSlug,
  );
  if (polys.length === 0) return [];

  const out: HubSchool[] = [];
  for (const s of schools) {
    if (typeof s.lat !== "number" || typeof s.lng !== "number") continue; // never guessed
    const pt = [s.lng, s.lat] as const;
    if (!polys.some((p) => inPolygon(pt, p))) continue;
    out.push({ slug: s.slug, name: s.name, board: s.board, level: s.level, fraserScore: s.fraserScore });
  }
  // Secondary first (the one parents ask about), then by name.
  out.sort((a, b) => (a.level === b.level ? a.name.localeCompare(b.name) : a.level === "secondary" ? -1 : 1));
  return out;
}
