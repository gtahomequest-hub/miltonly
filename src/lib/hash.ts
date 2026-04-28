// SHA-256 hashing for Google Ads Enhanced Conversions (manual mode).
//
// Why manual: auto-detect mode on Next.js multi-step forms gets near-zero
// match rate per Google's diagnostics. Manual hashing of email + phone
// (E.164) before passing to gtag user_data lifts match rate to 50%+.
//
// Why client-side crypto.subtle: keeps PII out of network logs / our own
// telemetry — only the hash leaves the browser. Same constraint Google
// recommends for Enhanced Conversions for Leads.

export async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashUserData(email?: string | null, phone?: string | null): Promise<{
  sha256_email_address?: string;
  sha256_phone_number?: string;
}> {
  const result: { sha256_email_address?: string; sha256_phone_number?: string } = {};
  if (email && email.trim()) {
    result.sha256_email_address = await sha256(email.trim().toLowerCase());
  }
  if (phone && phone.trim()) {
    // E.164: strip non-digits; prepend + (or +1 if 10 digits — North America default).
    const digits = phone.replace(/[^\d]/g, "");
    if (digits.length >= 10) {
      const e164 = digits.startsWith("1") ? `+${digits}` : `+1${digits}`;
      result.sha256_phone_number = await sha256(e164);
    }
  }
  return result;
}
