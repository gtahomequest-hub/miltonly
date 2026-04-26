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
      },
    });

    notifyNewLead(body, lead.id).catch((e) => console.error("Email notify error:", e));

    return NextResponse.json({ success: true, id: lead.id });
  } catch (e) {
    console.error("Lead creation error:", e);
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 });
  }
}
