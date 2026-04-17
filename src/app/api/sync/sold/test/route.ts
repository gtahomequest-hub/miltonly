// Diagnostic endpoint — simplest possible AMPRE call to verify the
// connection, auth, and base URL work before layering sold-specific
// filters + VOW fields on top. Mirrors detect/route.ts's proven fetch.
//
// Auth: Authorization: Bearer <CRON_SECRET>  OR  ?secret=<CRON_SECRET>.
// Returns: the raw AMPRE response — status, headers, body — plus token
// diagnostics so trailing-whitespace and missing-env issues are visible.

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Trim env vars — trailing whitespace on the URL corrupts the query string;
// trailing whitespace on the token corrupts the Authorization header.
const TREB_API_URL = (process.env.TREB_API_URL || "https://query.ampre.ca/odata/Property").trim();
const TREB_TOKEN = (process.env.TREB_API_TOKEN || "").trim();

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization");
  if (header === `Bearer ${expected}`) return true;
  const query = req.nextUrl.searchParams.get("secret");
  if (query === expected) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Discovery probe — no MlsStatus filter so we can see every status string
  // TREB actually uses for Milton records. 'Sold' as the filter value returns
  // zero records, which means TREB labels closed transactions with a
  // different string (likely 'Closed', 'Sold Conditional', etc.).
  const filter = encodeURIComponent("City eq 'Milton'");
  const url = `${TREB_API_URL}?$select=ListingKey,City,MlsStatus,TransactionType,CloseDate,ClosePrice,ModificationTimestamp&$filter=${filter}&$top=10`;

  // Token diagnostics — never log the token, just safe metadata.
  const tokenDiag = {
    present: TREB_TOKEN.length > 0,
    length: TREB_TOKEN.length,
    trailingWhitespace:
      TREB_TOKEN.length > 0 && /\s$/.test(TREB_TOKEN),
    endsWithLiteralBackslashN:
      TREB_TOKEN.length > 0 && TREB_TOKEN.endsWith("\\n"),
    first10: TREB_TOKEN.slice(0, 10),
    last4: TREB_TOKEN.slice(-4),
  };

  const urlDiag = {
    configured: TREB_API_URL,
    trailingWhitespace: /\s$/.test(TREB_API_URL),
    endsWithLiteralBackslashN: TREB_API_URL.endsWith("\\n"),
    called: url,
  };

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TREB_TOKEN}`,
        Accept: "application/json",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        stage: "fetch-threw",
        token: tokenDiag,
        url: urlDiag,
        error: String(err),
      },
      { status: 500 }
    );
  }

  const bodyText = await response.text().catch(() => "<body-read-failed>");
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  // Try to surface AMPRE's error message at the top level for quick reading
  // without having to pull it out of the raw JSON body manually.
  let amprerror: string | null = null;
  // Discovery data — unique MlsStatus values and per-record status, so the
  // caller doesn't have to parse responseBody to find the real sold label.
  let uniqueMlsStatuses: string[] = [];
  const recordStatuses: Array<{ ListingKey: string; MlsStatus: string | null; CloseDate: string | null; TransactionType: string | null }> = [];
  let recordCount = 0;
  try {
    const parsed = JSON.parse(bodyText);
    amprerror = parsed?.error?.message ?? parsed?.message ?? null;
    const values = Array.isArray(parsed?.value) ? parsed.value : [];
    recordCount = values.length;
    const statusSet = new Set<string>();
    for (const r of values) {
      if (r?.MlsStatus) statusSet.add(String(r.MlsStatus));
      recordStatuses.push({
        ListingKey: String(r?.ListingKey ?? ""),
        MlsStatus: r?.MlsStatus ?? null,
        CloseDate: r?.CloseDate ?? null,
        TransactionType: r?.TransactionType ?? null,
      });
    }
    uniqueMlsStatuses = Array.from(statusSet).sort();
  } catch {
    // Not JSON — leave discovery fields empty.
  }

  // Diagnostic endpoint always returns HTTP 200. Success/failure of the
  // upstream AMPRE call is conveyed by `ok` and `httpStatus` in the body.
  return NextResponse.json({
    ok: response.ok,
    stage: "response-received",
    token: tokenDiag,
    url: urlDiag,
    httpStatus: response.status,
    httpStatusText: response.statusText,
    amprerror,
    recordCount,
    uniqueMlsStatuses,
    recordStatuses,
    responseHeaders,
    responseBody: bodyText.slice(0, 4000),
    responseBodyLength: bodyText.length,
  });
}
