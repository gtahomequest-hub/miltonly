// src/lib/streetSlugReview.ts
// Step 5 (registry ingest, 2026-07) — sync-time street-slug validation. When vow-sync
// mints a street_slug, we canonicalize it against the Town registry; if it matches (or
// is an allowlisted off-registry rural road) it proceeds. If NEITHER, it goes to the
// StreetSlugReview queue (fail-loud, like UnmappedNeighbourhoodString) — logged for
// review, NOT auto-turned into a page. A real new subdivision street is added to the
// registry (clearing the queue); a junk/unit leak is dismissed.
import { prisma } from "@/lib/prisma";
import { canonicalizeResidential } from "@/lib/canonicalizeResidential";

/** Returns the count of distinct UNKNOWN slugs queued for review. */
export async function reviewMintedStreetSlugs(
  pairs: Array<{ streetName: string; streetSlug: string }>,
  source = "vow-sync",
): Promise<number> {
  // Distinct slugs only; canonicalize in-memory (no DB) and queue the unknowns.
  const unknown = new Map<string, string>(); // slug -> sample name
  for (const { streetName, streetSlug } of pairs) {
    if (!streetSlug || unknown.has(streetSlug)) continue;
    const c = canonicalizeResidential(streetName, streetSlug);
    if (c.matched || c.offRegistry) continue; // known — proceed
    unknown.set(streetSlug, streetName);
  }
  for (const [streetSlug, sampleName] of Array.from(unknown)) {
    await prisma.streetSlugReview.upsert({
      where: { streetSlug },
      create: { streetSlug, sampleName, source, seenCount: 1 },
      update: { sampleName, seenCount: { increment: 1 }, lastSeen: new Date() },
    });
  }
  if (unknown.size) console.warn(`[street-slug-review] queued ${unknown.size} unknown street_slug(s) for review: ${Array.from(unknown.keys()).slice(0, 8).join(", ")}`);
  return unknown.size;
}
