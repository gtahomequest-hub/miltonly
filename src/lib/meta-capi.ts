// Meta Conversions API (CAPI) server-side client.
//
// Pairs with the browser Pixel: both fire the same event with the same
// event_id so Meta dedupes server + browser pairs and counts a single
// conversion. CAPI is the durable side — survives ad blockers, iOS
// privacy, and browser-side script failures.
//
// PII MUST be hashed before sending. Meta rejects unhashed em/ph/fn/ln
// fields. We use SHA-256 of trimmed lowercase strings (Meta's spec).
//
// Failures are logged but never thrown — a CAPI outage must not break the
// user-facing form submission. The Pixel browser-side fire still happens
// independently; if CAPI catches up later, the event_id dedupes.
//
// Docs: https://developers.facebook.com/docs/marketing-api/conversions-api

import { createHash } from "crypto";

const GRAPH_API_VERSION = "v18.0";

// Inputs to hashUserData — all optional, all PII.
export interface UserDataInput {
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
}

// SHA-256 hex outputs as required by Meta. Keys match Meta's user_data
// schema (em, ph, fn, ln) so the result spreads directly into a CAPI
// user_data block. Undefined keys are omitted (Meta rejects empty hashes).
export interface HashedUserData {
  em?: string[];
  ph?: string[];
  fn?: string[];
  ln?: string[];
}

// Full user_data block sent to CAPI. Includes the hashed PII plus the
// non-hashed client signals (IP, UA, click IDs) Meta uses for matching.
export interface CapiUserData extends HashedUserData {
  client_ip_address?: string;
  client_user_agent?: string;
  fbc?: string;
  fbp?: string;
}

export interface CapiEventParams {
  event_name: string;
  event_time: number; // Unix seconds — Meta rejects events older than 7 days
  event_id: string; // dedup key paired with browser Pixel
  event_source_url: string;
  user_data: CapiUserData;
  custom_data?: Record<string, unknown>;
  action_source?: "website" | "app" | "phone_call" | "chat" | "email" | "physical_store" | "system_generated" | "other";
}

export interface CapiResponse {
  ok: boolean;
  status?: number;
  trace?: unknown;
}

// SHA-256 hex of a trimmed lowercase string. Returns null for empty/undefined
// so the caller can use `?? undefined` to drop the key entirely.
function sha256Lower(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return createHash("sha256").update(normalized).digest("hex");
}

// Phone hashing per Meta spec: keep digits only (drop +, spaces, dashes,
// parens) before SHA-256. Country code MUST be included (Meta example:
// hash "16505551212" not "5551212"). The caller is responsible for passing
// an E.164-ish string with country code; we just strip non-digits here.
function sha256Phone(value: string | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  return createHash("sha256").update(digits).digest("hex");
}

export function hashUserData(data: UserDataInput): HashedUserData {
  const out: HashedUserData = {};
  const em = sha256Lower(data.email);
  if (em) out.em = [em];
  const ph = sha256Phone(data.phone);
  if (ph) out.ph = [ph];
  const fn = sha256Lower(data.firstName);
  if (fn) out.fn = [fn];
  const ln = sha256Lower(data.lastName);
  if (ln) out.ln = [ln];
  return out;
}

// Posts to graph.facebook.com/{pixel_id}/events. If META_CAPI_TEST_EVENT_CODE
// is set, the payload routes to the Test Events tab in Events Manager so we
// can verify shape without polluting real ad optimization.
//
// Never throws. Failures are logged and returned as { ok: false } so the
// caller can decide whether to fall back (typically: just log + continue).
export async function sendCapiEvent(params: CapiEventParams): Promise<CapiResponse> {
  const pixelId = process.env.META_PIXEL_ID;
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN;
  const testEventCode = process.env.META_CAPI_TEST_EVENT_CODE;

  if (!pixelId || !accessToken) {
    console.warn("[meta-capi] skipped — META_PIXEL_ID or META_CAPI_ACCESS_TOKEN not set");
    return { ok: false, trace: "missing credentials" };
  }

  const event = {
    event_name: params.event_name,
    event_time: params.event_time,
    event_id: params.event_id,
    event_source_url: params.event_source_url,
    action_source: params.action_source ?? "website",
    user_data: params.user_data,
    ...(params.custom_data ? { custom_data: params.custom_data } : {}),
  };

  const body: Record<string, unknown> = {
    data: [event],
    access_token: accessToken,
  };
  if (testEventCode) {
    body.test_event_code = testEventCode;
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const trace = await res.json().catch(() => null);
    if (!res.ok) {
      console.warn(`[meta-capi] ${params.event_name} returned ${res.status}`, trace);
      return { ok: false, status: res.status, trace };
    }
    return { ok: true, status: res.status, trace };
  } catch (err) {
    console.warn(`[meta-capi] ${params.event_name} threw`, err);
    return { ok: false, trace: err instanceof Error ? err.message : String(err) };
  }
}
