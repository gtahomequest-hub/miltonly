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
];

export const OFF_REGISTRY_SET = new Set(OFF_REGISTRY_STREETS);
