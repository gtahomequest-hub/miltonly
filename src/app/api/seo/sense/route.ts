import { NextRequest, NextResponse } from "next/server";
import { runSense } from "@/lib/seo/sense";

// Organic growth loop piece 1 — SENSE. Weekly Vercel cron (see vercel.json).
// Fills SeoOpportunity / SenseRun / SeoActionLog. Does NOT generate anything
// and does NOT write streetQueue — later pieces act on the queue this fills.
export const maxDuration = 300;
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

  // Kill switch — live from day one. Unset/false = the loop senses nothing.
  if (process.env.ORGANIC_LOOP_ENABLED !== "true") {
    console.log("[seo/sense] ORGANIC_LOOP_ENABLED not 'true' — skipping (kill switch).");
    return NextResponse.json({ skipped: true, reason: "ORGANIC_LOOP_ENABLED is not 'true'" });
  }

  try {
    const summary = await runSense();
    console.log(`[seo/sense] run ${summary.senseRunId}: ${summary.keywordRows} keywords, ` +
      `${summary.opportunities.created} new / ${summary.opportunities.updated} updated opportunities, ` +
      `${summary.coverageInspected} inspections, indexed ${summary.indexedCount}`);
    return NextResponse.json(summary);
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 400);
    console.error("[seo/sense] FAILED: " + msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
