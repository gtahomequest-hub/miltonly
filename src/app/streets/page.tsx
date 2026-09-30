// src/app/streets/page.tsx
// LIVE /streets — forest-v2 restyle of the A-Z street directory. The search / A-Z /
// neighbourhood-chip mechanics are owned by the reusable <DirectoryGrid>; the shell is
// SiteNav + hero + SiteFooter, scoped .dir-v2 theme. ChromeGate suppresses the navy Navbar on
// /streets (exact) and /streets/<slug> (prefix).
//
// THE PUBLIC ROWS ONLY (MC-046 Stage 1, rulings R9 and R11). "N listings" counted every
// advertised row, sold, rented and expired included, and the list was ordered by that count: a
// number and a rank that disclosed each street's sold and leased volume. Both now read the
// public predicate (src/lib/listings/vow.ts, PUBLIC_LISTING_WHERE: an active sale listing or an
// available lease), and the order is the active count, ties alphabetical.
//
// Which streets are listed: every street with a public listing, and every published street page
// (the sitemap's set, publishedStreetPageSlugs), so every page keeps its link from here. A
// street whose only rows are sold, rented or expired is not listed on the strength of them.
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import { formatPriceFull } from "@/lib/format";
import SiteNavLive from "@/components/nav/SiteNavLive";
import SiteFooter from "@/components/nav/SiteFooter";
import DirectoryGrid from "@/components/directory/DirectoryGrid";
import type { DirectoryItem } from "@/components/directory/types";
import "@/components/directory/directory-theme.css";
import { resolveStreetName } from "@/lib/streetName";
import { publishedStreetPageSlugs } from "@/lib/streetSurface";
import { PUBLIC_LISTING_WHERE } from "@/lib/listings/vow";

// MC-018 (2026-09-14): ISR, not a render per request. MC-016 measured this page as the
// standing consumer on DB1: 57 renders in one fifteen-minute window, each pulling every Milton
// listing's four columns (3,414 rows) to keep one per street, for every crawler hit and every
// StreetContent write's revalidation. It reads no request data (the search and the A-Z are
// client-side in DirectoryGrid), so it serves from the route cache for an hour; every
// StreetContent write already purges it by path (DEC-REGEN-REVALIDATE, revalidateSurfaces.ts),
// so a new page is listed within the write's own revalidation, not the hour.
export const revalidate = 3600;

export const metadata = genMeta({
  title: `${config.CITY_NAME} Streets, Price Data for Every Street`,
  description: `Browse every ${config.CITY_NAME} ${config.CITY_PROVINCE} street with homes for sale now and typical asking prices, street by street.`,
  canonical: `${config.SITE_URL}/streets`,
});

export default async function StreetsIndexPage() {
  // Public listings per street: active sale listings and available leases, advertised, in Milton.
  const [publicRows, publishedSlugs] = await Promise.all([
    prisma.listing.groupBy({
      by: ["streetSlug"],
      _count: true,
      where: PUBLIC_LISTING_WHERE,
    }),
    publishedStreetPageSlugs(),
  ]);
  const publicCount = new Map(publicRows.map((r) => [r.streetSlug, r._count]));
  const publishedSet = new Set(publishedSlugs);

  // Hotfix 2026-05-09: replaced per-street N+1 loop (4 queries × 431 streets =
  // ~1,724 concurrent queries) with bulk queries. The N+1 pattern exhausted
  // the Vercel serverless → Neon connection pool post-Path-A redeploy and
  // triggered Application error: digest 306433527.
  const slugs = Array.from(new Set([...publicRows.map((r) => r.streetSlug), ...publishedSlugs]));

  // Bulk #1: the neighbourhood of each street, for the chips and the subtitle. Prisma's `distinct`
  // is done in memory after the whole set leaves the database (MC-016); DISTINCT ON keeps one row
  // per slug on the server. The sample is the newest listing that carries a name. It supplies a
  // neighbourhood string and a name fallback, never a count, a status or a price.
  const samples = slugs.length === 0 ? [] : await prisma.$queryRaw<Array<{ streetSlug: string; streetName: string | null; neighbourhood: string | null }>>`
    SELECT DISTINCT ON ("streetSlug") "streetSlug", "streetName", "neighbourhood"
    FROM "public"."Listing"
    WHERE "streetSlug" IN (${Prisma.join(slugs)}) AND "streetName" IS NOT NULL
      -- MC-046: public rows only (PUBLIC_LISTING_WHERE, in SQL); a sold or leased row names nothing
      AND "permAdvertise" = TRUE AND city = ${config.PRISMA_CITY_VALUE}
      AND ((status = 'active' AND ("transactionType" IS NULL OR "transactionType" <> 'For Lease'))
        OR ("transactionType" = 'For Lease' AND "leaseStatus" = 'active'))
    ORDER BY "streetSlug", "listedAt" DESC NULLS LAST`;
  const sampleMap = new Map(samples.map((r) => [r.streetSlug, r]));

  // Bulk #2: avg ACTIVE FOR-SALE list price per slug — the real, current,
  // public home-price signal. Excludes lease (lease `price` is monthly rent,
  // which blended the legacy "average" down to garbage on condo/rental-heavy
  // streets) and excludes sold/expired (stale). Uses `price` (list price), NOT
  // soldPrice — active list prices are public, so no k-anon/VOW gate. Streets
  // with no active sale listing simply don't appear here → price null → omitted.
  const salePriceRows = slugs.length === 0 ? [] : await prisma.listing.groupBy({
    by: ["streetSlug"],
    _avg: { price: true },
    where: {
      streetSlug: { in: slugs },
      status: "active",
      transactionType: { not: "For Lease" },
      permAdvertise: true,
    },
  });
  const salePriceMap = new Map(
    salePriceRows.map((r) => [r.streetSlug, r._avg.price])
  );

  // Bulk #3: recently queued (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const queuedRows = slugs.length === 0 ? [] : await prisma.streetQueue.findMany({
    where: { streetSlug: { in: slugs }, createdAt: { gte: sevenDaysAgo } },
    select: { streetSlug: true },
  });
  const newSet = new Set(queuedRows.map((r) => r.streetSlug));

  const streetData = slugs
    .map((slug) => {
      const sample = sampleMap.get(slug);
      return {
        slug,
        name: resolveStreetName(slug, sample?.streetName ?? null).name,
        neighbourhood: sample?.neighbourhood
          ? sample.neighbourhood.replace(/^\d+\s*-\s*\w+\s+/, "").trim()
          : config.CITY_NAME,
        // public listings only: active sale listings and available leases
        activeCount: publicCount.get(slug) ?? 0,
        // null when the street has no active for-sale listing — render NO price
        // (never $0 / NaN / a blended figure).
        avgSalePrice: (() => {
          const v = salePriceMap.get(slug);
          return v != null && v > 0 ? Math.round(v) : null;
        })(),
        hasPage: publishedSet.has(slug),
        isNew: newSet.has(slug),
      };
    })
    // THE ORDER IS THE ACTIVE COUNT, TIES ALPHABETICAL (R9). It was the all-status count.
    .sort((a, b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name, "en-CA"));

  // Get unique neighbourhoods for filter chips
  const neighbourhoods = Array.from(new Set(streetData.map((s) => s.neighbourhood)))
    .filter((n) => n && n !== config.CITY_NAME)
    .sort();

  // The SITEMAP'S set, not a raw StreetContent count. Those differ by one:
  // `15-side-road-side-road-milton` is a published row with no ResidentialStreet entity, a
  // machine-made address artifact the sitemap refuses. This page said 445 while the sitemap
  // emitted 444 and the homepage said 738; one function now answers all three.
  const publishedCount = publishedSlugs.length;
  // Streets with a live price: an active for-sale listing with an asking price (R11). It was the
  // count of every street on the list, most of which carried only sold or expired rows.
  const livePriceCount = streetData.filter((s) => s.avgSalePrice != null).length;

  // Map to the shared directory contract (presentation only).
  const items: DirectoryItem[] = streetData.map((s) => {
    const badges: DirectoryItem["badges"] = [];
    if (s.isNew) badges.push({ label: "New", tone: "new" });
    if (s.activeCount >= 5) badges.push({ label: "VIP Hub", tone: "vip" });

    const meta: DirectoryItem["meta"] = [
      // the public listings on the street now, never a count that includes sold or leased rows
      { label: `${s.activeCount} listing${s.activeCount === 1 ? "" : "s"}`, tone: s.activeCount > 0 ? "active" : "muted" },
    ];
    if (s.hasPage) meta.push({ label: "Full report", tone: "accent" });

    return {
      key: s.slug,
      name: s.name,
      href: `/streets/${s.slug}`,
      searchExtra: s.neighbourhood,
      group: s.neighbourhood,
      subtitle: s.neighbourhood,
      // sale-only; omitted entirely when null so the card shows counts, no price
      stat: s.avgSalePrice != null ? formatPriceFull(s.avgSalePrice) : undefined,
      // The figure is the mean ASKING price of the street's live for-sale listings, not a sale
      // price and not the page's typical (MA-001 defect 13); the label says which.
      statLabel: s.avgSalePrice != null ? "Typical asking, listed now" : undefined,
      badges,
      meta,
    };
  });

  return (
    <div className="dir-v2">
      <SiteNavLive variant="page" />

      <section className="dir-hero">
        <div className="dir-wrap">
          <span className="dir-eyebrow">Street intelligence</span>
          <h1>
            Every {config.CITY_NAME} <em>street</em>
          </h1>
          <p className="dir-sub">
            {livePriceCount} streets with live price data · {publishedCount} full street
            reports published · Updated daily from PropTx MLS®
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

      <SiteFooter />
    </div>
  );
}
