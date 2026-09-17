import { Resend } from "resend";
import { config } from "@/lib/config";
import { unsubscribeUrl, listUnsubscribeHeaders } from "@/lib/email/unsubscribe";
import { emailFooter } from "@/lib/email/footer";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.RESEND_FROM_EMAIL || `${config.SITE_NAME} <noreply@${config.SITE_DOMAIN}>`;

export async function sendVerificationEmail(email: string, code: string) {
  if (!resend) {
    console.log(`[DEV] Verification code for ${email}: ${code}`);
    return;
  }

  const result = await resend.emails.send({
    from: FROM,
    to: email,
    replyTo: process.env.REALTOR_EMAIL,
    subject: `${code} — Your ${config.SITE_NAME} verification code`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:440px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#07111f,#1e3a5f);padding:28px 32px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="color:#f59e0b;margin:0;font-size:22px;font-weight:800;letter-spacing:-0.5px;">miltonly<span style="color:#f8f9fb;">.</span></h1>
        </div>
        <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;padding:32px;text-align:center;">
          <p style="color:#374151;font-size:15px;margin:0 0 8px;">Your verification code is:</p>
          <div style="background:#f8f9fb;border:2px solid #e2e8f0;border-radius:12px;padding:20px;margin:16px 0;">
            <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#07111f;">${code}</span>
          </div>
          <p style="color:#94a3b8;font-size:12px;margin:16px 0 0;">This code expires in 15 minutes.</p>
        </div>
        <div style="background:#f8f9fb;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:16px;text-align:center;">
          <p style="color:#94a3b8;font-size:11px;margin:0;">You're receiving this because someone signed up at ${config.SITE_DOMAIN}</p>
        </div>
      </div>
    `,
  });
  if (result.error) {
    console.error("[email send failed]", { leadId: email, source: "verification", error: result.error.message });
  } else {
    console.log("[email sent]", { leadId: email, source: "verification", resendId: result.data?.id });
  }
}

export interface DealAlertSend {
  sent: boolean;
  resendId?: string | null;
  reason?: string;
}

/**
 * One deal alert, for one watch. `watchId` is what the unsubscribe link is signed over, and
 * `origin` is where the links point (the preview host on a preview deployment). The footer
 * and the List-Unsubscribe headers come from src/lib/email, the same as the brief and the
 * digest, so a CASL element cannot be present in one recurring mail and absent from another.
 *
 * It refuses rather than sends when the unsubscribe link cannot be signed: a commercial email
 * with no working unsubscribe is the thing the Act prohibits, and the caller reads `sent` to
 * decide whether to stamp the watch.
 */
export async function sendDealAlertEmail(
  email: string,
  firstName: string | null,
  searchName: string,
  matches: { address: string; price: number; mlsNumber: string; propertyType: string }[],
  watchId: string,
  origin?: string,
): Promise<DealAlertSend> {
  if (!resend) {
    console.log(`[DEV] Deal alert for ${email}: ${matches.length} matches`);
    return { sent: false, reason: "RESEND_API_KEY unset" };
  }

  let unsubscribe: string;
  try {
    unsubscribe = unsubscribeUrl(watchId, origin);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error("[email send failed]", { leadId: email, source: "deal-alert", error: reason });
    return { sent: false, reason };
  }
  const site = origin || config.SITE_URL;
  const listName = searchName ? searchName.charAt(0).toLowerCase() + searchName.slice(1) : "listing alerts";
  const footer = emailFooter({ unsubscribeUrl: unsubscribe, listName, origin });

  const listItems = matches
    .slice(0, 10)
    .map(
      (m) =>
        `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">
            <a href="${site}/listings/${m.mlsNumber}" style="color:#07111f;font-weight:600;text-decoration:none;font-size:14px;">${m.address}</a>
            <br/><span style="color:#94a3b8;font-size:11px;">${m.propertyType} · MLS ${m.mlsNumber}</span>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700;color:#07111f;font-size:14px;">$${m.price.toLocaleString()}</td>
        </tr>`
    )
    .join("");

  const plural = matches.length > 1 ? "s" : "";
  const text = [
    `Hi ${firstName || "there"}, ${matches.length} new listing${plural} match "${searchName}".`,
    "",
    ...matches.slice(0, 10).map((m) => `- ${m.address}, $${m.price.toLocaleString()}: ${site}/listings/${m.mlsNumber}`),
    "",
    `View all on ${config.SITE_NAME}: ${site}/saved`,
    footer.text,
  ].join("\n");

  const result = await resend.emails.send({
    from: FROM,
    to: email,
    replyTo: process.env.REALTOR_EMAIL,
    subject: `${matches.length} new listing${plural} matching "${searchName}" · ${config.SITE_NAME}`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#07111f,#1e3a5f);padding:20px 24px;border-radius:12px 12px 0 0;">
          <h2 style="color:#f59e0b;margin:0;font-size:18px;">New listings for you</h2>
          <p style="color:#cbd5e1;margin:4px 0 0;font-size:13px;">Hi ${firstName || "there"}, ${matches.length} new listing${plural} match "${searchName}"</p>
        </div>
        <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-top:none;">
          ${listItems}
        </table>
        <div style="padding:20px 24px;background:#fffbeb;border:1px solid #fde68a;border-top:none;border-radius:0 0 12px 12px;text-align:center;">
          <a href="${site}/saved" style="color:#d97706;font-weight:700;font-size:14px;text-decoration:none;">View all on ${config.SITE_NAME} →</a>
        </div>
        ${footer.html}
      </div>
    `,
    text,
    headers: listUnsubscribeHeaders(unsubscribe),
  });
  if (result.error) {
    console.error("[email send failed]", { leadId: email, source: "deal-alert", error: result.error.message });
    return { sent: false, reason: result.error.message };
  }
  console.log("[email sent]", { leadId: email, source: "deal-alert", resendId: result.data?.id });
  return { sent: true, resendId: result.data?.id ?? null };
}
