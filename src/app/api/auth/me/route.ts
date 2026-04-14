import { getSession } from "@/lib/auth";
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
    },
  });
}
