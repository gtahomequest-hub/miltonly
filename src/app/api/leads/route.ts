import { prisma } from "@/lib/prisma";
import { notifyNewLead } from "@/lib/email";
import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";
import { hit } from "@/lib/rateLimit";
import { sendLeadSms } from "@/lib/twilio";

const HONEYPOT = process.env.HONEYPOT_FIELD || "company_website";
const ADS_SOURCE = "ads-rentals-lp";

// Reused for the optional renter-facing cheat-sheet email. Realtor notification
// continues to flow through `notifyNewLead` (src/lib/email.ts) — both fire when
// CHEATSHEET_ENABLED=true; only `notifyNewLead` fires otherwise.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || "Miltonly <onboarding@resend.dev>";
const RESEND_REPLY_TO = process.env.RESEND_REPLY_TO || process.env.REALTOR_EMAIL;

// Auto-reply sender. Hardcoded to the Resend testing sender until miltonly.com
// domain is verified in Resend dashboard. Display name keeps it personal —
// "Aamir from Miltonly" rather than the raw onboarding@resend.dev address.
// reply-to routes the lead's reply to Aamir's real inbox.
const AUTO_REPLY_FROM = "Aamir from Miltonly <onboarding@resend.dev>";
const AUTO_REPLY_REPLY_TO = process.env.AAMIR_EMAIL || process.env.REALTOR_EMAIL || "aamir@miltonly.com";

// Fire-and-forget. Returns immediately so /api/leads response stays fast.
// All errors are caught + logged; never propagated to the client.
function sendAutoReply(args: {
  leadId: string;
  email: string;
  firstName: string;
}) {
  if (!resend) return;
  const { leadId, email, firstName } = args;
  const safeName = (firstName || "there").trim() || "there";
  const subject = "Got your Milton rental request — calling you in under 60 minutes";
  // RECO compliance: every realtor communication must accurately identify
  // the brokerage. Brokerage = "RE/MAX Realty Specialists Inc., Brokerage".
  // Signature block follows: bold name, accent line, brokerage, stats, contact
  // row, compliance asterisk note. Google Reviews row intentionally omitted
  // until a real URL is supplied — no placeholder/broken links shipped.
  const html = `
    <p>Hi ${safeName},</p>
    <p>Aamir here. I just got your request for a Milton rental.</p>
    <p>I'll be calling you in the next 60 minutes. If now is a bad time, just reply to this email and tell me when works.</p>
    <p>While you wait — a few things I want you to know:</p>
    <ul>
      <li>I'm RE/MAX Hall of Fame and have helped 150+ Milton families lease in the last 14 years</li>
      <li>You pay me nothing. The landlord covers my fee.</li>
      <li>I'll send you matching active listings before our call so you can scan options.</li>
    </ul>
    <p>Talk soon,</p>
    <table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:14px;line-height:1.5;max-width:600px;margin-top:24px;">
      <tr>
        <td style="padding-top:24px;border-top:2px solid #F5A524;">
          <div style="font-size:18px;font-weight:700;color:#1a1a1a;margin-bottom:2px;">
            Aamir Yaqoob, REALTOR<sup>&reg;</sup>
          </div>
          <div style="font-size:13px;color:#F5A524;font-weight:600;letter-spacing:0.3px;margin-bottom:8px;">
            RE/MAX Hall of Fame
          </div>
          <div style="font-size:13px;color:#555;margin-bottom:12px;">
            RE/MAX Realty Specialists Inc., Brokerage*
          </div>
          <div style="font-size:13px;color:#1a1a1a;margin-bottom:4px;">
            14 years focused on Milton &nbsp;&bull;&nbsp; 150+ families leased
          </div>
          <div style="margin-top:12px;">
            <a href="tel:+16478399090" style="color:#F5A524;text-decoration:none;font-weight:600;font-size:15px;">
              (647) 839-9090
            </a>
            &nbsp;&nbsp;|&nbsp;&nbsp;
            <a href="mailto:${AUTO_REPLY_REPLY_TO}" style="color:#1a1a1a;text-decoration:none;">
              ${AUTO_REPLY_REPLY_TO}
            </a>
          </div>
          <div style="margin-top:6px;">
            <a href="https://www.miltonly.com" style="color:#1a1a1a;text-decoration:none;font-size:13px;">
              miltonly.com
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
    "Aamir here. I just got your request for a Milton rental.",
    "",
    "I'll be calling you in the next 60 minutes. If now is a bad time, just reply to this email and tell me when works.",
    "",
    "While you wait — a few things I want you to know:",
    "  - I'm RE/MAX Hall of Fame and have helped 150+ Milton families lease in the last 14 years",
    "  - You pay me nothing. The landlord covers my fee.",
    "  - I'll send you matching active listings before our call so you can scan options.",
    "",
    "Talk soon,",
    "",
    "—",
    "",
    "Aamir Yaqoob, REALTOR®",
    "RE/MAX Hall of Fame",
    "RE/MAX Realty Specialists Inc., Brokerage*",
    "",
    "14 years focused on Milton • 150+ families leased",
    "",
    "(647) 839-9090",
    AUTO_REPLY_REPLY_TO,
    "miltonly.com",
    "",
    "*Not intended to solicit buyers or tenants currently under contract with another brokerage.",
  ].join("\n");

  resend.emails
    .send({
      from: AUTO_REPLY_FROM,
      to: email,
      replyTo: AUTO_REPLY_REPLY_TO,
      subject,
      html,
      text,
    })
    .then((result) => {
      if (result.error) {
        console.error("[auto-reply send failed]", { leadId, error: result.error.message });
      } else {
        console.log("[auto-reply sent]", { leadId, resendId: result.data?.id });
      }
    })
    .catch((e) => console.error("Auto-reply send error:", e));
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

    // 1. Honeypot — silent reject, no DB / SMS / email
    if (body && body[HONEYPOT]) {
      return NextResponse.json({ success: true, id: "spam", ok: true, redirect: "/rentals/thank-you?lid=spam" });
    }

    // 2. Rate limit — in-memory, per-instance (see src/lib/rateLimit.ts comment)
    const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() || "unknown";
    if (!hit(ip)) {
      return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 });
    }

    const { firstName, email, phone, source, intent, street, timeline, hasAgent } = body;
    const isAds = source === ADS_SOURCE;

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
          source: ADS_SOURCE,
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
        lead.id
      ).catch((e) => console.error("Email notify error:", e));

      // Auto-reply — fires within ~30s if email present. Skipped on honeypot
      // (already returned above) and when no email was captured.
      if (finalEmail) {
        sendAutoReply({ leadId: lead.id, email: finalEmail, firstName: trimmedName });
      }

      // Twilio stub — fire-and-forget. Currently logs to console; live SMS
      // wired but commented out until A2P 10DLC is registered.
      sendLeadSms({
        id: lead.id,
        firstName: trimmedName,
        phone: normalizedPhone,
        bedrooms: bedroomsInt,
        priceRangeMax: priceRangeMax,
        timeline: moveIn,
      }).catch((e) => console.error("Twilio stub error:", e));

      // Renter cheat-sheet email — gated by env flag + email presence.
      // TODO: swap RESEND_FROM_EMAIL to leads@miltonly.com once miltonly.com domain is verified in Resend dashboard
      if (process.env.CHEATSHEET_ENABLED === "true" && finalEmail && resend) {
        const pdfUrl = process.env.CHEATSHEET_PDF_URL || "https://www.miltonly.com/milton-rental-cheat-sheet.pdf";
        resend.emails
          .send({
            from: RESEND_FROM,
            to: finalEmail,
            replyTo: RESEND_REPLY_TO,
            subject: `Your Milton rental matches are coming, ${trimmedName} — read this in the meantime`,
            html: `
              <p>Hi ${trimmedName},</p>
              <p>Thanks for reaching out — Aamir will text you 3–5 hand-picked Milton matches by end of business day.</p>
              <p>While you wait, here's the <a href="${pdfUrl}">Milton Renter's Cheat Sheet (PDF)</a> — what landlords actually ask for, prices by neighbourhood, and three red flags to watch for.</p>
              <p>If anything's urgent, call or text <a href="tel:+16478399090">(647) 839-9090</a>.</p>
              <p>— Aamir Yaqoob<br>RE/MAX Realty Specialists Inc., Brokerage</p>
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

    notifyNewLead(body, lead.id).catch((e) => console.error("Email notify error:", e));

    // Auto-reply for non-ads sources (listing detail, alerts, etc.) — same
    // skip rules: skip if no email, honeypot already short-circuited above.
    if (lead.email) {
      sendAutoReply({ leadId: lead.id, email: lead.email, firstName: lead.firstName });
    }

    return NextResponse.json({ success: true, id: lead.id });
  } catch (e) {
    console.error("Lead creation error:", e);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}
