// Unit tests for mapListingStates — verifies the lease-state preservation logic
// produced for the 2026-05-09 schema migration.
//
// Run: npx tsx scripts/test-map-listing-states.ts

// Re-implement the function inline (it's not exported from detect/route.ts).
// If the function in detect/route.ts changes, this test must update in lockstep.
function mapListingStates(
  mlsStatus: string | null,
  txType: string | null,
  standardStatus: string | null,
): { status: string; leaseStatus: string | null } {
  const s = (mlsStatus || "").toLowerCase();
  const std = (standardStatus || "").toLowerCase();
  const isLease = (txType || "").toLowerCase().includes("lease") || s.includes("lease");

  if (!isLease) {
    if (s.includes("sold")) return { status: "sold", leaseStatus: null };
    if (s.includes("expired") || s.includes("terminated") || s.includes("suspended")) {
      return { status: "expired", leaseStatus: null };
    }
    return { status: "active", leaseStatus: null };
  }

  let leaseStatus: string;
  if (s.includes("leased")) leaseStatus = "leased";
  else if (s.includes("expired")) leaseStatus = "expired";
  else if (s.includes("terminated")) leaseStatus = "terminated";
  else if (s.includes("suspended")) leaseStatus = "suspended";
  else if (std.includes("cancelled")) leaseStatus = "cancelled";
  else if (std.includes("withdrawn")) leaseStatus = "withdrawn";
  else if (s.includes("new") || s.includes("price change")) leaseStatus = "active";
  else leaseStatus = "active";

  return { status: "rented", leaseStatus };
}

interface TestCase {
  name: string;
  mlsStatus: string | null;
  txType: string | null;
  standardStatus: string | null;
  expectStatus: string;
  expectLeaseStatus: string | null;
}

// Note on MlsStatus values: PropTx/AMPRE returns full-word values for both
// sale-side and lease-side. The lease probe confirmed: Expired, Leased, New,
// Price Change, Suspended, Terminated. The mapping function uses keyword
// substring matching (s.includes("sold") etc.) which works for full words.
// If MLS ever returns abbreviated codes ("Sld", "Exp"), they fall through to
// the catch-all defaults — a known limitation matching the pre-2026-05-09
// production behavior. Tests use full-word values matching observed feed data.
const TESTS: TestCase[] = [
  // Sale-side (semantics unchanged from pre-2026-05-09 mapStatus)
  { name: "sale: New",         mlsStatus: "New",         txType: "For Sale", standardStatus: "Active",    expectStatus: "active",  expectLeaseStatus: null },
  { name: "sale: Sold",        mlsStatus: "Sold",        txType: "For Sale", standardStatus: "Closed",    expectStatus: "sold",    expectLeaseStatus: null },
  { name: "sale: Expired",     mlsStatus: "Expired",     txType: "For Sale", standardStatus: "Expired",   expectStatus: "expired", expectLeaseStatus: null },
  { name: "sale: Terminated",  mlsStatus: "Terminated",  txType: "For Sale", standardStatus: "Cancelled", expectStatus: "expired", expectLeaseStatus: null },
  { name: "sale: Suspended",   mlsStatus: "Suspended",   txType: "For Sale", standardStatus: "Active",    expectStatus: "expired", expectLeaseStatus: null },
  { name: "sale: Price Change",mlsStatus: "Price Change",txType: "For Sale", standardStatus: "Active",    expectStatus: "active",  expectLeaseStatus: null },

  // Lease-side (NEW: preserves full lifecycle per 2026-05-09 schema migration)
  { name: "lease: New (active rental)",       mlsStatus: "New",         txType: "For Lease", standardStatus: "Active",    expectStatus: "rented", expectLeaseStatus: "active" },
  { name: "lease: Leased (completed)",        mlsStatus: "Leased",      txType: "For Lease", standardStatus: "Closed",    expectStatus: "rented", expectLeaseStatus: "leased" },
  { name: "lease: Expired",                   mlsStatus: "Expired",     txType: "For Lease", standardStatus: "Expired",   expectStatus: "rented", expectLeaseStatus: "expired" },
  { name: "lease: Terminated",                mlsStatus: "Terminated",  txType: "For Lease", standardStatus: "Cancelled", expectStatus: "rented", expectLeaseStatus: "terminated" },
  { name: "lease: Suspended",                 mlsStatus: "Suspended",   txType: "For Lease", standardStatus: "Active",    expectStatus: "rented", expectLeaseStatus: "suspended" },
  { name: "lease: Cancelled (StandardStatus)",mlsStatus: null,          txType: "For Lease", standardStatus: "Cancelled", expectStatus: "rented", expectLeaseStatus: "cancelled" },
  { name: "lease: Withdrawn (StandardStatus)",mlsStatus: null,          txType: "For Lease", standardStatus: "Withdrawn", expectStatus: "rented", expectLeaseStatus: "withdrawn" },
  { name: "lease: Price Change collapses to active", mlsStatus: "Price Change", txType: "For Lease", standardStatus: "Active", expectStatus: "rented", expectLeaseStatus: "active" },

  // Edge cases
  { name: "edge: null mlsStatus + lease txType",       mlsStatus: null, txType: "For Lease", standardStatus: "Active", expectStatus: "rented", expectLeaseStatus: "active" },
  { name: "edge: unknown mlsStatus + lease defaults to active", mlsStatus: "Frobnicated", txType: "For Lease", standardStatus: "Active", expectStatus: "rented", expectLeaseStatus: "active" },
  { name: "edge: case insensitivity (LEASED)",         mlsStatus: "LEASED", txType: "For Lease", standardStatus: "Closed", expectStatus: "rented", expectLeaseStatus: "leased" },
];

let passed = 0;
let failed = 0;
const failures: string[] = [];

for (const t of TESTS) {
  const result = mapListingStates(t.mlsStatus, t.txType, t.standardStatus);
  const ok = result.status === t.expectStatus && result.leaseStatus === t.expectLeaseStatus;
  if (ok) {
    passed++;
    console.log(`  ✓ ${t.name}`);
  } else {
    failed++;
    failures.push(`${t.name} — got status=${result.status} leaseStatus=${result.leaseStatus}; expected status=${t.expectStatus} leaseStatus=${t.expectLeaseStatus}`);
    console.log(`  ✗ ${t.name}`);
    console.log(`      got status=${result.status} leaseStatus=${result.leaseStatus}`);
    console.log(`      expected status=${t.expectStatus} leaseStatus=${t.expectLeaseStatus}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed (${TESTS.length} total)`);
if (failed > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
