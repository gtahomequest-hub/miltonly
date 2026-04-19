// VOW sold records sync — TREB AMPRE OData → sold.sold_records + sold.media + sold.rooms.
//
// TEMPORARILY INSTRUMENTED (2026-04-19) to diagnose a Vercel 500 with empty
// body. The catch block leaks err.message + err.stack in the response so
// we can see the actual failure without shell/CLI access to Vercel logs.
// Bearer auth keeps the leak bounded. REVERT AFTER DIAGNOSIS.

import { NextRequest, NextResponse } from "next/server";
import { soldDb } from "@/lib/db";
import { runSoldSync, type AmpConfig, type SqlExecutor } from "@/lib/vow-sync";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const TREB_API_URL = (process.env.TREB_API_URL || "https://query.ampre.ca/odata/Property").trim();
const VOW_TOKEN = (process.env.VOW_TOKEN || "").trim();

function neonExecutor(db: NonNullable<typeof soldDb>): SqlExecutor {
  return async (text, values) => {
    return (await db.query(text, values)) as Record<string, unknown>[];
  };
}

export async function GET(req: NextRequest) {
  return POST(req);
}

export async function POST(req: NextRequest) {
  try {
    console.log("[sync/sold] phase=handler-entered");

    const header = req.headers.get("authorization");
    const expected = `Bearer ${process.env.CRON_SECRET}`;
    if (!header || !process.env.CRON_SECRET || header !== expected) {
      console.log("[sync/sold] phase=auth-rejected");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.log("[sync/sold] phase=auth-ok");

    if (!soldDb) {
      console.error("[sync/sold] phase=soldDb-missing SOLD_DATABASE_URL not configured");
      return NextResponse.json(
        { error: "SOLD_DATABASE_URL is not configured" },
        { status: 503 }
      );
    }
    console.log("[sync/sold] phase=soldDb-present");

    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.max(1, parseInt(limitParam, 10) || 0) : Infinity;
    console.log(`[sync/sold] phase=limit-parsed limit=${limit}`);

    const db = neonExecutor(soldDb);
    const amp: AmpConfig = { propertyUrl: TREB_API_URL, token: VOW_TOKEN, pageSize: 500 };
    console.log(`[sync/sold] phase=executor-built TREB=${TREB_API_URL} tokenLen=${VOW_TOKEN.length}`);

    console.log("[sync/sold] phase=runSoldSync-starting");
    const result = await runSoldSync({ db, amp, limit });
    console.log(`[sync/sold] phase=runSoldSync-done result=${JSON.stringify(result)}`);

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    const name = err instanceof Error ? err.name : "unknown";
    console.error(`[sync/sold] CRASH name=${name} message=${msg}\n${stack}`);
    // TEMPORARY error-body leak — revert once root cause found.
    return NextResponse.json(
      { error: "server_error", name, message: msg, stack },
      { status: 500 }
    );
  }
}
