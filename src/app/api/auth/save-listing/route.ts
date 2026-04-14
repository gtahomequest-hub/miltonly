import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

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
    updated = [...current, mlsNumber];
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { savedListings: updated },
  });

  return NextResponse.json({ savedListings: updated });
}
