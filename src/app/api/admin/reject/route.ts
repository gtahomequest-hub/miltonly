import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookieValue } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  if (!verifyAdminCookieValue(request.cookies.get("miltonly_admin")?.value)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { streetSlug, reviewNotes } = await request.json();
  if (!streetSlug) {
    return NextResponse.json({ error: "Missing streetSlug" }, { status: 400 });
  }

  await prisma.streetContent.update({
    where: { streetSlug },
    data: {
      status: "rejected",
      reviewNotes: reviewNotes || null,
    },
  });

  return NextResponse.json({ ok: true, streetSlug });
}
