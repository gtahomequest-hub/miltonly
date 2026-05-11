import { Resend } from "resend";
import { config } from "@/lib/config";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.RESEND_FROM_EMAIL || `${config.SITE_NAME} <noreply@${config.SITE_DOMAIN}>`;
const TO = process.env.REALTOR_EMAIL || "";

// KVCORE_LEAD_PARSE_EMAIL — the kvCORE/BoldTrail lead-parsing email address
// in the format `leads+<account-token>@kvcore.com`. When set, every realtor-
// notification email also BCCs this address so kvCORE auto-creates a lead
// record. Unset = no BCC, no warning per-call; one boot-time log so missing
// config is visible without spamming.
//
// kvCORE/BoldTrail terminology: kvCORE is the underlying CRM product;
// BoldTrail is the rebrand. "Parse" signals the purpose — parsing inbound
// leads, not transactional email TO leads.
//
// Path 1 of the kvCORE webhook integration scope. Path 2 (full API webhook
// with gclid hand-off) ships separately.
const KVCORE_LEAD_PARSE_EMAIL = process.env.KVCORE_LEAD_PARSE_EMAIL || "";
if (!KVCORE_LEAD_PARSE_EMAIL && process.env.NODE_ENV === "production") {
  console.warn("[email] KVCORE_LEAD_PARSE_EMAIL is not set — lead BCC to kvCORE disabled");
}

export interface LeadData {
  firstName?: string;
  email?: string;
  phone?: string;
  source?: string;
  intent?: string;
  street?: string;
  timeline?: string;
  propertyType?: string;
  budget?: string;
  priority?: string;
  bedrooms?: string;
  parking?: string;
  pet?: string;
  notes?: string;
  // Attribution — set when the form passed through attributionPayload()
  // (src/lib/attribution.ts). All optional; missing keys are skipped in the
  // parse-friendly text body.
  gclid?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  landingPage?: string;
  pageUrl?: string; // explicit page URL of the submission, when known
  [key: string]: string | undefined;
}

/**
 * Build a plain-text "Field: Value" body that kvCORE/BoldTrail's lead parser
 * can read reliably. Universal format — Field-colon-value, one per line, no
 * Markdown, no HTML, no padding. Empty/undefined fields are skipped (no
 * `Field: undefined` lines). Newlines inside values are stripped to prevent
 * accidental line splits in the parser.
 *
 * The HTML notification (rich card) still ships in parallel for the realtor's
 * inbox readability; this text variant ships as the email's `text:` body and
 * is what kvCORE parses.
 *
 * Exported for test coverage (scripts/test-lead-parse-format.ts).
 */
export function formatLeadParseTextBody(data: LeadData): string {
  const flatten = (v: string | undefined): string | null => {
    if (v === undefined || v === null) return null;
    const s = String(v).replace(/[\r\n]+/g, " ").trim();
    return s.length > 0 ? s : null;
  };

  const sourceLabel: Record<string, string> = {
    wizard: "Rental Wizard",
    "listing-card-book": "Book Showing (Listing Card)",
    "listing-card-1hr": "1-Hour Showing (Listing Card)",
    "1hr-booking": "1-Hour Booking (Hero Card)",
    alert: "Search Alert Signup",
    "new-match-alert": "New Match Alert",
    "ads-rentals-lp": "Rentals Landing Page (Paid Ad)",
    "homepage-exclusive": "Off-Market List (Homepage)",
    "homepage-mortgage-calculator": "Mortgage Calc — Pre-Approval",
    "homepage-sold-on-my-street": "Sold Report — Street Search",
    "homepage-persona-first-time-buyer": "Persona — First-Time Buyer (Homepage)",
    "homepage-persona-newcomer": "Persona — New to Canada (Homepage)",
    "homepage-persona-move-up": "Persona — Move-Up Family (Homepage)",
    "homepage-newsletter": `Newsletter — ${config.CITY_NAME} Market Brief (Pre-Footer)`,
    "exclusive-listing": "Exclusive Listing Inquiry",
  };

  const fields: Array<[string, string | undefined]> = [
    ["Name", data.firstName],
    ["Email", data.email],
    ["Phone", data.phone],
    ["Source", sourceLabel[data.source || ""] || data.source],
    ["Intent", data.intent],
    ["Timeline", data.timeline],
    ["Property", data.street],
    ["Type", data.propertyType],
    ["Budget", data.budget],
    ["Bedrooms", data.bedrooms],
    ["Parking", data.parking],
    ["Pet", data.pet],
    ["Priority", data.priority],
    ["Notes", data.notes],
    ["gclid", data.gclid],
    ["utm_source", data.utm_source],
    ["utm_medium", data.utm_medium],
    ["utm_campaign", data.utm_campaign],
    ["utm_term", data.utm_term],
    ["utm_content", data.utm_content],
    ["Page URL", data.pageUrl || data.landingPage],
  ];

  const lines: string[] = [];
  for (const [label, raw] of fields) {
    const v = flatten(raw);
    if (v !== null) lines.push(`${label}: ${v}`);
  }
  return lines.join("\n");
}

export async function notifyNewLead(data: LeadData, leadId?: string) {
  if (!resend || !TO) return;

  const sourceLabel: Record<string, string> = {
    wizard: "Rental Wizard",
    "listing-card-book": "Book Showing (Listing Card)",
    "listing-card-1hr": "1-Hour Showing (Listing Card)",
    "1hr-booking": "1-Hour Booking (Hero Card)",
    alert: "Search Alert Signup",
    "new-match-alert": "New Match Alert",
    "ads-rentals-lp": "Rentals Landing Page (Paid Ad)",
    "homepage-exclusive": "Off-Market List (Homepage)",
    "homepage-mortgage-calculator": "Mortgage Calc — Pre-Approval",
    "homepage-sold-on-my-street": "Sold Report — Street Search",
    "homepage-persona-first-time-buyer": "Persona — First-Time Buyer (Homepage)",
    "homepage-persona-newcomer": "Persona — New to Canada (Homepage)",
    "homepage-persona-move-up": "Persona — Move-Up Family (Homepage)",
    "homepage-newsletter": `Newsletter — ${config.CITY_NAME} Market Brief (Pre-Footer)`,
  };

  const rows = [
    ["Name", data.firstName],
    ["Phone", data.phone],
    ["Email", data.email],
    ["Source", sourceLabel[data.source || ""] || data.source],
    ["Intent", data.intent],
    ["Timeline", data.timeline],
    ["Property", data.street],
    ["Type", data.propertyType],
    ["Budget", data.budget],
    ["Bedrooms", data.bedrooms],
    ["Parking", data.parking],
    ["Pet", data.pet],
    ["Priority", data.priority],
  ].filter(([, v]) => v);

  const htmlRows = rows.map(([k, v]) => `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;border-bottom:1px solid #f1f5f9;">${k}</td><td style="padding:8px 12px;color:#07111f;border-bottom:1px solid #f1f5f9;">${v}</td></tr>`).join("");

  const isHot = data.timeline === "ASAP" || data.timeline === "Within 1 month";
  const subject = `${isHot ? "🔥 HOT" : "📩"} New ${sourceLabel[data.source || ""] || "lead"} — ${data.firstName || "Unknown"}${data.phone ? ` (${data.phone})` : ""}`;

  const text = formatLeadParseTextBody(data);

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: TO,
      ...(KVCORE_LEAD_PARSE_EMAIL ? { bcc: [KVCORE_LEAD_PARSE_EMAIL] } : {}),
      replyTo: process.env.REALTOR_EMAIL,
      subject,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:0 auto;">
          <div style="background:linear-gradient(135deg,#07111f,#1e3a5f);padding:20px 24px;border-radius:12px 12px 0 0;">
            <h2 style="color:#f59e0b;margin:0;font-size:18px;">Miltonly — New Lead</h2>
            <p style="color:#cbd5e1;margin:4px 0 0;font-size:13px;">${new Date().toLocaleString("en-CA", { timeZone: "America/Toronto" })}</p>
          </div>
          <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-top:none;">
            ${htmlRows}
          </table>
          ${data.phone ? `<div style="padding:16px 24px;background:#fffbeb;border:1px solid #fde68a;border-top:none;border-radius:0 0 12px 12px;text-align:center;"><a href="tel:${data.phone}" style="color:#d97706;font-weight:700;font-size:16px;text-decoration:none;">📞 Call ${data.firstName || "lead"} now</a></div>` : ""}
        </div>
      `,
      text,
    });
    if (result.error) {
      console.error("[email send failed]", { leadId, source: data.source, error: result.error.message });
    } else {
      console.log("[email sent]", { leadId, source: data.source, resendId: result.data?.id, kvcoreBcc: !!KVCORE_LEAD_PARSE_EMAIL });
    }
  } catch (e) {
    console.error("[email send failed]", { leadId, source: data.source, error: e instanceof Error ? e.message : String(e) });
  }
}
