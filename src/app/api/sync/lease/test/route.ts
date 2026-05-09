// Diagnostic endpoint — probe MLS for non-Closed lease records to determine
// whether active/expired/terminated/suspended LEASE listings exist in the
// AMPRE feed for Milton.
//
// Context: DB1 Listing currently has 0 expired-lease and 0 active-lease
// rows. The detect ingest at /api/sync/detect/route.ts:117 maps any record
// with TransactionType containing 'lease' to status="rented" — collapsing
// the full lease state machine. This probe answers: did MLS ever send those
// records, or do they not exist in the feed?
//
// Probes (all filtered to TransactionType eq 'For Lease'):
//   A: All non-Closed lease records (any non-finalized state)
//   B: Active lease records (MlsStatus eq 'New' or 'Pc')
//   C: Expired lease records (MlsStatus eq 'Exp')
//   D: Terminated lease records (MlsStatus eq 'Ter')
//   E: Suspended lease records (MlsStatus eq 'Sus')
//
// Per probe: count, unique MlsStatus / StandardStatus values seen, sample
// records, AMPRE error if any. Summary aggregates the union.
//
// Auth: Authorization: Bearer <CRON_SECRET>  OR  ?secret=<CRON_SECRET>.

import { NextRequest, NextResponse } from "next/server";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TREB_API_URL = (process.env.TREB_API_URL || "https://query.ampre.ca/odata/Property").trim();
// Lease records likely IDX-allowed (they're public listings) but use VOW
// token for parity with the sold/test endpoint and to avoid auth surprises.
const VOW_TOKEN = (process.env.VOW_TOKEN || "").trim();
const IDX_TOKEN = (process.env.TREB_API_TOKEN || "").trim();

const SELECT_FIELDS =
  "ListingKey,City,MlsStatus,StandardStatus,TransactionType," +
  "ListPrice,BedroomsTotal,PropertyType,PropertySubType," +
  "OriginalEntryTimestamp,ModificationTimestamp,ExpirationDate,CloseDate";

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${expected}`) return true;
  const query = req.nextUrl.searchParams.get("secret");
  if (query === expected) return true;
  return false;
}

interface SampleRecord {
  ListingKey: string;
  MlsStatus: string | null;
  StandardStatus: string | null;
  TransactionType: string | null;
  ListPrice: number | null;
  BedroomsTotal: number | null;
  PropertyType: string | null;
  ExpirationDate: string | null;
  CloseDate: string | null;
}

interface ProbeResult {
  filter: string;
  ok: boolean;
  httpStatus: number;
  count: number;
  uniqueMlsStatuses: string[];
  uniqueStandardStatuses: string[];
  uniqueTransactionTypes: string[];
  sample: SampleRecord[];
  ampreError: string | null;
}

async function runProbe(filterExpr: string, top: number, token: string): Promise<ProbeResult> {
  const encodedFilter = encodeURIComponent(filterExpr);
  const encodedOrderby = encodeURIComponent("ModificationTimestamp desc");
  const url =
    `${TREB_API_URL}?$select=${SELECT_FIELDS}` +
    `&$filter=${encodedFilter}` +
    `&$orderby=${encodedOrderby}` +
    `&$top=${top}` +
    `&$count=true`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  } catch (err) {
    return {
      filter: filterExpr,
      ok: false,
      httpStatus: 0,
      count: 0,
      uniqueMlsStatuses: [],
      uniqueStandardStatuses: [],
      uniqueTransactionTypes: [],
      sample: [],
      ampreError: String(err),
    };
  }

  const bodyText = await response.text().catch(() => "");
  let ampreError: string | null = null;
  let values: unknown[] = [];
  let totalCount = 0;
  try {
    const parsed: unknown = JSON.parse(bodyText);
    if (parsed && typeof parsed === "object") {
      const obj = parsed as { value?: unknown; error?: { message?: string }; message?: string; "@odata.count"?: number };
      ampreError = obj.error?.message ?? obj.message ?? null;
      if (Array.isArray(obj.value)) values = obj.value;
      if (typeof obj["@odata.count"] === "number") totalCount = obj["@odata.count"];
    }
  } catch {
    // Not JSON
  }

  const mlsSet = new Set<string>();
  const stdSet = new Set<string>();
  const txnSet = new Set<string>();
  const sample: SampleRecord[] = [];
  for (const r of values) {
    if (!r || typeof r !== "object") continue;
    const rec = r as Record<string, unknown>;
    if (rec.MlsStatus) mlsSet.add(String(rec.MlsStatus));
    if (rec.StandardStatus) stdSet.add(String(rec.StandardStatus));
    if (rec.TransactionType) txnSet.add(String(rec.TransactionType));
    if (sample.length < 5) {
      sample.push({
        ListingKey: String(rec.ListingKey ?? ""),
        MlsStatus: (rec.MlsStatus as string | null) ?? null,
        StandardStatus: (rec.StandardStatus as string | null) ?? null,
        TransactionType: (rec.TransactionType as string | null) ?? null,
        ListPrice: (rec.ListPrice as number | null) ?? null,
        BedroomsTotal: (rec.BedroomsTotal as number | null) ?? null,
        PropertyType: (rec.PropertyType as string | null) ?? null,
        ExpirationDate: (rec.ExpirationDate as string | null) ?? null,
        CloseDate: (rec.CloseDate as string | null) ?? null,
      });
    }
  }

  return {
    filter: filterExpr,
    ok: response.ok,
    httpStatus: response.status,
    count: totalCount > 0 ? totalCount : values.length,
    uniqueMlsStatuses: Array.from(mlsSet).sort(),
    uniqueStandardStatuses: Array.from(stdSet).sort(),
    uniqueTransactionTypes: Array.from(txnSet).sort(),
    sample,
    ampreError,
  };
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // VOW_TOKEN for lease probes (covers all public + restricted records).
  // Fall back to IDX_TOKEN if VOW absent (lease records are typically IDX-allowed).
  const token = VOW_TOKEN || IDX_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Neither VOW_TOKEN nor TREB_API_TOKEN configured" }, { status: 500 });
  }

  const cityFilter = `City eq '${config.AMPRE_CITY_FILTER}'`;
  const leaseFilter = `${cityFilter} and TransactionType eq 'For Lease'`;

  // PropTx/AMPRE returns FULL WORD MlsStatus values for lease records
  // ("Expired", "Terminated", "Suspended") — NOT the abbreviated codes
  // ("Exp", "Ter", "Sus") that work for sold-records sale-side probes.
  // Also probing Cancelled + Withdrawn which appeared in StandardStatus.
  const [
    probeAll,
    probeActive,
    probeExpired,
    probeTerminated,
    probeSuspended,
    probeCancelled,
    probeWithdrawn,
    probePriceChange,
    probeLeased,
  ] = await Promise.all([
    runProbe(`${leaseFilter}`, 30, token),
    runProbe(`${leaseFilter} and MlsStatus eq 'New'`, 20, token),
    runProbe(`${leaseFilter} and MlsStatus eq 'Expired'`, 20, token),
    runProbe(`${leaseFilter} and MlsStatus eq 'Terminated'`, 20, token),
    runProbe(`${leaseFilter} and MlsStatus eq 'Suspended'`, 20, token),
    runProbe(`${leaseFilter} and StandardStatus eq 'Cancelled'`, 20, token),
    runProbe(`${leaseFilter} and StandardStatus eq 'Withdrawn'`, 20, token),
    runProbe(`${leaseFilter} and MlsStatus eq 'Price Change'`, 20, token),
    runProbe(`${leaseFilter} and MlsStatus eq 'Leased'`, 20, token),
  ]);

  const allMls = new Set<string>();
  const allStd = new Set<string>();
  for (const p of [
    probeAll, probeActive, probeExpired, probeTerminated, probeSuspended,
    probeCancelled, probeWithdrawn, probePriceChange, probeLeased,
  ]) {
    p.uniqueMlsStatuses.forEach((s) => allMls.add(s));
    p.uniqueStandardStatuses.forEach((s) => allStd.add(s));
  }

  const counts = {
    anyLease: probeAll.count,
    activeLease_New: probeActive.count,
    expiredLease_Expired: probeExpired.count,
    terminatedLease_Terminated: probeTerminated.count,
    suspendedLease_Suspended: probeSuspended.count,
    cancelledLease_Cancelled: probeCancelled.count,
    withdrawnLease_Withdrawn: probeWithdrawn.count,
    priceChangedLease_PriceChange: probePriceChange.count,
    leasedLease_Leased: probeLeased.count,
  };
  const droppedClassesTotal =
    counts.activeLease_New +
    counts.expiredLease_Expired +
    counts.terminatedLease_Terminated +
    counts.suspendedLease_Suspended +
    counts.cancelledLease_Cancelled +
    counts.withdrawnLease_Withdrawn +
    counts.priceChangedLease_PriceChange;

  return NextResponse.json({
    tokenUsed: VOW_TOKEN ? "VOW" : "IDX",
    cityFilter: config.AMPRE_CITY_FILTER,
    summary: {
      uniqueMlsStatusesAcrossLeaseProbes: Array.from(allMls).sort(),
      uniqueStandardStatusesAcrossLeaseProbes: Array.from(allStd).sort(),
      counts,
      droppedClassesTotal,
      finding:
        droppedClassesTotal > 0
          ? `MLS sends ${droppedClassesTotal} non-Leased lease records that the current ingest at detect/route.ts:117 is collapsing to status=rented. Schema fix required to preserve the lease state machine.`
          : "All non-Leased lease classes returned 0 — either MLS truly doesn't send them, OR these specific filter values don't match (still investigating).",
    },
    probeAll,
    probeActive,
    probeExpired,
    probeTerminated,
    probeSuspended,
    probeCancelled,
    probeWithdrawn,
    probePriceChange,
    probeLeased,
  });
}
