import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { formatLeadParseTextBody } from "@/lib/email";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL || `${config.SITE_NAME} <noreply@${config.SITE_DOMAIN}>`;
const TO = process.env.REALTOR_EMAIL || config.realtor.email;
// kvCORE/BoldTrail lead-parsing inbox — see src/lib/email.ts for full docs.
const KVCORE_LEAD_PARSE_EMAIL = process.env.KVCORE_LEAD_PARSE_EMAIL || "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, email, message, address, slug } = body as {
      name?: string;
      phone?: string;
      email?: string;
      message?: string;
      address?: string;
      slug?: string;
    };

    if (!name || !phone) {
      return NextResponse.json({ error: "Name and phone required" }, { status: 400 });
    }

    // Attribution capture — see src/lib/attribution.ts. Sent by InquiryForm.tsx
    // via attributionPayload() spread into the fetch body. Missing on legacy
    // submissions (pre-2026-05-11) — fields default to null.
    const utmSource = (body.utm_source || "").toString().slice(0, 80) || null;
    const utmMedium = (body.utm_medium || "").toString().slice(0, 80) || null;
    const utmCampaign = (body.utm_campaign || "").toString().slice(0, 120) || null;
    const utmKeyword = (body.utm_term || "").toString().slice(0, 120) || null;
    const utmContent = (body.utm_content || "").toString().slice(0, 120) || null;
    const gclid = (body.gclid || "").toString().slice(0, 200) || null;
    const utmSourceLast = (body.utm_source_last || "").toString().slice(0, 80) || null;
    const utmMediumLast = (body.utm_medium_last || "").toString().slice(0, 80) || null;
    const utmCampaignLast = (body.utm_campaign_last || "").toString().slice(0, 120) || null;
    const utmTermLast = (body.utm_term_last || "").toString().slice(0, 120) || null;
    const utmContentLast = (body.utm_content_last || "").toString().slice(0, 120) || null;
    const gclidLast = (body.gclid_last || "").toString().slice(0, 200) || null;
    const landingPage = (body.landingPage || "").toString().slice(0, 300) || null;
    const firstVisitAt = body.firstVisitAt ? new Date(body.firstVisitAt) : null;

    const lead = await prisma.lead.create({
      data: {
        firstName: name,
        email: email || "",
        phone,
        source: "exclusive-listing",
        intent: "buyer",
        score: "hot",
        scorePoints: 40,
        street: address || null,
        notes: message || null,
        utmSource,
        utmMedium,
        utmCampaign,
        utmKeyword,
        utmContent,
        gclid,
        utmSourceLast,
        utmMediumLast,
        utmCampaignLast,
        utmTermLast,
        utmContentLast,
        gclidLast,
        landingPage,
        firstVisitAt,
      },
    });

    if (resend && TO) {
      try {
        // Plain-text body for kvCORE parser — same builder as notifyNewLead.
        const text = formatLeadParseTextBody({
          firstName: name,
          email: email || undefined,
          phone,
          source: "exclusive-listing",
          intent: "buyer",
          street: address || undefined,
          notes: message || undefined,
          gclid: gclid || undefined,
          utm_source: utmSource || undefined,
          utm_medium: utmMedium || undefined,
          utm_campaign: utmCampaign || undefined,
          utm_term: utmKeyword || undefined,
          utm_content: utmContent || undefined,
          pageUrl: landingPage || (slug ? `${config.SITE_URL_WWW}/exclusive/${slug}` : undefined),
        });

        const result = await resend.emails.send({
          from: FROM,
          to: TO,
          ...(KVCORE_LEAD_PARSE_EMAIL ? { bcc: [KVCORE_LEAD_PARSE_EMAIL] } : {}),
          replyTo: process.env.REALTOR_EMAIL,
          subject: `Exclusive listing inquiry — ${address || slug || "unknown"}`,
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;">
              <div style="background:linear-gradient(135deg,#07111f,#1e3a5f);padding:20px 24px;border-radius:12px 12px 0 0;">
                <h2 style="color:#f59e0b;margin:0;font-size:18px;">🔥 Exclusive Listing Inquiry</h2>
                <p style="color:#cbd5e1;margin:4px 0 0;font-size:13px;">${new Date().toLocaleString("en-CA", { timeZone: "America/Toronto" })}</p>
              </div>
              <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-top:none;">
                <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #f1f5f9;">Listing</td><td style="padding:10px 14px;color:#07111f;border-bottom:1px solid #f1f5f9;">${address || slug || "—"}</td></tr>
                <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #f1f5f9;">Name</td><td style="padding:10px 14px;color:#07111f;border-bottom:1px solid #f1f5f9;">${name}</td></tr>
                <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #f1f5f9;">Phone</td><td style="padding:10px 14px;color:#07111f;border-bottom:1px solid #f1f5f9;"><a href="tel:${phone}" style="color:#d97706;">${phone}</a></td></tr>
                ${email ? `<tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #f1f5f9;">Email</td><td style="padding:10px 14px;color:#07111f;border-bottom:1px solid #f1f5f9;"><a href="mailto:${email}" style="color:#d97706;">${email}</a></td></tr>` : ""}
                ${message ? `<tr><td style="padding:10px 14px;font-weight:600;color:#374151;vertical-align:top;">Message</td><td style="padding:10px 14px;color:#07111f;">${message.replace(/\n/g, "<br>")}</td></tr>` : ""}
              </table>
              <div style="padding:14px 24px;background:#fffbeb;border:1px solid #fde68a;border-top:none;border-radius:0 0 12px 12px;text-align:center;">
                <a href="tel:${phone}" style="color:#d97706;font-weight:700;font-size:15px;text-decoration:none;">📞 Call ${name} now</a>
              </div>
            </div>
          `,
          text,
        });
        if (result.error) {
          console.error("[email send failed]", { leadId: lead.id, source: "exclusive-listing", error: result.error.message });
        } else {
          console.log("[email sent]", { leadId: lead.id, source: "exclusive-listing", resendId: result.data?.id, kvcoreBcc: !!KVCORE_LEAD_PARSE_EMAIL });
        }
      } catch (e) {
        console.error("[email send failed]", { leadId: lead.id, source: "exclusive-listing", error: e instanceof Error ? e.message : String(e) });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Exclusive inquiry error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
