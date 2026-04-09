import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSMS } from "@/lib/smsAlert";

export const maxDuration = 30;

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

  const actions: string[] = [];

  // ── CHECK 1: Reset stuck items ──
  const twentyMinAgo = new Date(Date.now() - 20 * 60 * 1000);
  const stuck = await prisma.streetQueue.updateMany({
    where: {
      status: "processing",
      updatedAt: { lt: twentyMinAgo },
    },
    data: { status: "pending" },
  });
  if (stuck.count > 0) {
    actions.push(`Reset ${stuck.count} stuck queue items`);
    console.log(`Monitor: Reset ${stuck.count} stuck queue items`);
  }

  // ── CHECK 2: Repeated failures ──
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const failedCount = await prisma.streetQueue.count({
    where: {
      status: "failed",
      attempts: { gte: 3 },
      createdAt: { gt: twentyFourHoursAgo },
    },
  });
  if (failedCount > 0) {
    await sendSMS(
      `\u26a0 Miltonly: ${failedCount} street pages failed generation.\nCheck admin dashboard.`
    );
    actions.push(`Alerted: ${failedCount} failed generations`);
  }

  // ── CHECK 3: Daily summary (7am UTC = ~3am ET) ──
  const currentHour = new Date().getUTCHours();
  if (currentHour === 11) {
    // 11 UTC = 7am ET
    const draftsWaiting = await prisma.streetContent.count({
      where: { status: "draft", needsReview: true },
    });
    const publishedYesterday = await prisma.streetContent.count({
      where: {
        status: "published",
        publishedAt: { gt: twentyFourHoursAgo },
      },
    });
    const ineligible = await prisma.streetQueue.count({
      where: { status: "ineligible" },
    });

    await sendSMS(
      `\u2600 Miltonly morning summary:\n\u2022 ${draftsWaiting} drafts waiting for your review\n\u2022 ${publishedYesterday} pages published yesterday\n\u2022 ${ineligible} streets ineligible (low data)\nReview: miltonly.vercel.app/admin/review`
    );
    actions.push("Sent daily summary");
  }

  return NextResponse.json({
    ok: true,
    actions,
    stuckReset: stuck.count,
    failedAlerted: failedCount,
  });
}
