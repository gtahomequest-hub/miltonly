// Browser-side Pixel helpers used by form submit handlers (and any other
// page interaction that should fire a Meta event).
//
// The Pixel base script (src/components/MetaPixel.tsx) defines window.fbq
// synchronously when it loads. These helpers run later — typically after
// a user clicks Submit — and there's a narrow race window where the
// inline script is still parsing. The retry guard handles that case
// without throwing.
//
// Pair each Pixel fire with a server-side CAPI fire using the same
// event_id so Meta dedupes. generateEventId() is the canonical source;
// the route handler at /api/leads/create falls back to lead.id only when
// the client forgets to send one.

const RETRY_DELAY_MS = 100;
const MAX_RETRIES = 3;

type FbqFn = (...args: unknown[]) => void;

// Schedules an fbq call. If fbq isn't defined yet, retries every
// RETRY_DELAY_MS up to MAX_RETRIES times. Silently logs a warning on the
// final miss — never throws. A missed event must not crash the page.
function safeFbq(args: unknown[]): void {
  let attempts = 0;
  function attempt(): void {
    if (typeof window === "undefined") return;
    const fbq = (window as unknown as { fbq?: FbqFn }).fbq;
    if (typeof fbq === "function") {
      try {
        fbq(...args);
      } catch (err) {
        console.warn("[pixel-client] fbq threw", err);
      }
      return;
    }
    attempts += 1;
    if (attempts >= MAX_RETRIES) {
      console.warn(`[pixel-client] fbq not loaded after ${MAX_RETRIES} retries; skipping event`, args[1]);
      return;
    }
    setTimeout(attempt, RETRY_DELAY_MS);
  }
  attempt();
}

// Standard event names recognized by Meta. firePixelEvent is typed to
// these; arbitrary custom events should use fbq('trackCustom', ...)
// directly until we have a clear use case for them.
export type StandardPixelEvent =
  | "ViewContent"
  | "Search"
  | "AddToCart"
  | "InitiateCheckout"
  | "Purchase"
  | "Lead"
  | "CompleteRegistration"
  | "Contact"
  | "Subscribe"
  | "Schedule";

export interface FirePixelLeadParams {
  eventId: string;
  value: number;
  currency: string;
}

// Fires the standardized 'Lead' event. event_id MUST match the eventId
// passed to CAPI (handled by the route handler) or Meta will count two
// conversions instead of one.
export function firePixelLead({ eventId, value, currency }: FirePixelLeadParams): void {
  safeFbq([
    "track",
    "Lead",
    { value, currency },
    { eventID: eventId }, // note: 'eventID' (capital ID) is the Pixel SDK spelling
  ]);
}

// Generic standard event fire. params is whatever the event needs
// (search_string, content_ids, etc.). Pair with an eventID via the
// optional 4th-arg object when CAPI dedup is wanted.
export function firePixelEvent(
  name: StandardPixelEvent,
  params: Record<string, unknown> = {},
  eventId?: string,
): void {
  const args: unknown[] = ["track", name, params];
  if (eventId) args.push({ eventID: eventId });
  safeFbq(args);
}

// Reads the Meta-set _fbc and _fbp cookies for inclusion in the form
// POST. CAPI uses these for match-quality improvement. Falls back to
// undefined if the cookies aren't present (e.g. ad blocker stripped
// them, or the user landed without an fbclid).
export function readFbCookies(): { fbc?: string; fbp?: string } {
  if (typeof document === "undefined") return {};
  const result: { fbc?: string; fbp?: string } = {};
  const pairs = document.cookie.split(";");
  for (const raw of pairs) {
    const eq = raw.indexOf("=");
    if (eq === -1) continue;
    const name = raw.slice(0, eq).trim();
    const value = raw.slice(eq + 1).trim();
    if (name === "_fbc") result.fbc = decodeURIComponent(value);
    else if (name === "_fbp") result.fbp = decodeURIComponent(value);
  }
  return result;
}

// crypto.randomUUID() is available in all evergreen browsers + Node 19+.
// Falls back to a Date.now + Math.random shim only on the off chance the
// runtime doesn't have it; the shim is sufficient for Pixel/CAPI dedup
// (collision risk is astronomical, not zero) but should never be reached
// in production browsers.
export function generateEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
