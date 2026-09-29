// src/lib/lead/refPath.ts
//
// A path on this site, or null. For a surface that reports where it was reached from: /book reads
// ?ref= and sends it as `ref`, and the ingest stores it as that lead's landingPage (ML-014). One
// rule, used by the page and by the ingest, so the two cannot drift.
//
// Refused: anything not starting with "/", protocol-relative paths ("//host"), absolute URLs,
// whitespace, quotes and angle brackets, and anything over 300 characters. Dot segments are
// resolved by the URL parser and the RESULT is checked again, because "/a/..//evil.com" resolves
// to "//evil.com", which a browser treats as another host. The query is stripped, so the value is
// the leads-per-page key.
export function sameOriginPath(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (s.length === 0 || s.length > 300 || !s.startsWith("/") || s.startsWith("//") || /[\s<>"'\\]/.test(s)) return null;
  let p: string;
  try {
    p = new URL(s, "https://miltonly.invalid").pathname;
  } catch {
    return null;
  }
  if (!p.startsWith("/") || p.startsWith("//") || p.length > 300) return null;
  return p;
}
