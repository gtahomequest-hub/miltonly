// kvCORE / BoldTrail lead-parser email. Sends a dedicated plain-text email
// to KVCORE_LEAD_PARSE_EMAIL for every new lead — BoldTrail's parser ingests
// the labeled key-value lines and auto-creates a CRM lead. Separate from
// (not BCC of) the realtor HTML notification: keeping them isolated means
// the realtor email can change format without breaking the parser, and
// disabling kvCORE doesn't affect the realtor path.
//
// Required env:
//   KVCORE_LEAD_PARSE_EMAIL — BoldTrail parser inbox (empty disables)
//   RESEND_API_KEY          — Resend API key
//   RESEND_FROM_EMAIL       — verified-domain sender (Path B), defaults to noreply@<site>
//   RESEND_REPLY_TO         — realtor inbox for parser-side replies, optional
//
// Both env-var gates are intentional:
//   - Empty KVCORE_LEAD_PARSE_EMAIL → silent no-op (turn off without code)
//   - Missing RESEND_API_KEY        → log "[kvcore parser send skipped]" so
//     ops can spot misconfiguration in production logs

import { Resend } from "resend";
import { config } from "@/lib/config";
import { withRetry } from "./retry";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.RESEND_FROM_EMAIL || `${config.SITE_NAME} <noreply@${config.SITE_DOMAIN}>`;
const REPLY_TO = process.env.RESEND_REPLY_TO || process.env.REALTOR_EMAIL || config.realtor.email;

export interface KvcoreLeadInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  source: string;
  intent?: string;
  timeline?: string;
  budget?: string;
  bedrooms?: string;
  propertyType?: string;
  // Sales-variant fields. Present only on buyer leads.
  preApproved?: string;
  mlsNumber?: string;
  // Lead-magnet fields (Commit 4j). Carried through so future kvCORE body
  // variants can surface them; current renter-shaped fallback ignores them.
  yourHomeAddress?: string;
  notes?: string;
}

const KVCORE_BUYER_TIMELINE_LABEL: Record<string, string> = {
  asap: "ASAP",
  "1-3months": "Next 1–3 months",
  "3-6months": "3–6 months",
  browsing: "Just browsing",
};

const KVCORE_PRE_APPROVED_LABEL: Record<string, string> = {
  yes: "Yes, pre-approved",
  no: "Not yet",
};

/**
 * Build the plain-text body kvCORE's parser ingests. Every label always
 * appears (one per line) — empty value after the colon when the lead row
 * doesn't have that field. Consistent line set is what kvCORE expects.
 * Exported separately so the body shape is testable without dispatching a
 * real Resend send.
 *
 * Two variants:
 *   - Buyer (intent === "buyer"): sales-side body. Property Type +
 *     Bedrooms stay blank (renter-only fields). Adds a Listing line and
 *     prefixes Source with "Miltonly Sales -".
 *   - Renter / other: existing rental shape, unchanged.
 */
export function buildKvcoreParserBody(lead: KvcoreLeadInput): string {
  if (lead.intent === "buyer") {
    const timelineLabel = lead.timeline
      ? (KVCORE_BUYER_TIMELINE_LABEL[lead.timeline] || lead.timeline)
      : "";
    const preApprovedLabel = lead.preApproved
      ? (KVCORE_PRE_APPROVED_LABEL[lead.preApproved] || lead.preApproved)
      : "";
    return [
      `First Name: ${lead.firstName ?? ""}`,
      `Last Name: `,
      `Email: ${lead.email ?? ""}`,
      `Phone: ${lead.phone ?? ""}`,
      `Source: Miltonly Sales - ${lead.source}`,
      `Intent: buyer`,
      `Timeline: ${timelineLabel}`,
      `Pre-approved: ${preApprovedLabel}`,
      `Property Type: `,
      `Bedrooms: `,
      `Listing: ${lead.mlsNumber ?? ""}`,
    ].join("\n");
  }

  return [
    `First Name: ${lead.firstName ?? ""}`,
    `Last Name: ${lead.lastName ?? ""}`,
    `Email: ${lead.email ?? ""}`,
    `Phone: ${lead.phone ?? ""}`,
    `Source: Miltonly - ${lead.source}`,
    `Intent: ${lead.intent ?? ""}`,
    `Timeline: ${lead.timeline ?? ""}`,
    `Budget: ${lead.budget ?? ""}`,
    `Bedrooms: ${lead.bedrooms ?? ""}`,
    `Property Type: ${lead.propertyType ?? ""}`,
  ].join("\n");
}

/**
 * Fire-and-forget. Sends a parser-friendly plain-text email to the kvCORE
 * BCC address. Wrapped in withRetry (1.5s / 3s / 6s backoff) so transient
 * iad1 → resend.com failures get absorbed.
 *
 * Resend SDK has two failure modes that both need to retry:
 *   - Throws on network errors
 *   - Returns { error: ... } on API errors (auth, sandbox, etc.)
 * Both convert to a thrown Error inside the retry closure so withRetry
 * sees the failure either way.
 */
export async function sendKvcoreParserEmail(
  lead: KvcoreLeadInput,
  leadId: string,
): Promise<void> {
  const parserEmail = (process.env.KVCORE_LEAD_PARSE_EMAIL || "").trim();
  if (!parserEmail) {
    // Intentional silent gate — empty env disables this path without code.
    return;
  }
  if (!resend) {
    console.log("[kvcore parser send skipped]", {
      leadId,
      reason: "RESEND_API_KEY not set",
    });
    return;
  }

  const text = buildKvcoreParserBody(lead);

  const subjectName = `${lead.firstName ?? "New"} ${lead.lastName ?? ""}`.trim();
  const subject = `Miltonly Lead - ${subjectName}`;

  try {
    const result = await withRetry(
      async () => {
        const r = await resend.emails.send({
          from: FROM,
          to: parserEmail,
          replyTo: REPLY_TO,
          subject,
          text,
        });
        if (r.error) {
          const msg = r.error.message || JSON.stringify(r.error);
          throw new Error(msg);
        }
        return r;
      },
      { label: "resend:kvcore-parser", leadId },
    );
    console.log("[kvcore parser sent]", { leadId, resendId: result.data?.id });
  } catch (e) {
    console.error("[kvcore parser send failed]", {
      leadId,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
