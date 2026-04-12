import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
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

function toNum(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
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
  sqft?: number | null;
  yearBuilt?: number | null;
  lotSize?: string | null;
  maintenance?: number | null;
  taxes?: number | null;
  taxYear?: number | null;
  heating?: string | null;
  cooling?: string | null;
  basement?: string | null;
  garage?: string | null;
  exterior?: string | null;
  locker?: string | null;
  exposure?: string | null;
  petFriendly?: boolean | null;
  interiorFeatures?: string[];
  exteriorFeatures?: string[];
  rooms?: unknown;
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
        sqft: toNum(body.sqft),
        yearBuilt: toNum(body.yearBuilt),
        lotSize: body.lotSize || null,
        maintenance: toNum(body.maintenance),
        taxes: toNum(body.taxes),
        taxYear: toNum(body.taxYear),
        heating: body.heating || null,
        cooling: body.cooling || null,
        basement: body.basement || null,
        garage: body.garage || null,
        exterior: body.exterior || null,
        locker: body.locker || null,
        exposure: body.exposure || null,
        petFriendly: body.petFriendly ?? null,
        interiorFeatures: Array.isArray(body.interiorFeatures) ? body.interiorFeatures : [],
        exteriorFeatures: Array.isArray(body.exteriorFeatures) ? body.exteriorFeatures : [],
        rooms: (body.rooms ?? Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull,
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
        sqft: body.sqft !== undefined ? toNum(body.sqft) ?? null : undefined,
        yearBuilt: body.yearBuilt !== undefined ? toNum(body.yearBuilt) ?? null : undefined,
        lotSize: body.lotSize !== undefined ? body.lotSize || null : undefined,
        maintenance: body.maintenance !== undefined ? toNum(body.maintenance) ?? null : undefined,
        taxes: body.taxes !== undefined ? toNum(body.taxes) ?? null : undefined,
        taxYear: body.taxYear !== undefined ? toNum(body.taxYear) ?? null : undefined,
        heating: body.heating !== undefined ? body.heating || null : undefined,
        cooling: body.cooling !== undefined ? body.cooling || null : undefined,
        basement: body.basement !== undefined ? body.basement || null : undefined,
        garage: body.garage !== undefined ? body.garage || null : undefined,
        exterior: body.exterior !== undefined ? body.exterior || null : undefined,
        locker: body.locker !== undefined ? body.locker || null : undefined,
        exposure: body.exposure !== undefined ? body.exposure || null : undefined,
        petFriendly: body.petFriendly !== undefined ? body.petFriendly : undefined,
        interiorFeatures: Array.isArray(body.interiorFeatures) ? body.interiorFeatures : undefined,
        exteriorFeatures: Array.isArray(body.exteriorFeatures) ? body.exteriorFeatures : undefined,
        rooms:
          body.rooms !== undefined
            ? ((body.rooms ?? Prisma.DbNull) as Prisma.InputJsonValue | typeof Prisma.DbNull)
            : undefined,
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
