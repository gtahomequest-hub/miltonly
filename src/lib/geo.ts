// Proximity utilities + hardcoded Milton-area points of interest.
// All lat/lng are public landmark coordinates; no external API calls.

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

export const PARKS: POI[] = [
  { name: "Rattlesnake Point Conservation", lat: 43.5056, lng: -79.9567, icon: "🌲" },
  { name: "Kelso Conservation Area", lat: 43.5167, lng: -79.9333, icon: "🌲" },
  { name: "Centennial Park", lat: 43.5234, lng: -79.8834, icon: "🌳" },
  { name: "Milton Community Park", lat: 43.5178, lng: -79.8645, icon: "🌳" },
  // Neighbourhood parks (approximate centroids) for more granular distance signal
  { name: "Rotary Park", lat: 43.5165, lng: -79.8830, icon: "🌳" },
  { name: "Coates Park", lat: 43.5210, lng: -79.8980, icon: "🌳" },
  { name: "Willmott Park", lat: 43.4980, lng: -79.9070, icon: "🌳" },
  { name: "Ford District Park", lat: 43.4950, lng: -79.9260, icon: "🌳" },
  { name: "Escarpment View Park", lat: 43.5300, lng: -79.8550, icon: "🌳" },
  { name: "Velodrome Park", lat: 43.5340, lng: -79.8950, icon: "🌳" },
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
  // Omitted — no reliable centroid from public sources, or name is
  // ambiguous / covers a large rural area that would give misleading
  // nearby-distance signal:
  //   "1030 - DG Derry Green"            (industrial corridor; no residential centre)
  //   "1039 - MI Rural Milton"           (catch-all)
  //   "1041 - NA Rural Nassagaweya"      (large rural tract)
  //   "1044 - TR Rural Trafalgar"        (large rural tract)
  //   "Rural Milton West"                (large rural tract)
  //   "Brookville/Haltonville"           (two hamlets, ambiguous centre)
  //   "Moffat"                           (small hamlet)
  //   "Nassagaweya"                      (entire former township)
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
