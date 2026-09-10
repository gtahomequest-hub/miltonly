// src/lib/guides/index.ts
//
// THE SEAM, filled. src/components/guides/types.ts named these two functions
// and nothing implemented them; this is the data window it asked for.
//
//   getGuidesIndexData(): Promise<GuidesIndexData>
//   getGuideArticle(slug): Promise<GuideArticleData | null>
//
// The layout stays dumb. Everything a guide knows arrives through here.

import "server-only";
import { config } from "@/lib/config";
import type {
  GuidesIndexData,
  GuideArticleData,
  GuideCategoryGroup,
  GuideCategoryKey,
  GuideTeaser,
  GuideLink,
} from "@/components/guides/types";
import type { GroundedFigures } from "@/lib/content/groundedFigures";
import { GUIDE_DEFS, GUIDE_SLUGS, GUIDES_UPDATED, buildGuide, type GuideDef } from "./guides";
import { getMiltonSoldAggregates } from "@/lib/soldAggregates";
import { prisma } from "@/lib/prisma";
import { getSchoolRows, getActiveCondoFees } from "./figures";

const CITY = config.CITY_NAME;

const CATEGORY_META: Record<GuideCategoryKey, { label: string; blurb: string }> = {
  buying: { label: "Buying", blurb: "Before you make an offer" },
  selling: { label: "Selling", blurb: "Before you list" },
  renting: { label: "Renting", blurb: "Before you sign" },
  living: { label: "Everyday life", blurb: "Once you are here" },
};

/** A teaser needs the article's own read time, so the index builds every
 *  article. Six guides against cached aggregates; the alternative is a stored
 *  read time that drifts the moment a figure suppresses and a sentence drops. */
async function allTeasers(): Promise<Array<{ def: GuideDef; teaser: GuideTeaser }>> {
  const out: Array<{ def: GuideDef; teaser: GuideTeaser }> = [];
  for (const def of GUIDE_DEFS) {
    const built = await buildGuide(def.slug);
    if (!built) continue;
    out.push({
      def,
      teaser: {
        slug: def.slug,
        title: def.title,
        dek: def.dek,
        category: def.category,
        categoryLabel: def.categoryLabel,
        readMinutes: built.data.readMinutes,
        updated: GUIDES_UPDATED,
      },
    });
  }
  return out;
}

export async function getGuidesIndexData(): Promise<GuidesIndexData> {
  const teasers = await allTeasers();

  // Index stats are counts of what the guides actually draw on. A count is
  // non-sensitive at any n, so none of these is k-gated — but each is real,
  // not a marketing number.
  const [agg, publishedStreets, publishedHubs] = await Promise.all([
    getMiltonSoldAggregates(),
    prisma.streetContent.count({ where: { status: "published" } }),
    prisma.hubContent.count({ where: { status: "published" } }),
  ]);

  const categories: GuideCategoryGroup[] = (Object.keys(CATEGORY_META) as GuideCategoryKey[])
    .map((key) => ({
      key,
      label: CATEGORY_META[key].label,
      blurb: CATEGORY_META[key].blurb,
      guides: teasers.filter((t) => t.def.category === key).map((t) => t.teaser),
    }))
    // A category with no guides renders as an empty heading, which reads as a
    // missing page rather than a deliberate absence. Drop it.
    .filter((c) => c.guides.length > 0);

  return {
    heading: `${CITY}, explained`,
    sub: `Six guides built on this site's own ${CITY} data. Every figure carries the window it was measured over and the number of sales behind it, and a figure with too few sales behind it is left out rather than estimated.`,
    stats: [
      { n: String(teasers.length), l: "guides" },
      { n: String(agg.overall.count), l: "sales behind the figures" },
      { n: String(publishedHubs), l: "neighbourhood pages" },
      { n: String(publishedStreets), l: "street pages" },
    ],
    featured: teasers[0]?.teaser ?? null,
    categories,
    ctaBuyer: {
      heading: `See what is for sale in ${CITY}`,
      body: `Every active listing on the board, with the street and neighbourhood page behind each one.`,
      buttonLabel: "Browse listings",
      href: "/listings",
    },
    ctaSeller: {
      heading: "Find out what your home is worth",
      body: `A valuation built from ${CITY} sold data, not a national average.`,
      buttonLabel: "Get a valuation",
      href: "/sell#valuation",
    },
  };
}

// ── link-down ─────────────────────────────────────────────────────────────
//
// A guide that cites a neighbourhood figure and does not link to that
// neighbourhood's page is a dead end for both a reader and a crawler. These
// build the link rows from the SAME data the section's figures came from, so
// a link can never point at a page whose figure the guide did not use.

async function linksFor(slug: string): Promise<Record<number, GuideLink[]>> {
  switch (slug) {
    case "what-milton-neighbourhoods-cost": {
      const agg = await getMiltonSoldAggregates();
      return {
        0: [{ label: "All Milton sold data", href: "/sold" }],
        1: agg.byNeighbourhood.slice(0, 12).map((n) => ({
          label: n.name,
          href: `/neighbourhoods/${n.slug}`,
        })),
        2: [
          { label: "Detached homes", href: "/freehold" },
          { label: "Condos", href: "/condos" },
          { label: "Compare freehold and condo", href: "/compare/freehold-vs-condo" },
        ],
      };
    }
    case "how-to-read-a-milton-sold-price":
      return {
        0: [{ label: "Milton sold data", href: "/sold" }],
        1: [{ label: "Sold prices by neighbourhood", href: "/sold" }],
        3: [{ label: "Street-level pages", href: "/streets" }],
      };
    case "is-it-a-good-time-to-sell-in-milton":
      return {
        1: [{ label: "Milton sold data", href: "/sold" }],
        3: [
          { label: "Homes for sale now", href: "/listings" },
          { label: "Get a valuation", href: "/sell#valuation" },
        ],
      };
    case "milton-condo-fees-parking-and-lockers": {
      const rows = await getActiveCondoFees();
      return {
        1: rows.slice(0, 16).map((r) => ({
          label: r.neighbourhood ? `${r.bedrooms} bed, ${r.neighbourhood}` : `${r.bedrooms} bed condo`,
          href: `/listings/${r.mlsNumber}`,
        })),
        3: [
          { label: "Condo buildings in Milton", href: "/condos" },
          { label: "Condo or freehold", href: "/condos-guide" },
        ],
      };
    }
    case "what-it-costs-to-buy-your-first-home-in-milton":
      return {
        1: [{ label: "Homes for sale now", href: "/listings" }],
        3: [
          { label: "Milton sold data", href: "/sold" },
          { label: "Townhouses and condos", href: "/condos" },
        ],
      };
    case "milton-schools-what-the-data-shows": {
      const rows = getSchoolRows();
      return {
        0: [{ label: "All Milton schools", href: "/schools" }],
        2: rows
          .filter((r) => r.level === "elementary")
          .slice(0, 12)
          .map((r) => ({ label: r.name, href: `/schools/${r.slug}` })),
        3: rows
          .filter((r) => r.level === "secondary")
          .map((r) => ({ label: r.name, href: `/schools/${r.slug}` })),
      };
    }
    default:
      return {};
  }
}

export interface GuideArticleResult {
  data: GuideArticleData;
  figures: GroundedFigures;
  def: GuideDef;
}

export async function getGuideArticleFull(slug: string): Promise<GuideArticleResult | null> {
  const built = await buildGuide(slug);
  if (!built) return null;
  const def = GUIDE_DEFS.find((d) => d.slug === slug)!;

  const links = await linksFor(slug);
  const sections = built.data.sections.map((s, i) =>
    links[i]?.length ? { ...s, links: links[i] } : s,
  );

  // Related: the other five, in evidence order, capped at three.
  const teasers = await allTeasers();
  const related = teasers
    .filter((t) => t.def.slug !== slug)
    .slice(0, 3)
    .map((t) => t.teaser);

  return { data: { ...built.data, sections, related }, figures: built.figures, def };
}

/** The seam's article half, as types.ts declared it. */
export async function getGuideArticle(slug: string): Promise<GuideArticleData | null> {
  const full = await getGuideArticleFull(slug);
  return full ? full.data : null;
}

export { GUIDE_DEFS, GUIDE_SLUGS };
