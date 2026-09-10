import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { makeStreetDecision } from "@/lib/streetDecision";
import { generateStreetContent } from "@/lib/generateStreet";

export const maxDuration = 300;

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

  const start = Date.now();
  const built: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  const hasApiKey = !!process.env.ANTHROPIC_API_KEY;
  const keyPrefix = process.env.ANTHROPIC_API_KEY?.slice(0, 10) || "NOT_SET";
  console.log(`[generate] ANTHROPIC_API_KEY defined: ${hasApiKey}, prefix: ${keyPrefix}`);

  if (!hasApiKey) {
    return NextResponse.json({
      error: "ANTHROPIC_API_KEY is not set in environment variables",
      hint: "Add it in Vercel dashboard → Settings → Environment Variables → make sure Production is checked",
    }, { status: 500 });
  }

  const pending = await prisma.streetQueue.findMany({
    where: {
      OR: [
        { status: "pending" },
        { status: "failed", attempts: { lt: 3 } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 25,
  });

  // ── DEC-NEW-PAGE-CAP (2026-09-10) ──
  // QUEUE item 7's widened gate admits 249 registry-filtered streets that have no page. Left
  // uncapped, this drain would build all of them, and it runs HOURLY - 24 chances a day. That
  // is a corpus-sized change nobody reviewed, arriving overnight.
  //
  // So: at most NEW_PAGES_PER_DAY pages are CREATED per day. Regenerations are not capped and
  // never were; refreshing a page that already exists is the thing item 7 was written to fix,
  // and it publishes nothing new.
  //
  // The count is over StreetContent.createdAt, which the database defaults on insert and no
  // code path rewrites. It carries real history from 2026-04-21, so the cap is accurate from
  // its first run rather than starting blind. generatedAt and publishedAt are both rewritten
  // by every regeneration and would have counted refreshes as creations.
  const NEW_PAGES_PER_DAY = 20;
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const createdToday = await prisma.streetContent.count({
    where: { createdAt: { gte: dayStart } },
  });
  let newPageBudget = Math.max(0, NEW_PAGES_PER_DAY - createdToday);
  console.log(`[generate] new-page cap: ${createdToday}/${NEW_PAGES_PER_DAY} created today, budget ${newPageBudget}`);

  const toBuild: { streetSlug: string; streetName: string }[] = [];
  let deferred = 0;

  for (const item of pending) {
    const decision = await makeStreetDecision(item.streetSlug, item.streetName);
    if (decision === "build" || decision === "regenerate") {
      // "build" means makeStreetDecision found no StreetContent row, so it is a new page and
      // spends budget. "regenerate" touches a page that already exists and does not.
      if (decision === "build") {
        if (newPageBudget <= 0) {
          // LEFT PENDING, deliberately. Not marked done, not marked ineligible - the street is
          // eligible, it is merely waiting its turn. The next run picks it up with a fresh
          // budget, and the queue's createdAt ordering means it keeps its place.
          deferred++;
          continue;
        }
        newPageBudget--;
      }
      toBuild.push(item);
    } else {
      skipped.push(`${item.streetName} (${decision})`);
      // UPG-4 Stage 2 Piece 3 (DEF-17 fix): Always transition out of pending
      // after streetDecision examines the row. Previous logic left skip_current
      // rows in pending forever, accumulating 230 orphaned rows by 2026-05-04.
      // skip_current = content is fresh enough; queue's job for this street is done.
      // skip_low_data = no stats yet; mark ineligible (StreetGeneration cron will
      // re-evaluate when stats arrive).
      const newStatus = decision === "skip_low_data" ? "ineligible" : "done";
      await prisma.streetQueue.update({
        where: { id: item.id },
        data: { status: newStatus, processedAt: new Date() },
      });
    }
  }

  for (let i = 0; i < toBuild.length; i += 10) {
    const batch = toBuild.slice(i, i + 10);

    await Promise.all(
      batch.map((item) =>
        prisma.streetQueue.updateMany({
          where: { streetSlug: item.streetSlug },
          data: { status: "processing" },
        })
      )
    );

    const results = await Promise.allSettled(
      batch.map((item) => generateStreetContent(item.streetSlug, item.streetName))
    );

    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      const item = batch[j];
      if (result.status === "fulfilled") {
        built.push(item.streetName);
        await prisma.streetQueue.updateMany({
          where: { streetSlug: item.streetSlug },
          data: { status: "done", processedAt: new Date() },
        });
      } else {
        const errMsg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        failed.push(`${item.streetName}: ${errMsg}`);
        await prisma.streetQueue.updateMany({
          where: { streetSlug: item.streetSlug },
          data: {
            status: "failed",
            lastError: errMsg,
            attempts: { increment: 1 },
          },
        });
        console.error(`Failed to generate ${item.streetName}:`, result.reason);
      }
    }

    if (i + 10 < toBuild.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return NextResponse.json({
    processed: built.length + failed.length,
    built,
    skipped,
    failed,
    // DEC-NEW-PAGE-CAP: reported, never silent. A run that defers is a run that hit the cap,
    // and the difference between "nothing to build" and "not allowed to build yet" has to be
    // readable from the response or the cap looks like a stalled queue.
    newPageCap: { limit: NEW_PAGES_PER_DAY, createdToday, remaining: newPageBudget, deferred },
    durationMs: Date.now() - start,
  });
}
