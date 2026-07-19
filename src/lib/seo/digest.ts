// src/lib/seo/digest.ts
// Organic growth loop piece 2 — the weekly digest. READS what sense stored
// (SenseRun + SeoOpportunity + SeoActionLog); never calls GSC. Sends ONE
// email via the existing Resend transport (same FROM/TO as lead alerts).
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";

interface DigestData {
  runNow: {
    id: string;
    finishedAt: Date | null;
    startedAt: Date;
    indexedCount: number | null;
    totalImpressions: number | null;
    totalClicks: number | null;
    error: string | null;
  } | null;
  runPrev: { indexedCount: number | null; totalImpressions: number | null; totalClicks: number | null } | null;
  pendingCount: number;
  statusCounts: Record<string, number>;
  newSinceLastDigest: { count: number; byClass: Record<string, number>; top: Array<{ query: string; class: string; impressions: number; position: number; targetPage: string | null }> };
  movers: Array<{ query: string; impressions: number; prevImpressions: number; position: number; delta: number }>;
  thinEntities: Array<{ query: string; entitySlug: string | null; impressions: number; position: number }>;
  killSwitchOn: boolean;
}

const delta = (now: number | null, prev: number | null): string => {
  if (now === null) return "n/a";
  if (prev === null) return `${now} (no prior week)`;
  const d = now - prev;
  return `${now} (${d >= 0 ? "+" : ""}${d} vs last week)`;
};

export async function collectDigestData(): Promise<DigestData> {
  const finishedRuns = await prisma.senseRun.findMany({
    where: { finishedAt: { not: null }, error: null },
    orderBy: { startedAt: "desc" },
    take: 2,
  });
  const runNow = finishedRuns[0] ?? null;
  const runPrev = finishedRuns[1] ?? null;

  const statusGroups = await prisma.seoOpportunity.groupBy({ by: ["status"], _count: true });
  const statusCounts: Record<string, number> = {};
  for (const g of statusGroups) statusCounts[g.status] = g._count;

  // "New since last digest": createdAt after the previous digest_sent log
  // (first digest: everything is new).
  const lastDigest = await prisma.seoActionLog.findFirst({
    where: { action: "digest_sent" },
    orderBy: { createdAt: "desc" },
  });
  const newRows = await prisma.seoOpportunity.findMany({
    where: lastDigest ? { createdAt: { gt: lastDigest.createdAt } } : {},
    orderBy: { impressions: "desc" },
  });
  const byClass: Record<string, number> = {};
  for (const r of newRows) byClass[r.class] = (byClass[r.class] || 0) + 1;

  // Movers: tracked opportunities with a prior-week baseline, by |impression change|.
  const withPrev = await prisma.seoOpportunity.findMany({
    where: { prevImpressions: { not: null } },
  });
  const movers = withPrev
    .map((r) => ({
      query: r.query,
      impressions: r.impressions,
      prevImpressions: r.prevImpressions as number,
      position: r.position,
      delta: r.impressions - (r.prevImpressions as number),
    }))
    .filter((m) => m.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5);

  const thinEntities = (
    await prisma.seoOpportunity.findMany({
      where: { class: "THIN_ENTITY", status: "pending" },
      orderBy: { impressions: "desc" },
      take: 10,
    })
  ).map((r) => ({ query: r.query, entitySlug: r.entitySlug, impressions: r.impressions, position: r.position }));

  return {
    runNow,
    runPrev,
    pendingCount: statusCounts["pending"] ?? 0,
    statusCounts,
    newSinceLastDigest: {
      count: newRows.length,
      byClass,
      top: newRows.slice(0, 3).map((r) => ({
        query: r.query,
        class: r.class,
        impressions: r.impressions,
        position: r.position,
        targetPage: r.targetPage,
      })),
    },
    movers,
    thinEntities,
    killSwitchOn: process.env.ORGANIC_LOOP_ENABLED === "true",
  };
}

export function renderDigestText(d: DigestData): string {
  const L: string[] = [];
  L.push(`MILTONLY SEO WEEKLY - ${new Date().toISOString().slice(0, 10)}`);
  L.push("");
  L.push("HEADLINE");
  L.push(`  indexed pages : ${delta(d.runNow?.indexedCount ?? null, d.runPrev?.indexedCount ?? null)}`);
  L.push(`  impressions   : ${delta(d.runNow?.totalImpressions ?? null, d.runPrev?.totalImpressions ?? null)}`);
  L.push(`  clicks        : ${delta(d.runNow?.totalClicks ?? null, d.runPrev?.totalClicks ?? null)}`);
  L.push(`  pending opportunities: ${d.pendingCount}`);
  L.push("");
  L.push("MOVERS (top impression change, week over week)");
  if (d.movers.length === 0) L.push("  none yet - first tracked week has no baseline");
  for (const m of d.movers) {
    L.push(`  ${m.delta >= 0 ? "+" : ""}${m.delta}  "${m.query}"  ${m.prevImpressions} -> ${m.impressions} impr, pos ${m.position.toFixed(1)}`);
  }
  L.push("");
  L.push(`NEW OPPORTUNITIES since last digest: ${d.newSinceLastDigest.count}`);
  for (const [cls, n] of Object.entries(d.newSinceLastDigest.byClass)) L.push(`  ${cls}: ${n}`);
  for (const t of d.newSinceLastDigest.top) {
    L.push(`  * "${t.query}" [${t.class}] ${t.impressions} impr, pos ${t.position.toFixed(1)}${t.targetPage ? `, riding ${t.targetPage}` : ""}`);
  }
  L.push("");
  L.push(`THIN-ENTITY SPOTLIGHT (auto-generation candidates, awaiting piece 4): ${d.thinEntities.length}`);
  for (const t of d.thinEntities) {
    L.push(`  ${t.entitySlug ?? "?"}  <- "${t.query}" (${t.impressions} impr, pos ${t.position.toFixed(1)})`);
  }
  L.push("");
  L.push("QUEUE STATE");
  for (const [s, n] of Object.entries(d.statusCounts)) L.push(`  ${s}: ${n}`);
  L.push("");
  const run = d.runNow;
  const durS = run?.finishedAt ? Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / 1000) : null;
  L.push(
    `loop ${d.killSwitchOn ? "ENABLED" : "DISABLED (kill switch)"} | last sense: ${
      run ? `${run.error ? "FAILED" : "ok"}${durS !== null ? `, ${durS}s` : ""}, ${run.startedAt.toISOString().slice(0, 16)}Z` : "never ran"
    }`,
  );
  return L.join("\n");
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderDigestHtml(d: DigestData): string {
  const th = `style="text-align:left;padding:6px 10px;border-bottom:1px solid #dfe0dc;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b6f6a;"`;
  const td = `style="padding:6px 10px;border-bottom:1px solid #f0f0ed;font-size:13px;color:#292b29;"`;
  const h3 = `style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#017848;margin:22px 0 8px;"`;
  const run = d.runNow;
  const durS = run?.finishedAt ? Math.round((run.finishedAt.getTime() - run.startedAt.getTime()) / 1000) : null;

  const moversRows = d.movers.length
    ? d.movers
        .map(
          (m) =>
            `<tr><td ${td}>${m.delta >= 0 ? "+" : ""}${m.delta}</td><td ${td}>${esc(m.query)}</td><td ${td}>${m.prevImpressions} &rarr; ${m.impressions}</td><td ${td}>${m.position.toFixed(1)}</td></tr>`,
        )
        .join("")
    : `<tr><td ${td} colspan="4">none yet — first tracked week has no baseline</td></tr>`;

  const newTop = d.newSinceLastDigest.top
    .map(
      (t) =>
        `<tr><td ${td}>${esc(t.query)}</td><td ${td}>${t.class}</td><td ${td}>${t.impressions}</td><td ${td}>${t.position.toFixed(1)}</td><td ${td}>${esc(t.targetPage ?? "-")}</td></tr>`,
    )
    .join("");

  const thinRows = d.thinEntities.length
    ? d.thinEntities
        .map(
          (t) =>
            `<tr><td ${td}>${esc(t.entitySlug ?? "?")}</td><td ${td}>${esc(t.query)}</td><td ${td}>${t.impressions}</td><td ${td}>${t.position.toFixed(1)}</td></tr>`,
        )
        .join("")
    : `<tr><td ${td} colspan="4">none pending</td></tr>`;

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#fffdfa;">
    <div style="background:linear-gradient(180deg,#051f15,#073126);padding:18px 22px;border-radius:12px 12px 0 0;">
      <div style="color:#fff;font-size:18px;font-weight:600;">Milton<span style="color:#00ff80;">ly</span> — SEO Weekly</div>
      <div style="color:rgba(255,255,255,.7);font-size:12px;margin-top:2px;">${new Date().toISOString().slice(0, 10)} · organic growth loop</div>
    </div>
    <div style="padding:18px 22px;border:1px solid #dfe0dc;border-top:0;border-radius:0 0 12px 12px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td ${td}><b>Indexed pages</b></td><td ${td}>${esc(delta(run?.indexedCount ?? null, d.runPrev?.indexedCount ?? null))}</td></tr>
        <tr><td ${td}><b>Impressions (90d window)</b></td><td ${td}>${esc(delta(run?.totalImpressions ?? null, d.runPrev?.totalImpressions ?? null))}</td></tr>
        <tr><td ${td}><b>Clicks (90d window)</b></td><td ${td}>${esc(delta(run?.totalClicks ?? null, d.runPrev?.totalClicks ?? null))}</td></tr>
        <tr><td ${td}><b>Pending opportunities</b></td><td ${td}>${d.pendingCount}</td></tr>
      </table>

      <h3 ${h3}>Movers — week over week</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr><th ${th}>&Delta;</th><th ${th}>Query</th><th ${th}>Impr</th><th ${th}>Pos</th></tr>
        ${moversRows}
      </table>

      <h3 ${h3}>New opportunities: ${d.newSinceLastDigest.count}</h3>
      <div style="font-size:12px;color:#6b6f6a;margin-bottom:6px;">${Object.entries(d.newSinceLastDigest.byClass)
        .map(([c, n]) => `${c}: ${n}`)
        .join(" &middot; ") || "none"}</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><th ${th}>Query</th><th ${th}>Class</th><th ${th}>Impr</th><th ${th}>Pos</th><th ${th}>Riding</th></tr>
        ${newTop}
      </table>

      <h3 ${h3}>Thin-entity spotlight (auto-gen candidates)</h3>
      <table style="width:100%;border-collapse:collapse;">
        <tr><th ${th}>Street</th><th ${th}>Query</th><th ${th}>Impr</th><th ${th}>Pos</th></tr>
        ${thinRows}
      </table>

      <h3 ${h3}>Queue state</h3>
      <div style="font-size:13px;color:#292b29;">${Object.entries(d.statusCounts)
        .map(([s, n]) => `${s}: <b>${n}</b>`)
        .join(" &middot; ") || "empty"}</div>

      <div style="margin-top:20px;padding-top:12px;border-top:1px solid #dfe0dc;font-size:11px;color:#6b6f6a;">
        loop ${d.killSwitchOn ? "ENABLED" : "<b>DISABLED (kill switch)</b>"} &middot; last sense: ${
          run ? `${run.error ? "FAILED" : "ok"}${durS !== null ? `, ${durS}s` : ""}, ${run.startedAt.toISOString().slice(0, 16)}Z` : "never ran"
        }
      </div>
    </div>
  </div>`;
}

export async function sendDigest(): Promise<{ sent: boolean; text: string; reason?: string }> {
  const data = await collectDigestData();
  const text = renderDigestText(data);
  const html = renderDigestHtml(data);

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.REALTOR_EMAIL || "";
  if (!apiKey || !to) {
    return { sent: false, text, reason: !apiKey ? "RESEND_API_KEY not set" : "REALTOR_EMAIL not set" };
  }
  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM_EMAIL || `${config.SITE_NAME} <noreply@${config.SITE_DOMAIN}>`;

  const result = await resend.emails.send({
    from,
    to,
    subject: `Miltonly SEO Weekly — ${new Date().toISOString().slice(0, 10)}`,
    html,
    text,
  });
  if (result.error) {
    return { sent: false, text, reason: String(result.error.message ?? result.error).slice(0, 200) };
  }

  await prisma.seoActionLog.create({
    data: {
      action: "digest_sent",
      detail: {
        emailId: result.data?.id ?? null,
        pending: data.pendingCount,
        newOpportunities: data.newSinceLastDigest.count,
        indexedCount: data.runNow?.indexedCount ?? null,
      },
    },
  });
  return { sent: true, text };
}
