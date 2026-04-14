import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.RESEND_FROM_EMAIL || "Miltonly <noreply@miltonly.com>";

export async function sendVerificationEmail(email: string, code: string) {
  if (!resend) {
    console.log(`[DEV] Verification code for ${email}: ${code}`);
    return;
  }

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `${code} — Your Miltonly verification code`,
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
          <p style="color:#94a3b8;font-size:11px;margin:0;">You're receiving this because someone signed up at miltonly.com</p>
        </div>
      </div>
    `,
  });
}

export async function sendDealAlertEmail(
  email: string,
  firstName: string | null,
  searchName: string,
  matches: { address: string; price: number; mlsNumber: string; propertyType: string }[]
) {
  if (!resend) {
    console.log(`[DEV] Deal alert for ${email}: ${matches.length} matches`);
    return;
  }

  const listItems = matches
    .slice(0, 10)
    .map(
      (m) =>
        `<tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;">
            <a href="https://miltonly.com/listings/${m.mlsNumber}" style="color:#07111f;font-weight:600;text-decoration:none;font-size:14px;">${m.address}</a>
            <br/><span style="color:#94a3b8;font-size:11px;">${m.propertyType} · MLS ${m.mlsNumber}</span>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700;color:#07111f;font-size:14px;">$${m.price.toLocaleString()}</td>
        </tr>`
    )
    .join("");

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `${matches.length} new listing${matches.length > 1 ? "s" : ""} matching "${searchName}" — Miltonly`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#07111f,#1e3a5f);padding:20px 24px;border-radius:12px 12px 0 0;">
          <h2 style="color:#f59e0b;margin:0;font-size:18px;">New listings for you</h2>
          <p style="color:#cbd5e1;margin:4px 0 0;font-size:13px;">Hi ${firstName || "there"}, ${matches.length} new listing${matches.length > 1 ? "s" : ""} match "${searchName}"</p>
        </div>
        <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-top:none;">
          ${listItems}
        </table>
        <div style="padding:20px 24px;background:#fffbeb;border:1px solid #fde68a;border-top:none;border-radius:0 0 12px 12px;text-align:center;">
          <a href="https://miltonly.com/saved" style="color:#d97706;font-weight:700;font-size:14px;text-decoration:none;">View all on Miltonly →</a>
        </div>
      </div>
    `,
  });
}
