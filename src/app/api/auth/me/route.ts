// GET /api/auth/me: who is signed in and what the card still owes.
//
// Every page calls this on mount (UserProvider), so it is where the 60-minute inactivity clock
// is wound (MP-006, R-8.13): touchSession() re-issues the cookie with `act` an hour out and the
// ceiling untouched. A page rendered on the server cannot set a cookie; this route can.

import { getSession, touchSession } from "@/lib/auth";
import { vowStepsLeft } from "@/lib/vow-access";
import { passwordExpiresAt } from "@/lib/portal/passwordRule";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
  }
  await touchSession();
  return NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        savedListings: user.savedListings,
        // What the VOW card still has to ask (MP-002b, MP-006): the agreement (or a re-consent
        // to a newer text), the password, its renewal, the registrant answer.
        ...vowStepsLeft(user),
        isRegistrant: user.isRegistrant,
        passwordExpiresAt: passwordExpiresAt(user.passwordSetAt),
        termsVersion: user.vowAcknowledgementVersion,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
