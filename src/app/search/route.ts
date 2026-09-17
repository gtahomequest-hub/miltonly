// src/app/search/route.ts
// THE SEARCH FORM'S NO-JAVASCRIPT PATH (MH-006, MA-004 defect 6).
//
// Every street search on the site is a <form action="/search" method="get"> whose submit
// handler, once hydrated, resolves the query through /api/hero-search and pushes the route
// without a full load. Before hydration (four to ten seconds on a phone, measured), or with
// scripting off, the same form submits here, the same resolver runs, and the answer is a
// redirect to the same destination. One resolver, two transports, one result.
//
// It is a redirect and nothing else: never a page, never indexed (robots disallows it), and
// never the target of an <a href>, which the battery would refuse as a hop.
import { NextResponse } from "next/server";
import { resolveHeroSearch } from "@/lib/heroSearch";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  let href: string;
  try {
    href = await resolveHeroSearch(q);
  } catch {
    href = q.trim() ? `/listings?q=${encodeURIComponent(q.trim())}` : "/listings";
  }
  return NextResponse.redirect(new URL(href, url.origin), 303);
}
