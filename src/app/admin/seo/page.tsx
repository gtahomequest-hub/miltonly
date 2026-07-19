import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyAdminCookieValue } from "@/lib/adminAuth";
import AdminSeoClient from "./AdminSeoClient";

// Organic growth loop piece 3 — the SEO approval queue. Same gate pattern as
// /admin/review (miltonly_admin cookie via /api/admin/auth). Approve/Reject
// only write status + audit log; enqueueing is piece 4.
export const dynamic = "force-dynamic";

export default async function AdminSeoPage() {
  const cookieStore = cookies();
  const isAuth = verifyAdminCookieValue(cookieStore.get("miltonly_admin")?.value);
  if (!isAuth) {
    // Reuse the review page's login flow: send the operator there to sign in.
    return (
      <div className="min-h-screen bg-[#07111f] flex items-center justify-center">
        <div className="bg-[#0c1e35] border border-[#1e3a5f] rounded-2xl p-8 w-full max-w-sm text-center">
          <h1 className="text-[20px] font-extrabold text-[#f8f9fb] mb-2">Miltonly Admin</h1>
          <p className="text-[12px] text-[#64748b] mb-4">
            Sign in on the review page first — the session covers this queue too.
          </p>
          <a
            href="/admin/review"
            className="inline-block bg-[#f59e0b] text-[#07111f] text-[13px] font-extrabold rounded-lg px-5 py-2.5 hover:bg-[#eab308] transition-colors"
          >
            Go to sign-in
          </a>
        </div>
      </div>
    );
  }

  const rows = await prisma.seoOpportunity.findMany({ orderBy: { impressions: "desc" } });
  const lastSense = await prisma.senseRun.findFirst({
    where: { finishedAt: { not: null }, error: null },
    orderBy: { startedAt: "desc" },
  });

  const statusCounts: Record<string, number> = {};
  const classCounts: Record<string, number> = {};
  for (const r of rows) {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    classCounts[r.class] = (classCounts[r.class] || 0) + 1;
  }

  return (
    <AdminSeoClient
      rows={rows.map((r) => ({
        id: r.id,
        query: r.query,
        cls: r.class,
        entityType: r.entityType,
        entitySlug: r.entitySlug,
        targetPage: r.targetPage,
        impressions: r.impressions,
        clicks: r.clicks,
        position: r.position,
        prevImpressions: r.prevImpressions,
        prevPosition: r.prevPosition,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }))}
      statusCounts={statusCounts}
      classCounts={classCounts}
      lastSenseAt={lastSense?.startedAt.toISOString() ?? null}
      killSwitchOn={process.env.ORGANIC_LOOP_ENABLED === "true"}
    />
  );
}
