// src/lib/hubLive.ts
// THE ONE LIVE READ per hub request.
//
// Before this, a hub page derived its numbers from two unrelated places: the
// BODY recomputed them from DB2 through buildHubInput, while the SERP meta
// description served a string frozen into HubContent.metaDescription at
// generation time. They disagreed on every hub but one. Measured against the
// live 12-month aggregate on 2026-08-15:
//
//   · 16 of 22 stored prices had drifted (Beaty $995,000 stored vs $975,000
//     live; Nassagaweya $1,730,000 vs $1,585,000)
//   · 21 of 21 stored sale counts had drifted, every one of them HIGH
//     (Beaty claimed 187 sales; the page beside it rendered 159)
//   · Brookville / Haltonville and Milton North published a typical price into
//     the SERP while their own pages, correctly, published none — their pools
//     are 4 and 3 sales, below K_ANON_PRICE. A k-anon suppression that only
//     holds on one of two published surfaces is not a suppression.
//
// Only Timberlea read live, because it had been hand-patched for a GSC rewrite.
// This module generalises that patch to all 22 and deletes the stored-string
// path: getHubMetaLive composes from lib/ai/hub/hubMeta.ts — the SAME formula
// and the SAME round5k the generator uses — over aggregates read at request
// time, so a hub's meta cannot describe a market its body no longer shows.
//
// The React cache() wrapper matters: Next calls generateMetadata and the page
// body as two separate invocations of the same request, and both need the hub
// input. Cached, they read one computation, so "one source" is literal rather
// than merely parallel — and the extra DB2 round-trips the Timberlea patch used
// to cost are gone.
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import { buildHubInput, buildRuralHubInput } from "@/lib/ai/buildHubInput";
import { buildHubMeta } from "@/lib/ai/hub/hubMeta";
import type { HubGeneratorInput } from "@/types/hub-generator";

/** Per-hub SERP closers. Everything else about the description is shared. */
const HUB_META_CLOSER: Record<string, string> = {
  // GSC 2026-07-18 keyword report: the Timberlea hub carried 60 impressions at
  // ~pos 19 with zero clicks. This clause is that rewrite, preserved verbatim.
  timberlea: "a straight market read on Milton's established central pocket",
};

/** The Neighbourhood row, memoised for the request. */
export const getNeighbourhoodCached = cache((slug: string) =>
  prisma.neighbourhood.findUnique({ where: { slug } }),
);

/**
 * The hub's live input, dispatched on profile and memoised for the request.
 * Fail-soft by design: a DB2 hiccup must degrade a hub to its number-free
 * state, never 500 a published page. Returns null for standard_no_hub.
 */
export const getHubInputCached = cache(
  async (slug: string): Promise<HubGeneratorInput | null> => {
    const nbhd = await getNeighbourhoodCached(slug);
    if (!nbhd) return null;
    try {
      if (nbhd.profile === "urban_hub") return await buildHubInput(slug);
      if (nbhd.profile === "rural_hub") return await buildRuralHubInput(slug);
      return null;
    } catch {
      return null;
    }
  },
);

/**
 * Title + description for a published hub, composed from live aggregates.
 * Returns null when the hub is not published — the caller renders "not found".
 *
 * The stored metaTitle is still honoured as the title fallback (titles carry no
 * figures, so they cannot go stale), but the DESCRIPTION is always live. When
 * the aggregate is unavailable the composer's own no-hook branch fires: a
 * number-free description, not a stale one and not an empty one.
 */
export const getHubMetaLive = cache(async (
  slug: string,
): Promise<{ title: string; description: string } | null> => {
  const content = await prisma.hubContent.findUnique({
    where: { neighbourhoodSlug: slug },
    select: { status: true, metaTitle: true, neighbourhoodName: true },
  });
  if (!content || content.status !== "published") return null;

  // Profile comes from the RECORD, never from the fail-soft input: when DB2 is
  // unreachable a rural hub must still read "Road-by-road", not silently become
  // urban because the aggregate that carried its profile came back null.
  const nbhd = await getNeighbourhoodCached(slug);
  const input = await getHubInputCached(slug);
  const name = content.neighbourhoodName;
  const profile = nbhd?.profile === "rural_hub" ? "rural" : "urban";

  const { metaTitle, metaDescription } = buildHubMeta(
    name,
    {
      typicalPrice: input?.aggregates.typicalPrice ?? null,
      salesCount: input?.aggregates.salesCount ?? 0,
    },
    profile,
    HUB_META_CLOSER[slug],
  );

  return {
    title: content.metaTitle ?? metaTitle,
    description: metaDescription,
  };
});

export const hubCanonical = (slug: string) => `${config.SITE_URL}/neighbourhoods/${slug}`;
