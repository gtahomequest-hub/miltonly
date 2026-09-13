import { revalidatePath, revalidateTag } from "next/cache";
import { DB_CACHE_TAG } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const secret = searchParams.get("secret");

  if (secret !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const path = body?.path as string | undefined;
  const tag = body?.tag as string | undefined;

  // MC-010: a sync that runs outside the app (the local runners) cannot reach Next's Data Cache
  // directly; it posts the tag here. Only the database tags are accepted.
  if (tag) {
    const known = Object.values(DB_CACHE_TAG);
    if (!known.includes(tag)) return NextResponse.json({ error: "unknown tag", known }, { status: 400 });
    revalidateTag(tag);
    return NextResponse.json({ revalidated: true, tag });
  }

  if (path) {
    revalidatePath(path);
    return NextResponse.json({ revalidated: true, path });
  }

  // Revalidate all key pages when no specific path given
  const paths = ["/", "/listings", "/streets", "/rentals", "/exclusive"];
  paths.forEach((p) => revalidatePath(p));

  return NextResponse.json({ revalidated: true, paths });
}
