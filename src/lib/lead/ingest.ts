// THE submission path. One function, one Lead row, one set of side effects.
//
// Before this there were four ingress routes writing two tables with four different sets of
// side effects, so which emails a lead triggered depended on which form they happened to
// find. public.Lead is canonical now; ads.leads is no longer written.
//
// Order is load-bearing:
//   1. guards      — honeypot, origin, rate limit. Nothing is written for a rejected call.
//   2. Lead row    — must succeed. A failure here is a 500 and no side effects fire.
//   3. side effects — confirmation, ops alert, CRM parser email, watch, CAPI. Each is
//      independent and each failure is logged, never propagated: the lead is already saved
//      and a transient Resend outage must not tell the visitor their submission failed.

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveLeadEnv, isCountable, type LeadEnv } from "@/lib/lead/env";
import { normalizeIntent, leadValueFor } from "@/lib/lead/intent";
import { checkHoneypot, checkOrigin, checkRateLimit, type GuardVerdict } from "@/lib/lead/guards";
import { sendLeadConfirmation, sendOpsAlert } from "@/lib/lead/notify";
import { createWatchForLead, type WatchResult } from "@/lib/lead/savedSearch";
import { sendKvcoreParserEmail } from "@/lib/notifications/kvcore";
import { sendCapiEvent, hashUserData } from "@/lib/meta-capi";

export interface LeadBody {
  source?: string;
  intent?: string;
  name?: string;
  email?: string;
  phone?: string;
  /** The street, building or area the surface was about. A resolved name. */
  property_address?: string;
  neighbourhood?: string;
  notes?: string;
  timeline?: string;
  budget?: string;
  bedrooms?: string;
  campaign?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  fbclid?: string;
  fbc?: string;
  fbp?: string;
  event_id?: string;
  event_source_url?: string;
  mlsNumber?: string;
  consent?: boolean;
  consentText?: string;
  consentTimestamp?: string;
  /** Honeypot field, and anything else the caller sends, is read off the raw body. */
  [k: string]: unknown;
}

export interface IngestResult {
  ok: boolean;
  status: number;
  leadId?: string;
  env?: LeadEnv;
  error?: string;
  /** Present only in non-production, so a preview proof can show what fired. */
  diagnostics?: {
    confirmationEmailId: string | null;
    opsAlertId: string | null;
    watch: WatchResult;
    value: number;
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** The pathname a lead came from, which is the leads-per-page key. Host and query stripped
 *  here as well as in the view, so the stored value is already the thing being counted. */
function pagePathFrom(eventSourceUrl: string | undefined, referer: string | null): string | null {
  const raw = eventSourceUrl || referer;
  if (!raw) return null;
  try {
    return new URL(raw).pathname;
  } catch {
    return null;
  }
}

function scoreFor(intent: string, hasPhone: boolean): { score: string; points: number } {
  if (intent === "sell") return { score: "hot", points: 75 };
  if (hasPhone) return { score: "warm", points: 50 };
  return { score: "cold", points: 25 };
}

export async function ingestLead(body: LeadBody, req: NextRequest): Promise<IngestResult> {
  // ── 1. guards ───────────────────────────────────────────────────────────────────
  const honeypot = checkHoneypot(body);
  if (!honeypot.ok) {
    console.warn("[lead/ingest] rejected", { reason: honeypot.reason, source: body.source });
    return { ok: true, status: honeypot.status };
  }

  const source = (body.source ?? "").trim();
  if (!source) return { ok: false, status: 400, error: "source is required" };

  const email = (body.email ?? "").trim().toLowerCase();
  const phone = (body.phone ?? "").trim();
  if (!email && !phone) return { ok: false, status: 400, error: "email or phone is required" };
  if (email && !EMAIL_RE.test(email)) return { ok: false, status: 400, error: "invalid email" };

  const origin: GuardVerdict = checkOrigin(req.headers.get("origin"), req.headers.get("referer"));
  if (!origin.ok) {
    console.warn("[lead/ingest] rejected", { reason: origin.reason, source });
    return { ok: false, status: origin.status, error: origin.error };
  }

  const ip = clientIp(req);
  const limit = await checkRateLimit({ ip, email: email || undefined });
  if (!limit.ok) {
    console.warn("[lead/ingest] rejected", { reason: limit.reason, source });
    return { ok: false, status: limit.status, error: limit.error };
  }

  // ── 2. the row ──────────────────────────────────────────────────────────────────
  const env = resolveLeadEnv(req.headers.get("host"));
  const intent = normalizeIntent(body.intent);
  const value = leadValueFor(body.intent);
  const { score, points } = scoreFor(intent, phone.length >= 10);
  const subject = (body.property_address ?? "").trim() || null;
  const page = pagePathFrom(body.event_source_url, req.headers.get("referer"));
  const name = (body.name ?? "").trim();

  let leadId: string;
  try {
    const row = await prisma.lead.create({
      data: {
        firstName: name || "Unknown",
        email: email || null,
        phone: phone || null,
        // The RAW token is stored, exactly as the surface sent it, so existing analytics
        // that group on intent keep working. `intent` for the value model is derived.
        intent: (body.intent ?? intent).toString(),
        score,
        scorePoints: points,
        street: subject,
        neighbourhoods: body.neighbourhood ? [body.neighbourhood] : [],
        notes: body.notes ?? null,
        timeline: body.timeline ?? null,
        mlsNumber: typeof body.mlsNumber === "string" && /^[A-Z][0-9]{8}$/.test(body.mlsNumber) ? body.mlsNumber : null,
        source,
        env,
        consentText: typeof body.consentText === "string" ? body.consentText.slice(0, 2000) : null,
        consentTimestamp: body.consentTimestamp ? new Date(body.consentTimestamp) : null,
        utmSource: body.utm_source?.slice(0, 80) || null,
        utmMedium: body.utm_medium?.slice(0, 80) || null,
        utmCampaign: body.utm_campaign?.slice(0, 120) || null,
        utmContent: body.utm_content?.slice(0, 120) || null,
        utmKeyword: body.utm_term?.slice(0, 120) || null,
        gclid: body.gclid?.slice(0, 200) || null,
        landingPage: page,
        referrer: req.headers.get("referer")?.slice(0, 300) || null,
        userAgent: req.headers.get("user-agent")?.slice(0, 300) || null,
        ip,
      },
      select: { id: true },
    });
    leadId = row.id;
  } catch (err) {
    console.error("[lead/ingest] Lead write failed", err);
    return { ok: false, status: 500, error: "db_write_failed" };
  }

  // ── 3. side effects ─────────────────────────────────────────────────────────────
  const ctx = { source, subject };

  const watchPromise = createWatchForLead({
    source,
    email: email || null,
    leadId,
    env,
    subject,
    neighbourhood: body.neighbourhood ?? null,
  }).catch((err): WatchResult => {
    console.warn("[lead/ingest] watch creation failed", err);
    return { created: false, skipped: "error" };
  });

  const confirmPromise = email
    ? sendLeadConfirmation({ to: email, name: name || null, ctx }).catch((err) => {
        console.warn("[lead/ingest] confirmation email failed", err);
        return null;
      })
    : Promise.resolve(null);

  const watch = await watchPromise;

  const alertPromise = sendOpsAlert({
    leadId,
    env,
    value,
    fields: {
      source,
      intent: body.intent ?? intent,
      value_intent: intent,
      name: name || undefined,
      email: email || undefined,
      phone: phone || undefined,
      subject: subject ?? undefined,
      neighbourhood: body.neighbourhood ?? undefined,
      notes: body.notes ?? undefined,
      page: page ?? undefined,
      watch: watch.created ? `${watch.kind} watch ${watch.id}` : watch.skipped,
    },
  }).catch((err) => {
    console.warn("[lead/ingest] ops alert failed", err);
    return null;
  });

  // kvCORE / BoldTrail parser email on every lead. A silent no-op while
  // KVCORE_LEAD_PARSE_EMAIL is unset, which it is in production today.
  const crmPromise = sendKvcoreParserEmail(
    {
      firstName: name || undefined,
      email: email || undefined,
      phone: phone || undefined,
      source,
      intent: body.intent ?? intent,
      timeline: body.timeline,
      budget: body.budget,
      bedrooms: body.bedrooms,
    },
    leadId,
  ).catch((err) => console.warn("[lead/ingest] kvcore parser email failed", err));

  // Meta CAPI. Only for countable leads: a preview test must not move a real ad account's
  // optimization, and Meta has no environment dimension to file it under.
  const capiPromise = isCountable(env)
    ? sendCapiEvent({
        event_name: "Lead",
        event_time: Math.floor(Date.now() / 1000),
        event_id: (typeof body.event_id === "string" && body.event_id) || leadId,
        event_source_url: body.event_source_url || req.headers.get("referer") || `https://${process.env.VERCEL_URL ?? "miltonly.com"}/`,
        user_data: {
          ...hashUserData({ email: email || undefined, phone: phone || undefined, firstName: name || undefined }),
          client_ip_address: ip,
          client_user_agent: req.headers.get("user-agent") ?? undefined,
          fbc: typeof body.fbc === "string" ? body.fbc : undefined,
          fbp: typeof body.fbp === "string" ? body.fbp : undefined,
        },
        custom_data: { value, currency: "CAD", lead_event_source: source },
      }).catch(() => ({ ok: false }))
    : Promise.resolve({ ok: false });

  const [confirmationEmailId, opsAlertId] = await Promise.all([confirmPromise, alertPromise]);
  await Promise.all([crmPromise, capiPromise]);

  console.log("[lead/ingest] stored", { leadId, source, env, value, watch: watch.created ? watch.kind : watch.skipped });

  return {
    ok: true,
    status: 200,
    leadId,
    env,
    ...(isCountable(env) ? {} : { diagnostics: { confirmationEmailId, opsAlertId, watch, value } }),
  };
}
