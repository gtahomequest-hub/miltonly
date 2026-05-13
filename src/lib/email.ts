import { Resend } from "resend";
import { config } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { formatPriceFull } from "@/lib/format";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.RESEND_FROM_EMAIL || `${config.SITE_NAME} <noreply@${config.SITE_DOMAIN}>`;
const TO = process.env.REALTOR_EMAIL || "";

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
  // Sales-variant fields (intent === "buyer"). Renter leads leave these undefined.
  preApproved?: string;
  mlsNumber?: string;
  // Optional free-text message from the AamirTrustCard message capture flow.
  // Always undefined for renter leads. Rendered as its own row in the
  // realtor email when present + non-empty.
  message?: string;
  // Lead-magnet fields (Commit 4j).
  // yourHomeAddress: the home-valuation submitter's current home address.
  // notes: optional free-text from the home-valuation textarea.
  yourHomeAddress?: string;
  notes?: string;
  [key: string]: string | undefined;
}

// Defensive HTML-escape for free-text fields that get inlined into the
// realtor notification email. The visitor's message is sanitized server-side
// at /api/leads (null-byte strip + naive HTML tag strip), but escaping here
// is the second layer that protects against table-row injection.
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SOURCE_LABEL: Record<string, string> = {
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
  "sales-rentals-featured-top": "Sales Featured Page · Top Form",
  "sales-rentals-featured-book": "Sales Featured Page · Book a Showing",
  "sales-rentals-featured-related": "Sales Featured Page · Related Listing Unlock",
  "sales-rentals-featured-message": "Sales Featured Page · AamirTrustCard Message",
  "sales-ads-market-pulse-unlock": "Sales Featured Page · Market Pulse Unlock",
  "sales-ads-home-valuation": "Sales Featured Page · Home Valuation Request",
};

const BUYER_TIMELINE_LABEL: Record<string, string> = {
  asap: "ASAP",
  "1-3months": "Next 1–3 months",
  "3-6months": "3–6 months",
  browsing: "Just browsing",
};

const PRE_APPROVED_LABEL: Record<string, string> = {
  yes: "Yes, pre-approved",
  no: "Not yet",
};

function salesSourceLabel(source: string | undefined): string {
  if (!source) return "Sales Featured Page (Paid Ad)";
  if (SOURCE_LABEL[source]) return SOURCE_LABEL[source];
  if (source.startsWith("sales-")) return "Sales Featured Page (Paid Ad)";
  return source;
}

// Try to enrich a buyer-lead email with the listing the user was viewing. Lookup
// is best-effort: a missing listing or DB hiccup downgrades to "MLS only", never
// throws (the realtor email must still send).
async function lookupListingForEmail(
  mlsNumber: string | undefined,
): Promise<string | null> {
  if (!mlsNumber) return null;
  try {
    const listing = await prisma.listing.findUnique({
      where: { mlsNumber },
      select: { mlsNumber: true, address: true, city: true, price: true },
    });
    if (!listing) return mlsNumber;
    return `${listing.mlsNumber} — ${listing.address}, ${listing.city} (${formatPriceFull(listing.price)})`;
  } catch {
    return mlsNumber;
  }
}

export async function notifyNewLead(data: LeadData, leadId?: string) {
  if (!resend || !TO) return;

  const isBuyer = data.intent === "buyer";
  const isMarketPulse = data.intent === "market-pulse-unlock";
  const isHomeValuation = data.intent === "home-valuation";
  const isLeadMagnet = isMarketPulse || isHomeValuation;
  const sourceLine = (isBuyer || isLeadMagnet)
    ? salesSourceLabel(data.source)
    : (SOURCE_LABEL[data.source || ""] || data.source);

  let listingLine: string | null = null;
  if (isBuyer || isLeadMagnet) {
    listingLine = await lookupListingForEmail(data.mlsNumber);
  }

  const timelineLine = isBuyer
    ? (data.timeline ? (BUYER_TIMELINE_LABEL[data.timeline] || data.timeline) : undefined)
    : data.timeline;
  const preApprovedLine = isBuyer && data.preApproved
    ? (PRE_APPROVED_LABEL[data.preApproved] || data.preApproved)
    : undefined;

  // Sales-variant: render the visitor's free-text message as its own row
  // when present. Escaped before going into the HTML table so the body is
  // injection-safe; newlines preserved as <br> for readability.
  const messageLine = isBuyer && data.message && data.message.trim().length > 0
    ? escapeHtml(data.message.trim()).replace(/\r?\n/g, "<br>")
    : undefined;

  // Home-valuation: escape the home address + optional notes for the same
  // injection-safety reason.
  const yourHomeAddressLine = isHomeValuation && data.yourHomeAddress
    ? escapeHtml(data.yourHomeAddress.trim())
    : undefined;
  const notesLine = isHomeValuation && data.notes && data.notes.trim().length > 0
    ? escapeHtml(data.notes.trim()).replace(/\r?\n/g, "<br>")
    : undefined;

  let rows: Array<[string, string | undefined]>;
  if (isHomeValuation) {
    rows = [
      ["Name", data.firstName],
      ["Phone", data.phone],
      ["Email", data.email],
      ["Source", sourceLine],
      ["Intent", "home-valuation"],
      ["Your home", yourHomeAddressLine],
      ["Notes", notesLine],
      ["Triggered from listing", listingLine || undefined],
    ];
  } else if (isMarketPulse) {
    rows = [
      ["Name", data.firstName],
      ["Phone", data.phone],
      ["Email", data.email],
      ["Source", sourceLine],
      ["Intent", "market-pulse-unlock"],
      ["Triggered from listing", listingLine || undefined],
    ];
  } else if (isBuyer) {
    rows = [
      ["Name", data.firstName],
      ["Phone", data.phone],
      ["Email", data.email],
      ["Source", sourceLine],
      ["Intent", "buyer"],
      ["Timeline", timelineLine],
      ["Pre-approved", preApprovedLine],
      ["Listing", listingLine || undefined],
      ["Message", messageLine],
    ];
  } else {
    rows = [
      ["Name", data.firstName],
      ["Phone", data.phone],
      ["Email", data.email],
      ["Source", sourceLine],
      ["Intent", data.intent],
      ["Timeline", timelineLine],
      ["Property", data.street],
      ["Type", data.propertyType],
      ["Budget", data.budget],
      ["Bedrooms", data.bedrooms],
      ["Parking", data.parking],
      ["Pet", data.pet],
      ["Priority", data.priority],
    ];
  }

  const filteredRows = rows.filter(([, v]) => v);

  const htmlRows = filteredRows
    .map(([k, v]) => `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;border-bottom:1px solid #f1f5f9;">${k}</td><td style="padding:8px 12px;color:#07111f;border-bottom:1px solid #f1f5f9;">${v}</td></tr>`)
    .join("");

  const subject = isHomeValuation
    ? `📩 NEW VALUATION REQUEST — ${data.yourHomeAddress || data.firstName || "Unknown"}`
    : isMarketPulse
      ? `📩 NEW MARKET-PULSE LEAD — ${data.firstName || "Unknown"}${data.phone ? ` (${data.phone})` : ""}`
      : isBuyer
        ? `📩 NEW SALE LEAD — ${data.firstName || "Unknown"}${data.phone ? ` (${data.phone})` : ""}`
        : (() => {
            const isHot = data.timeline === "ASAP" || data.timeline === "Within 1 month";
            return `${isHot ? "🔥 HOT" : "📩"} New ${SOURCE_LABEL[data.source || ""] || "lead"} — ${data.firstName || "Unknown"}${data.phone ? ` (${data.phone})` : ""}`;
          })();

  const headerLabel = isHomeValuation
    ? "Miltonly — NEW VALUATION REQUEST"
    : isMarketPulse
      ? "Miltonly — NEW MARKET-PULSE LEAD"
      : isBuyer
        ? "Miltonly — NEW SALE LEAD"
        : "Miltonly — New Lead";

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: TO,
      replyTo: process.env.REALTOR_EMAIL,
      subject,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:500px;margin:0 auto;">
          <div style="background:linear-gradient(135deg,#07111f,#1e3a5f);padding:20px 24px;border-radius:12px 12px 0 0;">
            <h2 style="color:#f59e0b;margin:0;font-size:18px;">${headerLabel}</h2>
            <p style="color:#cbd5e1;margin:4px 0 0;font-size:13px;">${new Date().toLocaleString("en-CA", { timeZone: "America/Toronto" })}</p>
          </div>
          <table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #e2e8f0;border-top:none;">
            ${htmlRows}
          </table>
          ${data.phone ? `<div style="padding:16px 24px;background:#fffbeb;border:1px solid #fde68a;border-top:none;border-radius:0 0 12px 12px;text-align:center;"><a href="tel:${data.phone}" style="color:#d97706;font-weight:700;font-size:16px;text-decoration:none;">📞 Call ${data.firstName || "lead"} now</a></div>` : ""}
        </div>
      `,
    });
    if (result.error) {
      const msg = result.error.message || JSON.stringify(result.error);
      console.error("[email send failed]", { leadId, source: data.source, error: msg });
      // Re-throw so withRetry at the call site can retry transient failures.
      // The existing .catch() chain at /api/leads still fires after retries
      // are exhausted; other callers' .catch() chains (off-market-leads etc.)
      // already exist to absorb thrown errors.
      throw new Error(msg);
    }
    console.log("[email sent]", { leadId, source: data.source, resendId: result.data?.id });
  } catch (e) {
    console.error("[email send failed]", { leadId, source: data.source, error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}
