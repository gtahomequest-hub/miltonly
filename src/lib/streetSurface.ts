// src/lib/streetSurface.ts
// The single source of truth for "is this ResidentialStreet entity surfaced?"
//
// Registry ingest (2026-07): the site holds an entity for every official Milton
// street (944), but a bare/dormant entity (0 sold, 0 listings, unpublished) would
// render a 404 at /streets/[slug]. So entities are surfaced in hero search,
// autocomplete, and hub street lists ONLY when they render a real page:
//   recencyWeightedSold > 0   (has sold history — the ~500 that render today)
//   OR hasPublishedPage       (a page was deliberately published — e.g. the
//                              minimal-template new-construction / low-sale pages)
//
// Pageless dormant entities stay in the DB (search can grow into them later) but
// are not shown anywhere user-facing. Auto-promotion flips hasPublishedPage when a
// first sale/listing arrives. The sitemap is gated separately (published
// StreetContent) and needs no change.
import type { Prisma } from "@prisma/client";

export const SURFACED_STREET_WHERE = {
  OR: [{ recencyWeightedSold: { gt: 0 } }, { hasPublishedPage: true }],
} satisfies Prisma.ResidentialStreetWhereInput;
