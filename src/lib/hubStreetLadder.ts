// src/lib/hubStreetLadder.ts
// The hub's street ladder: every published street in the hub, ranked by homes for sale today.
//
// MC-046 Stage 1 (PropTx VOW Best Practices item 40, ruling R9). The ladder used to carry each
// street page's own typical SOLD price, its sample ("across N sales in the last 12 months") and
// the 12-month sale count, and it ranked the streets by that count. All three are values derived
// from VOW records, and the order alone disclosed relative sold volume. The ladder now reads DB1
// only: the count of IDX active sale listings on each street, pooled over the street's identity
// (deriveIdentity, the key resolveSiblingSlugs pools a street page's own listings on), and it is
// ordered by that count, ties alphabetical. Nothing here reads the sold database.
import { prisma } from "@/lib/prisma";
import { deriveIdentity } from "@/lib/streetUtils";
import { PUBLIC_SALE_WHERE } from "@/lib/listings/vow";

export interface LadderStreet {
  slug: string;
  name: string;
  /** IDX active sale listings on the street's identity today. A count of public listings. */
  activeCount: number;
  isVip: boolean;
  hasVideo: boolean;
}

/** The identity a street page pools over. The same function resolveSiblingSlugs keys on. */
function identityKey(slug: string): string {
  return deriveIdentity(slug)?.identityKey ?? slug;
}

/** Active sale listings per street identity, across Milton, in one grouped query. */
async function activeByIdentity(): Promise<Map<string, number>> {
  const rows = await prisma.listing.groupBy({
    by: ["streetSlug"],
    _count: true,
    where: { ...PUBLIC_SALE_WHERE },
  });
  const out = new Map<string, number>();
  for (const r of rows) {
    if (!r.streetSlug) continue;
    const k = identityKey(r.streetSlug);
    out.set(k, (out.get(k) ?? 0) + r._count);
  }
  return out;
}

/**
 * Decorate a hub's streets with their active count and order them: most homes for sale first,
 * ties alphabetical. The caller supplies the streets; this module never decides which streets a
 * hub shows.
 */
export async function buildLadder(
  streets: Array<{ slug: string; name: string; isVip: boolean }>,
  videoSlugs: Set<string>,
): Promise<LadderStreet[]> {
  const active = streets.length ? await activeByIdentity().catch(() => new Map<string, number>()) : new Map<string, number>();
  return streets
    .map((s) => ({
      slug: s.slug,
      name: s.name,
      activeCount: active.get(identityKey(s.slug)) ?? 0,
      isVip: s.isVip,
      hasVideo: videoSlugs.has(s.slug),
    }))
    .sort((a, b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name));
}
