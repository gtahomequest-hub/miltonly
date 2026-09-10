// Every lead gets two emails: a confirmation to the person, and an alert to the desk.
//
// The confirmation used to be one generic paragraph — "I'll personally review your request
// and reply within the hour" — sent to someone who had ticked a street-alert box and
// expected nothing but listings. A confirmation that describes a different promise than the
// page made is worse than none, so the line is chosen by source.
//
// The ops alert fires on every countable lead. On a preview deployment it is silent unless
// LEAD_ALERTS_ON_PREVIEW is set, and then it is prefixed, because preview and production
// share one database and an untagged preview alert is indistinguishable from a real one.

import { Resend } from "resend";
import { config } from "@/lib/config";
import { isCountable, alertsForcedOnNonProduction, type LeadEnv } from "@/lib/lead/env";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FIRST_NAME = config.realtor.name.split(" ")[0];
const WHATSAPP = `https://wa.me/${config.realtor.phoneE164.replace("+", "")}`;

export interface NotifyContext {
  source: string;
  /** The street, building or area the lead is about, already resolved. */
  subject?: string | null;
}

// What the page promised, in the words the page used. `subject` is a resolved street or
// building name when the surface had one.
//
// The generic fallback still names an action and a timeframe; it never promises listings to
// someone who asked for a valuation, or the reverse.
export function confirmationLineFor(ctx: NotifyContext): string {
  const where = ctx.subject ? ctx.subject : `${config.CITY_NAME}`;
  switch (ctx.source) {
    case "street-alert":
    case "street-exit-intent":
      return `You are on the alert list for ${where}. We will email you when a home there is listed or sold, and nothing else.`;
    case "street-corner-widget":
      return `Your note about ${where} is in. ${FIRST_NAME} will reply during business hours.`;
    case "condo-building-alert":
      return `You are on the alert list for ${where}. We will email you when a unit there is listed or sold, and nothing else.`;
    case "condo-building-contact":
      return `Your question about ${where} is in. ${FIRST_NAME} will reply during business hours.`;
    case "sold-home-valuation":
    case "sell-page":
    case "doorhanger-valuation":
    case "sales-ads-home-valuation":
      return `${FIRST_NAME} prepares every valuation by hand from comparable sales. Your written report arrives by email within 24 business hours.`;
    case "mosque-alert":
    case "school-alert":
      return `You are on the alert list for ${where}. We will email you when a home comes up near it.`;
    case "homepage-newsletter":
      return `You are on the Miltonly list. One email when something in ${config.CITY_NAME} is worth telling you about.`;
    case "daily-brief":
      return `You are signed up for the ${config.CITY_NAME} daily brief. It arrives each morning, and it is only what changed.`;
    case "homepage-exclusive":
      return `You are on the off-market list. ${FIRST_NAME} will call you when something matches.`;
    case "exclusive-listing":
      return `Your inquiry is in. ${FIRST_NAME} will reach out about the listing during business hours.`;
    case "sales-ads-market-pulse-unlock":
      return `Your market report is unlocked. ${FIRST_NAME} follows up with the fuller read by phone.`;
    default:
      return `Your request is in. ${FIRST_NAME} replies personally, during business hours.`;
  }
}

function confirmationSubject(ctx: NotifyContext): string {
  switch (ctx.source) {
    case "street-alert":
    case "street-exit-intent":
    case "condo-building-alert":
    case "mosque-alert":
    case "school-alert":
      return ctx.subject ? `You are watching ${ctx.subject}` : "You are on the alert list";
    case "sold-home-valuation":
    case "sell-page":
    case "doorhanger-valuation":
    case "sales-ads-home-valuation":
      return "Your valuation is being prepared";
    case "daily-brief":
      return `Your ${config.CITY_NAME} daily brief starts tomorrow`;
    default:
      return "I got your message";
  }
}

export async function sendLeadConfirmation(args: {
  to: string;
  name?: string | null;
  ctx: NotifyContext;
}): Promise<string | null> {
  const from = process.env.RESEND_FROM_EMAIL;
  if (!resend || !from) {
    console.warn("[lead/notify] confirmation skipped: RESEND_API_KEY or RESEND_FROM_EMAIL unset");
    return null;
  }
  const greeting = args.name ? `Hi ${args.name.split(" ")[0]},` : "Hi there,";
  const html = `
    <p>${greeting}</p>
    <p>${confirmationLineFor(args.ctx)}</p>
    <p>If it is faster for you, message ${FIRST_NAME} directly on WhatsApp: <a href="${WHATSAPP}">${WHATSAPP}</a></p>
    <p>${FIRST_NAME}<br/>${config.SITE_NAME} · RE/MAX Realty Specialists Inc., Brokerage</p>
  `;
  const result = await resend.emails.send({
    from,
    replyTo: process.env.AAMIR_EMAIL || process.env.REALTOR_EMAIL || undefined,
    to: args.to,
    subject: confirmationSubject(args.ctx),
    html,
  });
  if (result.error) throw new Error(`confirmation refused: ${result.error.message}`);
  return result.data?.id ?? null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function sendOpsAlert(args: {
  leadId: string;
  env: LeadEnv;
  value: number;
  fields: Record<string, unknown>;
}): Promise<string | null> {
  if (!isCountable(args.env) && !alertsForcedOnNonProduction()) {
    console.log("[lead/notify] ops alert suppressed for non-production lead", { leadId: args.leadId, env: args.env });
    return null;
  }
  const to = process.env.ALERT_EMAIL_TO;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!resend || !from || !to) {
    console.warn("[lead/notify] ops alert skipped: RESEND_API_KEY, RESEND_FROM_EMAIL or ALERT_EMAIL_TO unset");
    return null;
  }
  const prefix = isCountable(args.env) ? "" : `[${args.env}] `;
  const rows = Object.entries(args.fields)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `<tr><td style="padding:6px 10px;font-weight:600;">${esc(k)}</td><td style="padding:6px 10px;">${esc(String(v))}</td></tr>`)
    .join("");
  const source = String(args.fields.source ?? "unknown");
  const result = await resend.emails.send({
    from,
    to,
    subject: `${prefix}New lead — ${source}`,
    html: `
      <h3>${prefix}New lead — ${esc(source)}</h3>
      <p><strong>lead_id:</strong> ${esc(args.leadId)} · <strong>env:</strong> ${esc(args.env)} · <strong>value:</strong> CAD ${args.value}</p>
      <table border="1" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">${rows}</table>
    `,
  });
  if (result.error) throw new Error(`ops alert refused: ${result.error.message}`);
  return result.data?.id ?? null;
}
