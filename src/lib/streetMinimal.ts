// src/lib/streetMinimal.ts
// Server-side context for the MINIMAL street template (registry ingest, 2026-07).
//
// A minimal page is a deliberately-published page for a street with no generated profile: a
// deterministic layout (NO LLM prose) that reuses data we already have: neighbourhood,
// registry street type, schools serving the area, nearby published streets and live listings.
//
// MC-046 Stage 1 (PropTx VOW Best Practices item 40): the neighbourhood market context (the
// neighbourhood's 12-month sold count, from DB3) and the "no resales recorded" statement were
// derived from sold records. Neither is read or written here any more, and the nearby streets
// are ordered by name, not by sold volume (R9).
//
// A street renders minimal iff its StreetContent has status='published' AND
// template='minimal'. The display name of its neighbourhood comes from the Neighbourhood entity.
import "server-only";
import { prisma } from "@/lib/prisma";
import { getSchoolsByNeighbourhood, type School } from "@/lib/schools";
import { publishedStreetPageSlugs } from "@/lib/streetSurface";
import { MILTON_STREET_REGISTRY } from "@/data/miltonStreetRegistry";
import { expandStreetName } from "@/lib/street-data";
import { resolveStreetName } from "@/lib/streetName";

const TYPE_LABEL: Record<string, string> = {
  crescent: "crescent", court: "court", drive: "drive", terrace: "terrace", street: "street",
  place: "place", road: "road", way: "way", avenue: "avenue", gate: "gate", heights: "heights",
  lane: "lane", landing: "landing", boulevard: "boulevard", circle: "circle", trail: "trail",
  line: "line", point: "point", crossing: "crossing", garden: "garden", common: "common",
  path: "path", close: "close", townline: "townline", parkway: "parkway", centre: "centre",
  numbered: "route",
};

const regBySlug = new Map(MILTON_STREET_REGISTRY.map((r) => [r.slug, r]));

export interface MinimalStreetView {
  slug: string;
  name: string;
  shortName: string;
  neighbourhoodName: string | null;
  neighbourhoodSlug: string | null;
  typeLabel: string | null;
  eyebrow: string;
  whereItIs: string;
  schools: School[];
  nearbyStreets: Array<{ slug: string; name: string }>;
}

/** Null unless the slug is a published minimal-template street. */
export async function getMinimalStreetView(slug: string): Promise<MinimalStreetView | null> {
  const content = await prisma.streetContent.findUnique({
    where: { streetSlug: slug },
    select: { template: true, status: true, streetName: true },
  });
  if (!content || content.status !== "published" || content.template !== "minimal") return null;

  const entity = await prisma.residentialStreet.findUnique({
    where: { slug },
    select: {
      name: true, shortName: true, streetType: true,
      neighbourhood: { select: { id: true, name: true, slug: true } },
    },
  });

  // Registry-first. entity?.name and content.streetName are both drifted copies — measured, the
  // entity table disagrees with the registry on 626 of 944 rows — so they are the fallback, not the
  // source. Note the old chain could fall through to the bare slug.
  const resolvedName = resolveStreetName(slug, entity?.name || content.streetName || null);
  const name = resolvedName.name.replace(/\.\s/g, " ").replace(/\s+/g, " ").trim();
  const shortName = resolvedName.shortName || entity?.shortName || name;
  const nbName = entity?.neighbourhood?.name ?? null;
  const nbSlug = entity?.neighbourhood?.slug ?? null;

  const reg = regBySlug.get(slug);
  const typeLabel = reg ? (TYPE_LABEL[reg.type] ?? reg.type) : entity?.streetType ?? null;

  // Schools serving the neighbourhood (roster is neighbourhood-tagged; honest —
  // distance is surfaced only where a school has coordinates).
  const schools = nbName ? getSchoolsByNeighbourhood(nbName).slice(0, 6) : [];

  // Nearby streets — published siblings in the same neighbourhood (link graph). The set was the
  // surfacing predicate (sold history OR a page) ordered by VIP flag and 12-month sold count: a
  // rank by sold volume, with no figure shown, still discloses relative volume (MC-046, R9). It is
  // the published street pages, residential, in name order.
  let nearbyStreets: Array<{ slug: string; name: string }> = [];
  if (entity?.neighbourhood?.id) {
    const published = await publishedStreetPageSlugs();
    const sibs = await prisma.residentialStreet.findMany({
      where: { neighbourhoodId: entity.neighbourhood.id, slug: { not: slug, in: published }, isResidential: true },
      orderBy: { name: "asc" },
      take: 8,
      select: { slug: true, name: true },
    });
    nearbyStreets = sibs.map((s) => ({ slug: s.slug, name: expandStreetName(s.name).replace(/\.\s/g, " ").replace(/\s+/g, " ").trim() }));
  }

  const inArea = nbName ? ` in Milton's ${nbName} neighbourhood` : " in Milton";
  // "X is a <type>" only reads as English for type nouns that are ordinary countable places.
  // "Richardson Way is a way", "Kelso Line is a line", "Holland Heights is a heights" do not.
  // For those the type is dropped from the sentence — it is still stated exactly once, in the
  // Street facts row ("Street type: Way"), and it is visible in the name itself.
  const ARTICLE_READS_NATURALLY = new Set([
    "crescent", "court", "drive", "road", "place", "street", "avenue",
    "boulevard", "lane", "trail", "circle", "terrace", "close", "path",
  ]);
  const whereItIs =
    typeLabel && ARTICLE_READS_NATURALLY.has(typeLabel.toLowerCase())
      ? `${name} is a ${typeLabel}${inArea}.`
      : `${name} is${inArea}.`;

  const eyebrow = nbName ? `${nbName} · Milton` : "Milton";

  return { slug, name, shortName, neighbourhoodName: nbName, neighbourhoodSlug: nbSlug, typeLabel, eyebrow, whereItIs, schools, nearbyStreets };
}
