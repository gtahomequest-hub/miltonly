// src/app/api/jobs/warm-hubs/route.ts
//
// MC-027 item 2 (MA-005 defect 5). Every hub page reads DB2 and DB3 under the db2/db3 tags,
// and the sold sync and the three analytics jobs drop those tags after they write, so the next
// visitor of each of the 22 hubs rendered it synchronously, 2.4 to 4.0 s, and that visitor was
// often Googlebot. This job walks the 22 published hub paths once, in order, so the route cache
// is warm before a reader arrives. It runs from the crons a few minutes after each of those
// jobs (vercel.json), and it can be called after any tag drop. The build prerenders the same
// 22 pages, which covers a deploy.
//
// Auth via Authorization: Bearer <CRON_SECRET> OR ?secret=<CRON_SECRET>, as the other jobs.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const secret = url.searchParams.get("secret");
  const expected = process.env.CRON_SECRET;
  if (!expected || (bearer !== expected && secret !== expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const base = url.searchParams.get("base") || config.SITE_URL;
  const hubs = await prisma.hubContent.findMany({ where: { status: "published" }, select: { neighbourhoodSlug: true }, orderBy: { neighbourhoodSlug: "asc" } });
  const t0 = Date.now();
  const walked: Array<{ slug: string; status: number; ms: number; cache: string | null }> = [];
  for (const h of hubs) {
    const t = Date.now();
    try {
      const r = await fetch(`${base}/neighbourhoods/${h.neighbourhoodSlug}`, { headers: { "user-agent": "miltonly-warm-hubs" }, cache: "no-store" });
      await r.arrayBuffer();
      walked.push({ slug: h.neighbourhoodSlug, status: r.status, ms: Date.now() - t, cache: r.headers.get("x-vercel-cache") });
    } catch (e) {
      walked.push({ slug: h.neighbourhoodSlug, status: 0, ms: Date.now() - t, cache: String((e as Error).message).slice(0, 60) });
    }
  }
  return NextResponse.json({ ok: true, hubs: walked.length, seconds: Math.round((Date.now() - t0) / 1000), walked });
}
