// The activity gate must admit a street whose transaction record is real but old.
//
// WHY THIS EXISTS. The gate in getStreetStats read five sources, every one of them a
// "is this street live right now" signal: DB1 active listings, DB1 sold-status flips,
// DB1 active leases, and DB3's two 12-month counts. DB2 sold.sold_records, the table
// that holds the actual transaction record, was not among them.
//
// tasker-court-milton is the case that exposed it. Four DB2 records, three For Sale and
// one For Lease, the most recent 2025-03-01, all outside the 12-month window. No DB1
// listing, no DB3 row. All five sources read zero, so getStreetStats returned null and
// generation threw before buildGeneratorInput could see the four rows. A registry street
// with a genuine history could not have a page because the history was old.
//
// The two assertions that matter are opposite in sign, and a guard that only checks the
// first is the guard that lets the fix become a hole: a street with NOTHING on record
// must still be refused. The publish floor is entity + evidence, and the sixth source
// widens the evidence half by exactly one clause — record existence — not by removing it.
//
// Pure by design. The prebuild runs on every build; asserting the predicate against
// fixtures of the real corpus numbers catches the derivation, which is where the defect
// was. Whether tasker's four rows are still four is a data question, checked by the
// battery against production, not here.
import { hasStreetActivity, type StreetActivitySources } from "../src/lib/streetDecision";

const failures: string[] = [];

const NOTHING: StreetActivitySources = {
  activeListingCount: 0,
  soldStatusCount: 0,
  activeLeaseCount: 0,
  historicalSoldCount: 0,
  historicalLeasedCount: 0,
  recordedTransactionCount: 0,
};

function expect(label: string, sources: StreetActivitySources, want: boolean) {
  const got = hasStreetActivity(sources);
  if (got !== want) {
    failures.push(`  ${label}: gate returned ${got}, want ${want}`);
  }
}

// ── THE CASE ─────────────────────────────────────────────────────────────────────────
// tasker-court-milton as it stands on 2026-09-03. Zero sales in the 12-month window
// (which is what the five live sources measure, and why every one of them is 0), four
// records on the DB2 books. It must pass.
expect(
  "tasker-court-milton: 0 window sales, 4 record transactions",
  { ...NOTHING, recordedTransactionCount: 4 },
  true,
);

// ── THE FLOOR ────────────────────────────────────────────────────────────────────────
// A street with nothing on record anywhere must still be refused. This is the assertion
// that keeps the sixth source a clause and not a bypass.
expect("no signal on any of the six sources", NOTHING, false);

// A single record is enough — the gate asks whether the record exists, not whether it is
// deep. Depth is a k-anon question, answered downstream and never here.
expect("1 record transaction, nothing else", { ...NOTHING, recordedTransactionCount: 1 }, true);

// ── THE FIVE THAT ALREADY WORKED ─────────────────────────────────────────────────────
// Each pre-existing source must still admit on its own. The sixth clause is additive; if
// adding it narrowed any of these, the corpus would lose pages silently.
expect("DB1 active listing alone", { ...NOTHING, activeListingCount: 1 }, true);
expect("DB1 sold-status flip alone", { ...NOTHING, soldStatusCount: 1 }, true);
expect("DB1 active lease alone", { ...NOTHING, activeLeaseCount: 1 }, true);
expect("DB3 sold_count_12months alone", { ...NOTHING, historicalSoldCount: 1 }, true);
// calla-point-milton's actual shape: one DB3 lease is the entire reason it has a page.
expect("DB3 leased_count_12months alone (calla-point)", { ...NOTHING, historicalLeasedCount: 1 }, true);

// ── NEGATIVE COUNTS ──────────────────────────────────────────────────────────────────
// A COUNT can never go negative, but the predicate is exported and takes plain numbers.
// `> 0` rather than `!== 0` means a bad caller cannot talk its way past the floor.
expect("negative counts do not admit", { ...NOTHING, recordedTransactionCount: -1 }, false);

if (failures.length > 0) {
  console.error(`test-zero-sales-tier: ${failures.length} failure(s)`);
  for (const f of failures) console.error(f);
  process.exit(1);
}
console.log("test-zero-sales-tier: PASS (9 assertions)");
