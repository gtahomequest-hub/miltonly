// The one client-side submission helper. Every lead form this site owns calls this and
// nothing hand-rolls a fetch. scripts/test-lead-forms.ts enforces that at prebuild.
//
// It carries the honeypot field, the page URL, and the first-touch attribution the older
// surfaces already collect, so a form does not have to remember any of it. `intent` is typed
// to the vocabulary estimateLeadValue understands — the server normalizes anything else, but
// a new caller should not need normalizing.
//
// PHASE 2 WIDENED THE PAYLOAD RATHER THAN THE NUMBER OF PATHS. The fifteen funnel surfaces
// carried qualification fields (timeline, pre-approval, budget, bedrooms), a CASL consent
// snapshot, a free-text message, a valuation address and a market-pulse criteria packet, and
// each of them was the reason that surface had been left on the old monolith. They are
// optional fields here now, so one path serves every surface and no surface lost a field.

import { attributionPayload } from "@/lib/attribution";
import { HONEYPOT_FIELD } from "@/lib/lead/honeypot";

export type LeadClientIntent = "rent" | "buy" | "sell";

/** The aggregate packet a market-pulse unlock reveals. Mirrors getMarketPulse's return. */
export interface LeadStatsPacket {
  sold_count: number;
  avg_sold_price: number | null;
  median_sold_price: number | null;
  avg_dom: number | null;
  avg_sold_to_ask: number | null;
  market_score: number | null;
  match_basis?: string;
  [k: string]: unknown;
}

export interface PostLeadPayload {
  source: string;
  intent: LeadClientIntent;
  email?: string;
  phone?: string;
  name?: string;
  /** The street, building or area the lead is about. A resolved name, never a shortName. */
  property_address?: string;
  neighbourhood?: string;
  notes?: string;

  // ── qualification, from the funnel surfaces ─────────────────────────────────
  timeline?: string;
  /** "yes" | "no". Buyer surfaces only. */
  preApproved?: string;
  /** Raw budget token the form offered, e.g. "$2K–$2.5K" or "700000". */
  budget?: string;
  /** Raw bedroom token, e.g. "studio" | "2" | "4+". */
  bedrooms?: string;
  /** The form's own home-type token, mapped server-side onto Lead.propertyType. */
  homeType?: string;
  propertyType?: string;
  /** Free text the visitor typed. Sanitized server-side. */
  message?: string;
  /** The listing the visitor was looking at. Validated server-side; a bad format is dropped. */
  mlsNumber?: string;
  /** Whether the visitor already has an agent, when the surface asked. */
  hasAgent?: string;

  // ── CASL express consent, where the surface showed a disclosure ─────────────
  consent?: boolean;
  consentText?: string;
  consentTimestamp?: string;

  /** A valuation request: the address of the submitter's OWN home. */
  yourHomeAddress?: string;
  /** A market-pulse unlock: the analytics slice the reveal is computed over. */
  matchCriteria?: Record<string, unknown>;

  /** A price band, when the surface captured one. Creates a price-band watch. */
  priceMin?: number;
  priceMax?: number;

  // ── Meta pixel de-duplication, for the surfaces that fire a browser Pixel ───
  event_id?: string;
  fbc?: string;
  fbp?: string;
  fbclid?: string;

  /** Value of the hidden honeypot input. Pass it through; a bot fills it, a person cannot see it. */
  honeypot?: string;
}

export interface PostLeadResult {
  ok: boolean;
  leadId?: string;
  /** The route's message when it refused, already written for a visitor to read. */
  error?: string;
  /** Present only for a market-pulse unlock, and only when the packet computed. */
  stats?: LeadStatsPacket | null;
}

/** Resolves ok only when the route confirmed the write. A non-2xx, an `ok: false`, or a
 *  network failure all resolve false, so a caller cannot render a confirmation it did not
 *  earn — the defect that had two forms printing "You're in" over a 500. */
export async function postLeadDetailed(payload: PostLeadPayload): Promise<PostLeadResult> {
  const { honeypot, ...rest } = payload;
  try {
    const res = await fetch("/api/leads/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...rest,
        [HONEYPOT_FIELD]: honeypot ?? "",
        event_source_url: typeof window !== "undefined" ? window.location.href : undefined,
        ...attributionPayload(),
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      lead_id?: string;
      error?: string;
      stats?: LeadStatsPacket | null;
    };
    if (!res.ok || data?.ok === false) return { ok: false, error: data?.error };
    return { ok: true, leadId: data.lead_id, stats: data.stats };
  } catch {
    return { ok: false };
  }
}

export async function postLead(payload: PostLeadPayload): Promise<boolean> {
  return (await postLeadDetailed(payload)).ok;
}

/** Props for the hidden input every form renders. Kept here so the field name lives in one
 *  place and a form cannot drift from the server's expectation. */
export const honeypotInputProps = {
  name: HONEYPOT_FIELD,
  tabIndex: -1,
  autoComplete: "off" as const,
};
export const HONEYPOT_WRAPPER_STYLE = {
  position: "absolute" as const,
  left: "-10000px",
  top: "-10000px",
};
export { HONEYPOT_FIELD };
