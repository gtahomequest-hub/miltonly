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
import { prisma } from "@/lib/prisma";
import { getSchoolRows, getActiveCondoFees } from "./figures";

const CITY = config.CITY_NAME;

/** "Eight" rather than "8" at the top of a page of prose. Falls back to digits past twelve. */
function countWord(n: number): string {
  const words = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
  return words[n] ?? String(n);
}

const CATEGORY_META: Record<GuideCategoryKey, { label: string; blurb: string }> = {
  buying: { label: "Buying", blurb: "Before you make an offer" },
  selling: { label: "Selling", blurb: "Before you list" },
  renting: { label: "Renting", blurb: "Before you sign" },
  living: { label: "Everyday life", blurb: "Once you are here" },
};

/** A teaser needs the article's own read time, so the index builds every
 *  article. Eight guides against live active-listing counts and static sources; the alternative is a stored
 *  read time that drifts the moment a figure suppresses and a sentence drops. */
async function allTeasers(): Promise<Array<{ def: GuideDef; teaser: GuideTeaser }>> {
  const out: Array<{ def: GuideDef; teaser: GuideTeaser }> = [];
  // MC-046 R6: a noindexed guide (its sections were sold statistics) is not featured, related or
  // listed; it answers 200 at its URL with the neutral line until it returns gated in Stage 2.
  for (const def of GUIDE_DEFS.filter((g) => !g.noindex)) {
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

  // Index stats are counts of what the guides actually draw on, each real, not a marketing number.
  // MC-046 Stage 1 (R6): the "sales behind the figures" count was derived from VOW records and is
  // gone; no guide prints a sold figure any more.
  const [publishedStreets, publishedHubs] = await Promise.all([
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
    sub: `${countWord(teasers.length)} guides built on this site's own ${CITY} data, the Town's published rules and GO Transit's timetable feed. Every figure carries the date its source was read or the listings it was counted from.`,
    stats: [
      { n: String(teasers.length), l: "guides" },
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
// A guide that names a page and does not link to it is a dead end for both a reader and a crawler.
// Link rows are keyed by the section HEADING, not its position: MC-046 Stage 1 removed whole
// sections from some guides, and a positional key would have hung a row under the wrong heading.

async function linksFor(slug: string): Promise<Record<string, GuideLink[]>> {
  switch (slug) {
    case "how-to-read-a-milton-sold-price":
      return {
        "Why some figures are missing": [{ label: "Street-level pages", href: "/streets" }],
      };
    case "is-it-a-good-time-to-sell-in-milton":
      return {
        "What you would be competing with": [
          { label: "Homes for sale now", href: "/listings" },
          { label: "Get a valuation", href: "/sell#valuation" },
        ],
      };
    case "milton-condo-fees-parking-and-lockers": {
      const rows = await getActiveCondoFees();
      return {
        "Fees stated on condos for sale now": rows.slice(0, 16).map((r) => ({
          label: r.neighbourhood ? `${r.bedrooms} bed, ${r.neighbourhood}` : `${r.bedrooms} bed condo`,
          href: `/listings/${r.mlsNumber}`,
        })),
        "Before you commit": [
          { label: "Condo buildings in Milton", href: "/condos" },
          { label: "Condo or freehold", href: "/condos-guide" },
        ],
      };
    }
    case "what-it-costs-to-buy-your-first-home-in-milton":
      return {
        "The down payment is a sliding rule, not a percentage": [{ label: "Homes for sale now", href: "/listings" }],
        "The stress test decides what you qualify for": [{ label: "Townhouses and condos", href: "/condos" }],
      };
    case "milton-schools-what-the-data-shows": {
      const rows = getSchoolRows();
      return {
        "What this page can tell you": [{ label: "All Milton schools", href: "/schools" }],
        Elementary: rows
          .filter((r) => r.level === "elementary")
          .slice(0, 12)
          .map((r) => ({ label: r.name, href: `/schools/${r.slug}` })),
        Secondary: rows
          .filter((r) => r.level === "secondary")
          .map((r) => ({ label: r.name, href: `/schools/${r.slug}` })),
      };
    }
    // "parking-in-milton" and "milton-go-train-to-toronto" build their own link rows inside
    // their builders (parking.ts, goTransit.ts): the hubs they link to are derived from the
    // same source rows the sections cite, and a links row here would have to recompute them.
    // The two sold-statistics guides and the reading guide link to /sold through the neutral line.
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
  const sections = built.data.sections.map((s) =>
    links[s.heading]?.length ? { ...s, links: links[s.heading] } : s,
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
