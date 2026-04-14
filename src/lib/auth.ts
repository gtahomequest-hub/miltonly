import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "miltonly-dev-secret-change-in-production"
);

const COOKIE_NAME = "miltonly_session";

export async function createSession(userId: string) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(JWT_SECRET);

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
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

export function generateVerifyCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
