// POST /api/leads/create
//
// Single ingress point for the FB-ads lead pipeline. Catches submissions
// from FB Lead Forms (via webhook later), landing pages, WhatsApp deep
// links, and organic forms. Writes to ads.leads and fires browser-paired
// CAPI + ops emails.
//
// Feature-flagged via LEADS_API_ENABLED. While false, the endpoint
// returns { ok: true, no_op: true } without touching the DB or firing
// side effects — lets us deploy the route shape without going live.
//
// Failure semantics:
//   - Validation failure → 400
//   - DB write failure → 500 (no CAPI, no emails fired)
//   - CAPI / email failures → logged, response still 200 with lead_id
//     (lead is already saved; we don't want a transient CAPI outage to
//     make the user think their submission failed)

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createLead } from "@/lib/leads";
import { sendCapiEvent, hashUserData } from "@/lib/meta-capi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FALLBACK_EVENT_SOURCE_URL = "https://www.miltonly.com/";

interface CreateLeadBody {
  source?: string;
  campaign?: string;
  intent?: string;
  name?: string;
  email?: string;
  phone?: string;
  timeline?: string;
  budget?: string;
  bedrooms?: string;
  neighbourhood?: string;
  property_address?: string;
  notes?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  fbclid?: string;
  fbc?: string;
  fbp?: string;
  event_id?: string;
  event_source_url?: string;
  // Sales-variant listings the lead was viewing at submit time. No
  // dedicated column on ads.leads — routed into meta.mlsNumber JSONB
  // for cross-schema attribution lookups later (street → ad → close).
  mlsNumber?: string;
  // Dev-only escape hatch for verify-leads-pipeline.ts. Honored ONLY when
  // NODE_ENV !== 'production'. Ignored everywhere else so production
  // traffic can't bypass the alert email by setting this field.
  __test_skip_emails?: boolean;
}

// North-American phone normalization for the CAPI hash. Strips non-digits,
// prepends "1" on bare 10-digit numbers (Canadian/US assumption), leaves
// 11-digit-with-1 untouched, leaves international (11+ without leading 1)
// untouched, warns on too-short. Returns digits-only; hashUserData() further
// normalizes before SHA-256.
function normalizePhoneForHash(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return digits;
  if (digits.length >= 11) return digits;
  console.warn(`[leads/create] phone has ${digits.length} digits, expected >= 10; hashing as-is`);
  return digits;
}

// Best-effort split of a free-text "name" into first/last for the CAPI
// hash. The DB row keeps the original undivided string.
function splitName(name: string | undefined): { firstName?: string; lastName?: string } {
  if (!name) return {};
  const trimmed = name.trim();
  if (!trimmed) return {};
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function clientIpFrom(req: NextRequest): string | undefined {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim();
  const realIp = req.headers.get("x-real-ip");
  return realIp ?? undefined;
}

function eventSourceUrlFrom(req: NextRequest, bodyHint: string | undefined): string {
  if (bodyHint) return bodyHint;
  const referer = req.headers.get("referer");
  if (referer) return referer;
  console.warn(`[leads/create] event_source_url not provided and no referer header; falling back to ${FALLBACK_EVENT_SOURCE_URL}`);
  return FALLBACK_EVENT_SOURCE_URL;
}

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendConfirmationEmail(args: {
  to: string;
  leadName: string | undefined;
}): Promise<void> {
  if (!resend) {
    console.warn("[leads/create] RESEND_API_KEY missing; skipping confirmation email");
    return;
  }
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    console.warn("[leads/create] RESEND_FROM_EMAIL missing; skipping confirmation email");
    return;
  }
  const greeting = args.leadName ? `Hi ${args.leadName.split(" ")[0]},` : "Hi there,";
  const html = `
    <p>${greeting}</p>
    <p>Thanks for getting in touch — I'll personally review your request and reply within the hour during business hours.</p>
    <p>If it's faster for you, message me directly on WhatsApp: <a href="https://wa.me/16478399090">https://wa.me/16478399090</a></p>
    <p>Talk soon,<br/>Aamir<br/>Miltonly · RE/MAX Realty Specialists Inc., Brokerage</p>
  `;
  await resend.emails.send({
    from,
    to: args.to,
    subject: "I got your message — talking soon",
    html,
  });
}

async function sendAlertEmail(args: {
  to: string;
  leadId: string;
  body: CreateLeadBody;
  estimatedValue: number;
}): Promise<void> {
  if (!resend) {
    console.warn("[leads/create] RESEND_API_KEY missing; skipping alert email");
    return;
  }
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) {
    console.warn("[leads/create] RESEND_FROM_EMAIL missing; skipping alert email");
    return;
  }
  const rows = Object.entries(args.body)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${String(v)}</td></tr>`)
    .join("");
  const html = `
    <h3>New ads lead — ${args.body.source ?? "unknown source"}</h3>
    <p><strong>lead_id:</strong> ${args.leadId}</p>
    <p><strong>estimated_value:</strong> CAD ${args.estimatedValue}</p>
    <table border="1" cellpadding="6" cellspacing="0">${rows}</table>
  `;
  await resend.emails.send({
    from,
    to: args.to,
    subject: `New ads lead — ${args.body.source ?? "unknown"}${args.body.campaign ? ` / ${args.body.campaign}` : ""}`,
    html,
  });
}

export async function POST(req: NextRequest) {
  // ── Parse + validate ─────────────────────────────────────────────────
  let body: CreateLeadBody;
  try {
    body = (await req.json()) as CreateLeadBody;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  if (!body.source) {
    return NextResponse.json({ ok: false, error: "source is required" }, { status: 400 });
  }
  if (!body.email && !body.phone) {
    return NextResponse.json({ ok: false, error: "email or phone is required" }, { status: 400 });
  }

  // ── Feature flag ─────────────────────────────────────────────────────
  if (process.env.LEADS_API_ENABLED !== "true") {
    return NextResponse.json({ ok: true, no_op: true });
  }

  // ── DB write (must succeed before side effects) ──────────────────────
  let leadId: string;
  let estimatedValue: number;
  try {
    const result = await createLead({
      source: body.source,
      campaign: body.campaign,
      intent: body.intent,
      name: body.name,
      email: body.email,
      phone: body.phone,
      timeline: body.timeline,
      budget: body.budget,
      bedrooms: body.bedrooms,
      neighbourhood: body.neighbourhood,
      propertyAddress: body.property_address,
      notes: body.notes,
      utmSource: body.utm_source,
      utmMedium: body.utm_medium,
      utmCampaign: body.utm_campaign,
      utmContent: body.utm_content,
      fbclid: body.fbclid,
      meta: {
        fbc: body.fbc,
        fbp: body.fbp,
        event_id: body.event_id,
        event_source_url: body.event_source_url,
        mlsNumber: body.mlsNumber,
        user_agent: req.headers.get("user-agent") ?? undefined,
        ip_address: clientIpFrom(req),
        referer: req.headers.get("referer") ?? undefined,
      },
    });
    leadId = result.leadId;
    estimatedValue = result.estimatedValue;
  } catch (err) {
    console.error("[leads/create] DB write failed", err);
    return NextResponse.json({ ok: false, error: "db_write_failed" }, { status: 500 });
  }

  // ── CAPI + emails (all non-fatal; logged then continue) ──────────────
  const { firstName, lastName } = splitName(body.name);
  const hashed = hashUserData({
    email: body.email,
    phone: normalizePhoneForHash(body.phone),
    firstName,
    lastName,
  });
  const eventTime = Math.floor(Date.now() / 1000);
  const eventId = body.event_id ?? leadId; // fall back to lead.id so Pixel can still dedup if client forgot to send one
  const eventSourceUrl = eventSourceUrlFrom(req, body.event_source_url);

  const capiPromise = sendCapiEvent({
    event_name: "Lead",
    event_time: eventTime,
    event_id: eventId,
    event_source_url: eventSourceUrl,
    user_data: {
      ...hashed,
      client_ip_address: clientIpFrom(req),
      client_user_agent: req.headers.get("user-agent") ?? undefined,
      fbc: body.fbc,
      fbp: body.fbp,
    },
    custom_data: {
      value: estimatedValue,
      currency: "CAD",
      lead_event_source: body.source,
      ...(body.campaign ? { lead_event_campaign: body.campaign } : {}),
      ...(body.intent ? { lead_event_intent: body.intent } : {}),
    },
  }).catch((err) => {
    console.warn("[leads/create] CAPI promise rejected (should not happen)", err);
    return { ok: false };
  });

  const skipEmailsForTest = body.__test_skip_emails === true && process.env.NODE_ENV !== "production";
  if (skipEmailsForTest) {
    console.warn("[leads/create] skipping emails per __test_skip_emails flag (dev only)");
  }

  const alertTo = process.env.ALERT_EMAIL_TO;
  const confirmPromise = !skipEmailsForTest && body.email
    ? sendConfirmationEmail({ to: body.email, leadName: body.name }).catch((err) => {
        console.warn("[leads/create] confirmation email failed", err);
      })
    : Promise.resolve();
  const alertPromise = !skipEmailsForTest && alertTo
    ? sendAlertEmail({ to: alertTo, leadId, body, estimatedValue }).catch((err) => {
        console.warn("[leads/create] alert email failed", err);
      })
    : Promise.resolve();

  await Promise.all([capiPromise, confirmPromise, alertPromise]);

  return NextResponse.json({ ok: true, lead_id: leadId });
}
