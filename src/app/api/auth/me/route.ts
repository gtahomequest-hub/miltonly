import { getSession } from "@/lib/auth";
import { vowStepsLeft } from "@/lib/vow-access";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      savedListings: user.savedListings,
      // What the VOW card still has to ask (MP-002b): the acknowledgement, the password.
      ...vowStepsLeft(user),
    },
  });
}
