import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "miltonly-dev-secret-change-in-production"
);

const COOKIE_NAME = "miltonly_session";

// THE 90-DAY CEILING (MP-002). The TRREB VOW Policy lets a consumer's credential stand for up
// to 90 days, after which it must be renewed or reconfirmed. The session is that credential's
// life: a fixed expiry set at sign-in, never extended, never refreshed. At day 90 the cookie is
// dead and the person signs in again, which reconfirms the email. Do not add a sliding window.
export const SESSION_MAX_DAYS = 90;
const SESSION_SECONDS = 60 * 60 * 24 * SESSION_MAX_DAYS;

export async function createSession(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_DAYS}d`)
    .sign(JWT_SECRET);

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_SECONDS,
    path: "/",
  });

  return token;
}

export async function getSession() {
  const cookie = cookies().get(COOKIE_NAME);
  if (!cookie?.value) return null;

  try {
    const { payload } = await jwtVerify(cookie.value, JWT_SECRET);
    const userId = payload.userId as string;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.verified) return null;
    return user;
  } catch {
    return null;
  }
}

export async function destroySession() {
  cookies().set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
}

