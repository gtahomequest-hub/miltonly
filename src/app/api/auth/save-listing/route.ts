import { getSession, touchSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// MC-036, item 4: a person's saved list holds at most 100 listings, the most one response may
// describe (saved-listings/route.ts reads the same number). A save past it is refused and the
// list comes back unchanged, so the client's state stays what the server holds.
const SAVED_LISTINGS_CAP = 100;

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { mlsNumber, action } = await request.json();
  if (!mlsNumber) return NextResponse.json({ error: "MLS number required" }, { status: 400 });

  const current = user.savedListings || [];

  let updated: string[];
  if (action === "remove") {
    updated = current.filter((m) => m !== mlsNumber);
  } else {
    if (current.includes(mlsNumber)) {
      return NextResponse.json({ savedListings: current });
    }
    if (current.length >= SAVED_LISTINGS_CAP) {
      return NextResponse.json(
        { error: `You can save up to ${SAVED_LISTINGS_CAP} listings. Remove one to save another.`, savedListings: current },
        { status: 400 },
      );
    }
    updated = [...current, mlsNumber];
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { savedListings: updated },
  });
  await touchSession();

  return NextResponse.json({ savedListings: updated });
}
