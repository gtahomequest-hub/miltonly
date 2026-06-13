// src/app/streets/page.tsx
// LIVE /streets — forest-v2 restyle of the A-Z street directory. RESTYLE ONLY:
// the 4 bulk DB1 queries (city=Milton, permAdvertise=true) are byte-identical to
// the legacy navy page; the search / A-Z / neighbourhood-chip mechanics are the
// same (now owned by the reusable <DirectoryGrid>). Only the shell is repainted
// forest — SiteNav + hero + FooterSection, scoped .dir-v2 theme. ChromeGate
// suppresses the navy Navbar on /streets (exact) and /streets/<slug> (prefix).
//
// Two Wave-2 quirks folded in:
//   - The dead "price alerts" form (no POST) is removed (nothing-fake rule).
//   - Link graph: the index only lists streets with >=1 permAdvertise listing,
//     which is exactly the existence-gate condition in getStreetPageData
//     (null only when a street has NO listings AND no stats AND no content AND
//     no sold record) — so every linked /streets/<slug> resolves 200. hasPage
//     just toggles the "Full report" badge.
import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import { formatPriceFull } from "@/lib/format";
import SiteNav from "@/components/nav/SiteNav";
import FooterSection from "@/components/sections/FooterSection";
import DirectoryGrid from "@/components/directory/DirectoryGrid";
import type { DirectoryItem } from "@/components/directory/types";
import "@/components/directory/directory-theme.css";

export const dynamic = "force-dynamic";

export const metadata = genMeta({
  title: `${config.CITY_NAME} Streets, Price Data for Every Street`,
  description: `Browse every ${config.CITY_NAME} ${config.CITY_PROVINCE} street with real estate data. Average prices, days on market, active listings. Street-level intelligence powered by TREB.`,
  canonical: `${config.SITE_URL}/streets`,
});

export default async function StreetsIndexPage() {
  // Get all unique streets with listing counts and avg prices
  const streets = await prisma.listing.groupBy({
    by: ["streetSlug"],
    _count: true,
    _avg: { price: true },
    where: { city: config.PRISMA_CITY_VALUE, permAdvertise: true },
    orderBy: { _count: { streetSlug: "desc" } },
  });

  // Hotfix 2026-05-09: replaced per-street N+1 loop (4 queries × 431 streets =
  // ~1,724 concurrent queries) with 4 bulk queries. The N+1 pattern exhausted
  // the Vercel serverless → Neon connection pool post-Path-A redeploy and
  // triggered Application error: digest 306433527.
  const slugs = streets.map((s) => s.streetSlug);

  // Bulk #1: sample streetName + neighbourhood per slug
  const samples = await prisma.listing.findMany({
    where: { streetSlug: { in: slugs }, streetName: { not: null } },
    distinct: ["streetSlug"],
    select: { streetSlug: true, streetName: true, neighbourhood: true },
  });
  const sampleMap = new Map(samples.map((r) => [r.streetSlug, r]));

  // Bulk #2: active counts per slug
  const activeRows = await prisma.listing.groupBy({
    by: ["streetSlug"],
    _count: true,
    where: { streetSlug: { in: slugs }, status: "active", permAdvertise: true },
  });
  const activeMap = new Map(activeRows.map((r) => [r.streetSlug, r._count]));

  // Bulk #3: published street pages
  const publishedRows = await prisma.streetContent.findMany({
    where: { streetSlug: { in: slugs }, status: "published" },
    select: { streetSlug: true },
  });
  const publishedSet = new Set(publishedRows.map((r) => r.streetSlug));

  // Bulk #4: recently queued (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const queuedRows = await prisma.streetQueue.findMany({
    where: { streetSlug: { in: slugs }, createdAt: { gte: sevenDaysAgo } },
    select: { streetSlug: true },
  });
  const newSet = new Set(queuedRows.map((r) => r.streetSlug));

  const streetData = streets.map((s) => {
    const sample = sampleMap.get(s.streetSlug);
    return {
      slug: s.streetSlug,
      name: sample?.streetName || s.streetSlug,
      neighbourhood: sample?.neighbourhood
        ? sample.neighbourhood.replace(/^\d+\s*-\s*\w+\s+/, "").trim()
        : config.CITY_NAME,
      count: s._count,
      activeCount: activeMap.get(s.streetSlug) ?? 0,
      avgPrice: Math.round(s._avg.price || 0),
      hasPage: publishedSet.has(s.streetSlug),
      isNew: newSet.has(s.streetSlug),
    };
  });

  // Get unique neighbourhoods for filter chips
  const neighbourhoods = Array.from(new Set(streetData.map((s) => s.neighbourhood)))
    .filter((n) => n && n !== config.CITY_NAME)
    .sort();

  const publishedCount = await prisma.streetContent.count({ where: { status: "published" } });

  // Map to the shared directory contract (presentation only).
  const items: DirectoryItem[] = streetData.map((s) => {
    const badges: DirectoryItem["badges"] = [];
    if (s.isNew) badges.push({ label: "New", tone: "new" });
    if (s.activeCount >= 5) badges.push({ label: "VIP Hub", tone: "vip" });

    const meta: DirectoryItem["meta"] = [
      { label: `${s.count} listing${s.count === 1 ? "" : "s"}`, tone: "muted" },
    ];
    if (s.activeCount > 0) meta.push({ label: `${s.activeCount} active`, tone: "active" });
    if (s.hasPage) meta.push({ label: "Full report", tone: "accent" });

    return {
      key: s.slug,
      name: s.name,
      href: `/streets/${s.slug}`,
      searchExtra: s.neighbourhood,
      group: s.neighbourhood,
      subtitle: s.neighbourhood,
      stat: formatPriceFull(s.avgPrice),
      statLabel: "Average price",
      badges,
      meta,
    };
  });

  return (
    <div className="dir-v2">
      <SiteNav variant="page" />

      <section className="dir-hero">
        <div className="dir-wrap">
          <span className="dir-eyebrow">Street intelligence</span>
          <h1>
            Every {config.CITY_NAME} <em>street</em>
          </h1>
          <p className="dir-sub">
            {streetData.length} streets with live price data · {publishedCount} full street
            reports published · Updated daily from TREB MLS®
          </p>
        </div>
      </section>

      <DirectoryGrid
        items={items}
        groups={neighbourhoods.slice(0, 15)}
        groupLabel="Neighbourhood"
        groupAllLabel="All areas"
        searchPlaceholder="Search streets by name or neighbourhood…"
        itemNoun="street"
      />

      <FooterSection />
    </div>
  );
}
