import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { notifyAamirBySMS } from "@/lib/sms";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.RESEND_FROM_EMAIL || `${config.SITE_NAME} <noreply@${config.SITE_DOMAIN}>`;
const TO = process.env.REALTOR_EMAIL || config.realtor.email;

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
      },
    });

    if (resend && TO) {
      try {
        const result = await resend.emails.send({
          from: FROM,
          to: TO,
          replyTo: process.env.REALTOR_EMAIL,
          subject: `Exclusive listing inquiry \u2014 ${address || slug || "unknown"}`,
          html: `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;">
              <div style="background:linear-gradient(135deg,#07111f,#1e3a5f);padding:20px 24px;border-radius:12px 12px 0 0;">
                <h2 style="color:#f59e0b;margin:0;font-size:18px;">\uD83D\uDD25 Exclusive Listing Inquiry</h2>
                <p style="color:#cbd5e1;margin:4px 0 0;font-size:13px;">${new Date().toLocaleString("en-CA", { timeZone: "America/Toronto" })}</p>
              </div>
              <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-top:none;">
                <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #f1f5f9;">Listing</td><td style="padding:10px 14px;color:#07111f;border-bottom:1px solid #f1f5f9;">${address || slug || "\u2014"}</td></tr>
                <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #f1f5f9;">Name</td><td style="padding:10px 14px;color:#07111f;border-bottom:1px solid #f1f5f9;">${name}</td></tr>
                <tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #f1f5f9;">Phone</td><td style="padding:10px 14px;color:#07111f;border-bottom:1px solid #f1f5f9;"><a href="tel:${phone}" style="color:#d97706;">${phone}</a></td></tr>
                ${email ? `<tr><td style="padding:10px 14px;font-weight:600;color:#374151;border-bottom:1px solid #f1f5f9;">Email</td><td style="padding:10px 14px;color:#07111f;border-bottom:1px solid #f1f5f9;"><a href="mailto:${email}" style="color:#d97706;">${email}</a></td></tr>` : ""}
                ${message ? `<tr><td style="padding:10px 14px;font-weight:600;color:#374151;vertical-align:top;">Message</td><td style="padding:10px 14px;color:#07111f;">${message.replace(/\n/g, "<br>")}</td></tr>` : ""}
              </table>
              <div style="padding:14px 24px;background:#fffbeb;border:1px solid #fde68a;border-top:none;border-radius:0 0 12px 12px;text-align:center;">
                <a href="tel:${phone}" style="color:#d97706;font-weight:700;font-size:15px;text-decoration:none;">\uD83D\uDCDE Call ${name} now</a>
              </div>
            </div>
          `,
        });
        if (result.error) {
          console.error("[email send failed]", { leadId: lead.id, source: "exclusive-listing", error: result.error.message });
        } else {
          console.log("[email sent]", { leadId: lead.id, source: "exclusive-listing", resendId: result.data?.id });
        }
      } catch (e) {
        console.error("[email send failed]", { leadId: lead.id, source: "exclusive-listing", error: e instanceof Error ? e.message : String(e) });
      }
    }

    // SMS to Aamir — redundant channel, fire-and-forget, independent of email
    // outcome above. The Resend send and the Twilio send live on separate
    // promise chains so a failure in one never blocks the other.
    notifyAamirBySMS(
      {
        firstName: name,
        phone,
        source: "exclusive-listing",
        street: address || undefined,
        notes: message || undefined,
      },
      lead.id,
    ).catch((e) => console.error("[exclusive-inquiry sms error]", e));

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Exclusive inquiry error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
