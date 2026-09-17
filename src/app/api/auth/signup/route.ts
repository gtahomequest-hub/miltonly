// POST /api/auth/signup: the sign-in request (MP-002).
//
// The decision is requestSignIn() in src/lib/portal/door.ts: honeypot, origin, rate limit,
// then the secret is written and the email sent. This file is the two things the library
// must not own, the Prisma write and the Resend call, and the headers off the request.
//
// The row is upserted with the new secret whether or not the address is known, and the
// response is the same words either way. verifyAttempts resets with the secret: a fresh code
// is a fresh five tries.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendSignInEmail } from "@/lib/email-user";
import { requestSignIn } from "@/lib/portal/door";

export const dynamic = "force-dynamic";

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const result = await requestSignIn(
    {
      body,
      ip: clientIp(request),
      origin: request.headers.get("origin"),
      referer: request.headers.get("referer"),
      host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
      proto: request.headers.get("x-forwarded-proto"),
    },
    {
      persist: async ({ email, code, tokenHash, expiry }) => {
        await prisma.user.upsert({
          where: { email },
          update: { verifyCode: code, verifyTokenHash: tokenHash, verifyExpiry: expiry, verifyAttempts: 0 },
          create: { email, verifyCode: code, verifyTokenHash: tokenHash, verifyExpiry: expiry },
        });
      },
      send: sendSignInEmail,
    },
  ).catch((err) => {
    console.error("[auth/signup] failed", err);
    return null;
  });

  if (!result) {
    return NextResponse.json({ error: "Something went wrong. Try again in a minute." }, { status: 500 });
  }
  if (!result.ok || result.reason) {
    console.warn("[auth/signup] refused or trapped", { reason: result.reason, status: result.status });
  }
  return NextResponse.json(result.body, { status: result.status });
}
