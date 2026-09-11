// src/app/neighbourhoods/page.tsx
// LIVE /neighbourhoods — forest-v2 restyle of the hub directory index, REUSING
// the shared .dir-v2 DirectoryGrid primitive (same one /streets ships). RESTYLE
// + the carry-forward nothing-fake price fix + the page-2 link-graph fix:
//
//  - PRICE, 2026-09-10 (ruling): the card now carries THE HUB'S OWN k-gated 12-month
//    typical SOLD price, from the shared getNeighbourhoodCards() that the homepage
//    ladder also reads. It previously carried an active SALE-only LIST-price average —
//    a different statistic, over a different population (what is asking today, not what
//    traded), with no k-anon floor at all. Two figures under one word is the defect
//    hub-meta.mjs exists to catch on the SERP side, and the card grid was committing it
//    on the browse side. A hood whose hub suppresses its price now shows none here too.
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
import SiteNavLive from "@/components/nav/SiteNavLive";
import FooterSection from "@/components/sections/FooterSection";
import DirectoryGrid from "@/components/directory/DirectoryGrid";
import type { DirectoryItem } from "@/components/directory/types";
import { formatPriceFull } from "@/lib/format";
import { getNeighbourhoodCards } from "@/lib/neighbourhoodCards";
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

  // THE SHARED CARD DATA. Active count + the hub's own k-gated typical sold price, from
  // the one function the homepage ladder reads. Nothing about the price is recomputed here.
  const sharedCards = await getNeighbourhoodCards();
  const sharedBySlug = new Map(sharedCards.map((c) => [c.slug, c]));

  // Aggregate per canonical neighbourhood across its rawStrings.
  const cards = neighbourhoods
    .map((n) => {
      let totalListings = 0;
      for (const raw of n.rawStrings) totalListings += totalByRaw.get(raw) ?? 0;
      const shared = sharedBySlug.get(n.slug);
      const isRural = n.profile === "rural_hub";
      return {
        slug: n.slug,
        name: n.name,
        profile: isRural ? "Rural" : "Urban",
        totalListings,
        activeCount: shared?.activeCount ?? 0,
        typicalSoldPrice: shared?.typicalSoldPrice ?? null,
      };
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
      // "Typical sold" names the statistic it is: the hub's own 12-month figure, k-gated.
      // Suppressed hoods carry no stat at all rather than a zero or a softer label.
      stat: c.typicalSoldPrice != null ? formatPriceFull(c.typicalSoldPrice) : undefined,
      statLabel: c.typicalSoldPrice != null ? "Typical sold · 12mo" : undefined,
      meta,
    };
  });

  return (
    <div className="dir-v2">
      <SiteNavLive variant="page" />

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
