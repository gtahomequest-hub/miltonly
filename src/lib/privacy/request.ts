// A consumer's request to remove their personal information (MC-036, VOW Best Practices
// item 12; PIPEDA principle 4.3.8, the withdrawal of consent).
//
// The only route used to be a mailto and a phone number, so a request left no record, reached
// no one in a structured way, and nothing told PropTx or the listing brokerage. This is the
// record. NO SCHEMA CHANGE: the request is not a lead and does not become a Lead row; it is
// recorded by two emails through Resend, the same client the lead layer uses. One goes to the
// desk (ALERT_EMAIL_TO, the address every lead alert goes to) with the request and the standing
// instruction below, and one goes to the requester with a reference they can quote. The desk
// email IS the record: when Resend refuses it the function throws, and when Resend is not
// configured it reports `recorded: false` so the route can send the person to the mailto
// rather than hand out a reference nobody will act on.
//
// The reference is a timestamped id (PIR-YYYYMMDD-HHMMSS-xxxx, Toronto time), so the desk can
// find the email by date and the person can quote one token on the phone.

import { randomBytes } from "node:crypto";
import { isCountable, alertsForcedOnNonProduction, type LeadEnv } from "@/lib/lead/env";
import { Resend } from "resend";
import { config } from "@/lib/config";
import { mailingAddressLine } from "@/lib/email/footer";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FIRST_NAME = config.realtor.name.split(" ")[0];

/** What the desk does with every request, printed on every desk email so the instruction
 *  travels with the request rather than living in someone's memory. */
export const DESK_INSTRUCTION =
  "On a consumer request to remove personal information, remove it from Miltonly's systems and " +
  "advise PropTx and the listing brokerage of the request at once (PropTx VOW Best Practices " +
  "item 35, s9.1, VOW Policy 14).";

export const DESK_SUBJECT = "Personal information removal request";

/** The address the form and the /privacy page name as the fallback. */
export const FALLBACK_EMAIL = "gtahomequest@gmail.com";

const NAME_MAX = 120;
const EMAIL_MAX = 254;
const DETAILS_MAX = 4000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface PrivacyRequestInput {
  name: string;
  email: string;
  /** What the person wants removed, in their words: an address, a form they filled, an account. */
  details: string;
}

export interface PrivacyRequestResult {
  reference: string;
  /** True when the desk email reached Resend. False only when Resend is not configured. */
  recorded: boolean;
  deskEmailId: string | null;
  confirmationEmailId: string | null;
}

export type PrivacyRequestVerdict =
  | { ok: true; input: PrivacyRequestInput }
  | { ok: false; error: string };

/** Trims, caps and checks the three fields. The message is written for the person to read. */
export function validatePrivacyRequest(body: Record<string, unknown>): PrivacyRequestVerdict {
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const name = str(body.name, NAME_MAX);
  const email = str(body.email, EMAIL_MAX).toLowerCase();
  const details = str(body.details, DETAILS_MAX);
  if (!name) return { ok: false, error: "Enter your name." };
  if (!email || !EMAIL_RE.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!details) return { ok: false, error: "Say what you would like removed." };
  return { ok: true, input: { name, email, details } };
}


/** PIR-YYYYMMDD-HHMMSS-xxxx in Toronto time. The suffix keeps two requests in one second apart. */
export function privacyReference(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  // "24" is what some engines print for midnight under hour12: false.
  const hour = get("hour") === "24" ? "00" : get("hour");
  const date = `${get("year")}${get("month")}${get("day")}`;
  const time = `${hour}${get("minute")}${get("second")}`;
  return `PIR-${date}-${time}-${randomBytes(2).toString("hex")}`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

function deskEmail(input: PrivacyRequestInput, reference: string, receivedAt: Date) {
  const rows: Array<[string, string]> = [
    ["reference", reference],
    ["received", receivedAt.toISOString()],
    ["name", input.name],
    ["email", input.email],
    ["what to remove", input.details],
  ];
  const html = `
    <h3>${esc(DESK_SUBJECT)}</h3>
    <p><strong>${esc(DESK_INSTRUCTION)}</strong></p>
    <table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
      ${rows.map(([k, v]) => `<tr><td style="padding:6px 10px;font-weight:600;vertical-align:top;">${esc(k)}</td><td style="padding:6px 10px;white-space:pre-wrap;">${esc(v)}</td></tr>`).join("")}
    </table>
    <p>Reply to the requester at <a href="mailto:${esc(input.email)}">${esc(input.email)}</a> once the removal and the notices are done. The requester's confirmation quotes the reference above.</p>
  `;
  const text = [
    DESK_SUBJECT,
    "",
    DESK_INSTRUCTION,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    `Reply to the requester at ${input.email} once the removal and the notices are done.`,
  ].join("\n");
  return { html, text };
}

function confirmationEmail(input: PrivacyRequestInput, reference: string) {
  const greeting = `Hi ${input.name.split(" ")[0]},`;
  const lines = [
    `We received your request to remove your personal information from ${config.SITE_NAME}. Your reference is ${reference}.`,
    `${FIRST_NAME} will remove it from ${config.SITE_NAME}'s systems and, where a listing or a brokerage was involved, advise PropTx and the listing brokerage of your request. You will hear back at this address when that is done.`,
    `Some records are kept for the period the Trust in Real Estate Services Act, 2002 requires; the reply will say if any are, and why.`,
    `If you did not make this request, reply to this email and nothing will be removed.`,
  ];
  const sender = `${config.realtor.name}, ${config.realtor.title}, ${config.brokerage.name}`;
  const html = `
    <p>${esc(greeting)}</p>
    ${lines.map((l) => `<p>${esc(l)}</p>`).join("\n    ")}
    <p style="font-size:11px;line-height:1.6;color:#6b7280;margin:24px 0 0;border-top:1px solid #e5e7eb;padding-top:12px;">
      ${esc(sender)}<br/>
      ${esc(mailingAddressLine())}<br/>
      <a href="${config.SITE_URL}/privacy" style="color:#6b7280;">${esc(config.SITE_DOMAIN)}/privacy</a>
    </p>
  `;
  const text = [greeting, "", ...lines.flatMap((l) => [l, ""]), "--", sender, mailingAddressLine(), `${config.SITE_URL}/privacy`].join("\n");
  return { html, text };
}

/**
 * Records the request as two emails and returns the reference. Throws when Resend refuses the
 * desk email, because then there is no record; resolves with `recorded: false` when Resend is
 * not configured, and logs the request so a local run still leaves a trace.
 */
export async function submitPrivacyRequest(input: PrivacyRequestInput, now: Date = new Date(), env: LeadEnv = "production"): Promise<PrivacyRequestResult> {
  const reference = privacyReference(now);
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.ALERT_EMAIL_TO;
  // The same gate as every outbound lead path: a preview or a local run sends nothing real. The
  // request is logged with its reference and the page shows the mailto instead.
  if (!isCountable(env) && !alertsForcedOnNonProduction()) {
    console.warn("[privacy/request] not sent: non-production environment", { reference, env, email: input.email });
    return { reference, recorded: false, deskEmailId: null, confirmationEmailId: null };
  }
  if (!resend || !from || !to) {
    console.warn("[privacy/request] not recorded: RESEND_API_KEY, RESEND_FROM_EMAIL or ALERT_EMAIL_TO unset", { reference, email: input.email });
    return { reference, recorded: false, deskEmailId: null, confirmationEmailId: null };
  }

  const desk = deskEmail(input, reference, now);
  const deskResult = await resend.emails.send({
    from,
    to,
    replyTo: input.email,
    subject: DESK_SUBJECT,
    html: desk.html,
    text: desk.text,
  });
  if (deskResult.error) throw new Error(`desk email refused: ${deskResult.error.message}`);

  // The confirmation never costs the record: the desk has the request already, so a refused
  // confirmation is logged and the reference is still returned to the page.
  let confirmationEmailId: string | null = null;
  try {
    const confirmation = confirmationEmail(input, reference);
    const result = await resend.emails.send({
      from,
      replyTo: process.env.AAMIR_EMAIL || process.env.REALTOR_EMAIL || undefined,
      to: input.email,
      subject: `Your personal information removal request ${reference}`,
      html: confirmation.html,
      text: confirmation.text,
    });
    if (result.error) throw new Error(result.error.message);
    confirmationEmailId = result.data?.id ?? null;
  } catch (err) {
    console.warn("[privacy/request] confirmation not sent", { reference, err: err instanceof Error ? err.message : String(err) });
  }

  console.log("[privacy/request] recorded", { reference, deskEmailId: deskResult.data?.id ?? null, confirmationEmailId });
  return { reference, recorded: true, deskEmailId: deskResult.data?.id ?? null, confirmationEmailId };
}
