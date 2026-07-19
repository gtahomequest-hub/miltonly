import { NextRequest, NextResponse } from "next/server";
import { verifyAdminCookieValue } from "@/lib/adminAuth";
import { prisma } from "@/lib/prisma";
import { runAct } from "@/lib/seo/act";

// Organic growth loop piece 3 — approve/reject SeoOpportunity rows.
// STATUS + AUDIT LOG ONLY: no streetQueue writes, no generation (piece 4
// wires approve -> enqueue). Transitions are allowed FROM pending only.
export async function POST(request: NextRequest) {
  if (!verifyAdminCookieValue(request.cookies.get("miltonly_admin")?.value)) {
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

  // Approving THIN_ENTITY rows also runs the ACT enqueuer immediately, so a
  // manual approval works ahead of the weekly sweep. Same gates, cap, and
  // audit trail as the weekly run; kill switch off -> status-only (reported).
  let act: Awaited<ReturnType<typeof runAct>> | null = null;
  if (action === "approved") {
    const thinIds = rows.filter((r) => r.class === "THIN_ENTITY").map((r) => r.id);
    if (thinIds.length > 0) act = await runAct("approve", thinIds);
  }

  return NextResponse.json({
    updated: rows.length,
    skipped: ids.length - rows.length,
    act: act
      ? { enqueued: act.enqueued, skipped: act.skipped, capRemaining: act.capRemaining, killSwitchOn: act.killSwitchOn }
      : null,
  });
}
