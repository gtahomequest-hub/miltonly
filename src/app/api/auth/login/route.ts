// POST /api/auth/login: the returning sign-in, email + password (MP-002b, R-805(c)).
//
// Origin check and its own rate limit first (src/lib/portal/password.ts), then one bcrypt
// compare, run even when the address has no row or no password yet, against a dummy hash, so
// a wrong password, an unknown address and a not-yet-set password all take the same time and
// get the same words. The only success is a real hash that matches.
//
// A person whose password is not set yet (they signed in once by link and closed the card)
// cannot get in this way and is told, in the same words as everyone else, to use the link;
// the link route then shows the card, which asks for the password before any record.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { checkOrigin } from "@/lib/lead/guards";
import { normalizeEmail, safeRedirect } from "@/lib/portal/door";
import { checkLoginRateLimit, verifyPassword } from "@/lib/portal/password";
import { vowStepsLeft } from "@/lib/vow-access";

export const dynamic = "force-dynamic";

const MISMATCH = "That email and password do not match. Try again, or email yourself a sign-in link.";

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown; redirect?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const origin = checkOrigin(request.headers.get("origin"), request.headers.get("referer"));
  if (!origin.ok) {
    return NextResponse.json({ error: origin.error }, { status: origin.status });
  }

  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }
  const redirect = safeRedirect(typeof body.redirect === "string" ? body.redirect : null);

  const limit = await checkLoginRateLimit({ ip: clientIp(request), email });
  if (!limit.ok) {
    console.warn("[auth/login] rate limited", { reason: limit.reason });
    return NextResponse.json({ error: limit.error }, { status: limit.status });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        verified: true,
        passwordHash: true,
        passwordSetAt: true,
        vowAcknowledgedAt: true,
        vowAcknowledgementVersion: true,
        isRegistrant: true,
        reviewFlag: true,
      },
    });
    const matched = await verifyPassword(password, user?.passwordHash);
    if (!user || !matched || !user.verified) {
      return NextResponse.json({ error: MISMATCH }, { status: 401 });
    }

    // A password past 90 days (R-8.06) still matches and still signs the person in; the card
    // then takes the renewal before any record shows (needsPasswordRenewal below, judged by
    // src/lib/vow-access.ts). Refusing the login here would only send them to the link path,
    // which ends at the same card.
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await createSession(user.id);

    return NextResponse.json({
      success: true,
      redirect,
      ...vowStepsLeft(user),
      user: { id: user.id, email: user.email, firstName: user.firstName },
    });
  } catch (e) {
    console.error("[auth/login] failed", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
