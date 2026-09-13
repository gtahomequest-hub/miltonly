import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";

// MC-017 (2026-09-13). The build prerenders the fifty published streets most likely to be asked
// for first; the rest render on their first visit under the page's own ISR (dynamicParams true,
// revalidate an hour) and serve from the cache after that. Before this every published street
// was prerendered, 509 renders a build, each one a DB1, DB2, DB3 and Upstash round trip.
//
// "By traffic" is a proxy. Search Console (SeoOpportunity, the weekly sense run) holds
// impressions for 26 street pages and zero clicks for any, so the order is: impressions, then
// active listings on the street (the reason a reader lands on a street page today), then the
// slug for a stable tail. The list is only which pages are warm at deploy; it changes nothing a
// reader can see.
export const PRERENDER_STREET_LIMIT = 50;

export async function topStreetSlugsForPrerender(limit = PRERENDER_STREET_LIMIT): Promise<string[]> {
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
