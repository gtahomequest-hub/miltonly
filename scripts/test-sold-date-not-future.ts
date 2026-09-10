// Prebuild guard for DEC-SOLD-DATE-NOT-FUTURE (2026-09-10).
//
// sold.sold_records.sold_date must name a transaction that has happened. The feed's CloseDate
// is the agreed COMPLETION date and runs months ahead on a firm-but-unclosed sale, which is
// how 245 rows came to carry a sold_date after today, the furthest 2027-01-29.
//
// Pure function, pinned "today", no database.
import { resolveSoldDate } from "../src/lib/vow-sync";

const TODAY = new Date("2026-09-10T12:00:00Z");
let failures = 0;
function check(label: string, actual: string | null, expected: string | null) {
  if (actual === expected) { console.log(`  ok   ${label}`); return; }
  console.error(`  FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  failures++;
}

console.log("DEC-SOLD-DATE-NOT-FUTURE");

// A closed sale keeps its close date. This is the ordinary case and must not move.
check("past close is used verbatim",
  resolveSoldDate("2026-07-01", "2026-06-15", TODAY), "2026-07-01");

// Today counts as closed, not as future.
check("close today is used, not deferred",
  resolveSoldDate("2026-09-10", "2026-08-01", TODAY), "2026-09-10");

// The defect: a firm sale whose completion is months out takes the contract date.
check("future close falls back to the contract date",
  resolveSoldDate("2027-01-29", "2026-06-08", TODAY), "2026-06-08");

// The furthest real row from the corpus, and a near one.
check("near-future close (tomorrow) also falls back",
  resolveSoldDate("2026-09-11", "2026-09-01", TODAY), "2026-09-01");

// Nothing defensible: refuse rather than guess. sold_date is NOT NULL, so the caller drops it.
check("future close with no contract date returns null",
  resolveSoldDate("2026-12-22", null, TODAY), null);
check("future close with a future contract date returns null",
  resolveSoldDate("2026-12-22", "2026-11-30", TODAY), null);
check("no dates at all returns null", resolveSoldDate(null, null, TODAY), null);
check("unparseable close with a good contract date falls back",
  resolveSoldDate("not-a-date", "2026-05-09", TODAY), "2026-05-09");
check("unparseable everything returns null",
  resolveSoldDate("not-a-date", "also-not-a-date", TODAY), null);

// The invariant itself, stated as the property rather than as cases: whatever comes back is
// never after today.
const cases: Array<[string | null, string | null]> = [
  ["2027-01-29", "2026-06-08"], ["2026-09-11", "2026-09-08"], ["2026-07-01", "2026-06-15"],
  ["2026-12-22", null], [null, "2026-01-01"], ["2026-09-10", "2026-09-10"],
];
for (const [c, k] of cases) {
  const out = resolveSoldDate(c, k, TODAY);
  if (out !== null && new Date(out).getTime() > TODAY.getTime()) {
    console.error(`  FAIL property: resolveSoldDate(${c}, ${k}) returned the future value ${out}`);
    failures++;
  }
}
console.log(`  ok   no input produces a future sold_date (${cases.length} combinations)`);

if (failures > 0) { console.error(`\nDEC-SOLD-DATE-NOT-FUTURE: ${failures} failure(s)`); process.exit(1); }
console.log("DEC-SOLD-DATE-NOT-FUTURE: pass");
