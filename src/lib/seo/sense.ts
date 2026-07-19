// src/lib/seo/sense.ts
// SENSE orchestration for the organic growth loop (piece 1): weekly keyword
// classification + light-mode coverage, writing SeoOpportunity / SenseRun /
// SeoActionLog rows. NO generation, NO streetQueue writes — later pieces act
// on what this fills.
import { prisma } from "@/lib/prisma";
import {
  getSearchConsole,
  fetchSitemapUrls,
  GSC_PROPERTY,
  APEX,
  dayStr,
  normUrl,
  type SearchConsole,
} from "./gscClient";
import { buildEntities, classifyKeywords, pullKeywordData } from "./keywords";

const COVERAGE_STATE_ID = "coverage";
// Weekly inspection budget. Sized for the 300s Vercel maxDuration: measured
// first-run throughput is ~1.5s/inspection effective, and keywords + upserts
// need ~60-90s, so 120 keeps a full backlog run inside the window (the
// 200-cap first run took ~400s locally). Quota-trivial (~2000/day).
const LIGHT_INSPECTION_CAP = 120;
const STATE_CHECKPOINT_EVERY = 50; // persist mid-run so a killed run resumes

interface CoverageRecord {
  cls: string;
  coverageState: string | null;
  inspectedAt: string;
  error?: string;
}
interface CoverageStateJson {
  inspected: Record<string, CoverageRecord>;
}

export interface SenseSummary {
  senseRunId: string;
  keywordRows: number;
  coverageInspected: number;
  indexedCount: number;
  opportunities: { created: number; updated: number; byClass: Record<string, number> };
  skipped?: string;
}

// coverageState sentence -> INDEXED or a compact class (same sentence mapping
// as scripts/gsc-coverage-audit.ts; the CLI audit remains the detailed
// diagnostic — sense only needs indexed-or-not plus a label for the state).
function coverageClass(coverageState: string | null | undefined): string {
  const c = (coverageState || "").toLowerCase();
  if (c.includes("submitted and indexed") || c.startsWith("indexed")) return "INDEXED";
  if (c.startsWith("crawled")) return "CRAWLED_NOT_INDEXED";
  if (c.startsWith("discovered")) return "DISCOVERED_NOT_CRAWLED";
  if (c.includes("duplicate")) return "CANONICAL_CONFLICT";
  if (c.includes("redirect")) return "REDIRECT_ERROR";
  if (c.includes("soft 404")) return "SOFT_404";
  if (c.includes("server error") || c.includes("5xx")) return "SERVER_ERROR";
  if (c.includes("blocked") || c.includes("noindex") || c.includes("unauthorized") || c.includes("not found (404)")) return "BLOCKED";
  if (c.includes("unknown to google")) return "UNKNOWN_TO_GOOGLE";
  return "UNKNOWN";
}

async function lightCoverage(
  sc: SearchConsole,
  sitemapUrls: string[],
): Promise<{ inspected: number; indexedCount: number }> {
  // Positive set: pages with impressions in the last 30 days = indexed for free.
  const positives = new Set<string>();
  try {
    const res = await sc.searchanalytics.query({
      siteUrl: GSC_PROPERTY,
      requestBody: { startDate: dayStr(32), endDate: dayStr(2), dimensions: ["page"], rowLimit: 25000 },
    });
    for (const row of res.data.rows || []) {
      if ((row.impressions || 0) > 0 && row.keys && row.keys[0]) positives.add(normUrl(row.keys[0]));
    }
  } catch {
    /* fail-soft: with no positives everything is residual; the cap still binds */
  }

  const positiveInSitemap = sitemapUrls.filter((u) => positives.has(u));
  const residual = sitemapUrls.filter((u) => !positives.has(u));

  // Resume state (serverless-durable replacement for the CLI's local state.json).
  const stateRow = await prisma.seoCoverageState.findUnique({ where: { id: COVERAGE_STATE_ID } });
  const state: CoverageStateJson =
    stateRow && typeof stateRow.stateJson === "object" && stateRow.stateJson !== null
      ? (stateRow.stateJson as unknown as CoverageStateJson)
      : { inspected: {} };
  if (!state.inspected) state.inspected = {};

  const isDone = (u: string) => {
    const r = state.inspected[u];
    return Boolean(r) && r.cls !== "INSPECT_ERROR";
  };
  const pending = residual.filter((u) => !isDone(u));
  const batch = pending.slice(0, LIGHT_INSPECTION_CAP);

  let idx = 0;
  let spent = 0;
  const saveState = async () => {
    await prisma.seoCoverageState.upsert({
      where: { id: COVERAGE_STATE_ID },
      create: { id: COVERAGE_STATE_ID, stateJson: state as unknown as object },
      update: { stateJson: state as unknown as object },
    });
  };
  async function worker(): Promise<void> {
    for (;;) {
      const i = idx++;
      if (i >= batch.length) return;
      const url = batch[i];
      try {
        const res = await sc.urlInspection.index.inspect({
          requestBody: { inspectionUrl: url, siteUrl: GSC_PROPERTY },
        });
        const r = (res.data.inspectionResult || {}).indexStatusResult || {};
        state.inspected[url] = {
          cls: coverageClass(r.coverageState),
          coverageState: r.coverageState || null,
          inspectedAt: new Date().toISOString(),
        };
      } catch (e) {
        state.inspected[url] = {
          cls: "INSPECT_ERROR",
          coverageState: null,
          inspectedAt: new Date().toISOString(),
          error: (e instanceof Error ? e.message : String(e)).slice(0, 160),
        };
      }
      spent++;
      // Mid-run checkpoint: a run killed at maxDuration resumes next week
      // instead of re-inspecting the same batch (livelock on backlog).
      if (spent % STATE_CHECKPOINT_EVERY === 0) await saveState();
      await new Promise((r2) => setTimeout(r2, 120));
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);

  // Prune state entries that left the sitemap.
  const inSitemap = new Set(sitemapUrls);
  for (const u of Object.keys(state.inspected)) {
    if (!inSitemap.has(u)) delete state.inspected[u];
  }

  await prisma.seoCoverageState.upsert({
    where: { id: COVERAGE_STATE_ID },
    create: { id: COVERAGE_STATE_ID, stateJson: state as unknown as object },
    update: { stateJson: state as unknown as object },
  });

  const indexedFromInspection = residual.filter((u) => state.inspected[u]?.cls === "INDEXED").length;
  return { inspected: spent, indexedCount: positiveInSitemap.length + indexedFromInspection };
}

export async function runSense(): Promise<SenseSummary> {
  const run = await prisma.senseRun.create({ data: { coverageMode: "light" } });
  await prisma.seoActionLog.create({
    data: { action: "sense_run_started", detail: { senseRunId: run.id } },
  });

  try {
    const sc = getSearchConsole();
    const sitemapUrls = await fetchSitemapUrls();
    const entities = buildEntities(sitemapUrls.map((u) => u.replace(APEX, "") || "/"));

    // 1) Keywords: 90d pulls + shared classifier.
    const { qRows, qpRows } = await pullKeywordData(sc);
    const classified = classifyKeywords(qRows, qpRows, entities);

    // 2) THIN_ENTITY overlay: query maps to a street whose Phase 4.1
    //    generation has never succeeded (legacy/placeholder page) — the
    //    strongest future auto-tier candidates. Street entities only (v1).
    const streetSlugOf = (p: string | null) => (p && p.startsWith("/streets/") ? p.slice("/streets/".length) : null);
    const candidateSlugs = new Set<string>();
    for (const c of classified) {
      const s = streetSlugOf(c.shouldOwn) ?? streetSlugOf(c.topPage);
      if (s && !c.branded && c.cls !== "WINNING" && c.impressions >= 5) candidateSlugs.add(s);
    }
    const succeeded = new Set(
      (
        await prisma.streetGeneration.findMany({
          where: { streetSlug: { in: Array.from(candidateSlugs) }, status: "succeeded" },
          select: { streetSlug: true },
        })
      ).map((r) => r.streetSlug),
    );

    // 3) Upsert opportunities (dedupe by query+class; metrics refresh on
    //    re-runs, status is NEVER touched here). Branded + WINNING excluded.
    let created = 0;
    let updated = 0;
    const byClass: Record<string, number> = {};
    for (const c of classified) {
      if (c.branded || c.cls === "WINNING" || c.cls === "OTHER") continue;
      const entitySlug = streetSlugOf(c.shouldOwn) ?? streetSlugOf(c.topPage);
      const isThin = entitySlug !== null && !succeeded.has(entitySlug);
      const cls = isThin ? "THIN_ENTITY" : c.cls;
      const entityType = entitySlug ? "street" : "none";
      const targetPage = c.shouldOwn ?? c.topPage;

      const existing = await prisma.seoOpportunity.findUnique({
        where: { query_class: { query: c.query, class: cls } },
        select: { id: true },
      });
      const row = await prisma.seoOpportunity.upsert({
        where: { query_class: { query: c.query, class: cls } },
        create: {
          query: c.query,
          class: cls,
          entityType,
          entitySlug,
          targetPage,
          impressions: c.impressions,
          clicks: c.clicks,
          position: c.position,
          senseRunId: run.id,
        },
        update: {
          entityType,
          entitySlug,
          targetPage,
          impressions: c.impressions,
          clicks: c.clicks,
          position: c.position,
          senseRunId: run.id,
        },
      });
      if (existing) updated++;
      else {
        created++;
        await prisma.seoActionLog.create({
          data: {
            action: "opportunity_created",
            opportunityId: row.id,
            detail: { query: c.query, class: cls, entitySlug, targetPage, impressions: c.impressions },
          },
        });
      }
      byClass[cls] = (byClass[cls] || 0) + 1;
    }

    // 4) Light coverage (positives refresh + capped inspection, resumable).
    const cov = await lightCoverage(sc, sitemapUrls);

    await prisma.senseRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        keywordRows: classified.length,
        coverageInspected: cov.inspected,
        indexedCount: cov.indexedCount,
      },
    });
    await prisma.seoActionLog.create({
      data: {
        action: "sense_run_finished",
        detail: {
          senseRunId: run.id,
          keywordRows: classified.length,
          opportunitiesCreated: created,
          opportunitiesUpdated: updated,
          byClass,
          coverageInspected: cov.inspected,
          indexedCount: cov.indexedCount,
        },
      },
    });

    return {
      senseRunId: run.id,
      keywordRows: classified.length,
      coverageInspected: cov.inspected,
      indexedCount: cov.indexedCount,
      opportunities: { created, updated, byClass },
    };
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).slice(0, 400);
    await prisma.senseRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), error: msg },
    });
    await prisma.seoActionLog.create({
      data: { action: "sense_run_failed", detail: { senseRunId: run.id, error: msg } },
    });
    throw e;
  }
}
