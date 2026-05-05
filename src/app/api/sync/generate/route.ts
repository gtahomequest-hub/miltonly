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

  const toBuild: { streetSlug: string; streetName: string }[] = [];

  for (const item of pending) {
    const decision = await makeStreetDecision(item.streetSlug, item.streetName);
    if (decision === "build" || decision === "regenerate") {
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
    durationMs: Date.now() - start,
  });
}
