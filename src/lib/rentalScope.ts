// src/lib/rentalScope.ts
import { prisma } from "@/lib/prisma";

// MC-012: ?neighbourhood=<hub slug> scopes the page to one hub. The hub's "I'm renting" square
// says "Lease in this area", and until this it landed on every rental in Milton. The scope is
// resolved through the Neighbourhood row's rawStrings, the same mapping every hub figure uses,
// so the count here is the count that hub would publish. An unknown slug is not an error: the
// page falls back to the whole town and says nothing about the scope it could not honour. The
// canonical stays /rentals: the scoped page is a filter of it, not a page of its own.
export interface RentalScope {
  slug: string;
  name: string;
  rawStrings: string[];
}

export async function resolveRentalScope(param: string | string[] | undefined): Promise<RentalScope | null> {
  const slug = Array.isArray(param) ? param[0] : param;
  if (!slug || !/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const row = await prisma.neighbourhood.findUnique({ where: { slug }, select: { slug: true, name: true, rawStrings: true } });
  if (!row || row.rawStrings.length === 0) return null;
  return { slug: row.slug, name: row.name, rawStrings: row.rawStrings };
}
