import { prisma } from "@/lib/prisma";
import { generateVerifyCode } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email-user";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { email, firstName, phone } = await request.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const code = generateVerifyCode();
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    // Upsert user — if they already exist but aren't verified, refresh the code
    const user = await prisma.user.upsert({
      where: { email: normalizedEmail },
      update: {
        verifyCode: code,
        verifyExpiry: expiry,
        ...(firstName && { firstName }),
        ...(phone && { phone }),
      },
      create: {
        email: normalizedEmail,
        firstName: firstName || null,
        phone: phone || null,
        verifyCode: code,
        verifyExpiry: expiry,
      },
    });

    // If already verified, just send a new login code
    await sendVerificationEmail(normalizedEmail, code);

    return NextResponse.json({
      success: true,
      isExisting: user.verified,
      message: user.verified
        ? "We sent a login code to your email"
        : "We sent a verification code to your email",
    });
  } catch (e) {
    console.error("Signup error:", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
