// src/lib/town/geometry.ts
// The one accessor for a street's physical facts (QUEUE item 5). A lookup and a formatter, no
// rulings: those were applied when src/data/streetGeometry.ts was generated, so what this
// returns is what the layer says, one value or nothing.
//
// WHERE IT RENDERS AND WHERE IT NEVER DOES. The sidebar facts list, under its own heading, with
// the OGL attribution beside it. Never a market tile, never the hero, never a glance tile: those
// are market data and a road fact among them would read as one. And never a prompt: nothing in
// this module is imported by src/lib/ai (scripts/test-geometry-boundary.ts holds that line), so
// the model cannot restate "620 m" as "a short crescent of about 400 metres". The only unit
// figures on a street page are the ones this formatter writes from the layer.
import { STREET_GEOMETRY, type StreetGeometryRow } from "@/data/streetGeometry";
import { OGL_MILTON_ATTRIBUTION } from "@/data/townRoadFacts";
import { identityFromSlug } from "./identity";

export type { StreetGeometryRow };

export interface GeometryFact {
  /** stable key, carried into the markup as data-key so the battery can match a fact to its field */
  key: "length" | "lanes" | "speed" | "category" | "surface" | "sidewalk" | "terminus" | "axis";
  label: string;
  value: string;
}

export interface StreetGeometryFacts {
  /** the Town identity key the row was read under, carried into the markup so the battery can
   *  compare every rendered fact to the layer row it came from */
  identity: string;
  facts: GeometryFact[];
  attribution: string;
}

export function geometryRowFor(slug: string | null | undefined): StreetGeometryRow | null {
  if (!slug) return null;
  return STREET_GEOMETRY[identityFromSlug(slug).key] ?? null;
}

/** Length as the reader would say it: metres under a kilometre, kilometres to one decimal above. */
export function formatLength(lengthM: number): string {
  if (lengthM < 1000) return `${lengthM} m`;
  const km = Math.round(lengthM / 100) / 10;
  return `${km.toFixed(1)} km`;
}

const AXIS_LABEL: Record<string, string> = {
  "north to south": "Runs north to south",
  "east to west": "Runs east to west",
  "northeast to southwest": "Runs northeast to southwest",
  "northwest to southeast": "Runs northwest to southeast",
};

/** The facts a row publishes, in a fixed order. A null field contributes nothing. */
export function factsFromRow(row: StreetGeometryRow): GeometryFact[] {
  const out: GeometryFact[] = [];
  if (row.lengthM !== null) out.push({ key: "length", label: "Length", value: formatLength(row.lengthM) });
  if (row.category !== null) out.push({ key: "category", label: "Road class", value: capitalize(row.category) });
  if (row.lanes !== null) out.push({ key: "lanes", label: "Lanes", value: String(row.lanes) });
  if (row.speedLimit !== null) out.push({ key: "speed", label: "Posted limit", value: `${row.speedLimit} km/h` });
  if (row.surface !== null) out.push({ key: "surface", label: "Surface", value: capitalize(row.surface) });
  if (row.sidewalk !== null) out.push({ key: "sidewalk", label: "Sidewalk", value: capitalize(row.sidewalk) });
  if (row.terminus !== null) out.push({ key: "terminus", label: "Terminus", value: capitalize(row.terminus) });
  if (row.axis !== null && AXIS_LABEL[row.axis]) out.push({ key: "axis", label: "Orientation", value: AXIS_LABEL[row.axis] });
  return out;
}

/** Everything the sidebar needs, or null when the Town has no centreline for the street. */
export function geometryFactsFor(slug: string | null | undefined): StreetGeometryFacts | null {
  if (!slug) return null;
  const identity = identityFromSlug(slug).key;
  const row = STREET_GEOMETRY[identity] ?? null;
  if (!row) return null;
  const facts = factsFromRow(row);
  if (facts.length === 0) return null;
  const usesOsm = facts.some((f) => f.key === "surface" || f.key === "sidewalk");
  return {
    identity,
    facts,
    attribution: usesOsm
      ? `${OGL_MILTON_ATTRIBUTION} Surface and sidewalk from OpenStreetMap, © OpenStreetMap contributors.`
      : OGL_MILTON_ATTRIBUTION,
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
