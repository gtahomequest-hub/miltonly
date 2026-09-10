// The daily-brief sender. Monday to Friday, one email per subscriber.
//
// /api/alerts/match deliberately excludes kind "brief": that job answers "did anything match
// the filter you set", and a digest of what changed in Milton is a different query with
// different copy. This is its sender, and it reads the same watches from the other end.
//
// WHAT IT WILL NOT DO, each because the alternative is worse than sending nothing:
//
//   - It will not send twice to one address. Watches are grouped by email before sending, and
//     the most specific one (a street, then a neighbourhood, then neither) is the one whose
//     personal line is used. A subscriber who signed up from two pages gets one brief.
//   - It will not send on a day nothing changed. The signup copy promises "it is only what
//     changed". An email that says "nothing happened" every quiet day is the thing that
//     teaches people to filter the brief into a folder.
//   - It will not send the same edition twice. lastAlertAt is stamped on every successful
//     send and a watch already stamped inside this window is skipped, so a retry or a second
//     manual trigger is safe.
//   - It will not send a commercial email it cannot sign an unsubscribe link for. No secret,
//     no send, and the response says so.
//   - It will not cross environments. Preview and production share one database, so the job
//     reads only watches tagged with the environment it is itself running in. Without that, a
//     preview test would mail real addresses daily for as long as its watch lived.

import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";
import { resolveLeadEnv } from "@/lib/lead/env";
import { config } from "@/lib/config";
import { briefWindow, isSendingDay } from "@/lib/brief/window";
import { getBriefData, shouldSend, publishedSet, composeEdition, type Subscriber } from "@/lib/brief/compose";
import { unsubscribeUrl } from "@/lib/brief/unsubscribe";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function authorized(request: NextRequest): boolean {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const query = request.nextUrl.searchParams.get("secret");
  const expected = process.env.CRON_SECRET;
  return Boolean(expected) && (bearer === expected || query === expected);
}

/** The most specific watch wins: a street beats a neighbourhood beats neither. */
function specificity(w: { streetSlug: string | null; neighbourhood: string | null }): number {
  if (w.streetSlug) return 2;
  if (w.neighbourhood) return 1;
  return 0;
}

async function run(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "true";
  // `force` runs the job on a weekend so the path can be proven on a preview deployment
  // without waiting for a Monday. It does not change which watches are eligible.
  const force = request.nextUrl.searchParams.get("force") === "true";
  // A single address, for a preview proof. Still environment-scoped: it cannot reach a
  // production watch from a preview deployment.
  const only = request.nextUrl.searchParams.get("only")?.trim().toLowerCase() || null;

  const env = resolveLeadEnv(request.headers.get("host"));
  const win = briefWindow();

  if (!isSendingDay() && !force) {
    return NextResponse.json({ success: true, env, skipped: "not a sending day", window: win.date, sent: 0 });
  }

  const from = process.env.RESEND_FROM_EMAIL;
  if (!resend || !from) {
    return NextResponse.json(
      { success: false, env, error: "RESEND_API_KEY or RESEND_FROM_EMAIL unset", sent: 0 },
      { status: 500 },
    );
  }
  if (!process.env.BRIEF_UNSUBSCRIBE_SECRET && !process.env.CRON_SECRET) {
    return NextResponse.json(
      { success: false, env, error: "no secret to sign the unsubscribe link with", sent: 0 },
      { status: 500 },
    );
  }

  const watches = await prisma.savedSearch.findMany({
    where: {
      kind: "brief",
      alertEnabled: true,
      env,
      ...(only ? { email: only } : {}),
    },
    select: { id: true, email: true, streetSlug: true, neighbourhood: true, lastAlertAt: true },
  });

  // One per address. A second watch for the same person is a second page they signed up from,
  // not a second subscription.
  const byEmail = new Map<string, (typeof watches)[number]>();
  for (const w of watches) {
    if (!w.email) continue;
    const key = w.email.trim().toLowerCase();
    const held = byEmail.get(key);
    if (!held || specificity(w) > specificity(held)) byEmail.set(key, w);
  }

  const brief = await getBriefData(win);
  if (!shouldSend(brief)) {
    return NextResponse.json({
      success: true,
      env,
      window: win.date,
      label: win.label,
      skipped: "nothing changed in the window, so there is nothing to send",
      subscribers: byEmail.size,
      sent: 0,
    });
  }

  const published = await publishedSet();

  let sent = 0;
  let skipped = 0;
  const report: Array<Record<string, unknown>> = [];

  for (const [email, watch] of Array.from(byEmail.entries())) {
    // Already sent this edition. A retry after a partial failure resumes rather than repeats.
    if (watch.lastAlertAt && watch.lastAlertAt >= win.end) {
      skipped++;
      report.push({ watch: watch.id, skipped: "already sent this edition" });
      continue;
    }

    const sub: Subscriber = {
      watchId: watch.id,
      email,
      streetSlug: watch.streetSlug,
      neighbourhood: watch.neighbourhood,
    };

    let edition;
    try {
      edition = await composeEdition(sub, {
        win,
        brief,
        published,
        unsubscribeUrl: unsubscribeUrl(watch.id),
      });
    } catch (err) {
      skipped++;
      report.push({ watch: watch.id, skipped: "compose failed", error: err instanceof Error ? err.message : String(err) });
      continue;
    }

    if (dryRun) {
      report.push({ watch: watch.id, to: email, subject: edition.subject, namedStreet: edition.namedStreet, dryRun: true });
      continue;
    }

    try {
      const result = await resend.emails.send({
        from,
        to: email,
        replyTo: process.env.AAMIR_EMAIL || process.env.REALTOR_EMAIL || undefined,
        // A preview edition says so in the subject. Preview and production share one database
        // and an untagged preview email is indistinguishable from the real thing.
        subject: env === "production" ? edition.subject : `[${env}] ${edition.subject}`,
        html: edition.html,
        text: edition.text,
        headers: { "List-Unsubscribe": `<${unsubscribeUrl(watch.id)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      });
      if (result.error) throw new Error(result.error.message);
      await prisma.savedSearch.update({
        where: { id: watch.id },
        data: { lastAlertAt: new Date(), lastMatchCount: brief.listed.count + brief.sold.count },
      });
      sent++;
      report.push({ watch: watch.id, to: email, resendId: result.data?.id ?? null, namedStreet: edition.namedStreet, sent: true });
    } catch (err) {
      skipped++;
      report.push({ watch: watch.id, to: email, skipped: "send failed", error: err instanceof Error ? err.message : String(err) });
    }
  }

  console.log("[brief/send]", { env, window: win.date, subscribers: byEmail.size, sent, skipped });

  return NextResponse.json({
    success: true,
    env,
    city: config.CITY_NAME,
    window: { date: win.date, label: win.label, days: win.days, start: win.start.toISOString(), end: win.end.toISOString() },
    figures: { listed: brief.listed, sold: brief.sold, priceChanged: brief.priceChanged },
    subscribers: byEmail.size,
    sent,
    skipped,
    dryRun,
    report,
  });
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
