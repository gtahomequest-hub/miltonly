// src/lib/streetEnrichment.ts
// THE STREET'S REGISTRY CONTEXT (MC-046 Stage 1). This file used to carry DEC-CONDO-6's three
// data folds: the neighbourhood typical price (the hub's own sale aggregate), the graduated
// 12-month / ~2-year sale and lease typicals, and the tier and hasAnySale flags derived from
// them. Every one of those was a value derived from sold or leased records, and all of them left
// the visitor view under PropTx VOW Best Practices item 40. The reads that produced them are
// gone with them; nothing here queries DB2 or DB3.
//
// What remains is registry data the page still uses: the street's neighbourhood, for the CTAs'
// wording, and whether the street has any row on record, which only the noRecord prose guard
// reads (a property detail with no source anywhere is not published) and which never renders.
import { prisma } from "@/lib/prisma";

export interface StreetAreaContext {
  neighbourhoodName: string;
  neighbourhoodSlug: string | null;
}

export interface StreetEnrichment {
  /** the street's registry neighbourhood, or null where the registry places it in none */
  areaContext: StreetAreaContext | null;
  /** any DB1 row or DB2 record for the street. Server-side only: it gates the noRecord prose
   *  guard and is never rendered, serialised to a client component, or stated on the page. */
  hasRecord: boolean;
}

export async function buildStreetEnrichment(params: { slug: string; hasRecord: boolean }): Promise<StreetEnrichment> {
  const { slug, hasRecord } = params;
  const rs = await prisma.residentialStreet
    .findUnique({ where: { slug }, select: { neighbourhood: { select: { slug: true, name: true } } } })
    .catch(() => null);
  const nbhd = rs?.neighbourhood ?? null;
  return {
    areaContext: nbhd ? { neighbourhoodName: nbhd.name, neighbourhoodSlug: nbhd.slug } : null,
    hasRecord,
  };
}
