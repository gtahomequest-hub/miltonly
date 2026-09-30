// src/app/api/hero-index/route.ts
// Serves the hero-autocomplete index (every entity, its neighbourhood or address) as one
// cached JSON payload. The client fetches this once on first focus and filters locally.
// It carries no count derived from sold records (MC-046 R7): see src/lib/heroIndex.ts.
import { NextResponse } from "next/server";
import { getHeroIndex } from "@/lib/heroIndex";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const index = await getHeroIndex();
    return NextResponse.json(
      { index },
      { headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch {
    return NextResponse.json({ index: [] });
  }
}
