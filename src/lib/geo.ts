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
];

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
