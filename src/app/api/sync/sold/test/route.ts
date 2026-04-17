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

  // Diagnostic call — filter for Milton records with a populated CloseDate.
  // A populated CloseDate is the definitive indicator of a sold/closed
  // transaction regardless of what MlsStatus string TREB uses. Returns 5
  // records so we can see the exact MlsStatus values those sold records
  // carry (TREB reportedly uses 'Closed' rather than 'Sold').
  const filter = encodeURIComponent(
    "City eq 'Milton' and CloseDate gt 2024-01-01T00:00:00Z"
  );
  const url = `${TREB_API_URL}?$select=ListingKey,City,CityRegion,StateOrProvince,MlsStatus,TransactionType,CloseDate,ClosePrice,ModificationTimestamp&$filter=${filter}&$top=5`;

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

  return NextResponse.json(
    {
      stage: "response-received",
      token: tokenDiag,
      url: urlDiag,
      httpStatus: response.status,
      httpStatusText: response.statusText,
      responseHeaders,
      responseBody: bodyText.slice(0, 4000),
      responseBodyLength: bodyText.length,
    },
    { status: response.ok ? 200 : 502 }
  );
}
