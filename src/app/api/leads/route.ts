import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { notifyNewLead } from "@/lib/email";
import { withRetry } from "@/lib/notifications/retry";
import { sendKvcoreParserEmail } from "@/lib/notifications/kvcore";
import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";
import { hit } from "@/lib/rateLimit";
import { notifyAamirBySMS } from "@/lib/sms";

const HONEYPOT = process.env.HONEYPOT_FIELD || "company_website";
const ADS_SOURCE = "ads-rentals-lp";

// Reused for the optional renter-facing cheat-sheet email. Realtor notification
// continues to flow through `notifyNewLead` (src/lib/email.ts) — both fire when
// CHEATSHEET_ENABLED=true; only `notifyNewLead` fires otherwise.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || `${config.SITE_NAME} <onboarding@resend.dev>`;
const RESEND_REPLY_TO = process.env.RESEND_REPLY_TO || process.env.REALTOR_EMAIL;

// Auto-reply sender. Hardcoded to the Resend testing sender until the site
// domain is verified in Resend dashboard. Display name keeps it personal —
// "<First> from <SiteName>" rather than the raw onboarding@resend.dev address.
// reply-to routes the lead's reply to the realtor's real inbox.
const AUTO_REPLY_FROM = `${config.realtor.name.split(" ")[0]} from ${config.SITE_NAME} <onboarding@resend.dev>`;
const AUTO_REPLY_REPLY_TO = process.env.AAMIR_EMAIL || process.env.REALTOR_EMAIL || config.realtor.email;

// AUTO-REPLY FEATURE FLAG (disabled by default 2026-05-12) — the lead-facing
// auto-reply email currently fails for every real lead because the Resend
// account is still on the onboarding@resend.dev sandbox sender, which can
// only deliver to the account-owner inbox (gtahomequest@gmail.com). Sending
// to a real lead address returns 422 "verify a domain at resend.com/domains".
// Realtor notification (notifyNewLead) keeps working — only the lead-facing
// auto-reply is gated. Re-enable by setting ENABLE_AUTO_REPLY=true in Vercel
// after the verified-sender domain (Path B) ships.
const AUTO_REPLY_ENABLED = process.env.ENABLE_AUTO_REPLY === "true";

type AutoReplyVariant = "rental" | "sales";

// Sales-variant auto-reply — same retry / send semantics as the rental
// auto-reply, but with a sales-specific subject + body (4-business-hour
// SLA, comparables, no rental-leasing language). Dual-format (HTML + plain
// text) so every mail client renders cleanly.
function sendSalesAutoReply(args: {
  leadId: string;
  email: string;
  safeName: string;
  listingAddress: string | null;
}) {
  if (!resend) return;
  const { leadId, email, safeName, listingAddress } = args;
  const realtorFirstName = config.realtor.name.split(" ")[0];
  const propertyPhrase = listingAddress || "the property you were viewing";
  const subjectPropertyPhrase = listingAddress || "this property";
  const subject = `Got your request for ${subjectPropertyPhrase} — calling you within 4 business hours`;

  const html = `
    <p>Hi ${safeName},</p>
    <p>${realtorFirstName} here. I just got your request for ${propertyPhrase}.</p>
    <p>I'll call you within 4 business hours (9 AM – 9 PM ET). For anything urgent before then, call or text ${config.realtor.phone} directly.</p>
    <p>A few things to know while you wait:</p>
    <ul>
      <li>I'm RE/MAX Hall of Fame and have helped 150+ ${config.CITY_NAME} families buy and sell in the last ${config.realtor.yearsExperience} years</li>
      <li>I'll send you the full property info package plus 3–5 comparable sold properties so you can see how this listing is priced</li>
      <li>You're never under any obligation. We talk, you decide.</li>
    </ul>
    <p>Talk soon,</p>
    <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.5;max-width:600px;margin-top:24px;">
      <tr>
        <td style="padding-top:24px;border-top:2px solid #F5A524;">
          <div style="font-size:18px;font-weight:700;color:#1a1a1a;margin-bottom:2px;">
            ${config.realtor.name}, REALTOR<sup>&reg;</sup>
          </div>
          <div style="font-size:13px;color:#F5A524;font-weight:600;letter-spacing:0.3px;margin-bottom:8px;">
            RE/MAX Hall of Fame
          </div>
          <div style="font-size:13px;color:#555;margin-bottom:12px;">
            ${config.brokerage.name}*
          </div>
          <div style="font-size:13px;color:#1a1a1a;margin-bottom:4px;">
            ${config.realtor.yearsExperience} years focused on ${config.CITY_NAME} &nbsp;&bull;&nbsp; 150+ families helped &nbsp;&bull;&nbsp; $55M+ in transactions
          </div>
          <div style="margin-top:12px;">
            <a href="tel:${config.realtor.phoneE164}" style="color:#F5A524;text-decoration:none;font-weight:600;font-size:15px;">
              ${config.realtor.phone}
            </a>
            &nbsp;&nbsp;|&nbsp;&nbsp;
            <a href="mailto:${config.realtor.email}" style="color:#1a1a1a;text-decoration:none;">
              ${config.realtor.email}
            </a>
          </div>
          <div style="margin-top:6px;">
            <a href="${config.SITE_URL_WWW}" style="color:#1a1a1a;text-decoration:none;font-size:13px;">
              ${config.SITE_DOMAIN}
            </a>
          </div>
          <div style="margin-top:18px;font-size:11px;color:#888;line-height:1.4;">
            *Not intended to solicit buyers or sellers currently under contract with another brokerage.
          </div>
        </td>
      </tr>
    </table>
  `;
  const text = [
    `Hi ${safeName},`,
    "",
    `${realtorFirstName} here. I just got your request for ${propertyPhrase}.`,
    "",
    "I'll call you within 4 business hours (9 AM – 9 PM ET). For anything urgent before then, call or text " + config.realtor.phone + " directly.",
    "",
    "A few things to know while you wait:",
    "",
    `  - I'm RE/MAX Hall of Fame and have helped 150+ ${config.CITY_NAME} families buy and sell in the last ${config.realtor.yearsExperience} years`,
    "  - I'll send you the full property info package plus 3–5 comparable sold properties so you can see how this listing is priced",
    "  - You're never under any obligation. We talk, you decide.",
    "",
    "Talk soon,",
    "",
    "—",
    "",
    `${config.realtor.name}, REALTOR®`,
    "RE/MAX Hall of Fame",
    `${config.brokerage.name}*`,
    "",
    `${config.realtor.yearsExperience} years focused on ${config.CITY_NAME} • 150+ families helped • $55M+ in transactions`,
    "",
    config.realtor.phone,
    config.realtor.email,
    config.SITE_DOMAIN,
    "",
    "*Not intended to solicit buyers or sellers currently under contract with another brokerage.",
  ].join("\n");

  withRetry(
    async () => {
      const result = await resend!.emails.send({
        from: AUTO_REPLY_FROM,
        to: email,
        replyTo: AUTO_REPLY_REPLY_TO,
        subject,
        html,
        text,
      });
      if (result.error) {
        const msg = result.error.message || JSON.stringify(result.error);
        throw new Error(msg);
      }
      return result;
    },
    { label: "resend:auto-reply", leadId },
  )
    .then((result) => {
      console.log("[auto-reply sent]", { leadId, resendId: result.data?.id });
    })
    .catch((e) => console.error("[auto-reply send failed]", { leadId, error: e instanceof Error ? e.message : String(e) }));
}

// Fire-and-forget. Returns immediately so /api/leads response stays fast.
// All errors are caught + logged; never propagated to the client.
//
// Two variants share the same signature shape; `salesContext` is read only
// when variant === "sales" and personalizes the "Got your request for ..."
// subject line. Both variants emit dual-format (HTML + plain text), RECO-
// compliant signature, no Google Reviews placeholder.
function sendAutoReply(args: {
  leadId: string;
  email: string;
  firstName: string;
  variant?: AutoReplyVariant;
  salesContext?: {
    listingAddress?: string | null;
  };
}) {
  if (!resend) return;
  const { leadId, email, firstName, variant = "rental", salesContext } = args;
  const safeName = (firstName || "there").trim() || "there";

  if (variant === "sales") {
    return sendSalesAutoReply({ leadId, email, safeName, listingAddress: salesContext?.listingAddress ?? null });
  }

  const subject = `Got your ${config.CITY_NAME} rental request — calling you in under 60 minutes`;
  // RECO compliance: every realtor communication must accurately identify
  // the brokerage. Brokerage = "RE/MAX Realty Specialists Inc., Brokerage".
  // Signature block follows: bold name, accent line, brokerage, stats, contact
  // row, compliance asterisk note. Google Reviews row intentionally omitted
  // until a real URL is supplied — no placeholder/broken links shipped.
  const html = `
    <p>Hi ${safeName},</p>
    <p>${config.realtor.name.split(" ")[0]} here. I just got your request for a ${config.CITY_NAME} rental.</p>
    <p>I'll be calling you in the next 60 minutes. If now is a bad time, just reply to this email and tell me when works.</p>
    <p>While you wait — a few things I want you to know:</p>
    <ul>
      <li>I'm RE/MAX Hall of Fame and have helped 150+ ${config.CITY_NAME} families lease in the last ${config.realtor.yearsExperience} years</li>
      <li>You pay me nothing. The landlord covers my fee.</li>
      <li>I'll send you matching active listings before our call so you can scan options.</li>
    </ul>
    <p>Talk soon,</p>
    <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.5;max-width:600px;margin-top:24px;">
      <tr>
        <td style="padding-top:24px;border-top:2px solid #F5A524;">
          <div style="font-size:18px;font-weight:700;color:#1a1a1a;margin-bottom:2px;">
            ${config.realtor.name}, REALTOR<sup>&reg;</sup>
          </div>
          <div style="font-size:13px;color:#F5A524;font-weight:600;letter-spacing:0.3px;margin-bottom:8px;">
            RE/MAX Hall of Fame
          </div>
          <div style="font-size:13px;color:#555;margin-bottom:12px;">
            ${config.brokerage.name}*
          </div>
          <div style="font-size:13px;color:#1a1a1a;margin-bottom:4px;">
            ${config.realtor.yearsExperience} years focused on ${config.CITY_NAME} &nbsp;&bull;&nbsp; 150+ families leased
          </div>
          <div style="margin-top:12px;">
            <a href="tel:${config.realtor.phoneE164}" style="color:#F5A524;text-decoration:none;font-weight:600;font-size:15px;">
              ${config.realtor.phone}
            </a>
            &nbsp;&nbsp;|&nbsp;&nbsp;
            <a href="mailto:${config.realtor.email}" style="color:#1a1a1a;text-decoration:none;">
              ${config.realtor.email}
            </a>
          </div>
          <div style="margin-top:6px;">
            <a href="${config.SITE_URL_WWW}" style="color:#1a1a1a;text-decoration:none;font-size:13px;">
              ${config.SITE_DOMAIN}
            </a>
          </div>
          <div style="margin-top:18px;font-size:11px;color:#888;line-height:1.4;">
            *Not intended to solicit buyers or tenants currently under contract with another brokerage.
          </div>
        </td>
      </tr>
    </table>
  `;
  const text = [
    `Hi ${safeName},`,
    "",
    `${config.realtor.name.split(" ")[0]} here. I just got your request for a ${config.CITY_NAME} rental.`,
    "",
    "I'll be calling you in the next 60 minutes. If now is a bad time, just reply to this email and tell me when works.",
    "",
    "While you wait — a few things I want you to know:",
    `  - I'm RE/MAX Hall of Fame and have helped 150+ ${config.CITY_NAME} families lease in the last ${config.realtor.yearsExperience} years`,
    "  - You pay me nothing. The landlord covers my fee.",
    "  - I'll send you matching active listings before our call so you can scan options.",
    "",
    "Talk soon,",
    "",
    "—",
    "",
    `${config.realtor.name}, REALTOR®`,
    "RE/MAX Hall of Fame",
    `${config.brokerage.name}*`,
    "",
    `${config.realtor.yearsExperience} years focused on ${config.CITY_NAME} • 150+ families leased`,
    "",
    config.realtor.phone,
    config.realtor.email,
    config.SITE_DOMAIN,
    "",
    "*Not intended to solicit buyers or tenants currently under contract with another brokerage.",
  ].join("\n");

  // Wrap the Resend send in withRetry so transient iad1 → resend.com
  // network failures get absorbed. The Resend SDK returns { error: ... }
  // on non-network failures (auth, domain, sandbox-restriction) AND
  // throws on network failures — both paths route into the closure's
  // throw so withRetry retries either way. Final-attempt failure falls
  // into the outer .catch below which preserves the existing
  // "[auto-reply send failed]" log line.
  withRetry(
    async () => {
      const result = await resend!.emails.send({
        from: AUTO_REPLY_FROM,
        to: email,
        replyTo: AUTO_REPLY_REPLY_TO,
        subject,
        html,
        text,
      });
      if (result.error) {
        const msg = result.error.message || JSON.stringify(result.error);
        throw new Error(msg);
      }
      return result;
    },
    { label: "resend:auto-reply", leadId },
  )
    .then((result) => {
      console.log("[auto-reply sent]", { leadId, resendId: result.data?.id });
    })
    .catch((e) => console.error("[auto-reply send failed]", { leadId, error: e instanceof Error ? e.message : String(e) }));
}

const HOME_TYPE_TO_PROPERTY_TYPE: Record<string, string | null> = {
  any: null,
  condo: "condo",
  town: "townhouse", // tolerate spec literal; we always store the canonical form
  townhouse: "townhouse",
  semi: "semi",
  detached: "detached",
};

function bedroomToInt(v: string | undefined): number | null {
  if (v === "studio") return 0;
  if (v === "4+") return 4;
  if (typeof v === "string" && /^[0-9]+$/.test(v)) return parseInt(v, 10);
  return null;
}

function budgetToInt(v: string | undefined): number | null {
  if (!v || v === "0") return null; // honest about "no budget specified"
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function normalizePhone(raw: string): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.length === 10) return "+1" + digits;
  return "+" + digits;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Honeypot — silent reject, no DB / SMS / email. Redirect tracks intent
    // so sales-variant bots get the sales thank-you (same client-side GA4 gate
    // already short-circuits on lid=spam).
    if (body && body[HONEYPOT]) {
      const spamRedirect = body.intent === "buyer"
        ? "/sales/thank-you?lid=spam"
        : "/rentals/thank-you?lid=spam";
      return NextResponse.json({ success: true, id: "spam", ok: true, redirect: spamRedirect });
    }

    // 2. Rate limit — in-memory, per-instance (see src/lib/rateLimit.ts comment)
    const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || "unknown";
    if (!hit(ip)) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
    }

    const { firstName, email, phone, source, intent, street, timeline, hasAgent } = body;

    // ─── Sales / buyer intent — dedicated path (Commit 4a) ─────────────────
    // Reuses the helpers (rate limit, honeypot, normalizePhone, Lead write,
    // notifications) but keeps its own flow control. Buyer leads never fall
    // through to the ads-path or non-ads-path below.
    if (intent === "buyer") {
      // Validate timeline + preApproved (required).
      const VALID_TIMELINES = new Set(["asap", "1-3months", "3-6months", "browsing"]);
      const VALID_PRE_APPROVED = new Set(["yes", "no"]);
      const timelineRaw = typeof body.timeline === "string" ? body.timeline : "";
      const preApprovedRaw = typeof body.preApproved === "string" ? body.preApproved : "";
      if (!VALID_TIMELINES.has(timelineRaw)) {
        return NextResponse.json(
          { ok: false, error: "Please select your buying timeline." },
          { status: 400 },
        );
      }
      if (!VALID_PRE_APPROVED.has(preApprovedRaw)) {
        return NextResponse.json(
          { ok: false, error: "Please select your pre-approval status." },
          { status: 400 },
        );
      }

      // Validate mlsNumber format (optional). Accept lead even if invalid —
      // just don't persist the value (and log) so we never block conversion
      // on a malformed referrer-tag mlsNumber.
      const mlsRaw = typeof body.mlsNumber === "string" ? body.mlsNumber.trim() : "";
      const MLS_RE = /^[A-Z][0-9]{8}$/;
      let mlsNumberOut: string | null = null;
      if (mlsRaw) {
        if (MLS_RE.test(mlsRaw)) {
          mlsNumberOut = mlsRaw;
        } else {
          console.warn("[leads] sales lead with invalid mlsNumber format", { mlsNumber: mlsRaw, source });
        }
      }

      // Contact-field validation. Mirror the ads-path: at least one of
      // phone / email must be present + parseable.
      const trimmedName = (firstName || "").toString().trim() || `Lead ${(phone || "").toString().replace(/\D/g, "").slice(-4) || "0000"}`;
      const phoneRaw = (phone || "").toString();
      const emailRaw = (email || "").toString().trim();
      const hasPhone = phoneRaw.replace(/\D/g, "").length >= 10;
      const hasEmail = emailRaw.length > 0 && EMAIL_RE.test(emailRaw);
      if (!hasPhone && !hasEmail) {
        return NextResponse.json({ ok: false, error: "Please provide a phone or email." }, { status: 400 });
      }
      if (emailRaw.length > 0 && !hasEmail) {
        return NextResponse.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
      }

      const normalizedPhone = hasPhone ? normalizePhone(phoneRaw) : null;
      const finalEmail = hasEmail ? emailRaw.toLowerCase() : null;

      // Score: warm if pre-approved + ASAP/1-3mo, else if any phone present
      // -> warm, else cold. Keeps the existing 3-bucket model simple.
      const isHotIntent = preApprovedRaw === "yes" && (timelineRaw === "asap" || timelineRaw === "1-3months");
      const score = isHotIntent ? "hot" : hasPhone ? "warm" : "cold";
      const scorePoints = isHotIntent ? 75 : hasPhone ? 50 : 25;

      const referrer = (body.referrer || request.headers.get("referer") || "").toString().slice(0, 300) || null;
      const userAgent = (request.headers.get("user-agent") || "").slice(0, 300) || null;

      const lead = await prisma.lead.create({
        data: {
          firstName: trimmedName,
          email: finalEmail,
          phone: normalizedPhone,
          source: typeof source === "string" && source ? source : "sales-rentals-featured",
          intent: "buyer",
          score,
          scorePoints,
          timeline: timelineRaw,
          preApproved: preApprovedRaw,
          mlsNumber: mlsNumberOut,
          utmSource: (body.utm_source || "").toString().slice(0, 80) || null,
          utmMedium: (body.utm_medium || "").toString().slice(0, 80) || null,
          utmCampaign: (body.utm_campaign || "").toString().slice(0, 120) || null,
          utmKeyword: (body.utm_term || "").toString().slice(0, 120) || null,
          utmContent: (body.utm_content || "").toString().slice(0, 120) || null,
          gclid: (body.gclid || "").toString().slice(0, 200) || null,
          utmSourceLast: (body.utm_source_last || "").toString().slice(0, 80) || null,
          utmMediumLast: (body.utm_medium_last || "").toString().slice(0, 80) || null,
          utmCampaignLast: (body.utm_campaign_last || "").toString().slice(0, 120) || null,
          utmTermLast: (body.utm_term_last || "").toString().slice(0, 120) || null,
          utmContentLast: (body.utm_content_last || "").toString().slice(0, 120) || null,
          gclidLast: (body.gclid_last || "").toString().slice(0, 200) || null,
          firstVisitAt: body.firstVisitAt ? new Date(body.firstVisitAt) : null,
          landingPage: (body.landingPage || "").toString().slice(0, 300) || null,
          referrer,
          userAgent,
          ip,
        },
      });

      const notifyPayload = {
        firstName: trimmedName,
        email: finalEmail || undefined,
        phone: normalizedPhone || undefined,
        source: typeof source === "string" && source ? source : "sales-rentals-featured",
        intent: "buyer",
        timeline: timelineRaw,
        preApproved: preApprovedRaw,
        mlsNumber: mlsNumberOut || undefined,
      };

      // Realtor email — NEW SALE LEAD subject + body shape from notifyNewLead.
      withRetry(
        () => notifyNewLead(notifyPayload, lead.id),
        { label: "resend:realtor-email", leadId: lead.id },
      ).catch((e) => console.error("Email notify error:", e));

      // kvCORE / BoldTrail parser email — sales variant body (dormant until
      // KVCORE_LEAD_PARSE_EMAIL is set in Production).
      sendKvcoreParserEmail(notifyPayload, lead.id)
        .catch((e) => console.error("[kvcore notify error]", e));

      // Twilio SMS — NEW SALE LEAD shape from buildAamirSMSBody.
      withRetry(
        () => notifyAamirBySMS(notifyPayload, lead.id),
        { label: "twilio:sms", leadId: lead.id },
      ).catch((e) => console.error("[sms notify error]", e));

      // Sales auto-reply — 4-business-hour SLA. Same env gate as renter.
      if (finalEmail && AUTO_REPLY_ENABLED) {
        // Best-effort listing lookup so the subject line + body can reference
        // the actual address. Lookup failures don't block the auto-reply;
        // sendSalesAutoReply gracefully handles a null listingAddress.
        let listingAddress: string | null = null;
        if (mlsNumberOut) {
          try {
            const listing = await prisma.listing.findUnique({
              where: { mlsNumber: mlsNumberOut },
              select: { address: true, city: true },
            });
            if (listing) listingAddress = `${listing.address}, ${listing.city}`;
          } catch {
            // Swallow — non-fatal; auto-reply falls back to generic copy.
          }
        }
        sendAutoReply({
          leadId: lead.id,
          email: finalEmail,
          firstName: trimmedName,
          variant: "sales",
          salesContext: { listingAddress },
        });
      }

      return NextResponse.json({
        success: true,
        id: lead.id,
        ok: true,
        redirect: `/sales/thank-you?lid=${lead.id}`,
      });
    }

    // ADS_SOURCE-prefixed variants (e.g. "ads-rentals-lp-modal" from the
    // UnlockModal on /rentals/ads) get routed through the same paid-traffic
    // path: phone normalization, propertyType/priceRangeMax mapping, Twilio
    // SMS notification, auto-reply, attribution capture. The Lead row keeps
    // its specific source tag (e.g. "ads-rentals-lp-modal") so DB analytics
    // can split modal vs hero-form conversions.
    const isAds = source === ADS_SOURCE || (typeof source === "string" && source.startsWith(`${ADS_SOURCE}-`));

    if (isAds) {
      // ─── Strict validation for paid-traffic landing page ───
      const trimmedName = (firstName || "").toString().trim();
      if (trimmedName.length < 2 || trimmedName.length > 60) {
        return NextResponse.json({ ok: false, error: "Please enter your first name." }, { status: 400 });
      }

      const phoneRaw = (phone || "").toString();
      const emailRaw = (email || "").toString().trim();
      const hasPhone = phoneRaw.replace(/\D/g, "").length >= 10;
      const hasEmail = emailRaw.length > 0 && EMAIL_RE.test(emailRaw);

      if (!hasPhone && !hasEmail) {
        return NextResponse.json({ ok: false, error: "Please provide a phone or email." }, { status: 400 });
      }
      if (emailRaw.length > 0 && !hasEmail) {
        return NextResponse.json({ ok: false, error: "Please enter a valid email address." }, { status: 400 });
      }

      const normalizedPhone = hasPhone ? normalizePhone(phoneRaw) : null;
      const finalEmail = hasEmail ? emailRaw.toLowerCase() : null; // null, not "" — see TODO below

      // Form → Prisma column mapping (see spec FIELD MAPPING table)
      const bedroomsInt = bedroomToInt(body.bedrooms);
      const priceRangeMax = budgetToInt(body.budget);
      const homeType = (body.homeType || "any").toString().toLowerCase();
      const propertyType = homeType in HOME_TYPE_TO_PROPERTY_TYPE
        ? HOME_TYPE_TO_PROPERTY_TYPE[homeType]
        : null;
      const moveIn = ["asap", "1month", "flexible"].includes(body.moveIn) ? body.moveIn : "asap";

      // Score branch on source (only ads-rentals-lp gets new logic; other paths keep timeline-based)
      const score = hasPhone ? "warm" : "cold";
      const scorePoints = hasPhone ? 50 : 25;

      const referrer = (body.referrer || request.headers.get("referer") || "").toString().slice(0, 300) || null;
      const userAgent = (request.headers.get("user-agent") || "").slice(0, 300) || null;

      const lead = await prisma.lead.create({
        data: {
          firstName: trimmedName,
          email: finalEmail,
          phone: normalizedPhone,
          // Preserve the exact source the form sent (e.g. ads-rentals-lp,
          // ads-rentals-lp-modal). Fallback to ADS_SOURCE if missing.
          source: typeof source === "string" && source ? source : ADS_SOURCE,
          intent: "renter",
          score,
          scorePoints,
          bedrooms: bedroomsInt,
          priceRangeMin: 0,
          priceRangeMax,
          propertyType,
          timeline: moveIn,
          utmSource: (body.utm_source || "").toString().slice(0, 80) || null,
          utmMedium: (body.utm_medium || "").toString().slice(0, 80) || null,
          utmCampaign: (body.utm_campaign || "").toString().slice(0, 120) || null,
          utmKeyword: (body.utm_term || "").toString().slice(0, 120) || null,
          utmContent: (body.utm_content || "").toString().slice(0, 120) || null,
          gclid: (body.gclid || "").toString().slice(0, 200) || null,
          utmSourceLast: (body.utm_source_last || "").toString().slice(0, 80) || null,
          utmMediumLast: (body.utm_medium_last || "").toString().slice(0, 80) || null,
          utmCampaignLast: (body.utm_campaign_last || "").toString().slice(0, 120) || null,
          utmTermLast: (body.utm_term_last || "").toString().slice(0, 120) || null,
          utmContentLast: (body.utm_content_last || "").toString().slice(0, 120) || null,
          gclidLast: (body.gclid_last || "").toString().slice(0, 200) || null,
          firstVisitAt: body.firstVisitAt ? new Date(body.firstVisitAt) : null,
          landingPage: (body.landingPage || "").toString().slice(0, 300) || null,
          referrer,
          userAgent,
          ip,
        },
      });

      // Realtor email — preserves existing telemetry-instrumented pipeline.
      // Wrapped in withRetry to absorb transient iad1 → resend.com network
      // failures (1.5s / 3s / 6s backoff). The .catch() chain fires only
      // after all retries are exhausted.
      withRetry(
        () =>
          notifyNewLead(
            {
              firstName: trimmedName,
              email: finalEmail || undefined,
              phone: normalizedPhone || undefined,
              source: ADS_SOURCE,
              intent: "renter",
              timeline: moveIn,
              propertyType: propertyType || undefined,
              budget: priceRangeMax ? String(priceRangeMax) : undefined,
              bedrooms: bedroomsInt !== null ? String(bedroomsInt) : undefined,
            },
            lead.id,
          ),
        { label: "resend:realtor-email", leadId: lead.id },
      ).catch((e) => console.error("Email notify error:", e));

      // kvCORE / BoldTrail parser email — fire-and-forget plain-text send
      // to KVCORE_LEAD_PARSE_EMAIL so BoldTrail auto-creates the CRM lead.
      // Fires regardless of whether the lead provided an email (kvCORE
      // accepts phone-only leads). Internally retried + env-gated.
      sendKvcoreParserEmail(
        {
          firstName: trimmedName,
          email: finalEmail || undefined,
          phone: normalizedPhone || undefined,
          source: ADS_SOURCE,
          intent: "renter",
          timeline: moveIn,
          propertyType: propertyType || undefined,
          budget: priceRangeMax ? String(priceRangeMax) : undefined,
          bedrooms: bedroomsInt !== null ? String(bedroomsInt) : undefined,
        },
        lead.id,
      ).catch((e) => console.error("[kvcore notify error]", e));

      // Auto-reply — fires within ~30s if email present. Skipped on honeypot
      // (already returned above) and when no email was captured.
      if (finalEmail) {
        if (AUTO_REPLY_ENABLED) {
          sendAutoReply({ leadId: lead.id, email: finalEmail, firstName: trimmedName });
        }
      }

      // Twilio SMS to Aamir — redundant channel alongside email. Independent
      // .catch() so a Twilio failure never affects the Resend send (or vice
      // versa). The Lead row is the source of truth either way.
      // Wrapped in withRetry to absorb transient iad1 → twilio.com network
      // failures (1.5s / 3s / 6s backoff).
      withRetry(
        () =>
          notifyAamirBySMS(
            {
              firstName: trimmedName,
              phone: normalizedPhone || undefined,
              source: ADS_SOURCE,
              propertyType: propertyType || undefined,
              budget: priceRangeMax ? String(priceRangeMax) : undefined,
              timeline: moveIn,
            },
            lead.id,
          ),
        { label: "twilio:sms", leadId: lead.id },
      ).catch((e) => console.error("[sms notify error]", e));

      // Renter cheat-sheet email — gated by env flag + email presence.
      // TODO: swap RESEND_FROM_EMAIL to leads@<site domain> once domain is verified in Resend dashboard
      if (process.env.CHEATSHEET_ENABLED === "true" && finalEmail && resend) {
        const pdfUrl = process.env.CHEATSHEET_PDF_URL || `${config.SITE_URL_WWW}/${config.SLUG_SUFFIX}-rental-cheat-sheet.pdf`;
        resend.emails
          .send({
            from: RESEND_FROM,
            to: finalEmail,
            replyTo: RESEND_REPLY_TO,
            subject: `Your ${config.CITY_NAME} rental matches are coming, ${trimmedName} — read this in the meantime`,
            html: `
              <p>Hi ${trimmedName},</p>
              <p>Thanks for reaching out — ${config.realtor.name.split(" ")[0]} will text you 3–5 hand-picked ${config.CITY_NAME} matches by end of business day.</p>
              <p>While you wait, here's the <a href="${pdfUrl}">${config.CITY_NAME} Renter's Cheat Sheet (PDF)</a> — what landlords actually ask for, prices by neighbourhood, and three red flags to watch for.</p>
              <p>If anything's urgent, call or text <a href="tel:${config.realtor.phoneE164}">${config.realtor.phone}</a>.</p>
              <p>— ${config.realtor.name}<br>${config.brokerage.name}</p>
            `,
          })
          .then((result) => {
            if (result.error) {
              console.error("[cheat-sheet send failed]", { leadId: lead.id, error: result.error.message });
            } else {
              console.log("[cheat-sheet sent]", { leadId: lead.id, resendId: result.data?.id });
            }
          })
          .catch((e) => console.error("Cheat-sheet send error:", e));
      }

      // Dual-shape response — old callers continue using { success, id }, new code reads { ok, redirect }.
      return NextResponse.json({
        success: true,
        id: lead.id,
        ok: true,
        redirect: `/rentals/thank-you?lid=${lead.id}`,
      });
    }

    // ─── Existing path for all other lead sources (preserved) ───
    // TODO: normalize email empty-string → null across all sources in a follow-up commit.
    if (!firstName && !email && !phone) {
      return NextResponse.json({ error: "At least one contact field required" }, { status: 400 });
    }

    const lead = await prisma.lead.create({
      data: {
        firstName: firstName || "Unknown",
        email: email || "",
        phone: phone || null,
        source: source || "website",
        intent: intent || "buyer",
        score:
          timeline === "ASAP" || timeline === "Within 1 month"
            ? "hot"
            : timeline === "1–3 months"
              ? "warm"
              : "cold",
        scorePoints: phone ? 30 : 0,
        street: street || null,
        timeline: timeline || null,
        hasAgent: hasAgent === "Yes" ? true : hasAgent === "No" ? false : null,
        utmSource: (body.utm_source || "").toString().slice(0, 80) || null,
        utmMedium: (body.utm_medium || "").toString().slice(0, 80) || null,
        utmCampaign: (body.utm_campaign || "").toString().slice(0, 120) || null,
        utmKeyword: (body.utm_term || "").toString().slice(0, 120) || null,
        utmContent: (body.utm_content || "").toString().slice(0, 120) || null,
        gclid: (body.gclid || "").toString().slice(0, 200) || null,
        utmSourceLast: (body.utm_source_last || "").toString().slice(0, 80) || null,
        utmMediumLast: (body.utm_medium_last || "").toString().slice(0, 80) || null,
        utmCampaignLast: (body.utm_campaign_last || "").toString().slice(0, 120) || null,
        utmTermLast: (body.utm_term_last || "").toString().slice(0, 120) || null,
        utmContentLast: (body.utm_content_last || "").toString().slice(0, 120) || null,
        gclidLast: (body.gclid_last || "").toString().slice(0, 200) || null,
        firstVisitAt: body.firstVisitAt ? new Date(body.firstVisitAt) : null,
        landingPage: (body.landingPage || "").toString().slice(0, 300) || null,
      },
    });

    // Both wrapped in withRetry to absorb transient iad1 outbound failures.
    // Independent retry chains — Resend retry doesn't affect Twilio and vice versa.
    withRetry(() => notifyNewLead(body, lead.id), { label: "resend:realtor-email", leadId: lead.id })
      .catch((e) => console.error("Email notify error:", e));
    withRetry(() => notifyAamirBySMS(body, lead.id), { label: "twilio:sms", leadId: lead.id })
      .catch((e) => console.error("[sms notify error]", e));

    // kvCORE parser email — same shape as ads-path. Body fields are typed
    // `any` (from request.json()) so we explicitly construct the
    // KvcoreLeadInput shape with safe defaults. Source falls back to
    // "website" matching the existing non-ads lead.source default below.
    sendKvcoreParserEmail(
      {
        firstName: typeof body.firstName === "string" ? body.firstName : undefined,
        lastName: typeof body.lastName === "string" ? body.lastName : undefined,
        email: typeof body.email === "string" ? body.email : undefined,
        phone: typeof body.phone === "string" ? body.phone : undefined,
        source: typeof body.source === "string" && body.source ? body.source : "website",
        intent: typeof body.intent === "string" ? body.intent : undefined,
        timeline: typeof body.timeline === "string" ? body.timeline : undefined,
        budget: typeof body.budget === "string" ? body.budget : undefined,
        bedrooms: typeof body.bedrooms === "string" ? body.bedrooms : undefined,
        propertyType: typeof body.propertyType === "string" ? body.propertyType : undefined,
      },
      lead.id,
    ).catch((e) => console.error("[kvcore notify error]", e));

    // Auto-reply for non-ads sources (listing detail, alerts, etc.) — same
    // skip rules: skip if no email, honeypot already short-circuited above.
    if (lead.email) {
      if (AUTO_REPLY_ENABLED) {
        sendAutoReply({ leadId: lead.id, email: lead.email, firstName: lead.firstName });
      }
    }

    return NextResponse.json({ success: true, id: lead.id });
  } catch (e) {
    console.error("Lead creation error:", e);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}
