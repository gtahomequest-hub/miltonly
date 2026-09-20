// POST /api/auth/verify: a code or a link becomes a session (MP-002).
//
// Two bodies: { email, code } from the form, { token } from /signin/link. Both go through the
// pure judges in src/lib/portal/door.ts: expiry, the five-attempt lock, a constant-time
// compare. A wrong code bumps the counter on the row; a right one clears the whole secret
// (code, token hash, expiry, counter) so neither shape can be used twice.
//
// The response carries `redirect`, the same-origin path the caller passed through
// safeRedirect(), so the form and the link page both land the person where they started.
// Whether the person still has to acknowledge the VOW terms or set a password (MP-002b) is
// the page's business: the street island and /sold ask the server and render the card inline.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { judgeCode, judgeToken, hashToken, normalizeEmail, safeRedirect } from "@/lib/portal/door";
import { vowStepsLeft } from "@/lib/vow-access";

export const dynamic = "force-dynamic";

const SECRET_SELECT = {
  id: true,
  email: true,
  firstName: true,
  verified: true,
  verifyCode: true,
  verifyTokenHash: true,
  verifyExpiry: true,
  verifyAttempts: true,
  vowAcknowledgedAt: true,
  passwordHash: true,
} as const;

export async function POST(request: NextRequest) {
  let body: { email?: unknown; code?: unknown; token?: unknown; redirect?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Email and code required" }, { status: 400 });
  }
  const redirect = safeRedirect(typeof body.redirect === "string" ? body.redirect : null);

  try {
    let user: { id: string; email: string; firstName: string | null; verified: boolean; vowAcknowledgedAt: Date | null; passwordHash: string | null } | null = null;

    if (typeof body.token === "string" && body.token.length > 0) {
      const stored = await prisma.user.findFirst({ where: { verifyTokenHash: hashToken(body.token) }, select: SECRET_SELECT });
      const verdict = judgeToken(stored, body.token);
      if (!verdict.ok) {
        if (verdict.countAttempt && stored) {
          await prisma.user.update({ where: { id: stored.id }, data: { verifyAttempts: { increment: 1 } } });
        }
        return NextResponse.json({ error: verdict.error }, { status: verdict.status });
      }
      user = stored;
    } else {
      const email = normalizeEmail(body.email);
      const code = typeof body.code === "string" ? body.code.replace(/\D/g, "") : "";
      if (!email || !code) {
        return NextResponse.json({ error: "Email and code required" }, { status: 400 });
      }
      const stored = await prisma.user.findUnique({ where: { email }, select: SECRET_SELECT });
      const verdict = judgeCode(stored, code);
      if (!verdict.ok) {
        if (verdict.countAttempt && stored) {
          await prisma.user.update({ where: { id: stored.id }, data: { verifyAttempts: { increment: 1 } } });
        }
        return NextResponse.json({ error: verdict.error }, { status: verdict.status });
      }
      user = stored;
    }

    if (!user) {
      return NextResponse.json({ error: "That code is not valid. Request a new one." }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        verified: true,
        verifyCode: null,
        verifyTokenHash: null,
        verifyExpiry: null,
        verifyAttempts: 0,
        lastLoginAt: new Date(),
      },
    });

    await createSession(user.id);

    return NextResponse.json({
      success: true,
      redirect,
      // What the card still has to ask (MP-002b): the acknowledgement, the password.
      ...vowStepsLeft(user),
      user: { id: user.id, email: user.email, firstName: user.firstName },
    });
  } catch (e) {
    console.error("[auth/verify] failed", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
