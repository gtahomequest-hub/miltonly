// src/app/condos/page.tsx
// LIVE /condos — a REAL forest-v2 directory of published condo buildings (was a
// 307 redirect to /listings?type=Condo). Reuses the shared .dir-v2 DirectoryGrid
// primitive; each card links to its live /condos/<slug> detail page.
//
// SOURCE (published-only, link-safe): CondoBuilding ∩ CondoContent.status=
// 'published' — the exact gate feeding the live detail pages + sitemap. A card
// is built only when its slug resolves 200; unpublished buildings are excluded.
//
// PRICE (k-anon-safe + family-consistent): active SALE-only list price per
// building. List prices are public (no k-anon gate), so this is safe by
// construction — unlike CondoBuilding.avgSalePrice*bd (unsurfaced, no confirmed
// k-floor) or statsJson.typicalPrice (sold-derived; the detail page leads with
// that, k-anon-gated, but we keep the index off sold figures and consistent with
// /streets + /neighbourhoods). Null-degrade when a building has zero active sale
// listings (counts only) — many condos are rental-only or unlisted right now.
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
  title: `${config.CITY_NAME} Condo Buildings — Prices, Units & Market Data`,
  description: `Browse every ${config.CITY_NAME} ${config.CITY_PROVINCE} condo building with a published profile. Unit counts, active listings, and live sale prices by building. Updated daily from TREB.`,
  canonical: `${config.SITE_URL}/condos`,
});

function cleanHood(raw: string): string {
  return raw.replace(/^\d+\s*-\s*\w+\s+/, "").trim();
}

export default async function CondosIndexPage() {
  // Published buildings only (the link-safe set — each has a live /condos/<slug>).
  const publishedRows = await prisma.condoContent.findMany({
    where: { status: "published" },
    select: { buildingSlug: true, buildingName: true },
  });
  const nameBySlug = new Map(publishedRows.map((c) => [c.buildingSlug, c.buildingName]));
  const slugs = publishedRows.map((c) => c.buildingSlug);

  const buildings = slugs.length
    ? await prisma.condoBuilding.findMany({
        where: { slug: { in: slugs } },
        select: {
          slug: true,
          displayName: true,
          buildingAddress: true,
          totalUnits: true,
          streetSlug: true,
          streetNumber: true,
          neighbourhood: true,
          neighbourhoodEntity: { select: { name: true } },
        },
      })
    : [];

  // One bulk query for all active Milton condo listings, then match each to its
  // building in memory (streetSlug + civic-number prefix — same match the detail
  // page uses). Avoids the per-building N+1 that hit the streets page.
  const activeCondoListings = await prisma.listing.findMany({
    where: {
      city: config.PRISMA_CITY_VALUE,
      propertyType: "condo",
      status: "active",
      permAdvertise: true,
    },
    select: { streetSlug: true, address: true, price: true, transactionType: true },
  });

  const cards = buildings
    .map((b) => {
      const name = nameBySlug.get(b.slug) ?? b.displayName ?? b.buildingAddress ?? b.slug;
      const hood = b.neighbourhoodEntity?.name ?? (b.neighbourhood ? cleanHood(b.neighbourhood) : config.CITY_NAME);

      let activeCount = 0;
      let saleSum = 0;
      let saleN = 0;
      if (b.streetSlug && b.streetNumber) {
        const prefix = `${b.streetNumber} `;
        for (const l of activeCondoListings) {
          if (l.streetSlug !== b.streetSlug || !l.address.startsWith(prefix)) continue;
          activeCount += 1;
          if (l.transactionType !== "For Lease") {
            saleSum += l.price;
            saleN += 1;
          }
        }
      }
      const avgSalePrice = saleN > 0 && saleSum > 0 ? Math.round(saleSum / saleN) : null;
      return { slug: b.slug, name, hood, units: b.totalUnits, activeCount, avgSalePrice };
    })
    .sort((a, b) => (b.units ?? 0) - (a.units ?? 0) || a.name.localeCompare(b.name));

  const hoods = Array.from(new Set(cards.map((c) => c.hood)))
    .filter((h) => h && h !== config.CITY_NAME)
    .sort();

  const items: DirectoryItem[] = cards.map((c) => {
    const meta: DirectoryItem["meta"] = [];
    if (c.units && c.units > 0) meta.push({ label: `${c.units} units`, tone: "muted" });
    if (c.activeCount > 0) meta.push({ label: `${c.activeCount} active`, tone: "active" });
    return {
      key: c.slug,
      name: c.name,
      href: `/condos/${c.slug}`, // live published detail — resolves 200 directly
      searchExtra: c.hood,
      group: c.hood, // chip filter by neighbourhood
      subtitle: c.hood,
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
          <span className="dir-eyebrow">Condo intelligence</span>
          <h1>
            {config.CITY_NAME} <em>condo buildings</em>
          </h1>
          <p className="dir-sub">
            {cards.length} {config.CITY_NAME} condo buildings with published profiles · Live sale
            prices &amp; unit counts · Updated daily from TREB MLS®
          </p>
        </div>
      </section>

      <DirectoryGrid
        items={items}
        groups={hoods}
        groupLabel="Neighbourhood"
        groupAllLabel="All neighbourhoods"
        searchPlaceholder="Search condo buildings by name or neighbourhood…"
        itemNoun="building"
        enableAZ={false}
      />

      <FooterSection />
    </div>
  );
}
