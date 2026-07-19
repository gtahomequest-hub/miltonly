import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Organic growth loop piece 3 — approve/reject SeoOpportunity rows.
// STATUS + AUDIT LOG ONLY: no streetQueue writes, no generation (piece 4
// wires approve -> enqueue). Transitions are allowed FROM pending only.
export async function POST(request: NextRequest) {
  const adminCookie = request.cookies.get("miltonly_admin");
  if (adminCookie?.value !== "1") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { ids?: unknown; action?: unknown };
  const action = body.action === "approve" ? "approved" : body.action === "reject" ? "rejected" : null;
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 200) : [];
  if (!action || ids.length === 0) {
    return NextResponse.json({ error: "Expected { ids: string[], action: 'approve'|'reject' }" }, { status: 400 });
  }

  // Only pending rows transition; approved/rejected/auto_queued/done are final
  // for this surface. Fetch first so the audit log records exactly what moved.
  const rows = await prisma.seoOpportunity.findMany({
    where: { id: { in: ids }, status: "pending" },
    select: { id: true, query: true, class: true, entitySlug: true },
  });
  if (rows.length > 0) {
    await prisma.seoOpportunity.updateMany({
      where: { id: { in: rows.map((r) => r.id) }, status: "pending" },
      data: { status: action },
    });
    await prisma.seoActionLog.createMany({
      data: rows.map((r) => ({
        action: `seo_${action}`,
        opportunityId: r.id,
        detail: { by: "admin", query: r.query, class: r.class, entitySlug: r.entitySlug },
      })),
    });
  }

  return NextResponse.json({ updated: rows.length, skipped: ids.length - rows.length });
}
