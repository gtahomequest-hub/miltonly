import { NextRequest, NextResponse } from "next/server";
import { sendDigest } from "@/lib/seo/digest";

// Organic growth loop piece 2 — the weekly digest email. Reads what sense
// stored (never calls GSC), composes + sends ONE email via Resend. Weekly
// cron Mondays 10:30 UTC (see vercel.json) — after Sunday's 09:00 sense run.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return POST(request);
}

export async function POST(request: NextRequest) {
  const secret =
    request.headers.get("authorization")?.replace("Bearer ", "") ||
    request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (process.env.ORGANIC_LOOP_ENABLED !== "true") {
    console.log("[seo/digest] ORGANIC_LOOP_ENABLED not 'true' — skipping (kill switch).");
    return NextResponse.json({ skipped: true, reason: "ORGANIC_LOOP_ENABLED is not 'true'" });
  }

  try {
    const result = await sendDigest();
    console.log(`[seo/digest] sent=${result.sent}${result.reason ? ` reason=${result.reason}` : ""}`);
    return NextResponse.json(result);
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 400);
    console.error("[seo/digest] FAILED: " + msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
