// src/app/neighbourhoods/page.tsx
// LIVE /neighbourhoods — forest-v2 restyle of the hub directory index, REUSING
// the shared .dir-v2 DirectoryGrid primitive (same one /streets ships). RESTYLE
// + the carry-forward nothing-fake price fix + the page-2 link-graph fix:
//
//  - PRICE (same bug as /streets): the legacy card avg was a lease-blended,
//    all-status _avg:{price}. Recomputed to active SALE-only list price
//    (status=active AND transactionType != "For Lease" AND permAdvertise),
//    label "Avg sale price", null-degrade when zero active sale listings.
//
//  - LINK GRAPH (sharper here — an unpublished hub 404s, and 3 legacy slugs
//    301-redirect): cards are built CANONICAL-FIRST from published HubContent.
//    A card links to Neighbourhood.slug (the exact 200 the hub tier resolves) —
//    never a toSlug() guess (could 404) or a legacy form (would 301-bounce).
//    Listings are aggregated across Neighbourhood.rawStrings (the TREB strings
//    that map to each canonical hood). A raw neighbourhood with >=5 listings but
//    no published hub is NOT linked (would 404) — counted + reported in a log.
//
// ChromeGate suppresses the navy Navbar on /neighbourhoods (exact) and
// /neighbourhoods/<slug> (prefix). The _count>=5 visibility threshold is kept.
import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import SiteNav from "@/components/nav/SiteNav";
import FooterSection from "@/components/sections/FooterSection";
import DirectoryGrid from "@/components/directory/DirectoryGrid";
import type { DirectoryItem } from "@/components/directory/types";
import { formatPriceFull } from "@/lib/format";
import "@/components/directory/directory-theme.css";

export const dynamic = "force-dynamic";

export const metadata = genMeta({
  title: `${config.CITY_NAME} Neighbourhoods — Prices, Schools & Market Data`,
  description: `Explore every ${config.CITY_NAME} ${config.CITY_PROVINCE} neighbourhood. Compare average home prices, active listings, top streets, school zones and GO train access. Live TREB data.`,
  canonical: `${config.SITE_URL}/neighbourhoods`,
});

const MIN_LISTINGS = 5; // preserved visibility threshold (legacy _count>=5)

export default async function NeighbourhoodsPage() {
  // Candidate raw-neighbourhood listing counts (the legacy groupBy; the dead
  // _avg:{price} is dropped — price now comes from the active-sale query below).
  const hoodGroups = await prisma.listing.groupBy({
    by: ["neighbourhood"],
    _count: true,
    where: { city: config.PRISMA_CITY_VALUE, permAdvertise: true },
    orderBy: { _count: { neighbourhood: "desc" } },
  });
  const totalByRaw = new Map(hoodGroups.map((h) => [h.neighbourhood, h._count]));

  // Canonical, RESOLVABLE hubs only: published HubContent ∩ Neighbourhood.
  const publishedHubs = await prisma.hubContent.findMany({
    where: { status: "published" },
    select: { neighbourhoodSlug: true },
  });
  const publishedSlugs = publishedHubs.map((h) => h.neighbourhoodSlug);

  const neighbourhoods = await prisma.neighbourhood.findMany({
    where: { slug: { in: publishedSlugs } },
    select: { slug: true, name: true, profile: true, rawStrings: true },
  });

  // All raw strings that belong to a published hood — scope the active queries.
  const publishedRaws = neighbourhoods.flatMap((n) => n.rawStrings);

  // Active count per raw (status=active, any transaction type — preserves the
  // legacy "N active" meaning, which counted all active inventory).
  const activeRows = publishedRaws.length
    ? await prisma.listing.groupBy({
        by: ["neighbourhood"],
        _count: true,
        where: { neighbourhood: { in: publishedRaws }, status: "active", permAdvertise: true },
      })
    : [];
  const activeByRaw = new Map(activeRows.map((r) => [r.neighbourhood, r._count]));

  // Active FOR-SALE list price per raw — list price (public), excludes lease +
  // stale. _avg + _count so multi-raw hoods combine as a true weighted average.
  const saleRows = publishedRaws.length
    ? await prisma.listing.groupBy({
        by: ["neighbourhood"],
        _count: true,
        _avg: { price: true },
        where: {
          neighbourhood: { in: publishedRaws },
          status: "active",
          transactionType: { not: "For Lease" },
          permAdvertise: true,
        },
      })
    : [];
  const saleByRaw = new Map(saleRows.map((r) => [r.neighbourhood, { n: r._count, avg: r._avg.price ?? 0 }]));

  // Aggregate per canonical neighbourhood across its rawStrings.
  const cards = neighbourhoods
    .map((n) => {
      let totalListings = 0;
      let activeCount = 0;
      let saleSum = 0;
      let saleN = 0;
      for (const raw of n.rawStrings) {
        totalListings += totalByRaw.get(raw) ?? 0;
        activeCount += activeByRaw.get(raw) ?? 0;
        const s = saleByRaw.get(raw);
        if (s) {
          saleSum += s.avg * s.n;
          saleN += s.n;
        }
      }
      const avgSalePrice = saleN > 0 && saleSum > 0 ? Math.round(saleSum / saleN) : null;
      const isRural = n.profile === "rural_hub";
      return { slug: n.slug, name: n.name, profile: isRural ? "Rural" : "Urban", totalListings, activeCount, avgSalePrice };
    })
    // keep the legacy visibility threshold (now on the canonical total)
    .filter((c) => c.totalListings >= MIN_LISTINGS)
    .sort((a, b) => b.totalListings - a.totalListings);

  // Diagnostic: raw hoods with >=5 listings whose raw maps to NO published hub
  // (these would 404 if linked via the old toSlug()). Excluded from the grid.
  const publishedRawSet = new Set(publishedRaws);
  const excludedNoHub = hoodGroups.filter((h) => h._count >= MIN_LISTINGS && !publishedRawSet.has(h.neighbourhood));
  if (excludedNoHub.length > 0) {
    console.warn(
      `[neighbourhoods] ${excludedNoHub.length} raw neighbourhood(s) with >=${MIN_LISTINGS} listings have no published hub — excluded from linking:`,
      excludedNoHub.map((h) => `${h.neighbourhood} (${h._count})`).join(", ")
    );
  }

  const totalActive = cards.reduce((s, c) => s + c.activeCount, 0);
  const profiles = Array.from(new Set(cards.map((c) => c.profile))).sort(); // ["Rural","Urban"]

  const items: DirectoryItem[] = cards.map((c) => {
    const meta: DirectoryItem["meta"] = [
      { label: `${c.totalListings} listing${c.totalListings === 1 ? "" : "s"}`, tone: "muted" },
    ];
    if (c.activeCount > 0) meta.push({ label: `${c.activeCount} active`, tone: "active" });
    return {
      key: c.slug,
      name: c.name,
      href: `/neighbourhoods/${c.slug}`, // canonical published slug — resolves 200 directly
      searchExtra: c.profile,
      group: c.profile, // chip filter: Urban / Rural (no neighbourhood sub-chip — it IS the hood)
      subtitle: `${c.profile} neighbourhood`,
      stat: c.avgSalePrice != null ? formatPriceFull(c.avgSalePrice) : undefined,
      statLabel: c.avgSalePrice != null ? "Avg sale price" : undefined,
      meta,
    };
  });

  return (
    <div className="dir-v2">
      <SiteNav variant="page" />

      <section className="dir-hero">
        <div className="dir-wrap">
          <span className="dir-eyebrow">Neighbourhood intelligence</span>
          <h1>
            {config.CITY_NAME} <em>neighbourhoods</em>
          </h1>
          <p className="dir-sub">
            {cards.length} neighbourhoods with live price data · {totalActive} active listings ·
            Updated daily from TREB MLS®
          </p>
        </div>
      </section>

      <DirectoryGrid
        items={items}
        groups={profiles}
        groupLabel="Type"
        groupAllLabel="All neighbourhoods"
        searchPlaceholder="Search neighbourhoods…"
        itemNoun="neighbourhood"
        enableAZ={false}
      />

      <FooterSection />
    </div>
  );
}
