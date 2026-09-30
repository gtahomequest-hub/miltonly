// src/app/neighbourhoods/page.tsx
// LIVE /neighbourhoods: forest-v2 restyle of the hub directory index, REUSING the shared
// .dir-v2 DirectoryGrid primitive (same one /streets ships).
//
//  - MC-046 Stage 1 (PropTx VOW Best Practices item 40). The card's "Typical sold · 12mo" is
//    gone, from the card and from the props serialised into the client DirectoryGrid. The
//    "N listings" count used to be status-blind (sold, rented and expired rows counted, and the
//    grid was ordered by them); it now counts IDX active sale listings only (ruling R11), from
//    the shared getNeighbourhoodCards() the homepage and the menu read. The >=5 visibility
//    threshold and the order use the same count; ties are alphabetical.
//
//  - LINK GRAPH (an unpublished hub 404s, and 3 legacy slugs 301-redirect): cards are built
//    CANONICAL-FIRST from published HubContent. A card links to Neighbourhood.slug (the exact
//    200 the hub tier resolves), never a toSlug() guess or a legacy form. A raw neighbourhood
//    with >=5 active listings but no published hub is NOT linked (would 404); it is counted
//    and reported in a log.
//
// ChromeGate suppresses the navy Navbar on /neighbourhoods (exact) and /neighbourhoods/<slug>
// (prefix).
import { prisma } from "@/lib/prisma";
import { generateMetadata as genMeta } from "@/lib/seo";
import { config } from "@/lib/config";
import SiteNavLive from "@/components/nav/SiteNavLive";
import SiteFooter from "@/components/nav/SiteFooter";
import DirectoryGrid from "@/components/directory/DirectoryGrid";
import type { DirectoryItem } from "@/components/directory/types";
import { getNeighbourhoodCards } from "@/lib/neighbourhoodCards";
import { PUBLIC_SALE_WHERE } from "@/lib/listings/vow";
import "@/components/directory/directory-theme.css";

// MC-017 (2026-09-13): ISR, not a render per request; see the detail page for the tags and the
// write paths that drop it.
export const revalidate = 86400;

export const metadata = genMeta({
  title: `${config.CITY_NAME} Neighbourhoods: Prices, Schools & Market Data`,
  description: `Explore every ${config.CITY_NAME} ${config.CITY_PROVINCE} neighbourhood. Compare homes for sale now, streets, schools nearby and GO train access.`,
  canonical: `${config.SITE_URL}/neighbourhoods`,
});

const MIN_LISTINGS = 5; // preserved visibility threshold, now on active listings (R11)

export default async function NeighbourhoodsPage() {
  // Canonical, RESOLVABLE hubs only: published HubContent ∩ Neighbourhood.
  const [publishedHubs, sharedCards] = await Promise.all([
    prisma.hubContent.findMany({ where: { status: "published" }, select: { neighbourhoodSlug: true } }),
    getNeighbourhoodCards(),
  ]);
  const publishedSlugs = new Set(publishedHubs.map((h) => h.neighbourhoodSlug));
  const neighbourhoods = await prisma.neighbourhood.findMany({
    where: { slug: { in: Array.from(publishedSlugs) } },
    select: { slug: true, profile: true, rawStrings: true },
  });
  const profileBySlug = new Map(neighbourhoods.map((n) => [n.slug, n.profile === "rural_hub" ? "Rural" : "Urban"]));

  // THE SHARED CARD DATA: the hub's name and its count of homes for sale today, already ordered
  // by that count, ties alphabetical.
  const cards = sharedCards
    .filter((c) => profileBySlug.has(c.slug))
    .filter((c) => c.activeCount >= MIN_LISTINGS)
    .map((c) => ({ ...c, profile: profileBySlug.get(c.slug) as string }));

  // Diagnostic: raw hoods with >=5 active listings whose raw maps to NO published hub (these
  // would 404 if linked via the old toSlug()). Excluded from the grid.
  const publishedRawSet = new Set(neighbourhoods.flatMap((n) => n.rawStrings));
  const activeByRaw = await prisma.listing.groupBy({
    by: ["neighbourhood"],
    _count: true,
    where: { ...PUBLIC_SALE_WHERE },
  });
  const excludedNoHub = activeByRaw.filter((h) => h._count >= MIN_LISTINGS && !publishedRawSet.has(h.neighbourhood));
  if (excludedNoHub.length > 0) {
    console.warn(
      `[neighbourhoods] ${excludedNoHub.length} raw neighbourhood(s) with >=${MIN_LISTINGS} active listings have no published hub; excluded from linking:`,
      excludedNoHub.map((h) => `${h.neighbourhood} (${h._count})`).join(", ")
    );
  }

  const totalActive = cards.reduce((s, c) => s + c.activeCount, 0);
  const profiles = Array.from(new Set(cards.map((c) => c.profile))).sort(); // ["Rural","Urban"]

  const items: DirectoryItem[] = cards.map((c) => ({
    key: c.slug,
    name: c.name,
    href: `/neighbourhoods/${c.slug}`, // canonical published slug, resolves 200 directly
    searchExtra: c.profile,
    group: c.profile, // chip filter: Urban / Rural (no neighbourhood sub-chip: it IS the hood)
    subtitle: `${c.profile} neighbourhood`,
    meta: [{ label: `${c.activeCount} listing${c.activeCount === 1 ? "" : "s"}`, tone: "active" }],
  }));

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
            {cards.length} neighbourhoods · {totalActive} active listings · Updated daily from PropTx MLS®
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

      <SiteFooter />
    </div>
  );
}
