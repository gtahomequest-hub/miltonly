import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { publishedStreetPageSlugs } from "@/lib/streetSurface";
import { schools } from "@/lib/schools";
import { GUIDE_SLUGS } from "@/lib/guides/guides";
import { mosques } from "@/lib/mosques";

export const dynamic = "force-dynamic";

const SITE_URL = config.SITE_URL;


export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/listings`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/sell`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/streets`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      // /condos is now a real forest directory (was a redirect) — index the
      // crawl path into the published /condos/<slug> detail pages below.
      url: `${SITE_URL}/condos`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      // /freehold — first ownership-axis hub (freehold vs condo/POTL). Indexable
      // SEO page; opens the crawl path for "freehold homes Milton" intent.
      url: `${SITE_URL}/freehold`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      // /condos-guide — condo ownership-axis hub (decision page, distinct from the
      // /condos directory). Indexable SEO page for "condos in Milton" intent.
      url: `${SITE_URL}/condos-guide`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      // /potl — POTL (Parcel of Tied Land) ownership-axis hub. Number-free editorial
      // explainer for the "what is POTL / parcel of tied land Milton" intent.
      url: `${SITE_URL}/potl`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/rentals`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/exclusive`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      // /compare — now a real forest INDEX of comparison pages (was a thin navy
      // "coming soon" street-vs-street stub). Points the crawl at the live
      // comparisons below.
      url: `${SITE_URL}/compare`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      // /compare/freehold-vs-condo — the COMPARE flagship: grounded two-column
      // freehold-vs-condo decision page. Indexable for "freehold vs condo Milton".
      url: `${SITE_URL}/compare/freehold-vs-condo`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/sold`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    // Content tier. /guides is the index; the guide pages are emitted from
    // GUIDE_DEFS below so the sitemap and the route's generateStaticParams can
    // never disagree about which guides exist.
    {
      url: `${SITE_URL}/guides`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/market-watch`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];

  // Guide pages — one per registry entry.
  const guidePages: MetadataRoute.Sitemap = GUIDE_SLUGS.map((slug) => ({
    url: `${SITE_URL}/guides/${slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Market Watch editions — published only. An edition is immutable once
  // published, so lastModified is its publish time and never "now".
  const editions = await prisma.marketEdition.findMany({
    where: { status: "published" },
    select: { weekOf: true, publishedAt: true, updatedAt: true },
    orderBy: { weekOf: "desc" },
    take: 104,
  });
  const editionPages: MetadataRoute.Sitemap = editions.map((e) => ({
    url: `${SITE_URL}/market-watch/${e.weekOf}`,
    lastModified: e.publishedAt ?? e.updatedAt,
    changeFrequency: "yearly" as const,
    priority: 0.6,
  }));

  // Neighbourhood hub pages — canonical slugs from the published HubContent set,
  // the SAME source getHubData() resolves. Previously these were derived by
  // munging Listing.neighbourhood, which emitted legacy slug forms
  // (1051---walker, brookvillehaltonville, rural-nassagaweya) that 404 on the
  // hub-v2 route; HubContent.neighbourhoodSlug IS the canonical 200 target, so
  // the sitemap now points only at slugs that render. (neighbourhoodSlug is
  // @unique — no duplicates.)
  const publishedHubs = await prisma.hubContent.findMany({
    where: { status: "published" },
    select: { neighbourhoodSlug: true, updatedAt: true },
  });

  const neighbourhoodPages: MetadataRoute.Sitemap = publishedHubs.map((h) => ({
    url: `${SITE_URL}/neighbourhoods/${h.neighbourhoodSlug}`,
    lastModified: h.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Published street pages from pipeline.
  //
  // PUBLISH FLOOR = ENTITY FLOOR. This list used to come from StreetContent alone, so
  // publication was keyed off "did the generator ever write a row" — which is not a
  // statement about whether the street exists. Five slugs with NO ResidentialStreet row
  // were in the sitemap with generated prose, among them wood-close-n-a-milton and
  // 15-side-road-side-road-milton, which are machine-made from an address artifact and
  // are not streets. The typo entity miltonbrock-crescent-milton was absent only
  // because no content row happened to be written for it: luck, not a control.
  //
  // A page may not be published for a street that does not exist. Content is still
  // required — this adds the entity as a second, independent condition.
  //
  // THE SET ITSELF now lives in publishedStreetPageSlugs() (src/lib/streetSurface.ts), because
  // the homepage states a page count and stated "738" while this emitted 444 — two surfaces
  // describing different sets with one word. The intersection is unchanged; only its home moved.
  // lastModified still needs the row, so the timestamps are read here and filtered by that set.
  const [publishedStreets, pageSlugs] = await Promise.all([
    prisma.streetContent.findMany({
      where: { status: "published" },
      select: { streetSlug: true, updatedAt: true },
    }),
    publishedStreetPageSlugs(),
  ]);
  const entitySlugs = new Set(pageSlugs);

  const streetPages: MetadataRoute.Sitemap = publishedStreets
    .filter((s) => entitySlugs.has(s.streetSlug))
    .map((s) => ({
      url: `${SITE_URL}/streets/${s.streetSlug}`,
      lastModified: s.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  // Per-street sold data lives on the street pages (/streets/<slug>) via the
  // VOW sold-records island — there is no /sold/<slug> route, so we do NOT emit
  // /sold/<slug> URLs here (they 404'd). The /sold index itself is a staticPage.

  // Published condo-building pages from the WS5 condo pipeline.
  const publishedCondos = await prisma.condoContent.findMany({
    where: { status: "published" },
    select: { buildingSlug: true, updatedAt: true },
  });

  const condoPages: MetadataRoute.Sitemap = publishedCondos.map((c) => ({
    url: `${SITE_URL}/condos/${c.buildingSlug}`,
    lastModified: c.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // The /neighbourhoods/<slug>/streets overflow pages 301 to the hub's #streets since MC-012
  // (2026-09-12) and are not declared: a URL that redirects is not a page.
  const streetOverflowPages: MetadataRoute.Sitemap = [];

  // School pages
  const schoolPages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/schools`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    ...schools.map((s) => ({
      url: `${SITE_URL}/schools/${s.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];

  // Listing detail pages.
  //
  // These were missing entirely: the sitemap carried /listings but not a single /listings/<mls>,
  // so every detail page depended on Google walking paginated browse pages to be discovered. Two
  // of them turned up in GSC still indexed under the pre-flip www host precisely because the apex
  // twin had never been fetched.
  //
  // THREE GATES, and each is load-bearing:
  //   status = "active"      — a sold, rented or expired listing is not a live page worth
  //                            submitting. (Milton today: 460 active, 544 sold, 1277 rented,
  //                            948 expired — emitting all of them would quadruple the sitemap
  //                            with pages that no longer represent anything for sale.)
  //   permAdvertise = true   — the VOW compliance gate. listings/[mlsNumber]/page.tsx:39 returns
  //                            robots noindex and renders a "not available" block for these, so
  //                            submitting one would advertise a URL we deliberately refuse to
  //                            show. Currently 0 active listings fail this, but the filter is the
  //                            point: it must not depend on that staying true.
  //   city                   — same scope as every other surface.
  //
  // NOTHING BEYOND THE MLS NUMBER IS EMITTED. The select is mlsNumber + updatedAt only; the URL
  // already contains the MLS number publicly, and lastModified is a timestamp. No address, no
  // price, no coordinates, no displayAddress-gated field reaches the sitemap.
  const activeListings = await prisma.listing.findMany({
    where: { city: config.PRISMA_CITY_VALUE, status: "active", permAdvertise: true },
    select: { mlsNumber: true, updatedAt: true },
  });
  const listingPages: MetadataRoute.Sitemap = activeListings.map((l) => ({
    url: `${SITE_URL}/listings/${l.mlsNumber}`,
    lastModified: l.updatedAt,
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));

  // Mosque pages
  const mosquePages: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/mosques`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    },
    ...mosques.map((m) => ({
      url: `${SITE_URL}/mosques/${m.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];

  return [...staticPages, ...guidePages, ...editionPages, ...neighbourhoodPages, ...streetPages, ...streetOverflowPages, ...condoPages, ...schoolPages, ...mosquePages, ...listingPages];
}
