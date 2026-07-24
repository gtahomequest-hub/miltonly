// src/lib/streetMinimal.ts
// Server-side context for the MINIMAL street template (registry ingest, 2026-07).
//
// A minimal page is a deliberately-published page for a zero/low-sale street: an
// honest, deterministic layout (NO LLM prose) that reuses data we already have —
// neighbourhood, registry street type, schools serving the area, neighbourhood-
// level market context (clearly labelled, never street-level), nearby streets,
// live listings, and a plain "no resales recorded yet" statement.
//
// A street renders minimal iff its StreetContent has status='published' AND
// template='minimal'. StreetContent.neighbourhood holds the RAW TREB neighbourhood
// key (e.g. "1025 - BW Bowes") so the area stats resolve; the display name comes
// from the Neighbourhood entity.
import "server-only";
import { prisma } from "@/lib/prisma";
import { getNeighbourhoodSaleStats } from "@/lib/sold-data";
import { getSchoolsByNeighbourhood, type School } from "@/lib/schools";
import { SURFACED_STREET_WHERE } from "@/lib/streetSurface";
import { MILTON_STREET_REGISTRY } from "@/data/miltonStreetRegistry";
import { expandStreetName } from "@/lib/street-data";

const TYPE_LABEL: Record<string, string> = {
  crescent: "crescent", court: "court", drive: "drive", terrace: "terrace", street: "street",
  place: "place", road: "road", way: "way", avenue: "avenue", gate: "gate", heights: "heights",
  lane: "lane", landing: "landing", boulevard: "boulevard", circle: "circle", trail: "trail",
  line: "line", point: "point", crossing: "crossing", garden: "garden", common: "common",
  path: "path", close: "close", townline: "townline", parkway: "parkway", centre: "centre",
  numbered: "route",
};

const regBySlug = new Map(MILTON_STREET_REGISTRY.map((r) => [r.slug, r]));

export interface StreetAreaStats {
  neighbourhoodName: string;
  soldCount12mo: number;
  marketScore: number | null;
  window: string;
}

export interface MinimalStreetView {
  slug: string;
  name: string;
  shortName: string;
  neighbourhoodName: string | null;
  neighbourhoodSlug: string | null;
  typeLabel: string | null;
  eyebrow: string;
  whereItIs: string;
  noData: string;
  schools: School[];
  area: StreetAreaStats | null;
  nearbyStreets: Array<{ slug: string; name: string }>;
}

/** Null unless the slug is a published minimal-template street. */
export async function getMinimalStreetView(slug: string): Promise<MinimalStreetView | null> {
  const content = await prisma.streetContent.findUnique({
    where: { streetSlug: slug },
    select: { template: true, status: true, neighbourhood: true, streetName: true },
  });
  if (!content || content.status !== "published" || content.template !== "minimal") return null;

  const entity = await prisma.residentialStreet.findUnique({
    where: { slug },
    select: {
      name: true, shortName: true, streetType: true,
      neighbourhood: { select: { id: true, name: true, slug: true } },
    },
  });

  const name = expandStreetName(entity?.name || content.streetName || slug).replace(/\.\s/g, " ").replace(/\s+/g, " ").trim();
  const shortName = entity?.shortName || name;
  const nbName = entity?.neighbourhood?.name ?? null;
  const nbSlug = entity?.neighbourhood?.slug ?? null;
  const rawKey = content.neighbourhood; // raw TREB key for analytics

  const reg = regBySlug.get(slug);
  const typeLabel = reg ? (TYPE_LABEL[reg.type] ?? reg.type) : entity?.streetType ?? null;

  // Schools serving the neighbourhood (roster is neighbourhood-tagged; honest —
  // distance is surfaced only where a school has coordinates).
  const schools = nbName ? getSchoolsByNeighbourhood(nbName).slice(0, 6) : [];

  // Neighbourhood-level market context (never street-level). Prices are authed-only
  // in the packet; the public surface shows counts + a market-activity read.
  let area: StreetAreaStats | null = null;
  if (rawKey) {
    const st = await getNeighbourhoodSaleStats(rawKey).catch(() => null);
    if (st && nbName) {
      area = { neighbourhoodName: nbName, soldCount12mo: st.sold_count_12months, marketScore: st.market_score, window: "trailing 12 months" };
    }
  }

  // Nearby streets — surfaced siblings in the same neighbourhood (link graph).
  let nearbyStreets: Array<{ slug: string; name: string }> = [];
  if (entity?.neighbourhood?.id) {
    const sibs = await prisma.residentialStreet.findMany({
      where: { neighbourhoodId: entity.neighbourhood.id, slug: { not: slug }, ...SURFACED_STREET_WHERE },
      orderBy: [{ isVip: "desc" }, { soldCount12mo: "desc" }],
      take: 8,
      select: { slug: true, name: true },
    });
    nearbyStreets = sibs.map((s) => ({ slug: s.slug, name: expandStreetName(s.name).replace(/\.\s/g, " ").replace(/\s+/g, " ").trim() }));
  }

  const inArea = nbName ? ` in Milton's ${nbName} neighbourhood` : " in Milton";
  const whereItIs = typeLabel
    ? `${name} is a ${typeLabel}${inArea}.`
    : `${name} is${inArea}.`;

  const noData =
    `No home resales are recorded on ${shortName} in our data window — the last ~2 years of ` +
    `Milton sales. This is a real street with no recent turnover, not a page without a home. ` +
    `When a home sells here, this page fills in with its own price history and trends.`;

  const eyebrow = nbName ? `${nbName} · Milton` : "Milton";

  return { slug, name, shortName, neighbourhoodName: nbName, neighbourhoodSlug: nbSlug, typeLabel, eyebrow, whereItIs, noData, schools, area, nearbyStreets };
}
