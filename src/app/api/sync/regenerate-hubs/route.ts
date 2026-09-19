// src/app/api/sync/regenerate-hubs/route.ts
//
// THE 22 HUBS ON THE REGENERATE-ON-DRIFT CRON (MC-027 item 1, MA-005 defect 1). The street
// tier has queued a page for regeneration since July when its market-data hash moved;
// the hubs had nothing, and every hub served June prose beside live tiles. This route reads
// each published hub's live input (getHubInputCached, the same computation the page renders
// from), folds it through the tolerance rule (src/lib/hubDrift.ts, the hub twin of
// calcMarketDataHash), and regenerates the hubs whose stored hash differs, DeepSeek only, at
// most HUBS_PER_RUN a run so a daily cron cycles the 22 in a week and one bad night cannot
// spend more than a few cents. The generator grounds the new prose against that same input,
// writes the new hash, and revalidates the hub page and index.
//
// Auth via Authorization: Bearer <CRON_SECRET> OR ?secret=<CRON_SECRET>. ?limit=<n> caps a run;
// ?dry=1 reports drift and regenerates nothing.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hubDrift } from "@/lib/hubDrift";
import { generateUrbanHub } from "@/lib/ai/hub/generateUrbanHub";
import { generateRuralHub } from "@/lib/ai/hub/generateRuralHub";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const HUBS_PER_RUN = 3;

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}

async function run(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const secret = req.nextUrl.searchParams.get("secret");
  const expected = process.env.CRON_SECRET;
  if (!expected || (bearer !== expected && secret !== expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const limit = Math.max(0, Math.min(22, Number(req.nextUrl.searchParams.get("limit") ?? HUBS_PER_RUN) || HUBS_PER_RUN));

  const hubs = await prisma.hubContent.findMany({
    where: { status: "published" },
    select: { neighbourhoodSlug: true },
    orderBy: { neighbourhoodSlug: "asc" },
  });
  const profiles = new Map(
    (await prisma.neighbourhood.findMany({ where: { slug: { in: hubs.map((h) => h.neighbourhoodSlug) } }, select: { slug: true, profile: true } })).map((n) => [n.slug, n.profile]),
  );

  const drifted: Array<{ slug: string; reason: string }> = [];
  for (const h of hubs) {
    const d = await hubDrift(h.neighbourhoodSlug);
    if (d.drifted) drifted.push({ slug: h.neighbourhoodSlug, reason: d.reason });
  }

  const regenerated: Array<{ slug: string; published: boolean; attempts: number; costUsd: number | null }> = [];
  const failed: Array<{ slug: string; error: string }> = [];
  if (!dry) {
    for (const d of drifted.slice(0, limit)) {
      try {
        const profile = profiles.get(d.slug);
        const r = profile === "urban_hub"
          ? await generateUrbanHub(d.slug, { primaryProvider: "deepseek", deepseekOnly: true })
          : await generateRuralHub(d.slug, { deepseekOnly: true });
        const gen = await prisma.hubGeneration.findUnique({ where: { neighbourhoodSlug: d.slug }, select: { costUsd: true } });
        regenerated.push({ slug: d.slug, published: r.published, attempts: r.attempts, costUsd: gen?.costUsd == null ? null : Number(gen.costUsd) });
      } catch (e) {
        failed.push({ slug: d.slug, error: String((e as Error).message).slice(0, 160) });
      }
    }
  }
  return NextResponse.json({ ok: true, dry, hubs: hubs.length, drifted, regenerated, failed, remaining: Math.max(0, drifted.length - regenerated.length - failed.length) });
}
