import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "miltonly-dev-secret-change-in-production"
);

export const COOKIE_NAME = "miltonly_session";

// THE 90-DAY CEILING (MP-002). The TRREB VOW Policy lets a consumer's credential stand for up
// to 90 days, after which it must be renewed or reconfirmed. The session is that credential's
// life: a fixed expiry set at sign-in, never extended, never refreshed. At day 90 the cookie is
// dead and the person signs in again, which reconfirms the email. Do not add a sliding window
// to `exp`.
export const SESSION_MAX_DAYS = 90;
const SESSION_SECONDS = 60 * 60 * 24 * SESSION_MAX_DAYS;

// THE 60-MINUTE INACTIVITY TIMEOUT (MP-006, MLS R-8.13, PropTx Best Practices item 25).
// Separate from the ceiling: the token carries `act`, the instant the session stops counting as
// active, sixty minutes after the last request that touched it. getSession() refuses a token
// whose `act` has passed even when `exp` has not. touchSession() re-issues the token with a new
// `act` and the ORIGINAL `exp`, so activity extends the hour and never the ninety days. Only a
// route handler can set a cookie in Next 14, so the touch happens in /api/auth/me (which every
// page calls on mount) and in the gated record routes, not in a server component's read.
export const INACTIVITY_MINUTES = 60;
const INACTIVITY_SECONDS = 60 * INACTIVITY_MINUTES;

export interface SessionClaims {
  userId: string;
  /** seconds since epoch: the ceiling, fixed at sign-in */
  exp: number;
  /** seconds since epoch: active until, moved by every touch */
  act: number;
}

export type SessionVerdict = "ok" | "inactive" | "expired" | "invalid";

/** The pure rule, so the prebuild can hold it: expired beats inactive beats ok. */
export function judgeSession(claims: Partial<SessionClaims> | null | undefined, nowSeconds: number): SessionVerdict {
  if (!claims || typeof claims.userId !== "string" || typeof claims.exp !== "number" || typeof claims.act !== "number") {
    return "invalid";
  }
  if (claims.exp <= nowSeconds) return "expired";
  if (claims.act <= nowSeconds) return "inactive";
  return "ok";
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

async function sign(claims: SessionClaims): Promise<string> {
  return new SignJWT({ userId: claims.userId, act: claims.act })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(claims.exp)
    .sign(JWT_SECRET);
}

function setCookie(token: string, exp: number) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // The cookie lives as long as the ceiling; the hour is judged from `act`, not from the
    // cookie's own age, so an idle browser still presents the token and is refused by it.
    maxAge: Math.max(0, exp - nowSeconds()),
    path: "/",
  });
}

export async function createSession(userId: string) {
  const now = nowSeconds();
  const claims: SessionClaims = { userId, exp: now + SESSION_SECONDS, act: now + INACTIVITY_SECONDS };
  const token = await sign(claims);
  setCookie(token, claims.exp);
  return token;
}

async function readClaims(): Promise<SessionClaims | null> {
  const cookie = cookies().get(COOKIE_NAME);
  if (!cookie?.value) return null;
  try {
    const { payload } = await jwtVerify(cookie.value, JWT_SECRET);
    return { userId: payload.userId as string, exp: payload.exp as number, act: payload.act as number };
  } catch {
    return null;
  }
}

/** The signed-in user, or null: no cookie, a bad signature, past the ceiling, or an hour
 *  without a touch. Reads the row every time, so a change on it (a password set, a re-consent,
 *  a review flag) is seen on the next request. */
export async function getSession() {
  const claims = await readClaims();
  if (judgeSession(claims, nowSeconds()) !== "ok" || !claims) return null;
  const user = await prisma.user.findUnique({ where: { id: claims.userId } });
  if (!user || !user.verified) return null;
  return user;
}

/** Re-issue the token with `act` an hour from now and `exp` untouched. Route handlers only
 *  (a server component cannot set a cookie). A token that is not "ok" is left alone: an idle
 *  session is not revived by the request that finds it idle. */
export async function touchSession(): Promise<boolean> {
  const claims = await readClaims();
  const now = nowSeconds();
  if (!claims || judgeSession(claims, now) !== "ok") return false;
  const next: SessionClaims = { ...claims, act: now + INACTIVITY_SECONDS };
  try {
    setCookie(await sign(next), next.exp);
    return true;
  } catch {
    return false;
  }
}

export async function destroySession() {
  cookies().set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
}
