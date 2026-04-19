// VOW sold records sync — TREB AMPRE OData → sold.sold_records + sold.media + sold.rooms.
//
// All heavy lifting lives in src/lib/vow-sync.ts. This file is a thin route
// wrapper that handles auth, env, and returns the sync result as JSON.
//
// Architecture & compliance notes (see src/lib/vow-sync.ts for the mapping):
//   - NEVER delete from sold.sold_records. VOW 90-day rule on read path.
//   - Ingest ALL records regardless of PermAdvertise. Flags stored.
//   - $expand not supported on /Property by AMPRE — sibling /Media and
//     /PropertyRooms fetches run per-page in batches of 20.
//   - /Member endpoint is 403 under VOW #1848370 — no agent-name lookup.
//
// Auth: Authorization: Bearer <CRON_SECRET>.
// Local test hook: `?limit=N` query param caps total upserts.

import { NextRequest, NextResponse } from "next/server";
import { soldDb } from "@/lib/db";
import { runSoldSync, type AmpConfig, type SqlExecutor } from "@/lib/vow-sync";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const TREB_API_URL = (process.env.TREB_API_URL || "https://query.ampre.ca/odata/Property").trim();
const VOW_TOKEN = (process.env.VOW_TOKEN || "").trim();

// Adapt @neondatabase/serverless's tagged-template function to the shared
// SqlExecutor interface. As of v1.x, the direct (text, values) call form is
// deprecated — must use sql.query(text, values). Confirmed empirically
// against @neondatabase/serverless@1.0.2.
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
    const header = req.headers.get("authorization");
    const expected = `Bearer ${process.env.CRON_SECRET}`;
    if (!header || !process.env.CRON_SECRET || header !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!soldDb) {
      return NextResponse.json(
        { error: "SOLD_DATABASE_URL is not configured" },
        { status: 503 }
      );
    }

    const limitParam = req.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.max(1, parseInt(limitParam, 10) || 0) : Infinity;

    const db = neonExecutor(soldDb);
    const amp: AmpConfig = { propertyUrl: TREB_API_URL, token: VOW_TOKEN, pageSize: 500 };

    const result = await runSoldSync({ db, amp, limit });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[sync/sold] crash: ${msg}`, err instanceof Error ? err.stack : undefined);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
