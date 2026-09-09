// src/data/offRegistryStreets.ts
// Streets that legitimately exist but are NOT in the Town of Milton street registry:
// Region/rural roads (numbered Side Roads, some rural Lines) the Town does not
// administer. Absence from the registry means "not Town-assigned", not "not real"
// (they carry real sales — cf. Twiss Road). Step-5 sync validation must NOT flag a
// street_slug on this allowlist as unknown/junk.
//
// Generated during Step-4-proper (2026-07). Extend when a new legitimately-off-
// registry road appears (rather than treating it as junk).
export const OFF_REGISTRY_STREETS: string[] = [
  "3rd-side-road-milton",
  "side-road-milton",
  "5-side-road-milton",
  "20th-side-road-milton",
  "15th-side-road-milton",
  "20-side-road-milton",
  "3-side-road-milton",
  "no-1-side-road-milton",
  "20-side-rd-road-milton",
  "30-side-road-milton",
  "10-side-road-milton",
  "five-side-road-milton",
  "sideroad-10-milton",
  "14-side-road-milton",
  "15-side-road-milton",
  "second-line-milton",
  "25-side-road-milton",
  "nipissing-road-milton",
  // DEC-NAME-SOURCE Build 1. Rural Halton road, no registry row. Its junk-stripped canonical
  // (15-side-road-milton) is ALSO off-registry and has no StreetContent row, so a 301 would point
  // at a page that does not exist. The doubled type in the slug is fossilised; displayStreetName
  // already renders it "15 Side Road".
  "15-side-road-side-road-milton",
  // QUEUE item 4, ruling 1 (2026-09-09). Halton Regional Road 25. Its CondoBuilding row
  // (6415-regional-road-25-milton) was the ONE building in 65 that resolved to no name at all:
  // the registry has no row, and the stored string "6415 Regional Rd" has lost the "25", so a
  // re-parse lands on `regional||road`, which is nothing. Report 061.
  "regional-road-25-milton",
];

export const OFF_REGISTRY_SET = new Set(OFF_REGISTRY_STREETS);
