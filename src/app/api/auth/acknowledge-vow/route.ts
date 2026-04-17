// POST /api/auth/acknowledge-vow — records a user's bona-fide-interest
// acknowledgement. Required before any VOW data is rendered for that user.
//
// Captures four fields per VOW agreement §3.2 + §6.3(k) compliance:
//   vowAcknowledgedAt           — server-side timestamp (NOT client-supplied)
//   vowAcknowledgementText      — literal text the user saw (server-side constant;
//                                  snapshotted so future text changes don't erase
//                                  what a given user actually agreed to)
//   vowAcknowledgementIp        — from x-forwarded-for / x-real-ip
//   vowAcknowledgementUserAgent — from user-agent header

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { VOW_ACKNOWLEDGEMENT_TEXT } from "@/lib/vow-acknowledgement";

export const dynamic = "force-dynamic";

function getIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Idempotent — re-acknowledging doesn't overwrite the original timestamp
  // (first acknowledgement is the legally meaningful one).
  if (user.vowAcknowledgedAt) {
    return NextResponse.json({
      ok: true,
      alreadyAcknowledged: true,
      at: user.vowAcknowledgedAt,
    });
  }

  const ip = getIp(req);
  const userAgent = req.headers.get("user-agent") || "unknown";

  await prisma.user.update({
    where: { id: user.id },
    data: {
      vowAcknowledgedAt: new Date(),
      vowAcknowledgementText: VOW_ACKNOWLEDGEMENT_TEXT,
      vowAcknowledgementIp: ip,
      vowAcknowledgementUserAgent: userAgent,
    },
  });

  return NextResponse.json({ ok: true });
}
