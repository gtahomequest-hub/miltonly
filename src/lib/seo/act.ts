// src/lib/seo/act.ts
// Organic growth loop piece 4 - the ACT auto tier (the enqueuer). Runs
// inside the weekly sense flow (chosen over a separate cron: same run
// context, same kill switch, zero extra schedule surface) and from the
// admin approve action for THIN_ENTITY rows.
//
// The ONLY write is a streetQueue row - the existing hourly
// /api/sync/generate drain runs makeStreetDecision + Phase 4.1 v4-flash +
// the grounding gate exactly as it does for every human-triggered
// generation. Publish authority never moves.
//
// Safety chain (every gate, in order):
//   1. ORGANIC_LOOP_ENABLED kill switch (checked HERE as well as at the
//      route - approve-path calls skip enqueueing when the loop is off).
//   2. Class THIN_ENTITY only (branded/WINNING never become opportunities,
//      let alone THIN_ENTITY - structurally excluded upstream in sense).
//   3. Street must exist in ResidentialStreet (no page invention).
//   4. PRE-FILTER: any street with a succeeded StreetGeneration is OUT -
//      never auto-regenerate a published Phase 4.1 page, never trust the
//      drain to catch it.
//   5. No double-enqueue: existing pending/processing streetQueue row skips.
//   6. Weekly cap: max 10 act_enqueued in the trailing 7 days.
//   7. Every enqueue audit-logged (opportunity -> queue id).
import { prisma } from "@/lib/prisma";

export const ACT_WEEKLY_CAP = 10;

export interface ActResult {
  enqueued: Array<{ opportunityId: string; streetSlug: string; queueId: string }>;
  skipped: Array<{ opportunityId: string; streetSlug: string | null; reason: string }>;
  capRemaining: number;
  killSwitchOn: boolean;
}

export async function runAct(trigger: "sense" | "approve", opportunityIds?: string[]): Promise<ActResult> {
  const killSwitchOn = process.env.ORGANIC_LOOP_ENABLED === "true";
  const result: ActResult = { enqueued: [], skipped: [], capRemaining: 0, killSwitchOn };
  if (!killSwitchOn) return result; // gate 1 - no autonomy writes at all

  // Gate 6: weekly cap from the audit log (append-only, survives status churn).
  const weekAgo = new Date(Date.now() - 7 * 86400000);
  const usedThisWeek = await prisma.seoActionLog.count({
    where: { action: "act_enqueued", createdAt: { gte: weekAgo } },
  });
  let remaining = Math.max(0, ACT_WEEKLY_CAP - usedThisWeek);
  result.capRemaining = remaining;
  if (remaining === 0) return result;

  // Gate 2: THIN_ENTITY only; pending (weekly sweep) or approved (manual).
  const candidates = await prisma.seoOpportunity.findMany({
    where: {
      class: "THIN_ENTITY",
      status: { in: ["pending", "approved"] },
      entityType: "street",
      entitySlug: { not: null },
      ...(opportunityIds ? { id: { in: opportunityIds } } : {}),
    },
    orderBy: { impressions: "desc" },
  });

  for (const opp of candidates) {
    if (remaining === 0) {
      result.skipped.push({ opportunityId: opp.id, streetSlug: opp.entitySlug, reason: "weekly_cap_reached" });
      continue;
    }
    const slug = opp.entitySlug as string;

    // Gate 3: the street must exist in the entity table.
    const street = await prisma.residentialStreet.findUnique({
      where: { slug },
      select: { slug: true, name: true },
    });
    if (!street) {
      result.skipped.push({ opportunityId: opp.id, streetSlug: slug, reason: "no_residential_street_row" });
      continue;
    }

    // Gate 4: published Phase 4.1 page -> NEVER auto-regenerate.
    const gen = await prisma.streetGeneration.findUnique({
      where: { streetSlug: slug },
      select: { status: true },
    });
    if (gen?.status === "succeeded") {
      result.skipped.push({ opportunityId: opp.id, streetSlug: slug, reason: "published_phase41_prefilter" });
      continue;
    }

    // Gate 5: no double-enqueue while a row is live in the drain.
    const existingQueue = await prisma.streetQueue.findUnique({ where: { streetSlug: slug } });
    if (existingQueue && (existingQueue.status === "pending" || existingQueue.status === "processing")) {
      result.skipped.push({ opportunityId: opp.id, streetSlug: slug, reason: "already_in_queue" });
      continue;
    }

    // ENQUEUE - the only write the auto tier ever makes. Re-arm a previously
    // terminal queue row (done/failed/ineligible) or create fresh.
    const queueRow = existingQueue
      ? await prisma.streetQueue.update({
          where: { streetSlug: slug },
          data: { status: "pending", attempts: 0, lastError: null, processedAt: null },
        })
      : await prisma.streetQueue.create({
          data: { streetSlug: slug, streetName: street.name, status: "pending" },
        });

    await prisma.seoOpportunity.update({ where: { id: opp.id }, data: { status: "auto_queued" } });
    await prisma.seoActionLog.create({
      data: {
        action: "act_enqueued",
        opportunityId: opp.id,
        detail: {
          trigger,
          streetSlug: slug,
          streetName: street.name,
          queueId: queueRow.id,
          query: opp.query,
          impressions: opp.impressions,
        },
      },
    });
    result.enqueued.push({ opportunityId: opp.id, streetSlug: slug, queueId: queueRow.id });
    remaining--;
    result.capRemaining = remaining;
  }

  return result;
}
