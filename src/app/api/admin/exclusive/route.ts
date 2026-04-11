import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

function checkAuth(req: NextRequest) {
  const cookie = req.cookies.get("miltonly_admin");
  return cookie?.value === "1";
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

interface ExclusiveBody {
  id?: string;
  title?: string;
  address?: string;
  city?: string;
  price?: number;
  priceType?: string;
  bedsMin?: number;
  bedsMax?: number;
  baths?: number;
  parking?: number;
  propertyType?: string;
  status?: string;
  badge?: string;
  description?: string;
  photos?: string[];
  slug?: string;
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const listings = await prisma.exclusiveListing.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ listings });
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json()) as ExclusiveBody;
    const slug = body.slug?.trim() || slugify(`${body.address || ""}-${body.city || ""}`);
    const created = await prisma.exclusiveListing.create({
      data: {
        title: body.title || "",
        address: body.address || "",
        city: body.city || "",
        price: Number(body.price) || 0,
        priceType: body.priceType || "sale",
        bedsMin: Number(body.bedsMin) || 0,
        bedsMax: Number(body.bedsMax) || 0,
        baths: Number(body.baths) || 0,
        parking: Number(body.parking) || 0,
        propertyType: body.propertyType || "Other",
        status: body.status || "active",
        badge: body.badge || "Exclusive",
        description: body.description || "",
        photos: Array.isArray(body.photos) ? body.photos : [],
        slug,
      },
    });
    return NextResponse.json({ listing: created });
  } catch (e) {
    console.error("Create exclusive error:", e);
    return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = (await req.json()) as ExclusiveBody;
    if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const updated = await prisma.exclusiveListing.update({
      where: { id: body.id },
      data: {
        title: body.title,
        address: body.address,
        city: body.city,
        price: body.price !== undefined ? Number(body.price) : undefined,
        priceType: body.priceType,
        bedsMin: body.bedsMin !== undefined ? Number(body.bedsMin) : undefined,
        bedsMax: body.bedsMax !== undefined ? Number(body.bedsMax) : undefined,
        baths: body.baths !== undefined ? Number(body.baths) : undefined,
        parking: body.parking !== undefined ? Number(body.parking) : undefined,
        propertyType: body.propertyType,
        status: body.status,
        badge: body.badge,
        description: body.description,
        photos: Array.isArray(body.photos) ? body.photos : undefined,
        slug: body.slug,
      },
    });
    return NextResponse.json({ listing: updated });
  } catch (e) {
    console.error("Update exclusive error:", e);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await prisma.exclusiveListing.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Delete exclusive error:", e);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
