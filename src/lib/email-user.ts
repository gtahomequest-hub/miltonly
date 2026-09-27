import { Resend } from "resend";
import { config } from "@/lib/config";
import { unsubscribeUrl, listUnsubscribeHeaders } from "@/lib/email/unsubscribe";
import { emailFooter } from "@/lib/email/footer";
import { brokerageDisplayName } from "@/components/listings/ListingBrokerage";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.RESEND_FROM_EMAIL || `${config.SITE_NAME} <noreply@${config.SITE_DOMAIN}>`;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** The sign-in email (MP-002). One link and one code, the same secret in two shapes: the link
 *  for the phone that has the inbox open, the code for the screen that has the page open. It
 *  says who sent it and what to do if you did not ask, and nothing else. Transactional under
 *  CASL (no commercial content), so no unsubscribe, but the brokerage line stays because every
 *  email from this site names the person behind it. */
export async function sendSignInEmail(args: { email: string; code: string; link: string; minutes: number }) {
  const { email, code, link, minutes } = args;
  if (!resend) {
    console.log(`[DEV] Sign-in for ${email}: code ${code}, link ${link}`);
    return;
  }

  const text = [
    `Your ${config.SITE_NAME} sign-in`,
    "",
    `Tap this link to sign in: ${link}`,
    "",
    `Or type this code on the page you were on: ${code}`,
    "",
    `Both work for ${minutes} minutes and only once. If you did not ask to sign in, ignore this email; nothing happens without the link or the code.`,
    "",
    `${config.realtor.name}, ${config.realtor.title}`,
    config.brokerage.name,
    `${config.realtor.phone} · ${config.realtor.email}`,
  ].join("\n");

  const result = await resend.emails.send({
    from: FROM,
    to: email,
    replyTo: process.env.REALTOR_EMAIL,
    subject: `${code} is your ${config.SITE_NAME} sign-in code`,
    text,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:440px;margin:0 auto;color:#073126;">
        <div style="background:#073126;padding:22px 28px;border-radius:12px 12px 0 0;">
          <p style="margin:0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#00ff80;">${esc(config.SITE_NAME)}</p>
          <p style="margin:6px 0 0;font-size:20px;font-weight:600;color:#f6f4ef;">Your sign-in</p>
        </div>
        <div style="background:#ffffff;border:1px solid #dfe0dc;border-top:none;padding:28px;">
          <a href="${esc(link)}" style="display:block;text-align:center;background:#017848;color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 18px;border-radius:10px;">Sign in to ${esc(config.SITE_NAME)}</a>
          <p style="font-size:14px;line-height:1.5;margin:22px 0 8px;">Or type this code on the page you were on:</p>
          <div style="background:#f6f4ef;border:1px solid #dfe0dc;border-radius:10px;padding:16px;text-align:center;">
            <span style="font-size:32px;font-weight:700;letter-spacing:8px;font-family:ui-monospace,Menlo,Consolas,monospace;">${esc(code)}</span>
          </div>
          <p style="font-size:12px;line-height:1.5;color:#6b6f6a;margin:16px 0 0;">Both work for ${minutes} minutes and only once. If you did not ask to sign in, ignore this email; nothing happens without the link or the code.</p>
        </div>
        <div style="background:#f6f4ef;border:1px solid #dfe0dc;border-top:none;border-radius:0 0 12px 12px;padding:14px 28px;">
          <p style="font-size:11px;line-height:1.5;color:#6b6f6a;margin:0;">${esc(config.realtor.name)}, ${esc(config.realtor.title)} &middot; ${esc(config.brokerage.name)}<br/>${esc(config.realtor.phone)} &middot; ${esc(config.realtor.email)}</p>
        </div>
      </div>
    `,
  });
  if (result.error) {
    console.error("[email send failed]", { leadId: email, source: "sign-in", error: result.error.message });
  } else {
    console.log("[email sent]", { leadId: email, source: "sign-in", resendId: result.data?.id });
  }
}

export interface DealAlertSend {
  sent: boolean;
  resendId?: string | null;
  reason?: string;
}

/**
 * One deal alert, for one watch. `watchId` is what the unsubscribe link is signed over, and
 * `origin` is where the links point (the preview host on a preview deployment). `env` tags a
 * non-production subject, because preview and production share one database and an untagged
 * preview email is indistinguishable from the real thing. The footer
 * and the List-Unsubscribe headers come from src/lib/email, the same as the brief and the
 * digest, so a CASL element cannot be present in one recurring mail and absent from another.
 *
 * It refuses rather than sends when the unsubscribe link cannot be signed: a commercial email
 * with no working unsubscribe is the thing the Act prohibits, and the caller reads `sent` to
 * decide whether to stamp the watch.
 *
 * MC-036: `displayAddress` is on every match, and the email prints "Address on request" for a
 * withheld listing (InternetAddressDisplayYN = N), the same placeholder every card shows; the
 * caller redacts the row before it gets here, so the raw address is not in the argument either.
 */
export async function sendDealAlertEmail(
  email: string,
  firstName: string | null,
  searchName: string,
  matches: { address: string; displayAddress: boolean; price: number; mlsNumber: string; propertyType: string; listOfficeName?: string | null }[],
  watchId: string,
  origin?: string,
  env: string = "production",
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
  const addressOf = (m: { address: string; displayAddress: boolean }) => (m.displayAddress ? m.address : "Address on request");

  const listItems = matches
    .slice(0, 10)
    .map(
      (m) =>
        `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">
            <a href="${site}/listings/${m.mlsNumber}" style="color:#07111f;font-weight:600;text-decoration:none;font-size:14px;">${addressOf(m)}</a>
            <br/><span style="color:#94a3b8;font-size:11px;">${m.propertyType} · MLS ${m.mlsNumber}</span>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700;color:#07111f;font-size:14px;">$${m.price.toLocaleString()}${
            // The listing brokerage beside the price, in the price's size, weight and colour
            // (TRREB item 27, MC-029).
            brokerageDisplayName(m.listOfficeName) ? `<br/><span style="font-weight:700;color:#07111f;font-size:14px;">Listed by ${brokerageDisplayName(m.listOfficeName)}</span>` : ""
          }</td>
        </tr>`
    )
    .join("");

  const plural = matches.length > 1 ? "s" : "";
  const text = [
    `Hi ${firstName || "there"}, ${matches.length} new listing${plural} match "${searchName}".`,
    "",
    ...matches.slice(0, 10).map((m) => `- ${addressOf(m)}, $${m.price.toLocaleString()}${brokerageDisplayName(m.listOfficeName) ? `, listed by ${brokerageDisplayName(m.listOfficeName)}` : ""}: ${site}/listings/${m.mlsNumber}`),
    "",
    `View all on ${config.SITE_NAME}: ${site}/saved`,
    footer.text,
  ].join("\n");

  const result = await resend.emails.send({
    from: FROM,
    to: email,
    replyTo: process.env.REALTOR_EMAIL,
    subject: `${env === "production" ? "" : `[${env}] `}${matches.length} new listing${plural} matching "${searchName}" · ${config.SITE_NAME}`,
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
