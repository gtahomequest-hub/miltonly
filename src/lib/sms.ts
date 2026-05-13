// SMS notification for Aamir — redundant channel alongside Resend email.
// Email is the primary path; SMS is additive defense for Vercel ↔ Resend
// intermittent outbound issues (since 2026-05-11). Either channel failing
// must NOT block the other; the Lead row is the system of record.
//
// Wires Twilio's REST API. Module-load lazy client (constructs only when
// SID + token are present). When unconfigured, notifyAamirBySMS is a
// silent no-op so dev/preview environments don't get spammed and the
// lead-capture path still succeeds.
//
// Required env (set in Vercel after this commit ships):
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_FROM_PHONE     E.164, e.g. +16108876469 (Twilio number)
//   REALTOR_PHONE         E.164, e.g. +16478399090 (Aamir's mobile)

import twilio from "twilio";
import type { LeadData } from "./email";

const twilioClient =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

if (!twilioClient && process.env.NODE_ENV === "production") {
  console.warn("[sms] Twilio not configured — SMS notifications disabled");
}

const BUYER_TIMELINE_LABEL: Record<string, string> = {
  asap: "ASAP",
  "1-3months": "Next 1–3 months",
  "3-6months": "3–6 months",
  browsing: "Just browsing",
};

/**
 * Build the Aamir-facing SMS body for a new lead. Pure function — exported
 * for the prebuild regression test (scripts/test-sms-format.ts). No I/O,
 * no env reads, no Twilio dependency. Safe for any caller.
 *
 * Renter format (5 lines, ~160 chars):
 *   🏠 New Milton lead [LAST4]
 *   {type} · ${budget} · {timeline}
 *   Call: {phone}
 *   Lead ID: {last 8 of leadId}
 *
 * Buyer format (intent === "buyer", sales variant):
 *   🏠 NEW SALE LEAD
 *   Lead [LAST4] · {phone} · {email}
 *   Timeline: {label} · Pre-approved: {YES|NO}
 *   Listing: {mlsNumber or "—"}
 *   Source: {raw source tag}
 *
 * Falls back gracefully when fields are missing — never emits literal
 * "undefined" or breaks on a null phone.
 */
export function buildAamirSMSBody(data: LeadData, leadId: string): string {
  const phoneLast4 = data.phone?.slice(-4) || "????";

  // Home-valuation lead-magnet (Commit 4j). The address of the submitter's
  // current home is the headline detail Aamir needs — he'll pull comps for
  // it before calling back.
  if (data.intent === "home-valuation") {
    const phoneStr = data.phone || "(no phone)";
    const emailStr = data.email || "(no email)";
    const addrStr = data.yourHomeAddress || "(no address)";
    const sourceStr = data.source || "—";
    return [
      "📐 NEW VALUATION REQUEST",
      `Lead [${phoneLast4}] · ${phoneStr} · ${emailStr}`,
      `Their home: ${addrStr.length > 80 ? addrStr.slice(0, 79) + "…" : addrStr}`,
      `Source: ${sourceStr}`,
    ].join("\n");
  }

  // Market-pulse-unlock lead-magnet (Commit 4j). Aamir's follow-up
  // composes a richer report — the SMS just confirms the new subscriber.
  if (data.intent === "market-pulse-unlock") {
    const phoneStr = data.phone || "(no phone)";
    const emailStr = data.email || "(no email)";
    const listingStr = data.mlsNumber || "—";
    const sourceStr = data.source || "—";
    return [
      "📈 NEW MARKET-PULSE LEAD",
      `Lead [${phoneLast4}] · ${phoneStr} · ${emailStr}`,
      `From listing: ${listingStr}`,
      `Source: ${sourceStr}`,
    ].join("\n");
  }

  if (data.intent === "buyer") {
    const phoneStr = data.phone || "(no phone)";
    const emailStr = data.email || "(no email)";
    const timelineLabel = data.timeline
      ? (BUYER_TIMELINE_LABEL[data.timeline] || data.timeline)
      : "—";
    const preApprovedStr = data.preApproved
      ? data.preApproved.toUpperCase()
      : "—";
    const listingStr = data.mlsNumber || "—";
    const sourceStr = data.source || "—";
    const sourceLine = `Source: ${sourceStr}`;
    // Sales leads with a free-text message (from the AamirTrustCard capture
    // flow) get an extra clause on the source line: · "{message…}". Capped at
    // 80 chars + ellipsis so the SMS stays within a reasonable segment count.
    const messageRaw = data.message?.trim();
    const sourceLineWithMessage = messageRaw
      ? `${sourceLine} · "${messageRaw.length > 80 ? messageRaw.slice(0, 79) + "…" : messageRaw}"`
      : sourceLine;
    return [
      "🏠 NEW SALE LEAD",
      `Lead [${phoneLast4}] · ${phoneStr} · ${emailStr}`,
      `Timeline: ${timelineLabel} · Pre-approved: ${preApprovedStr}`,
      `Listing: ${listingStr}`,
      sourceLineWithMessage,
    ].join("\n");
  }

  const budget = data.budget || data.priceRangeMax || "unknown";
  const type = data.propertyType || "unknown";
  const timeline = data.timeline || "asap";
  const callLine = data.phone ? `Call: ${data.phone}` : "Call: (no phone)";
  const leadIdSuffix = leadId ? leadId.slice(-8) : "????????";
  return `🏠 New Milton lead [${phoneLast4}]\n${type} · $${budget} · ${timeline}\n${callLine}\nLead ID: ${leadIdSuffix}`;
}

export async function notifyAamirBySMS(
  data: LeadData,
  leadId: string,
): Promise<void> {
  if (
    !twilioClient ||
    !process.env.TWILIO_FROM_PHONE ||
    !process.env.REALTOR_PHONE
  ) {
    return;
  }

  const message = buildAamirSMSBody(data, leadId);

  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_FROM_PHONE!,
      to: process.env.REALTOR_PHONE!,
    });
    console.log("[sms sent]", { leadId, source: data.source, sid: result.sid });
  } catch (e) {
    console.error("[sms send failed]", {
      leadId,
      source: data.source,
      error: e instanceof Error ? e.message : String(e),
    });
    // Re-throw so withRetry at the call site can retry transient Twilio
    // failures (e.g. iad1 → twilio.com timeout). Callers that don't wrap
    // with withRetry still have their existing .catch() chains in place.
    throw e;
  }
}
