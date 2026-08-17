// Proximity utilities + Milton-area points of interest.
// No external API calls: parks come from the generated Town layer, the rest are public landmark
// coordinates.
import { TOWN_PARKS } from "@/data/townPlaces";

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function walkMinutes(km: number): number {
  return Math.round((km / 5) * 60);
}
export function driveMinutes(km: number): number {
  // Road factor 1.3× straight-line, avg 50 km/h in Milton/GTA + 2 min buffer
  return Math.round(((km * 1.3) / 50) * 60 + 2);
}

export interface POI {
  name: string;
  lat: number;
  lng: number;
  href?: string;
  icon?: string;
  fallbackMin?: number; // Milton-average drive minutes when listing coords unavailable
}

export function hasValidCoords(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat == null || lng == null) return false;
  if (lat === 0 && lng === 0) return false;
  // Milton lies around 43.5, -79.9 — anything far outside is bogus
  if (lat < 40 || lat > 48) return false;
  if (lng < -85 || lng > -75) return false;
  return true;
}

export const GROCERIES: POI[] = [
  { name: "Walmart Milton", lat: 43.5173, lng: -79.8823, icon: "🛒" },
  { name: "Canadian Superstore", lat: 43.5089, lng: -79.8456, icon: "🛒" },
  { name: "FreshCo Milton", lat: 43.5195, lng: -79.8831, icon: "🛒" },
  { name: "Sobeys Milton", lat: 43.511, lng: -79.8828, icon: "🛒" },
];

export const MOSQUES: POI[] = [
  { name: "Halton Islamic Community Centre", lat: 43.4756, lng: -79.8234, href: "/mosques/halton-islamic-community-centre", icon: "🕌" },
  { name: "Milton Muslim Community Centre", lat: 43.5183, lng: -79.8848, href: "/mosques/milton-muslim-community-centre", icon: "🕌" },
  { name: "Islamic Community Centre of Milton", lat: 43.5489, lng: -79.9124, href: "/mosques/islamic-community-centre-of-milton", icon: "🕌" },
];

// THE TOWN'S 93 PARKS, area-weighted centroids of the Town's own polygons.
//
// This was 9 hand-entered coordinates, 5 of them labelled "approximate centroids" in this file.
// A distance has two endpoints and is only as good as the worse one: computing from an
// authoritative street centreline to a guessed park would publish a precise number about an
// approximate place. The Town's polygons end that.
//
// (The 2026-07-19 batch-001 triage removed a "Velodrome Park" from the hand list because no Town
// source confirmed it and its coordinates were on the wrong side of Milton. That check is now
// structural — nothing is in this list that the Town does not publish.)
//
// Contains information licensed under the Open Government Licence – Milton.
export const PARKS: POI[] = TOWN_PARKS.map((p) => ({
  name: p.name,
  lat: p.lat,
  lng: p.lng,
  // Conservation areas read as wild land, municipal parks as green space.
  icon: /CONSERVATION|LINEAR|NATURAL/i.test(p.classification) ? "🌲" : "🌳",
}));

// Two conservation areas that sit OUTSIDE the Town's municipal parks layer (they are Conservation
// Halton land, not Town parks) but are the two most-asked-about green spaces in Milton. Kept as
// landmark coordinates, and kept honest by being named as what they are.
export const CONSERVATION_AREAS: POI[] = [
  { name: "Rattlesnake Point Conservation", lat: 43.5056, lng: -79.9567, icon: "🌲" },
  { name: "Kelso Conservation Area", lat: 43.5167, lng: -79.9333, icon: "🌲" },
];

// Highway 401 on-ramps. Milton has two; pick whichever is nearer per street.
export const HIGHWAY_ONRAMPS: POI[] = [
  { name: "Highway 401 at James Snow Pkwy", lat: 43.5220, lng: -79.8475, icon: "🛣️" },
  { name: "Highway 401 at Regional Rd 25", lat: 43.5183, lng: -79.8830, icon: "🛣️" },
];

// Fixed landmarks used by buildGeneratorInput's nearby + commute sections.
export const HOSPITAL: POI = { name: "Milton District Hospital", lat: 43.5158, lng: -79.8861, icon: "🏥" };
export const GO_STATION: POI = { name: "Milton GO Station", lat: 43.5173, lng: -79.8693, icon: "🚉" };

// Reference Milton centroid for "drive from anywhere in Milton" commute times.
// These drive minutes vary ~±5 across the town — close enough to hardcode.
// Toronto downtown is handled separately in buildGeneratorInput since it
// depends on walk-or-drive-to-GO time, which is street-specific.
export interface CommuteDestination {
  label: string;   // "toMississauga" key in StreetGeneratorInput
  name: string;    // human-readable destination
  method: string;  // "drive" / "transit"
  minutes: number; // typical from Milton centroid
}

export const COMMUTE_FIXED: CommuteDestination[] = [
  { label: "toMississauga", name: "Mississauga",         method: "drive",   minutes: 22 },
  { label: "toOakville",    name: "Oakville",            method: "drive",   minutes: 24 },
  { label: "toBurlington",  name: "Burlington",          method: "drive",   minutes: 20 },
  { label: "toPearson",     name: "Toronto Pearson",     method: "drive",   minutes: 32 },
];

// Toronto-downtown commute formula components (from example outputs):
//   toGOStationMinutes + 48 (GO train) + 12 (Union → downtown TTC) = total
export const GO_TRAIN_MINUTES = 48;
export const UNION_TO_DOWNTOWN_TTC_MINUTES = 12;

// ───── NEIGHBOURHOOD_CENTROIDS ──────────────────────────────────────────────
// Coords are approximate centres-of-mass for each named Milton neighbourhood,
// sourced from OpenStreetMap neighbourhood polygons cross-checked against
// Milton municipal ward/community boundaries. Used as a street-centroid
// fallback when DB1 / DB2 provide no per-listing lat/lng (100% of current
// records). All streets sharing a neighbourhood key resolve to the same
// centroid — within-neighbourhood differentiation is deliberately lost; the
// geography claim "street X is in neighbourhood Y, which is centred at (lat,
// lng)" remains factual.
//
// Keyed by the raw neighbourhood string as it appears in DB1/DB2 listings so
// no cleaning is required at lookup time. Includes both the TREB-coded form
// ("1032 - FO Ford") and the un-coded form ("Rural Milton West") seen in
// sold.sold_records. Unknown or rural-with-no-centroid strings intentionally
// OMITTED — callers throw NoCentroidError rather than guess.
export const NEIGHBOURHOOD_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  // Milton urban neighbourhoods (TREB-coded form, DB1/DB2 primary format)
  "1023 - BE Beaty":         { lat: 43.5285, lng: -79.8760 },
  "1024 - BM Bronte Meadows":{ lat: 43.5040, lng: -79.8760 },
  "1025 - BW Bowes":         { lat: 43.5280, lng: -79.8610 },
  "1026 - CB Cobban":        { lat: 43.5010, lng: -79.9180 },
  "1027 - CL Clarke":        { lat: 43.5200, lng: -79.8550 },
  "1028 - CO Coates":        { lat: 43.5220, lng: -79.8970 },
  "1029 - DE Dempsey":       { lat: 43.5250, lng: -79.8700 },
  "1031 - DP Dorset Park":   { lat: 43.5120, lng: -79.8860 },
  "1032 - FO Ford":          { lat: 43.4950, lng: -79.9260 },
  "1033 - HA Harrison":      { lat: 43.5440, lng: -79.8720 },
  "1034 - MN Milton North":  { lat: 43.5450, lng: -79.8950 },
  "1035 - OM Old Milton":    { lat: 43.5150, lng: -79.8830 },
  "1036 - SC Scott":         { lat: 43.5130, lng: -79.8930 },
  "1037 - TM Timberlea":     { lat: 43.5050, lng: -79.8950 },
  "1038 - WI Willmott":      { lat: 43.4980, lng: -79.9070 },
  "1051 - Walker":           { lat: 43.5110, lng: -79.8600 },
  // Non-coded forms used on a subset of records
  "Campbellville":           { lat: 43.4700, lng: -79.9900 },
  "Moffat":                  { lat: 43.5272, lng: -80.0117 },
  "Brookville/Haltonville":  { lat: 43.5910, lng: -79.9270 },
  // ── STILL OMITTED, AND DELIBERATELY SO ────────────────────────────────────
  //   "1030 - DG Derry Green"            (industrial corridor; no residential centre)
  //   "1039 - MI Rural Milton"           (catch-all)
  //   "1041 - NA Rural Nassagaweya"      (large rural tract)
  //   "1044 - TR Rural Trafalgar"        (large rural tract)
  //   "Rural Milton West"                (large rural tract)
  //   "Nassagaweya"                      (entire former township)
  //
  // These four rural strings were throwing NoCentroidError on ~25 streets, and the obvious fix
  // was to derive a centroid for each from the mean of its member streets' Town centrelines.
  // scripts/town/derive-rural-centroids.ts computes exactly that, and the numbers are why they
  // are still not here:
  //
  //   "1041 - NA Rural Nassagaweya" / "Nassagaweya"  43.5643, -80.0300  mean of 18, spread 19.0 km
  //   "Rural Milton West"                            43.4844, -79.9625  mean of 28, spread 14.0 km
  //   "1044 - TR Rural Trafalgar"                    43.5091, -79.7991  mean of  8, spread  7.3 km
  //
  // A centroid is used as a per-street position for nearby-distance claims. A point that every
  // street in a 19 km-wide township resolves to would put "4 min drive to Sobeys" on a page whose
  // street is twenty minutes away — the misleading-distance risk this list was written to avoid,
  // reintroduced with a number attached to make it look sourced.
  //
  // The real fix was upstream: resolveCentroid in buildGeneratorInput.ts now uses THE STREET'S OWN
  // Town centreline before falling back to a neighbourhood at all. That is exact rather than
  // approximate and it clears 18 of the 27 queued streets, including kelso-road, trafalgar-road,
  // conservation-road and crewsons-line.
  //
  // The 9 it does not clear are malformed slugs, not streets: 2nd-line, side-road (no base name
  // at all), fifth-nassagaweya-line, lower-base-line-n-a and five more. None is in the Town's
  // 944-street registry, none is published, and eight have no ResidentialStreet row. Adding a
  // township centroid would let exactly those nine generate pages carrying distance claims off a
  // 19 km approximation. They need slug cleanup instead.
  //
  //   "Brookville/Haltonville" and "Moffat" ARE present above — this list said otherwise until
  //   2026-08-17 and was simply out of date.
};

export const TRANSIT: POI[] = [
  { name: "Milton GO Station", lat: 43.515, lng: -79.8534, icon: "🚉" },
];

export const COMMUTES: POI[] = [
  { name: "Downtown Toronto", lat: 43.6453, lng: -79.3806, icon: "🏙️", fallbackMin: 55 },
  { name: "Square One", lat: 43.5937, lng: -79.6401, icon: "🛍️", fallbackMin: 25 },
  { name: "Pearson Airport", lat: 43.6777, lng: -79.6248, icon: "✈️", fallbackMin: 35 },
  { name: "Bronte GO", lat: 43.4024, lng: -79.7282, icon: "🚉", fallbackMin: 20 },
  { name: "Trafalgar GO", lat: 43.4556, lng: -79.6891, icon: "🚉", fallbackMin: 22 },
  { name: "Oakville Place", lat: 43.4671, lng: -79.6877, icon: "🛍️", fallbackMin: 24 },
  { name: "Sheridan College", lat: 43.6882, lng: -79.8401, icon: "🎓", fallbackMin: 30 },
  { name: "Milton Hospital", lat: 43.5287, lng: -79.8773, icon: "🏥", fallbackMin: 8 },
];

export function directionsUrl(destLat: number, destLng: number, originLat?: number, originLng?: number): string {
  const origin = originLat && originLng ? `&origin=${originLat},${originLng}` : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}${origin}`;
}
