// Admin force-regenerate endpoint.
//
// Bypasses makeStreetDecision entirely — regenerates a single street's
// AI content regardless of staleness, marketDataHash match, needsReview
// status, or attempt count. Used by scripts/force-regenerate-streets.mjs
// to fix compliance leaks in existing published content (e.g., "sold
// price" language surviving from pre-Phase-2.6 generations that the
// normal cron can't reach because makeStreetDecision returns
// skip_current on stale-but-hash-matching rows).
//
// Auth: same CRON_SECRET as /api/sync/*. Single-slug per request so the
// 300s maxDuration comfortably covers worst case (3 Claude retries).
//
// SMS is suppressed — bulk force-regen of 45+ streets would spam the
// owner. Status/review state on the DB row is still written.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateStreetContent } from "@/lib/generateStreet";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const secret =
    request.headers.get("authorization")?.replace("Bearer ", "") ||
    request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set" },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  if (!slug) {
    return NextResponse.json(
      { error: "Missing required field: slug (string)" },
      { status: 400 }
    );
  }

  // Look up the canonical streetName from the existing StreetContent row.
  // Force-regenerate is for EXISTING rows; if the row doesn't exist, the
  // normal build path should be used instead (via StreetQueue + cron).
  const existing = await prisma.streetContent.findUnique({
    where: { streetSlug: slug },
    select: { streetName: true },
  });
  if (!existing) {
    return NextResponse.json(
      {
        error: `StreetContent not found for slug "${slug}". ` +
          `Force-regenerate is for existing rows only. Add the slug to ` +
          `StreetQueue and run /api/sync/generate for new streets.`,
      },
      { status: 404 }
    );
  }

  const start = Date.now();
  try {
    const result = await generateStreetContent(slug, existing.streetName, {
      skipSms: true,
    });
    return NextResponse.json({
      ok: true,
      slug,
      streetName: result.streetName,
      passed: result.passed,
      attempts: result.attempts,
      durationMs: Date.now() - start,
    });
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error(`[force-regenerate] ${slug} failed:`, e);
    return NextResponse.json(
      {
        ok: false,
        slug,
        error: errMsg,
        durationMs: Date.now() - start,
      },
      { status: 500 }
    );
  }
}
