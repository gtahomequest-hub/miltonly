import { NextRequest, NextResponse } from "next/server";
import { makeAdminCookieValue } from "@/lib/adminAuth";

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  // HMAC-signed value (issued-at + signature) — the legacy static "1" is
  // rejected by verifyAdminCookieValue everywhere. See src/lib/adminAuth.ts.
  const value = makeAdminCookieValue();
  if (!value) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("miltonly_admin", value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });

  return response;
}
