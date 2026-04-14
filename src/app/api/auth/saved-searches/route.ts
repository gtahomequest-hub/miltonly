import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const searches = await prisma.savedSearch.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ searches });
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json();
  const { name, propertyType, neighbourhood, streetSlug, priceMin, priceMax, bedsMin, bathsMin, transactionType } = body;

  if (!name) return NextResponse.json({ error: "Search name required" }, { status: 400 });

  const search = await prisma.savedSearch.create({
    data: {
      userId: user.id,
      name,
      propertyType: propertyType || null,
      neighbourhood: neighbourhood || null,
      streetSlug: streetSlug || null,
      priceMin: priceMin ? parseInt(priceMin) : null,
      priceMax: priceMax ? parseInt(priceMax) : null,
      bedsMin: bedsMin ? parseInt(bedsMin) : null,
      bathsMin: bathsMin ? parseInt(bathsMin) : null,
      transactionType: transactionType || null,
    },
  });

  return NextResponse.json({ search });
}

export async function DELETE(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { searchId } = await request.json();
  if (!searchId) return NextResponse.json({ error: "Search ID required" }, { status: 400 });

  // Ensure the search belongs to this user
  const search = await prisma.savedSearch.findFirst({
    where: { id: searchId, userId: user.id },
  });
  if (!search) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.savedSearch.delete({ where: { id: searchId } });

  return NextResponse.json({ success: true });
}
