import { NextRequest, NextResponse } from "next/server";
import { syncMiltonListings } from "@/lib/sync/treb-sync";

export const maxDuration = 300; // 5 minutes for Vercel

export async function POST(request: NextRequest) {
  // Auth: check cron secret via header or query param
  const authHeader = request.headers.get("authorization");
  const secret = authHeader?.replace("Bearer ", "") ||
    request.nextUrl.searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await syncMiltonListings();
    return NextResponse.json({
      success: true,
      ...result,
      message: `Synced ${result.added + result.updated} listings (${result.added} new, ${result.updated} updated, ${result.skipped} skipped, ${result.errors} errors) in ${(result.duration / 1000).toFixed(1)}s`,
    });
  } catch (e) {
    console.error("Sync error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 }
    );
  }
}

// GET also works (for Vercel cron which sends GET)
export async function GET(request: NextRequest) {
  return POST(request);
}
