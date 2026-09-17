// The weekly leads digest sender. Monday 07:00 Toronto, one email to the desk.
//
// It is a report, not a subscriber mailing, so it takes the opposite posture from the brief
// on two points and the same on the rest:
//
//   - It reports PRODUCTION figures from wherever it runs. The leads-per-page view is
//     production-only by definition, and the desk wants real numbers even from a preview
//     proof. A non-production run says so in the subject.
//   - It goes to ONE address: LEADS_DIGEST_TO, or ALERT_EMAIL_TO when that is unset, which is
//     the address every desk alert already reaches. No address, no send, and the response
//     says so.
//   - It fires twice on the UTC cron and runs once. 07:00 Toronto is 11:00 UTC in EDT and
//     12:00 UTC in EST, so both are registered and the Toronto hour decides. `force=true`
//     lifts the slot guard for a proof; it changes nothing about what is read.
//   - `dryRun=true` computes the whole digest and returns it without sending. That is how
//     the figures are checked against their sources before a Monday.
//   - It is a recurring commercial email all the same (ML-004), so it carries the shared
//     footer and a signed one-click unsubscribe like the brief and the alerts. The thing the
//     unsubscribe disables is a SavedSearch of kind "digest" for the recipient, created on the
//     first send and read on every one; a disabled row stops the digest until it is re-enabled.

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { resolveLeadEnv } from "@/lib/lead/env";
import { digestWindow, isDigestSlot, DIGEST_HOUR } from "@/lib/digest/window";
import { getDigestData, composeDigest } from "@/lib/digest/compose";
import { digestWatchFor } from "@/lib/digest/recipient";
import { canSignUnsubscribe, unsubscribeUrl, listUnsubscribeHeaders } from "@/lib/email/unsubscribe";
import { emailFooter } from "@/lib/email/footer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function authorized(request: NextRequest): boolean {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const query = request.nextUrl.searchParams.get("secret");
  const expected = process.env.CRON_SECRET;
  return Boolean(expected) && (bearer === expected || query === expected);
}

async function run(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "true";
  const force = request.nextUrl.searchParams.get("force") === "true";
  const env = resolveLeadEnv(request.headers.get("host"));
  const now = new Date();
  const slot = isDigestSlot(now);
  const win = digestWindow(now);

  if (!slot.ok && !force && !dryRun) {
    return NextResponse.json({
      success: true,
      env,
      skipped: "not the digest slot",
      detail: `Toronto local hour is ${slot.hour} on day ${slot.dow}; this route runs Monday at ${DIGEST_HOUR}. Two UTC crons are registered, 11:00 and 12:00, so that exactly one lands on ${DIGEST_HOUR}:00 in both EDT and EST.`,
      sent: 0,
    });
  }

  const to = process.env.LEADS_DIGEST_TO || process.env.ALERT_EMAIL_TO;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!dryRun && (!resend || !from || !to)) {
    return NextResponse.json(
      { success: false, env, error: "RESEND_API_KEY, RESEND_FROM_EMAIL or a recipient (LEADS_DIGEST_TO or ALERT_EMAIL_TO) unset", sent: 0 },
      { status: 500 },
    );
  }

  if (!dryRun && !canSignUnsubscribe()) {
    return NextResponse.json(
      { success: false, env, error: "no secret to sign the unsubscribe link with", sent: 0 },
      { status: 500 },
    );
  }

  // The recipient's watch: the row the unsubscribe link disables. One per (address, env),
  // found or created, never duplicated. A preview digest links to the preview host.
  const host = request.headers.get("host");
  const linkOrigin = env === "production" || !host ? undefined : `https://${host}`;
  const watch = to ? await digestWatchFor(to, env, { create: !dryRun }) : null;

  if (watch && !watch.alertEnabled && !dryRun) {
    return NextResponse.json({ success: true, env, to, skipped: "recipient unsubscribed from the digest", watch: watch.id, sent: 0 });
  }

  const data = await getDigestData(win);
  const unsubscribe = watch ? unsubscribeUrl(watch.id, linkOrigin) : null;
  const footer = unsubscribe ? emailFooter({ unsubscribeUrl: unsubscribe, listName: "the weekly leads digest", origin: linkOrigin }) : undefined;
  const digest = composeDigest(data, win, footer);
  const subject = env === "production" ? digest.subject : `[${env}] ${digest.subject}`;

  const summary = {
    window: {
      asOf: win.asOf,
      week: { from: win.week.firstDate, to: win.week.lastDate, start: win.week.start.toISOString(), end: win.week.end.toISOString() },
      month: { from: win.month.firstDate, to: win.month.lastDate, start: win.month.start.toISOString(), end: win.month.end.toISOString() },
    },
    totals: data.totals,
    crossCheck: data.crossCheck,
    bySource: data.bySource,
    byPage: data.byPage,
    brief: data.brief,
    watches: data.watches,
    deliveries: data.deliveries,
    deliveryLogSince: data.deliveryLogSince,
    quiet: data.quiet.map((q) => q.source),
  };

  if (dryRun) {
    return NextResponse.json({ success: true, env, dryRun: true, subject, text: digest.text, ...summary, sent: 0 });
  }

  const result = await resend!.emails.send({
    from: from!,
    to: to!,
    replyTo: process.env.AAMIR_EMAIL || process.env.REALTOR_EMAIL || undefined,
    subject,
    html: digest.html,
    text: digest.text,
    headers: listUnsubscribeHeaders(unsubscribe!),
  });
  if (result.error) {
    return NextResponse.json({ success: false, env, error: result.error.message, ...summary, sent: 0 }, { status: 502 });
  }

  console.log("[digest/leads]", { env, asOf: win.asOf, to, resendId: result.data?.id ?? null, totals: data.totals });
  return NextResponse.json({ success: true, env, to, watch: watch?.id ?? null, resendId: result.data?.id ?? null, subject, ...summary, sent: 1 });
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}
