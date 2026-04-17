// Diagnostic endpoint — runs three probes in parallel against AMPRE to
// identify the correct server-side filter for Milton sold records.
//
// Probe A: City eq 'Milton' and StandardStatus eq 'Closed'
//          RESO-standard status value — should be universal across boards.
// Probe B: City eq 'Milton' and MlsStatus eq 'Sld'
//          TRREB historically uses abbreviated status codes; 'Sld' = Sold.
// Probe C: City eq 'Milton' and MlsStatus ne 'New'  (top=20)
//          Discovery — surfaces every non-active status string in the feed.
//
// Also reports, per probe: count, unique MlsStatus/StandardStatus values,
// sample records, AMPRE error message if any. Summary at the top aggregates
// winners (probes that returned records) and the union of statuses seen.
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
  const sample: SampleRecord[] = [];
  for (const r of values) {
    if (!r || typeof r !== "object") continue;
    const rec = r as Record<string, unknown>;
    if (rec.MlsStatus) mlsSet.add(String(rec.MlsStatus));
    if (rec.StandardStatus) stdSet.add(String(rec.StandardStatus));
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

  // Run all three probes in parallel — cuts wall time to max(probe duration).
  const [probeA, probeB, probeC] = await Promise.all([
    runProbe("City eq 'Milton' and StandardStatus eq 'Closed'", 5),
    runProbe("City eq 'Milton' and MlsStatus eq 'Sld'", 5),
    runProbe("City eq 'Milton' and MlsStatus ne 'New'", 20),
  ]);

  // Aggregate status vocabulary across all three probes so the union is one
  // array to inspect instead of three.
  const allMls = new Set<string>();
  const allStd = new Set<string>();
  for (const p of [probeA, probeB, probeC]) {
    p.uniqueMlsStatuses.forEach((s) => allMls.add(s));
    p.uniqueStandardStatuses.forEach((s) => allStd.add(s));
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
    },
    probeA_resoStandardClosed: probeA,
    probeB_mlsStatusSld: probeB,
    probeC_mlsStatusNotNew: probeC,
  });
}
