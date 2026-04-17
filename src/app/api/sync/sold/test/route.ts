// Diagnostic endpoint — runs four probes in parallel against AMPRE to
// identify the correct server-side filter for Milton sold records AND
// discover the exact TransactionType string values used by the feed.
//
// Probe A: City eq 'Milton' and StandardStatus eq 'Closed'          (top=5)
//          RESO-standard status value — should be universal across boards.
// Probe B: City eq 'Milton' and MlsStatus eq 'Sld'                  (top=5)
//          TRREB historically uses abbreviated status codes; 'Sld' = Sold.
// Probe C: City eq 'Milton' and MlsStatus ne 'New'                  (top=20)
//          Discovery — surfaces every non-active MlsStatus string in the feed.
// Probe D: City eq 'Milton' and StandardStatus eq 'Closed'          (top=100)
//          TransactionType discovery — larger sample guarantees we see both
//          sale and lease rows so the CHECK constraint in migration 002
//          uses the exact string values AMPRE returns.
//
// Per probe: count, unique MlsStatus/StandardStatus/TransactionType values,
// sample records, AMPRE error message if any. Summary at the top aggregates
// winners and the union of statuses/transaction types seen across probes.
//
// Auth: Authorization: Bearer <CRON_SECRET>  OR  ?secret=<CRON_SECRET>.

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const TREB_API_URL = (process.env.TREB_API_URL || "https://query.ampre.ca/odata/Property").trim();
// Uses VOW_TOKEN (VOW agreement #1848370) — IDX-scoped TREB_API_TOKEN
// cannot see sold/closed records. detect/route.ts keeps the IDX token.
const VOW_TOKEN = (process.env.VOW_TOKEN || "").trim();

const SELECT_FIELDS =
  "ListingKey,City,MlsStatus,StandardStatus,TransactionType," +
  "CloseDate,ClosePrice,PurchaseContractDate,ModificationTimestamp";

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
  CloseDate: string | null;
  ClosePrice: number | null;
  PurchaseContractDate: string | null;
  TransactionType: string | null;
}

interface ProbeResult {
  filter: string;
  ok: boolean;
  httpStatus: number;
  httpStatusText: string;
  count: number;
  uniqueMlsStatuses: string[];
  uniqueStandardStatuses: string[];
  uniqueTransactionTypes: string[];
  sample: SampleRecord[];
  amprerror: string | null;
  bodySnippet: string;
}

async function runProbe(filterExpr: string, top: number): Promise<ProbeResult> {
  const encodedFilter = encodeURIComponent(filterExpr);
  const encodedOrderby = encodeURIComponent("ModificationTimestamp desc");
  const url =
    `${TREB_API_URL}?$select=${SELECT_FIELDS}` +
    `&$filter=${encodedFilter}` +
    `&$orderby=${encodedOrderby}` +
    `&$top=${top}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${VOW_TOKEN}`,
        Accept: "application/json",
      },
    });
  } catch (err) {
    return {
      filter: filterExpr,
      ok: false,
      httpStatus: 0,
      httpStatusText: "fetch-threw",
      count: 0,
      uniqueMlsStatuses: [],
      uniqueStandardStatuses: [],
      uniqueTransactionTypes: [],
      sample: [],
      amprerror: String(err),
      bodySnippet: "",
    };
  }

  const bodyText = await response.text().catch(() => "");
  let amprerror: string | null = null;
  let values: unknown[] = [];
  try {
    const parsed: unknown = JSON.parse(bodyText);
    if (parsed && typeof parsed === "object") {
      const obj = parsed as { value?: unknown; error?: { message?: string }; message?: string };
      amprerror = obj.error?.message ?? obj.message ?? null;
      if (Array.isArray(obj.value)) values = obj.value;
    }
  } catch {
    // Not JSON — leave amprerror null, values empty.
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
    if (sample.length < 3) {
      sample.push({
        ListingKey: String(rec.ListingKey ?? ""),
        MlsStatus: (rec.MlsStatus as string | null) ?? null,
        StandardStatus: (rec.StandardStatus as string | null) ?? null,
        CloseDate: (rec.CloseDate as string | null) ?? null,
        ClosePrice: (rec.ClosePrice as number | null) ?? null,
        PurchaseContractDate: (rec.PurchaseContractDate as string | null) ?? null,
        TransactionType: (rec.TransactionType as string | null) ?? null,
      });
    }
  }

  return {
    filter: filterExpr,
    ok: response.ok,
    httpStatus: response.status,
    httpStatusText: response.statusText,
    count: values.length,
    uniqueMlsStatuses: Array.from(mlsSet).sort(),
    uniqueStandardStatuses: Array.from(stdSet).sort(),
    uniqueTransactionTypes: Array.from(txnSet).sort(),
    sample,
    amprerror,
    bodySnippet: bodyText.slice(0, 600),
  };
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokenDiag = {
    present: VOW_TOKEN.length > 0,
    length: VOW_TOKEN.length,
    trailingWhitespace: VOW_TOKEN.length > 0 && /\s$/.test(VOW_TOKEN),
    endsWithLiteralBackslashN: VOW_TOKEN.length > 0 && VOW_TOKEN.endsWith("\\n"),
    first10: VOW_TOKEN.slice(0, 10),
    last4: VOW_TOKEN.slice(-4),
  };

  const urlDiag = {
    configured: TREB_API_URL,
    trailingWhitespace: /\s$/.test(TREB_API_URL),
    endsWithLiteralBackslashN: TREB_API_URL.endsWith("\\n"),
  };

  // Run all four probes in parallel — cuts wall time to max(probe duration).
  const [probeA, probeB, probeC, probeD] = await Promise.all([
    runProbe("City eq 'Milton' and StandardStatus eq 'Closed'", 5),
    runProbe("City eq 'Milton' and MlsStatus eq 'Sld'", 5),
    runProbe("City eq 'Milton' and MlsStatus ne 'New'", 20),
    // Probe D — TransactionType discovery, large sample so we see both
    // 'For Sale' and 'For Lease' rows before writing the CHECK constraint.
    runProbe("City eq 'Milton' and StandardStatus eq 'Closed'", 100),
  ]);

  // Aggregate status + transaction-type vocabulary across all probes so the
  // union is one array to inspect instead of four.
  const allMls = new Set<string>();
  const allStd = new Set<string>();
  const allTxn = new Set<string>();
  for (const p of [probeA, probeB, probeC, probeD]) {
    p.uniqueMlsStatuses.forEach((s) => allMls.add(s));
    p.uniqueStandardStatuses.forEach((s) => allStd.add(s));
    p.uniqueTransactionTypes.forEach((s) => allTxn.add(s));
  }

  const winners: string[] = [];
  if (probeA.ok && probeA.count > 0) winners.push(probeA.filter);
  if (probeB.ok && probeB.count > 0) winners.push(probeB.filter);

  return NextResponse.json({
    token: tokenDiag,
    url: urlDiag,
    summary: {
      winners,
      uniqueMlsStatusesAcrossProbes: Array.from(allMls).sort(),
      uniqueStandardStatusesAcrossProbes: Array.from(allStd).sort(),
      uniqueTransactionTypesAcrossProbes: Array.from(allTxn).sort(),
    },
    probeA_resoStandardClosed: probeA,
    probeB_mlsStatusSld: probeB,
    probeC_mlsStatusNotNew: probeC,
    probeD_transactionTypeDiscovery: probeD,
  });
}
