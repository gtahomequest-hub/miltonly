// src/lib/town/rooftop.ts
// Resolve an MLS address to the Town's municipal rooftop coordinate.
//
// THE ONLY WAY A COORDINATE ENTERS A RECORD. Used by the ingest write path (so new records
// resolve on arrival) and by the backfill (so existing ones catch up). A backfill alone decays —
// same argument that decided the interior-junk strip.
//
// NULL WHERE UNRESOLVED, NEVER A SENTINEL. The defect this repairs was `item.Latitude || 0`:
// `||` turned an absent coordinate into a valid one at (0, 0), in the Gulf of Guinea, and every
// downstream null check passed. There is no fallback here. No street centroid stands in for a
// house, no neighbourhood centroid stands in for a street. Unresolved is null and null is absent.
import { rooftopFor } from "@/data/townAddressPoints";
import { parseAddress, rooftopKey } from "./identity";

export interface Rooftop {
  lat: number;
  lng: number;
}

/** Milton's bounding box, generously drawn — the last gate before a coordinate is stored. */
const MILTON = { minLng: -80.3, maxLng: -79.6, minLat: 43.3, maxLat: 43.75 };

export function isWithinMilton(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= MILTON.minLat && lat <= MILTON.maxLat &&
    lng >= MILTON.minLng && lng <= MILTON.maxLng
  );
}

/** The Town's rooftop for this address, or null. Never approximates. */
export function resolveRooftop(address: string | null | undefined): Rooftop | null {
  const parsed = parseAddress(address);
  if (!parsed) return null;
  const hit = rooftopFor(rooftopKey(parsed.number, parsed.identity));
  if (!hit) return null;
  // A generated file cannot be trusted more than a fetched one: bounds-check before storing.
  if (!isWithinMilton(hit.lat, hit.lng)) return null;
  return hit;
}
