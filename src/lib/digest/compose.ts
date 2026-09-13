import "server-only";
// The weekly leads digest: the reads and the copy.
//
// ONE EMAIL, MONDAY MORNING, TO THE DESK. It answers five questions about the lead layer for
// the week and the four weeks just ended, in this order because it is the order they get
// asked: how many leads and from where, which pages produced them, who is subscribed and
// watching, whether the confirmations and alerts actually went out, and which surfaces went
// quiet. It reports counts, never rates: there is no page-view denominator anywhere in this
// codebase and nothing here should be read as conversion.
//
// WHERE EACH FIGURE COMES FROM, and on which basis (src/lib/digest/window.ts):
//
//   leads by source and by page   public.lead_daily_by_page, production rows only by the
//                                 view's own definition, `day` read on the DATE basis
//   brief subscribers, watches    SavedSearch, env = production, alertEnabled, on the instants
//   confirmations and alerts      LeadActivity rows the ingest path writes on every send
//                                 attempt (email_sent, email_failed), joined to production
//                                 leads, on the instants. The log begins with the deploy
//                                 that introduced it, and the digest says when that was.
//   quiet surfaces                LIVE_SOURCES (src/lib/lead/sources.ts) minus every source
//                                 that produced a production row in the 28 days
//
// PRODUCTION FIGURES FROM WHEREVER IT RUNS. The brief refuses to cross environments because
// it mails subscribers; this mails the desk, and the view it reads is production-only by
// definition, so a preview run reports production figures under a [preview] subject. That is
// what lets the send be proven on a preview deployment against real numbers.

import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { LIVE_SOURCES } from "@/lib/lead/sources";
import type { DigestWindow, DigestPeriod } from "@/lib/digest/window";

export interface CountPair {
  week: number;
  month: number;
}

export interface SourceRow extends CountPair {
  source: string;
  where: string | null;
}

export interface PageRow extends CountPair {
  page: string;
}

export interface WatchRow {
  kind: string;
  active: number;
  newWeek: number;
  newMonth: number;
  /** Watches stamped by a send inside the week. */
  alertedWeek: number;
}

export interface DeliveryRow {
  kind: "confirmation" | "ops_alert";
  sent: CountPair;
  failed: CountPair;
}

export interface DigestData {
  totals: CountPair;
  bySource: SourceRow[];
  byPage: PageRow[];
  brief: { active: number; newWeek: number; newMonth: number; sentWeek: number };
  watches: WatchRow[];
  deliveries: DeliveryRow[];
  /** When the delivery log's earliest row was written, or null if it has none yet. */
  deliveryLogSince: Date | null;
  quiet: Array<{ source: string; where: string }>;
  /** The production count on the instant basis, for the operator's cross-check only. */
  crossCheck: { leadsOnInstants: CountPair };
}

const inPeriod = (at: Date | null, p: DigestPeriod) => at !== null && at >= p.start && at < p.end;
const dateOf = (d: Date) => d.toISOString().slice(0, 10);

export async function getDigestData(win: DigestWindow): Promise<DigestData> {
  const { week, month } = win;
  // The view's `day` is a DATE. Bound it with dates, so the comparison never depends on the
  // session timezone a timestamptz literal would be cast in.
  const weekFrom = week.firstDate;
  const weekTo = dateOf(week.dateEndExclusiveUtc);
  const monthFrom = month.firstDate;
  const monthTo = dateOf(month.dateEndExclusiveUtc);

  const [viewRows, watchRows, activityRows, earliestActivity, instantWeek, instantMonth] = await Promise.all([
    prisma.$queryRaw<Array<{ page: string; source: string; week: number; month: number }>>`
      SELECT page,
             source,
             COALESCE(SUM(leads) FILTER (WHERE day >= ${weekFrom}::date AND day < ${weekTo}::date), 0)::int AS week,
             COALESCE(SUM(leads) FILTER (WHERE day >= ${monthFrom}::date AND day < ${monthTo}::date), 0)::int AS month
      FROM public.lead_daily_by_page
      WHERE day >= ${monthFrom}::date AND day < ${monthTo}::date
      GROUP BY page, source
      ORDER BY month DESC, week DESC, page ASC, source ASC
    `,
    prisma.savedSearch.findMany({
      where: { env: "production", alertEnabled: true },
      select: { kind: true, email: true, userId: true, createdAt: true, lastAlertAt: true },
    }),
    prisma.leadActivity.findMany({
      where: {
        type: { in: ["email_sent", "email_failed"] },
        createdAt: { gte: month.start, lt: month.end },
        lead: { env: "production" },
      },
      select: { type: true, payload: true, createdAt: true },
    }),
    prisma.leadActivity.findFirst({
      where: { type: { in: ["email_sent", "email_failed"] } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    prisma.lead.count({ where: { env: "production", createdAt: { gte: week.start, lt: week.end } } }),
    prisma.lead.count({ where: { env: "production", createdAt: { gte: month.start, lt: month.end } } }),
  ]);

  // By source and by page, folded from the one read so the two tables cannot disagree.
  const sourceMap = new Map<string, SourceRow>();
  const pageMap = new Map<string, PageRow>();
  const totals: CountPair = { week: 0, month: 0 };
  for (const r of viewRows) {
    const s = sourceMap.get(r.source) ?? {
      source: r.source,
      where: LIVE_SOURCES.find((x) => x.source === r.source)?.where ?? null,
      week: 0,
      month: 0,
    };
    s.week += r.week;
    s.month += r.month;
    sourceMap.set(r.source, s);
    const p = pageMap.get(r.page) ?? { page: r.page, week: 0, month: 0 };
    p.week += r.week;
    p.month += r.month;
    pageMap.set(r.page, p);
    totals.week += r.week;
    totals.month += r.month;
  }
  const byCount = (a: CountPair, b: CountPair) => b.month - a.month || b.week - a.week;
  const bySource = Array.from(sourceMap.values()).sort((a, b) => byCount(a, b) || a.source.localeCompare(b.source));
  const byPage = Array.from(pageMap.values()).sort((a, b) => byCount(a, b) || a.page.localeCompare(b.page));

  // A brief subscriber is an address, not a watch: one person signed up from two pages is one
  // subscriber, the same rule the sender applies.
  const briefByEmail = new Map<string, { createdAt: Date; lastAlertAt: Date | null }>();
  const watchMap = new Map<string, WatchRow>();
  for (const w of watchRows) {
    if (w.kind === "brief") {
      const key = (w.email ?? w.userId ?? "").trim().toLowerCase();
      if (!key) continue;
      const held = briefByEmail.get(key);
      briefByEmail.set(key, {
        createdAt: held && held.createdAt < w.createdAt ? held.createdAt : w.createdAt,
        lastAlertAt: [held?.lastAlertAt ?? null, w.lastAlertAt].reduce<Date | null>((a, b) => (b && (!a || b > a) ? b : a), null),
      });
      continue;
    }
    const row = watchMap.get(w.kind) ?? { kind: w.kind, active: 0, newWeek: 0, newMonth: 0, alertedWeek: 0 };
    row.active++;
    if (inPeriod(w.createdAt, week)) row.newWeek++;
    if (inPeriod(w.createdAt, month)) row.newMonth++;
    if (inPeriod(w.lastAlertAt, week)) row.alertedWeek++;
    watchMap.set(w.kind, row);
  }
  const briefSubs = Array.from(briefByEmail.values());
  const brief = {
    active: briefSubs.length,
    newWeek: briefSubs.filter((s) => inPeriod(s.createdAt, week)).length,
    newMonth: briefSubs.filter((s) => inPeriod(s.createdAt, month)).length,
    sentWeek: briefSubs.filter((s) => inPeriod(s.lastAlertAt, week)).length,
  };
  const watches = Array.from(watchMap.values()).sort((a, b) => a.kind.localeCompare(b.kind));

  const deliveries: DeliveryRow[] = (["confirmation", "ops_alert"] as const).map((kind) => ({
    kind,
    sent: { week: 0, month: 0 },
    failed: { week: 0, month: 0 },
  }));
  for (const a of activityRows) {
    const payload = (a.payload ?? {}) as { kind?: string };
    const row = deliveries.find((d) => d.kind === payload.kind);
    if (!row) continue;
    const bucket = a.type === "email_sent" ? row.sent : row.failed;
    bucket.month++;
    if (inPeriod(a.createdAt, week)) bucket.week++;
  }

  const seen = new Set(bySource.filter((s) => s.month > 0).map((s) => s.source));
  const quiet = LIVE_SOURCES.filter((s) => !seen.has(s.source)).map((s) => ({ source: s.source, where: s.where }));

  return {
    totals,
    bySource,
    byPage,
    brief,
    watches,
    deliveries,
    deliveryLogSince: earliestActivity?.createdAt ?? null,
    quiet,
    crossCheck: { leadsOnInstants: { week: instantWeek, month: instantMonth } },
  };
}

// ── the copy ──────────────────────────────────────────────────────────────────

export interface Digest {
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** How many page rows the email shows in full. The rest are summed on one line. */
const PAGE_ROWS_SHOWN = 40;

const TH = 'style="text-align:left;padding:6px 10px;border-bottom:1px solid #d9d4c7;font-weight:600;color:#073126;"';
const TD = 'style="padding:6px 10px;border-bottom:1px solid #eeeae0;vertical-align:top;"';
const TDN = 'style="padding:6px 10px;border-bottom:1px solid #eeeae0;text-align:right;font-variant-numeric:tabular-nums;"';

function table(head: string[], rows: string[][], numericFrom: number): string {
  const h = head.map((c, i) => `<th ${TH}${i >= numericFrom ? ' align="right"' : ""}>${esc(c)}</th>`).join("");
  const b = rows
    .map((r) => `<tr>${r.map((c, i) => `<td ${i >= numericFrom ? TDN : TD}>${esc(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;width:100%;max-width:640px;">` +
    `<thead><tr>${h}</tr></thead><tbody>${b}</tbody></table>`;
}

function textTable(head: string[], rows: string[][], numericFrom: number): string {
  const all = [head, ...rows];
  const widths = head.map((_, i) => Math.min(48, Math.max(...all.map((r) => (r[i] ?? "").length))));
  const line = (r: string[]) =>
    r.map((c, i) => (i >= numericFrom ? c.padStart(widths[i]) : c.slice(0, widths[i]).padEnd(widths[i]))).join("  ");
  return [line(head), widths.map((w) => "-".repeat(w)).join("  "), ...rows.map(line)].join("\n");
}

function heading(s: string): string {
  return `<h2 style="font-family:Georgia,serif;font-weight:600;font-size:18px;color:#073126;margin:28px 0 10px;">${esc(s)}</h2>`;
}

function para(s: string): string {
  return `<p style="margin:0 0 10px;">${esc(s)}</p>`;
}

/** The whole digest, as one HTML body and one plain-text body that say the same things. */
export function composeDigest(data: DigestData, win: DigestWindow): Digest {
  const { week, month } = win;
  const subject = `Leads digest, week to ${week.lastDate}`;

  const html: string[] = [];
  const text: string[] = [];
  const both = (h: string, t: string) => {
    html.push(h);
    text.push(t);
  };

  both(
    `<h1 style="font-family:Georgia,serif;font-weight:600;font-size:22px;color:#073126;margin:0 0 6px;">${esc(config.SITE_NAME)} leads, week to ${esc(week.lastDate)}</h1>` +
      `<p style="margin:0 0 18px;color:#4a5a54;">${esc(`${week.firstDate} to ${week.lastDate}, and the 28 days from ${month.firstDate}. Counts, not rates.`)}</p>`,
    `${config.SITE_NAME.toUpperCase()} LEADS, WEEK TO ${week.lastDate}\n${week.firstDate} to ${week.lastDate}, and the 28 days from ${month.firstDate}. Counts, not rates.\n`,
  );

  const headline = `${plural(data.totals.week, "lead")} in the last 7 days, ${data.totals.month} in the last 28.`;
  both(`<p style="font-size:16px;margin:0 0 6px;"><strong>${esc(headline)}</strong></p>`, `${headline}\n`);

  // ── by source ──
  const sourceHead = ["Source", "Where", "7d", "28d"];
  const sourceRows = data.bySource.map((s) => [s.source, s.where ?? "(not a mounted surface)", String(s.week), String(s.month)]);
  both(
    heading("By source") + (sourceRows.length ? table(sourceHead, sourceRows, 2) : para("No production leads in the 28 days.")),
    `BY SOURCE\n${sourceRows.length ? textTable(sourceHead, sourceRows, 2) : "No production leads in the 28 days."}\n`,
  );

  // ── by page ──
  const pageHead = ["Page", "7d", "28d"];
  const shown = data.byPage.slice(0, PAGE_ROWS_SHOWN);
  const rest = data.byPage.slice(PAGE_ROWS_SHOWN);
  const pageRows = shown.map((p) => [p.page, String(p.week), String(p.month)]);
  if (rest.length) {
    pageRows.push([
      `${plural(rest.length, "more page")}`,
      String(rest.reduce((a, p) => a + p.week, 0)),
      String(rest.reduce((a, p) => a + p.month, 0)),
    ]);
  }
  both(
    heading("By page") + (pageRows.length ? table(pageHead, pageRows, 1) : para("No production leads in the 28 days.")),
    `BY PAGE\n${pageRows.length ? textTable(pageHead, pageRows, 1) : "No production leads in the 28 days."}\n`,
  );

  // ── subscribers and watches ──
  const briefLine =
    `${plural(data.brief.active, "brief subscriber")} active` +
    (data.brief.active
      ? `: ${data.brief.newWeek} new this week, ${data.brief.newMonth} new in 28 days, ${data.brief.sentWeek} received an edition this week.`
      : ".");
  const watchHead = ["Watch kind", "Active", "New 7d", "New 28d", "Alerted 7d"];
  const watchRows = data.watches.map((w) => [w.kind, String(w.active), String(w.newWeek), String(w.newMonth), String(w.alertedWeek)]);
  both(
    heading("Subscribers and watches") +
      para(briefLine) +
      (watchRows.length ? table(watchHead, watchRows, 1) : para("No other watches active.")),
    `SUBSCRIBERS AND WATCHES\n${briefLine}\n${watchRows.length ? textTable(watchHead, watchRows, 1) : "No other watches active."}\n`,
  );

  // ── deliveries ──
  const deliveryHead = ["Email", "Sent 7d", "Failed 7d", "Sent 28d", "Failed 28d"];
  const deliveryLabel = (k: DeliveryRow["kind"]) => (k === "confirmation" ? "Lead confirmation" : "Desk alert");
  const deliveryRows = data.deliveries.map((d) => [
    deliveryLabel(d.kind),
    String(d.sent.week),
    String(d.failed.week),
    String(d.sent.month),
    String(d.failed.month),
  ]);
  const logNote = data.deliveryLogSince
    ? `Counted from the delivery log, which begins ${dateOf(data.deliveryLogSince)}. Sends before that date are not in it.`
    : "The delivery log has no rows yet. It fills from the first lead after the deploy that introduced it.";
  both(
    heading("Confirmations and alerts") + table(deliveryHead, deliveryRows, 1) + `<p style="margin:10px 0 0;color:#4a5a54;font-size:13px;">${esc(logNote)}</p>`,
    `CONFIRMATIONS AND ALERTS\n${textTable(deliveryHead, deliveryRows, 1)}\n${logNote}\n`,
  );

  // ── quiet surfaces ──
  const quietIntro = data.quiet.length
    ? `${plural(data.quiet.length, "surface")} with no submission in 28 days:`
    : "Every mounted surface produced at least one lead in 28 days.";
  const quietList = data.quiet.map((q) => `${q.source} (${q.where})`);
  both(
    heading("Quiet surfaces") +
      para(quietIntro) +
      (quietList.length ? `<ul style="margin:0;padding-left:20px;">${quietList.map((q) => `<li style="margin:2px 0;">${esc(q)}</li>`).join("")}</ul>` : ""),
    `QUIET SURFACES\n${quietIntro}${quietList.length ? "\n" + quietList.map((q) => `  - ${q}`).join("\n") : ""}\n`,
  );

  // ── basis ──
  const basis =
    "Lead counts are production rows from lead_daily_by_page, which files a lead under the UTC calendar day it arrived, so a lead sent after 8pm Toronto sits on the following day's row. " +
    "Subscriber, watch and delivery figures are read on Toronto local days. Preview and development rows are excluded from everything.";
  both(
    `<p style="margin:28px 0 0;padding-top:12px;border-top:1px solid #d9d4c7;color:#4a5a54;font-size:12px;">${esc(basis)}</p>`,
    `\n${basis}`,
  );

  return {
    subject,
    html: `<div style="font-family:Inter,Helvetica,Arial,sans-serif;color:#1c2a25;background:#f6f4ef;padding:24px;">${html.join("")}</div>`,
    text: text.join("\n"),
  };
}
