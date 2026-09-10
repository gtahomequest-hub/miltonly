// Client-side POST into the live lead ingress. One shape, one place.
//
// This exists because the same twelve-line fetch was already copied into StreetAlertCTA,
// CondoCTAs and SoldValuationCTA, and the two components fixed in this hotfix would have
// made five copies. Phase 1 replaces this with the single submitLead() path; until then
// every new caller uses this and nothing hand-rolls a fetch.
//
// `intent` MUST use the vocabulary estimateLeadValue() understands — "rent" | "buy" |
// "sell" (src/lib/leads.ts). Anything else scores 0 and ships a misleading value to Meta's
// optimizer. The older surfaces send "buyer", which is exactly that defect; it is recorded
// as a Phase 1 item rather than propagated here.
export type LeadClientIntent = "rent" | "buy" | "sell";

export interface PostLeadPayload {
  source: string;
  intent: LeadClientIntent;
  email?: string;
  phone?: string;
  name?: string;
  /** The street or building the lead is about. A resolved name, never a shortName. */
  property_address?: string;
  neighbourhood?: string;
  notes?: string;
}

/** Resolves true only when the route confirmed the write. A non-2xx, an `ok: false`, or a
 *  network failure all resolve false, so a caller cannot render a confirmation it did not earn. */
export async function postLead(payload: PostLeadPayload): Promise<boolean> {
  try {
    const res = await fetch("/api/leads/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        event_source_url: typeof window !== "undefined" ? window.location.href : undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && data?.ok !== false;
  } catch {
    return false;
  }
}
