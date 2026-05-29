// WS3 — neighbourhood entity resolution (string-based assignment; geocoding parked).
//
// The raw TREB neighbourhood string is NOT 1:1 with a neighbourhood: rural areas
// arrive as both a coded and an uncoded variant (e.g. "1041 - NA Rural Nassagaweya"
// and "Nassagaweya"). Each Neighbourhood row carries every variant in rawStrings[];
// resolveNeighbourhood() maps a raw string to its canonical Neighbourhood.
//
// Profiles (Brain Claude, 2026-05-28):
//   urban_hub       — full hub spec + VIP tier (top-20%-or-tied per pool)
//   rural_hub       — shorter, character-led, NO VIP tier
//   standard_no_hub — entity/streets exist, no hub page (Derry Green)
// `kind` (geographic) and `profile` (content depth) may diverge: the two thin
// urban neighbourhoods (Milton North, Bronte Meadows) are kind=urban but
// profile=rural_hub so they aren't forced into a thin full-hub page.

import { prisma } from "@/lib/prisma";

export type NeighbourhoodProfile = "urban_hub" | "rural_hub" | "standard_no_hub";

export interface NeighbourhoodSeed {
  slug: string;
  name: string;
  rawStrings: string[];
  profile: NeighbourhoodProfile;
  kind: "urban" | "rural" | "industrial";
  isHub: boolean;
  hasVipTier: boolean;
}

// Canonical 24 neighbourhood entities from the 25 distinct TREB strings
// (Nassagaweya's coded + uncoded variants merge into one).
export const NEIGHBOURHOOD_SEED: NeighbourhoodSeed[] = [
  // ── Urban hubs (full spec + VIP tier) ──
  u("beaty", "Beaty", ["1023 - BE Beaty"]),
  u("bowes", "Bowes", ["1025 - BW Bowes"]),
  u("cobban", "Cobban", ["1026 - CB Cobban"]),
  u("clarke", "Clarke", ["1027 - CL Clarke"]),
  u("coates", "Coates", ["1028 - CO Coates"]),
  u("dempsey", "Dempsey", ["1029 - DE Dempsey"]),
  u("dorset-park", "Dorset Park", ["1031 - DP Dorset Park"]),
  u("ford", "Ford", ["1032 - FO Ford"]),
  u("harrison", "Harrison", ["1033 - HA Harrison"]),
  u("old-milton", "Old Milton", ["1035 - OM Old Milton"]),
  u("scott", "Scott", ["1036 - SC Scott"]),
  u("timberlea", "Timberlea", ["1037 - TM Timberlea"]),
  u("willmott", "Willmott", ["1038 - WI Willmott"]),
  u("walker", "Walker", ["1051 - Walker"]),
  // ── Thin urban: kind=urban, profile=rural_hub, no VIP (decision #3) ──
  thinUrban("bronte-meadows", "Bronte Meadows", ["1024 - BM Bronte Meadows"]),
  thinUrban("milton-north", "Milton North", ["1034 - MN Milton North"]),
  // ── Rural hubs (character-led, no VIP) ──
  r("rural-milton", "Rural Milton", ["1039 - MI Rural Milton"]),
  r("nassagaweya", "Nassagaweya", ["1041 - NA Rural Nassagaweya", "Nassagaweya"]), // MERGE
  r("rural-trafalgar", "Rural Trafalgar", ["1044 - TR Rural Trafalgar"]),
  r("brookville-haltonville", "Brookville / Haltonville", ["Brookville/Haltonville"]),
  r("campbellville", "Campbellville", ["Campbellville"]),
  r("moffat", "Moffat", ["Moffat"]),
  r("rural-milton-west", "Rural Milton West", ["Rural Milton West"]),
  // ── Standard / no hub (industrial; residential streets exist, no hub page) ──
  {
    slug: "derry-green", name: "Derry Green", rawStrings: ["1030 - DG Derry Green"],
    profile: "standard_no_hub", kind: "industrial", isHub: false, hasVipTier: false,
  },
];

function u(slug: string, name: string, rawStrings: string[]): NeighbourhoodSeed {
  return { slug, name, rawStrings, profile: "urban_hub", kind: "urban", isHub: true, hasVipTier: true };
}
function thinUrban(slug: string, name: string, rawStrings: string[]): NeighbourhoodSeed {
  return { slug, name, rawStrings, profile: "rural_hub", kind: "urban", isHub: true, hasVipTier: false };
}
function r(slug: string, name: string, rawStrings: string[]): NeighbourhoodSeed {
  return { slug, name, rawStrings, profile: "rural_hub", kind: "rural", isHub: true, hasVipTier: false };
}

/**
 * Resolve a raw TREB neighbourhood string to its canonical Neighbourhood.
 * On no match: records the string in the append-only UnmappedNeighbourhoodString
 * review queue (fail-loud), and returns null. NEVER auto-creates a neighbourhood —
 * Brain Claude reviews the queue and extends rawStrings[] or creates a new entity.
 */
export async function resolveNeighbourhood(rawString: string, source = "runtime") {
  const trimmed = (rawString ?? "").trim();
  if (!trimmed) return null;
  const match = await prisma.neighbourhood.findFirst({
    where: { rawStrings: { has: trimmed } },
  });
  if (match) return match;

  // Fail-loud + queue for review. Append-only; bump seenCount on repeats.
  console.error(`[resolveNeighbourhood] UNMAPPED neighbourhood string: ${JSON.stringify(trimmed)} (source=${source})`);
  await prisma.unmappedNeighbourhoodString.upsert({
    where: { rawString: trimmed },
    create: { rawString: trimmed, source },
    update: { seenCount: { increment: 1 }, lastSeen: new Date() },
  });
  return null;
}
