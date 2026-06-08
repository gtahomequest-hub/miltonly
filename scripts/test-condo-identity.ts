// deriveCondoIdentity regression test — pure unit test, no DB. Wired into
// prebuild so the condo ingestion-canonicalization fix (A1 gap, condo path)
// cannot silently regress. One case per junk pattern from the 2026-06 dedup
// (112 raw DB2 groups → 68 canonical buildings), plus negative cases that
// must NOT collapse.

import { deriveCondoIdentity, condoCanonicalSlug } from "@/lib/condoIdentity";

interface Case {
  label: string;
  streetNumber: string;
  streetSlug: string;
  expectCanonical: string | null; // member-level canonical (pre majority-suffix vote)
  expectClusterKey?: string;
}

const CASES: readonly Case[] = [
  // ── clean canonicals pass through unchanged ──
  { label: "clean slug unchanged", streetNumber: "720", streetSlug: "whitlock-avenue-milton",
    expectCanonical: "720-whitlock-avenue-milton", expectClusterKey: "720|whitlock" },

  // ── unit-descriptor strip ──
  { label: "unit d204", streetNumber: "720", streetSlug: "whitlock-ave-d204-milton",
    expectCanonical: "720-whitlock-avenue-milton" },
  { label: "unit b412", streetNumber: "760", streetSlug: "whitlock-ave-b412-milton",
    expectCanonical: "760-whitlock-avenue-milton" },
  { label: "unit a-114 (letter + number tokens)", streetNumber: "770", streetSlug: "whitlock-ave-a-114-milton",
    expectCanonical: "770-whitlock-avenue-milton" },
  { label: "direction + unit sw-206", streetNumber: "470", streetSlug: "sw-gordon-krantz-ave-sw-206-milton",
    expectCanonical: "470-gordon-krantz-avenue-milton" },
  { label: "unit 1803-b (number + bare letter)", streetNumber: "8020", streetSlug: "derry-rd-1803-b-milton",
    expectCanonical: "8020-derry-road-milton" },

  // ── doubled / conflicting suffix runs ──
  { label: "doubled suffix rd-road", streetNumber: "8020", streetSlug: "derry-rd-road-milton",
    expectCanonical: "8020-derry-road-milton" },
  { label: "doubled suffix ave-avenue", streetNumber: "470", streetSlug: "gordon-krantz-ave-avenue-milton",
    expectCanonical: "470-gordon-krantz-avenue-milton" },
  { label: "doubled suffix way-way", streetNumber: "1105", streetSlug: "leger-way-way-milton",
    expectCanonical: "1105-leger-way-milton" },
  { label: "conflicting suffix run rd-drive (first suffix wins)", streetNumber: "8020", streetSlug: "derry-rd-drive-milton",
    expectCanonical: "8020-derry-road-milton" },

  // ── misspellings ──
  { label: "misspelling whitelock", streetNumber: "750", streetSlug: "whitelock-avenue-milton",
    expectCanonical: "750-whitlock-avenue-milton" },
  { label: "misspelling reginal (+ allowlist)", streetNumber: "6415", streetSlug: "reginal-road-milton",
    expectCanonical: "6415-regional-road-25-milton" },
  { label: "misspelling ledger", streetNumber: "1105", streetSlug: "ledger-way-milton",
    expectCanonical: "1105-leger-way-milton" },
  { label: "misspelling kranz", streetNumber: "460", streetSlug: "gordon-kranz-avenue-milton",
    expectCanonical: "460-gordon-krantz-avenue-milton" },

  // ── numbered-road allowlist: "25" is street name, never a unit ──
  { label: "regional-road (allowlist adds 25)", streetNumber: "6415", streetSlug: "regional-road-milton",
    expectCanonical: "6415-regional-road-25-milton", expectClusterKey: "6415|regional-road-25" },
  { label: "regional-rd-25-road-304 (unit + junk after allowlist prefix)", streetNumber: "6415", streetSlug: "regional-rd-25-road-304-milton",
    expectCanonical: "6415-regional-road-25-milton" },

  // ── direction noise at any position ──
  { label: "leading direction e-main", streetNumber: "1460", streetSlug: "e-main-street-milton",
    expectCanonical: "1460-main-street-milton" },
  { label: "interior direction main-e-street", streetNumber: "1380", streetSlug: "main-e-street-milton",
    expectCanonical: "1380-main-street-milton" },
  { label: "direction + word-direction + unit (main-st-east-street-903)", streetNumber: "716", streetSlug: "main-st-east-street-903-milton",
    expectCanonical: "716-main-street-milton" },
  { label: "leading s- on derry", streetNumber: "8010", streetSlug: "s-derry-road-milton",
    expectCanonical: "8010-derry-road-milton" },

  // ── junk token "na" ──
  { label: "na junk token", streetNumber: "8020", streetSlug: "derry-rd-na-w-608-milton",
    expectCanonical: "8020-derry-road-milton" },

  // ── street_number unit-prefix split ──
  { label: "number prefix 309-770", streetNumber: "309-770", streetSlug: "whitlock-avenue-milton",
    expectCanonical: "770-whitlock-avenue-milton", expectClusterKey: "770|whitlock" },
  { label: "number prefix 418-490", streetNumber: "418-490", streetSlug: "gordon-krantz-avenue-milton",
    expectCanonical: "490-gordon-krantz-avenue-milton" },

  // ── suffix-abbreviation-as-base rename ──
  { label: "21-crt-street → court-street", streetNumber: "21", streetSlug: "crt-street-milton",
    expectCanonical: "21-court-street-milton", expectClusterKey: "21|court" },

  // ── suffix-less slug: passes through; cluster majority assigns suffix ──
  { label: "suffix-less gordon-krantz keeps clusterKey", streetNumber: "490", streetSlug: "gordon-krantz-milton",
    expectCanonical: "490-gordon-krantz-milton", expectClusterKey: "490|gordon-krantz" },

  // ── wrong suffix is NOT lexically fixable — clusterKey must still match ──
  { label: "boulevard variant clusters with avenue (key only)", streetNumber: "480", streetSlug: "gordon-krantz-boulevard-milton",
    expectCanonical: "480-gordon-krantz-boulevard-milton", expectClusterKey: "480|gordon-krantz" },
  { label: "farmstead road variant clusters with drive (key only)", streetNumber: "610", streetSlug: "farmstead-road-milton",
    expectCanonical: "610-farmstead-road-milton", expectClusterKey: "610|farmstead" },

  // ── negative cases: distinct streets must NOT collapse ──
  { label: "different base never merges", streetNumber: "720", streetSlug: "dempsey-avenue-milton",
    expectCanonical: "720-dempsey-avenue-milton", expectClusterKey: "720|dempsey" },
  { label: "malformed: empty street number", streetNumber: "", streetSlug: "whitlock-avenue-milton",
    expectCanonical: null },
  { label: "malformed: non-numeric street number", streetNumber: "abc", streetSlug: "whitlock-avenue-milton",
    expectCanonical: null },
];

// majority-suffix vote composition (the grouping-side helper)
const VOTE_CASES: ReadonlyArray<{ label: string; num: string; base: string; suffix: string; expect: string }> = [
  { label: "vote: avenue over boulevard", num: "480", base: "gordon-krantz", suffix: "avenue", expect: "480-gordon-krantz-avenue-milton" },
  { label: "vote: suffix-less special base", num: "6415", base: "regional-road-25", suffix: "", expect: "6415-regional-road-25-milton" },
];

let failures = 0;
for (const c of CASES) {
  const got = deriveCondoIdentity(c.streetNumber, c.streetSlug);
  const gotCanonical = got?.canonicalSlug ?? null;
  const canonicalOk = gotCanonical === c.expectCanonical;
  const clusterOk = c.expectClusterKey === undefined || got?.clusterKey === c.expectClusterKey;
  if (!canonicalOk || !clusterOk) {
    failures++;
    console.error(`FAIL ${c.label}`);
    if (!canonicalOk) console.error(`  canonical: expected ${c.expectCanonical}, got ${gotCanonical}`);
    if (!clusterOk) console.error(`  clusterKey: expected ${c.expectClusterKey}, got ${got?.clusterKey ?? null}`);
  }
}
for (const v of VOTE_CASES) {
  const got = condoCanonicalSlug(v.num, v.base, v.suffix);
  if (got !== v.expect) {
    failures++;
    console.error(`FAIL ${v.label}: expected ${v.expect}, got ${got}`);
  }
}

if (failures > 0) {
  console.error(`[condo-identity] FAIL — ${failures} case(s) failed.`);
  process.exit(1);
}
console.log(`[condo-identity] PASS — ${CASES.length + VOTE_CASES.length} cases green.`);
