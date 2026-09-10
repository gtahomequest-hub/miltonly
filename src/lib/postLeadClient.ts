// The one client-side submission helper. Every lead form this worktree owns calls this and
// nothing hand-rolls a fetch.
//
// It carries the honeypot field, the page URL, and the first-touch attribution the older
// surfaces already collect, so a form does not have to remember any of it. `intent` is typed
// to the vocabulary estimateLeadValue understands — the server normalizes anything else, but
// a new caller should not need normalizing.

import { attributionPayload } from "@/lib/attribution";
import { HONEYPOT_FIELD } from "@/lib/lead/honeypot";

export type LeadClientIntent = "rent" | "buy" | "sell";

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
  timeline?: string;
  budget?: string;
  /** Value of the hidden honeypot input. Pass it through; a bot fills it, a person cannot see it. */
  honeypot?: string;
}

export interface PostLeadResult {
  ok: boolean;
  leadId?: string;
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
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; lead_id?: string };
    if (!res.ok || data?.ok === false) return { ok: false };
    return { ok: true, leadId: data.lead_id };
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
