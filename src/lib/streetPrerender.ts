import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";

// MC-017 (2026-09-13) capped the build at the fifty published streets most likely to be asked
// for first; the rest rendered on their first visit under the page's own ISR (dynamicParams
// true, revalidate an hour). MA-007 (2026-09-21) measured what that cost: every production
// deploy dropped the ISR entry of the 596 streets outside the fifty, the battery after each
// merge rendered every one, and the route was 9.6% cached with a 2.3 s first byte on a MISS.
// MC-035: on production every published street prerenders, as the 22 hubs do, so a deploy
// leaves them PRERENDER and a reader's first request after it is a static read. A preview
// keeps the fifty: its build is a gate, not a corpus. Keyed on VERCEL_ENV, which Vercel sets
// to "production" on a Git build of main and on `vercel deploy --prod`, to "preview" on a CLI
// or branch preview, and which .env.local carries as "production" (pulled from Vercel), so the
// local gate prerenders the corpus too and proves the build before it is pushed.
//
// "By traffic" is the order, a proxy that only matters under the cap. Search Console
// (SeoOpportunity, the weekly sense run) holds impressions for 26 street pages and zero clicks
// for any, so the order is: impressions, then active listings on the street (the reason a
// reader lands on a street page today), then the slug for a stable tail.
export const PRERENDER_STREET_LIMIT_PREVIEW = 50;

/** Every published street on production; fifty anywhere else. */
export function prerenderStreetLimit(env: string | undefined = process.env.VERCEL_ENV): number {
  return env === "production" ? Number.POSITIVE_INFINITY : PRERENDER_STREET_LIMIT_PREVIEW;
}

export async function topStreetSlugsForPrerender(limit: number = prerenderStreetLimit()): Promise<string[]> {
  const published = await prisma.streetContent.findMany({
    where: { status: "published" },
    select: { streetSlug: true },
  });
  const all = Array.from(new Set(published.map((s) => s.streetSlug)));
  const slugs = new Set(all);
  if (all.length <= limit) return all.sort();

  const impressions = new Map<string, number>();
  const active = new Map<string, number>();
  try {
    const gsc = await prisma.seoOpportunity.groupBy({
      by: ["targetPage"],
      where: { targetPage: { startsWith: "/streets/" } },
      _sum: { impressions: true },
    });
    for (const r of gsc) {
      const slug = (r.targetPage ?? "").slice("/streets/".length).replace(/\/$/, "");
      if (slugs.has(slug)) impressions.set(slug, r._sum.impressions ?? 0);
    }
    const listings = await prisma.listing.groupBy({
      by: ["streetSlug"],
      where: { status: "active", city: config.PRISMA_CITY_VALUE, streetSlug: { in: all } },
      _count: { _all: true },
    });
    for (const r of listings) active.set(r.streetSlug, r._count._all);
  } catch (e) {
    // The ranking is a warm-cache preference, never a reason to fail a build.
    console.warn(`[streetPrerender] ranking read failed, alphabetical head used: ${String((e as Error).message).slice(0, 90)}`);
  }

  return all
    .sort((a, b) =>
      (impressions.get(b) ?? 0) - (impressions.get(a) ?? 0) ||
      (active.get(b) ?? 0) - (active.get(a) ?? 0) ||
      a.localeCompare(b),
    )
    .slice(0, limit);
}
