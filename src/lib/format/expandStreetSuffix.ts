// Phase 4.1 Step 11d — canonical street-name suffix expansion.
//
// Facade over the existing `expandStreetName` utility in src/lib/street-data.ts.
// The actual dictionary (STREET_ABBREVIATIONS) and expansion logic live there;
// this file exposes the same function under a clearer name and a stable import
// path for the generator boundary and page-render surfaces.
//
// Why this exists separately:
//   - The single source of truth stays in street-data.ts (pre-existing and
//     already wired into getStreetPageData / buildGeneratorInput).
//   - New callers that should explicitly think in "expand the suffix" terms
//     get a short, self-documenting import path.
//
// Expected behavior (exercised via street-data's expandStreetName):
//   "Aird Crt"         → "Aird Court"
//   "Aird Court"       → "Aird Court"          (already canonical)
//   "Main St E"        → "Main Street East"
//   "5 Side Rd"        → "5 Side Road"
//   "Murlock Heights"  → "Murlock Heights"     (no suffix token — unchanged)
//   "Allan Cres"       → "Allan Crescent"
//   "Barclay Cir"      → "Barclay Circle"
//   Case: mixed-case / uppercase / lowercase are all normalized via the
//   token-lowercasing step inside expandStreetName.
//   Mid-name occurrences: not transformed — only trailing-word dictionary
//   matches expand, because the suffix table is checked per-token and
//   non-matching tokens pass through verbatim.
//   Trailing " Milton" city token: stripped by stripTrailingCity inside
//   expandStreetName so the city never double-renders.

export { expandStreetName as expandStreetSuffix } from "@/lib/street-data";
