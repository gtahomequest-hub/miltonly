import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json({ error: "Email and code required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return NextResponse.json({ error: "No account found" }, { status: 404 });
    }

    if (user.verifyCode !== code) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    if (user.verifyExpiry && user.verifyExpiry < new Date()) {
      return NextResponse.json({ error: "Code expired — request a new one" }, { status: 400 });
    }

    // Mark verified, clear code, set session
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verified: true,
        verifyCode: null,
        verifyExpiry: null,
        lastLoginAt: new Date(),
      },
    });

    await createSession(user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
      },
    });
  } catch (e) {
    console.error("Verify error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
