import { NextRequest, NextResponse } from "next/server";

// ============================================================
// PRE-LAUNCH GATE
// Blocks all public traffic until PropTx IDX URL approval
// for miltonly.com is granted.
//
// To DISABLE this gate (go live):
//   Set MAINTENANCE_MODE = false below, then git push.
//
// To PREVIEW the real site while gate is on:
//   Visit https://www.miltonly.com/?preview=miltonly-aamir-2026
//   This sets a cookie. Future visits bypass the gate.
//
// To clear preview cookie:
//   Visit https://www.miltonly.com/?preview=off
// ============================================================

const MAINTENANCE_MODE = false;

// Change this secret to rotate access. Anyone with the current
// secret can preview the real site.
const PREVIEW_SECRET = "miltonly-aamir-2026";

const PREVIEW_COOKIE = "miltonly_preview";

// Paths that always bypass the gate:
// - /coming-soon : the public placeholder page
// - /api/sync/*, /api/compliance/*, /api/monitor/* : nightly crons (already secret-protected)
// - /admin/*, /api/admin/* : admin panel (already password-protected)
// - /_next/*, /favicon.ico, /robots.txt, static assets
const ALWAYS_ALLOW = [
  "/coming-soon",
  "/api/sync",
  "/api/compliance",
  "/api/monitor",
  "/api/alerts",
  "/api/revalidate",
  "/admin",
  "/api/admin",
  "/api/auth",
  "/_next",
  "/favicon",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
  "/opengraph-image",
];

export function middleware(req: NextRequest) {
  if (!MAINTENANCE_MODE) return NextResponse.next();

  const { pathname, searchParams } = req.nextUrl;

  // Handle preview toggle
  const previewParam = searchParams.get("preview");
  if (previewParam === PREVIEW_SECRET) {
    const res = NextResponse.redirect(new URL(pathname, req.url));
    res.cookies.set(PREVIEW_COOKIE, PREVIEW_SECRET, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return res;
  }
  if (previewParam === "off") {
    const res = NextResponse.redirect(new URL("/coming-soon", req.url));
    res.cookies.delete(PREVIEW_COOKIE);
    return res;
  }

  // Bypass gate if preview cookie is valid
  const previewCookie = req.cookies.get(PREVIEW_COOKIE)?.value;
  if (previewCookie === PREVIEW_SECRET) {
    return NextResponse.next();
  }

  // Always-allow paths
  if (ALWAYS_ALLOW.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Everyone else: rewrite to coming-soon
  return NextResponse.rewrite(new URL("/coming-soon", req.url));
}

// Run on all routes except static files and Next.js internals.
// The always-allow list above handles the fine-grained bypasses.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
