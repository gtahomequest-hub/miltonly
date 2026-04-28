// Site-wide attribution persistence.
//
// Captures gclid + utm_* params on any page load and persists them across
// navigation in localStorage + a first-party cookie. Forms read via
// getAttribution() and send first-touch + last-touch to /api/leads.
//
// Why both layers: localStorage survives within the same origin/profile;
// the cookie acts as a backup if storage is cleared partway through a session.
// Why first + last: first-touch credits the original ad click that produced
// awareness; last-touch credits the final ad click before submit. Google Ads
// imports first-touch (matches the AW conversion model); we keep last-touch
// for our own analytics.

const FIRST_KEY = "attribution";
const LAST_KEY = "attribution_last";
const COOKIE_KEY = "attribution";
const COOKIE_MAX_AGE = 7776000; // 90 days

export interface AttributionPayload {
  gclid: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  timestamp: number;
  landingPage: string;
}

function safeParse(raw: string | null | undefined): AttributionPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "timestamp" in parsed) {
      return parsed as AttributionPayload;
    }
  } catch {/* ignore */}
  return null;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, maxAge: number) {
  if (typeof document === "undefined") return;
  const v = encodeURIComponent(value);
  document.cookie = `${name}=${v}; max-age=${maxAge}; path=/; SameSite=Lax`;
}

export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const gclid = params.get("gclid") || "";
  const utmSource = params.get("utm_source");
  const utmMedium = params.get("utm_medium");
  const utmCampaign = params.get("utm_campaign");
  const utmTerm = params.get("utm_term");
  const utmContent = params.get("utm_content");

  // No attribution params on this URL → nothing to capture.
  if (!gclid && !utmSource && !utmMedium && !utmCampaign && !utmTerm && !utmContent) return;

  const payload: AttributionPayload = {
    gclid,
    utmSource: utmSource || null,
    utmMedium: utmMedium || null,
    utmCampaign: utmCampaign || null,
    utmTerm: utmTerm || null,
    utmContent: utmContent || null,
    timestamp: Date.now(),
    landingPage: window.location.pathname,
  };

  try {
    const existingFirst = window.localStorage.getItem(FIRST_KEY);
    if (!existingFirst) {
      window.localStorage.setItem(FIRST_KEY, JSON.stringify(payload));
      // Cookie mirrors first-touch only — survives storage purges.
      writeCookie(COOKIE_KEY, JSON.stringify(payload), COOKIE_MAX_AGE);
    } else if (!readCookie(COOKIE_KEY)) {
      // Storage has it, cookie was wiped — restore the cookie.
      writeCookie(COOKIE_KEY, existingFirst, COOKIE_MAX_AGE);
    }
    window.localStorage.setItem(LAST_KEY, JSON.stringify(payload));
  } catch {/* private mode / quota — fall through */}
}

export function getAttribution(): {
  first: AttributionPayload | null;
  last: AttributionPayload | null;
} {
  if (typeof window === "undefined") return { first: null, last: null };
  let first: AttributionPayload | null = null;
  let last: AttributionPayload | null = null;
  try {
    first = safeParse(window.localStorage.getItem(FIRST_KEY));
    last = safeParse(window.localStorage.getItem(LAST_KEY));
  } catch {/* ignore */}
  if (!first) first = safeParse(readCookie(COOKIE_KEY));
  if (!last) last = first;
  return { first, last };
}

// Helper for form submit handlers — flattens first+last into the body shape
// /api/leads accepts (existing fields = first-touch; *_last = last-touch).
export function attributionPayload(): Record<string, string> {
  const { first, last } = getAttribution();
  const out: Record<string, string> = {};
  if (first) {
    if (first.gclid) out.gclid = first.gclid;
    if (first.utmSource) out.utm_source = first.utmSource;
    if (first.utmMedium) out.utm_medium = first.utmMedium;
    if (first.utmCampaign) out.utm_campaign = first.utmCampaign;
    if (first.utmTerm) out.utm_term = first.utmTerm;
    if (first.utmContent) out.utm_content = first.utmContent;
    if (first.landingPage) out.landingPage = first.landingPage;
    if (first.timestamp) out.firstVisitAt = new Date(first.timestamp).toISOString();
  }
  if (last) {
    if (last.gclid) out.gclid_last = last.gclid;
    if (last.utmSource) out.utm_source_last = last.utmSource;
    if (last.utmMedium) out.utm_medium_last = last.utmMedium;
    if (last.utmCampaign) out.utm_campaign_last = last.utmCampaign;
    if (last.utmTerm) out.utm_term_last = last.utmTerm;
    if (last.utmContent) out.utm_content_last = last.utmContent;
  }
  return out;
}
