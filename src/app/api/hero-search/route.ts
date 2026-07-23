// src/app/api/hero-search/route.ts
// Resolve hero/search-band typed text to a real destination (entity-first).
// The client posts the raw query; we return { href } and the client navigates.
import { NextResponse } from "next/server";
import { resolveHeroSearch } from "@/lib/heroSearch";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    const href = await resolveHeroSearch(q);
    return NextResponse.json({ href });
  } catch {
    // On any failure fall back to listings search — never a dead submit.
    const href = q.trim() ? `/listings?q=${encodeURIComponent(q.trim())}` : "/listings";
    return NextResponse.json({ href });
  }
}
