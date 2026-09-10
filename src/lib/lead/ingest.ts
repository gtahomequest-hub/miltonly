// THE submission path. One function, one Lead row, one set of side effects.
//
// Before Phase 1 there were four ingress routes writing two tables with four different sets
// of side effects, so which emails a lead triggered depended on which form they happened to
// find. Phase 2 folded in the last sixteen surfaces, and with them the fields that had kept
// them out: qualification answers, a CASL consent snapshot, a free-text message, a valuation
// address, and the market-pulse aggregate packet that has to come back in the response.
//
// Order is load-bearing:
//   1. guards      — honeypot, origin, rate limit. Nothing is written for a rejected call.
//   2. validation  — field-level, with the message the visitor reads. No row for a refusal.
//   3. Lead row    — must succeed. A failure here is a 500 and no side effects fire.
//   4. side effects — confirmation, ops alert, SMS, CRM parser email, watch, CAPI. Each is
//      independent and each failure is logged, never propagated: the lead is already saved
//      and a transient Resend outage must not tell the visitor their submission failed.
//
// THE SMS IS BACK. Phase 1's path sent the desk an email and nothing else, while the four
// monolith branches all sent Aamir a Twilio message as a second channel, added in May after
// a Vercel-to-Resend outage swallowed leads. Migrating the paid surfaces onto this path
// without it would have removed that redundancy exactly where it was bought.

import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveLeadEnv, isCountable, type LeadEnv } from "@/lib/lead/env";
import { normalizeIntent, leadValueFor } from "@/lib/lead/intent";
import { checkHoneypot, checkOrigin, checkRateLimit, type GuardVerdict } from "@/lib/lead/guards";
import { sendLeadConfirmation, sendOpsAlert } from "@/lib/lead/notify";
import { createWatchForLead, type WatchResult } from "@/lib/lead/savedSearch";
import { scoreLead } from "@/lib/lead/score";
import {
  normalizePhone,
  phoneDigits,
  bedroomToInt,
  propertyTypeFor,
  budgetToBand,
  sanitizeText,
  mlsNumberFor,
} from "@/lib/lead/fields";
import { sendKvcoreParserEmail } from "@/lib/notifications/kvcore";
import { notifyAamirBySMS } from "@/lib/sms";
import { sendCapiEvent, hashUserData } from "@/lib/meta-capi";
import { getMarketPulse } from "@/lib/market-pulse";
import type { Prisma } from "@prisma/client";

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
  homeType?: string;
  propertyType?: string;
  preApproved?: string;
  hasAgent?: string;
  message?: string;
  yourHomeAddress?: string;
  matchCriteria?: Record<string, unknown>;
  priceMin?: number;
  priceMax?: number;
  campaign?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  utm_source_last?: string;
  utm_medium_last?: string;
  utm_campaign_last?: string;
  utm_content_last?: string;
  utm_term_last?: string;
  gclid?: string;
  gclid_last?: string;
  firstVisitAt?: string;
  landingPage?: string;
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

type MarketPulsePacket = Awaited<ReturnType<typeof getMarketPulse>>;

export interface IngestResult {
  ok: boolean;
  status: number;
  leadId?: string;
  env?: LeadEnv;
  error?: string;
  /** The market-pulse reveal. Returned in every environment, because the surface cannot
   *  render without it: unlike `diagnostics`, it is the product, not a proof. */
  stats?: MarketPulsePacket | null;
  /** Present only in non-production, so a preview proof can show what fired. */
  diagnostics?: {
    confirmationEmailId: string | null;
    opsAlertId: string | null;
    watch: WatchResult;
    value: number;
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The one source whose reveal is computed server-side and returned to the page. */
const MARKET_PULSE_SOURCE = "sales-ads-market-pulse-unlock";

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

function str(v: unknown, cap: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, cap);
  return s.length > 0 ? s : null;
}

function parseDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

export async function ingestLead(body: LeadBody, req: NextRequest): Promise<IngestResult> {
  // 1. guards
  const honeypot = checkHoneypot(body);
  if (!honeypot.ok) {
    console.warn("[lead/ingest] rejected", { reason: honeypot.reason, source: body.source });
    return { ok: true, status: honeypot.status };
  }

  const source = (body.source ?? "").trim();
  if (!source) return { ok: false, status: 400, error: "source is required" };

  const origin: GuardVerdict = checkOrigin(req.headers.get("origin"), req.headers.get("referer"));
  if (!origin.ok) {
    console.warn("[lead/ingest] rejected", { reason: origin.reason, source });
    return { ok: false, status: origin.status, error: origin.error };
  }

  // 2. validation, in the words the visitor reads
  const email = (body.email ?? "").trim().toLowerCase();
  const digits = phoneDigits(body.phone);
  if (!email && !digits) {
    return { ok: false, status: 400, error: "Please provide a phone or email." };
  }
  if (email && !EMAIL_RE.test(email)) {
    return { ok: false, status: 400, error: "Please enter a valid email address." };
  }
  if (digits && digits.length < 10) {
    return { ok: false, status: 400, error: "Please enter a 10-digit phone number." };
  }
  // A surface that showed a CASL disclosure must have had it ticked. The consent snapshot is
  // the brokerage's answer to a CRTC complaint, so an unticked box is refused here too and
  // not only in the browser, where a disabled submit button can be reached around.
  const consentText = sanitizeText(body.consentText, 2000);
  if (body.consent === false) {
    return { ok: false, status: 400, error: "Please tick the consent checkbox to continue." };
  }

  const ip = clientIp(req);
  const limit = await checkRateLimit({ ip, email: email || undefined });
  if (!limit.ok) {
    console.warn("[lead/ingest] rejected", { reason: limit.reason, source });
    return { ok: false, status: limit.status, error: limit.error };
  }

  // 3. the row
  const env = resolveLeadEnv(req.headers.get("host"));
  const intent = normalizeIntent(body.intent);
  const value = leadValueFor(body.intent);
  const phone = normalizePhone(body.phone);
  const timeline = str(body.timeline, 80);
  const preApproved = str(body.preApproved, 10);
  const { score, points, temperature } = scoreLead({
    intent,
    hasPhone: Boolean(phone),
    preApproved,
    timeline,
  });
  const subject = str(body.property_address, 300);
  const page = pagePathFrom(body.event_source_url, req.headers.get("referer")) ?? str(body.landingPage, 300);
  const name = (body.name ?? "").trim();
  const band = budgetToBand(body.budget);
  const priceMin = typeof body.priceMin === "number" && Number.isFinite(body.priceMin) ? Math.round(body.priceMin) : band.min;
  const priceMax = typeof body.priceMax === "number" && Number.isFinite(body.priceMax) ? Math.round(body.priceMax) : band.max;
  const propertyType = propertyTypeFor(body.propertyType ?? body.homeType);
  const bedrooms = bedroomToInt(body.bedrooms);
  const message = sanitizeText(body.message);
  const notes = sanitizeText(body.notes);
  const mlsNumber = mlsNumberFor(body.mlsNumber);
  const yourHomeAddress = str(body.yourHomeAddress, 200);
  const matchCriteria =
    body.matchCriteria && typeof body.matchCriteria === "object" && !Array.isArray(body.matchCriteria)
      ? (body.matchCriteria as Prisma.InputJsonValue)
      : undefined;

  let leadId: string;
  try {
    const row = await prisma.lead.create({
      data: {
        firstName: name || "Unknown",
        email: email || null,
        phone,
        // The RAW token is stored, exactly as the surface sent it, so existing analytics
        // that group on intent keep working. `intent` for the value model is derived.
        intent: (body.intent ?? intent).toString(),
        score,
        scorePoints: points,
        leadTemperatureAtSubmit: temperature,
        street: subject,
        neighbourhoods: body.neighbourhood ? [body.neighbourhood] : [],
        notes,
        message,
        timeline,
        preApproved,
        hasAgent: body.hasAgent === "Yes" ? true : body.hasAgent === "No" ? false : null,
        bedrooms,
        propertyType,
        priceRangeMin: priceMin,
        priceRangeMax: priceMax,
        yourHomeAddress,
        matchCriteria,
        mlsNumber,
        source,
        env,
        consentText,
        consentTimestamp: parseDate(body.consentTimestamp),
        utmSource: str(body.utm_source, 80),
        utmMedium: str(body.utm_medium, 80),
        utmCampaign: str(body.utm_campaign, 120),
        utmContent: str(body.utm_content, 120),
        utmKeyword: str(body.utm_term, 120),
        gclid: str(body.gclid, 200),
        // Last-touch attribution. The client helper has always sent these six and this path
        // dropped all six, so every lead it wrote credited the first ad click and lost the
        // one that actually converted.
        utmSourceLast: str(body.utm_source_last, 80),
        utmMediumLast: str(body.utm_medium_last, 80),
        utmCampaignLast: str(body.utm_campaign_last, 120),
        utmContentLast: str(body.utm_content_last, 120),
        utmTermLast: str(body.utm_term_last, 120),
        gclidLast: str(body.gclid_last, 200),
        firstVisitAt: parseDate(body.firstVisitAt),
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

  // 4. side effects
  const ctx = { source, subject };

  const watchPromise = createWatchForLead({
    source,
    email: email || null,
    leadId,
    env,
    subject,
    neighbourhood: body.neighbourhood ?? null,
    priceMin,
    priceMax,
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

  // The market-pulse reveal. Computed from the consented criteria snapshot, k-anonymity
  // enforced inside getMarketPulse, and awaited because the page cannot render without it.
  // A compute failure returns null stats and the surface falls back to "report by email".
  const statsPromise: Promise<MarketPulsePacket | null> =
    source === MARKET_PULSE_SOURCE && matchCriteria
      ? (async () => {
          const mc = matchCriteria as { propertyType?: string; neighbourhood?: string };
          if (!mc.propertyType || !mc.neighbourhood) return null;
          try {
            return await getMarketPulse({ propertyType: mc.propertyType, neighbourhood: mc.neighbourhood });
          } catch (err) {
            console.error("[lead/ingest] market pulse compute failed", { leadId, err });
            return null;
          }
        })()
      : Promise.resolve(null);

  const watch = await watchPromise;

  const notifyFields = {
    firstName: name || undefined,
    email: email || undefined,
    phone: phone || undefined,
    source,
    intent: (body.intent ?? intent).toString(),
    street: subject ?? undefined,
    timeline: timeline ?? undefined,
    preApproved: preApproved ?? undefined,
    propertyType: propertyType ?? undefined,
    budget: priceMax != null ? String(priceMax) : undefined,
    bedrooms: bedrooms != null ? String(bedrooms) : undefined,
    mlsNumber: mlsNumber ?? undefined,
    message: message ?? undefined,
    yourHomeAddress: yourHomeAddress ?? undefined,
    notes: notes ?? undefined,
  };

  const alertPromise = sendOpsAlert({
    leadId,
    env,
    value,
    fields: {
      ...notifyFields,
      value_intent: intent,
      score,
      neighbourhood: body.neighbourhood ?? undefined,
      page: page ?? undefined,
      watch: watch.created ? `${watch.kind} watch ${watch.id}` : watch.skipped,
    },
  }).catch((err) => {
    console.warn("[lead/ingest] ops alert failed", err);
    return null;
  });

  // Twilio, to Aamir. The same environment rule the ops alert follows: a preview submission
  // must not ring a real phone unless the path is deliberately being proven.
  const smsPromise = isCountable(env)
    ? notifyAamirBySMS(notifyFields, leadId).catch((err) => console.warn("[lead/ingest] sms failed", err))
    : Promise.resolve(undefined);

  // kvCORE / BoldTrail parser email on every lead. A silent no-op while
  // KVCORE_LEAD_PARSE_EMAIL is unset, which it is in production today.
  const crmPromise = sendKvcoreParserEmail(notifyFields, leadId).catch((err) =>
    console.warn("[lead/ingest] kvcore parser email failed", err),
  );

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

  const [confirmationEmailId, opsAlertId, stats] = await Promise.all([confirmPromise, alertPromise, statsPromise]);
  await Promise.all([crmPromise, capiPromise, smsPromise]);

  console.log("[lead/ingest] stored", { leadId, source, env, value, score, watch: watch.created ? watch.kind : watch.skipped });

  return {
    ok: true,
    status: 200,
    leadId,
    env,
    ...(stats !== null ? { stats } : {}),
    ...(isCountable(env) ? {} : { diagnostics: { confirmationEmailId, opsAlertId, watch, value } }),
  };
}
