// src/lib/streetAddresses.ts
// The address ladder view model — QUEUE item 3, built on the Gate A map in
// scratchpad/reports/054-address-anchors-gate-a.md.
//
// WHAT THIS IS ALLOWED TO CARRY, and nothing else:
//   house number      the Town's civic address, OGL-licensed, municipal fact
//   side              the parity of that number
//   fraction          position from the low-number end, 0-1, from the build-time projection
//   cross street      the nearest placed junction, a street fact stated at street grain
//   building form     ONLY where a DB1 listing for that exact address carries one
//   active status     ONLY a status=active, permAdvertise listing, as a link to /listings/<mls>
//
// NEVER, AT ANY k: a sold price, a sold date, an owner, a historical listing, or a per-address
// coordinate. A single address is a population of one, so no aggregate threshold can make a
// transaction figure safe — this is stricter than k-anonymity and deliberately so. The absence of
// a price here is not suppression to be relaxed later; it is the shape of the feature.
//
// PURE ON PURPOSE. No `server-only`, no prisma. The caller passes the listing rows it already
// fetched, which is why the prebuild guard can import this module directly.
import { townAddressesForSlug } from "@/lib/town/addresses";
import { identityFromSlug, parseAddress } from "@/lib/town/identity";
import { resolveStreetName } from "@/lib/streetName";

/** The DB1 columns this module is permitted to see. Deliberately narrow. */
export interface AddressLadderListing {
  address: string | null;
  mlsNumber: string;
  status: string | null;
  permAdvertise: boolean | null;
  propertySubType: string | null;
  propertyType: string | null;
}

export interface AddressMark {
  number: number;
  side: "odd" | "even";
  /** 0 at the low-number end, 1 at the high-number end. */
  fraction: number;
  /** nearest placed cross street, or null when the Town places none on this street. */
  crossStreet: string | null;
  /** building form, only where a DB1 listing for this address carried one. */
  form: string | null;
  /** a live, publicly advertisable listing at this address. No price, ever. */
  active: { mlsNumber: string; href: string } | null;
}

export interface AddressCrossTick {
  slug: string;
  name: string;
  fraction: number;
  /** set only where the cross street has a published page. A label otherwise, never a 404. */
  href: string | null;
}

export interface AddressLadder {
  count: number;
  low: number;
  high: number;
  /** Plain text, generated from the data. Never written by a model. */
  summary: string;
  marks: AddressMark[];
  crossStreets: AddressCrossTick[];
  /** how many marks carry a live listing — drives the legend, which is otherwise not drawn. */
  activeCount: number;
}

/** PropTx tenure strings that read badly verbatim. Anything unlisted passes through unchanged. */
const FORM_LABEL: Record<string, string> = {
  "att/row/townhouse": "Townhouse",
  "att/row/twnhouse": "Townhouse",
  "detached": "Detached",
  "semi-detached": "Semi-detached",
  "link": "Link",
  "condo apartment": "Condo apartment",
  "condo townhouse": "Condo townhouse",
  "vacant land": "Vacant land",
};

function formLabel(sub: string | null, type: string | null): string | null {
  const raw = (sub ?? type ?? "").trim();
  if (!raw) return null;
  return FORM_LABEL[raw.toLowerCase()] ?? raw;
}

/** en-dash between numerals, per the house voice. */
function numberRange(lo: number, hi: number): string {
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}

function joinList(items: string[]): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** The listed cross streets in the summary sentence stop here; the ladder still draws them all. */
const SUMMARY_CROSS_LIMIT = 8;

function buildSummary(
  streetName: string,
  count: number,
  lo: number,
  hi: number,
  crosses: AddressCrossTick[]
): string {
  const head =
    count === 1
      ? `The Town records one civic address on ${streetName}, numbered ${lo}`
      : `The Town records ${count} civic addresses on ${streetName}, numbered ${numberRange(lo, hi)}`;
  if (crosses.length === 0) return `${head}.`;
  const shown = crosses.slice(0, SUMMARY_CROSS_LIMIT).map((c) => c.name);
  const rest = crosses.length - shown.length;
  if (crosses.length === 1) return `${head}, with ${shown[0]} meeting it.`;
  const tail = rest > 0 ? `${joinList(shown)} and ${rest} more` : joinList(shown);
  return `${head}, with ${tail} meeting it in that order from the low-number end.`;
}

/**
 * ROLLOUT GATE (QUEUE item 3, step 6). null => every published street. A slug set restricts the
 * section to those streets while the shape is verified on preview. This is a build-time constant,
 * not an env flag: the preview and the merge have to render the same thing.
 */
export const ADDRESS_LADDER_SLUGS: ReadonlySet<string> | null = new Set([
  "mae-court-milton",
  "mcphail-way-milton",
  "pine-street-milton",
  "bell-school-line-milton",
]);

export function addressLadderEnabledFor(slug: string): boolean {
  return ADDRESS_LADDER_SLUGS === null || ADDRESS_LADDER_SLUGS.has(slug);
}

/**
 * Build the ladder for one street. Returns null where the Town's address layer carries nothing for
 * this street identity — the section is then not rendered at all, which is the honest failure.
 */
export function buildAddressLadder(input: {
  slug: string;
  streetName: string;
  listings: readonly AddressLadderListing[];
  /** cross-street slugs known to have a published page; anything else renders unlinked. */
  linkableSlugs?: ReadonlySet<string>;
}): AddressLadder | null {
  const town = townAddressesForSlug(input.slug);
  if (!town || town.addresses.length === 0) return null;

  const identityKey = identityFromSlug(input.slug).key;

  // DB1, joined by parsed house number AND street identity. A listing whose address parses to a
  // different street is not this street's address, whatever slug it was ingested under.
  const forms = new Map<number, string>();
  const actives = new Map<number, { mlsNumber: string; href: string }>();
  for (const l of input.listings) {
    const parsed = parseAddress(l.address);
    if (!parsed || parsed.identity.key !== identityKey) continue;
    const form = formLabel(l.propertySubType, l.propertyType);
    if (form && !forms.has(parsed.number)) forms.set(parsed.number, form);
    const isActive = String(l.status ?? "").toLowerCase() === "active" && l.permAdvertise !== false;
    if (isActive && !actives.has(parsed.number)) {
      actives.set(parsed.number, { mlsNumber: l.mlsNumber, href: `/listings/${l.mlsNumber}` });
    }
  }

  const crossStreets: AddressCrossTick[] = town.crossStreets.map((c) => ({
    slug: c.slug,
    name: resolveStreetName(c.slug).name,
    fraction: c.fraction,
    href: input.linkableSlugs?.has(c.slug) ? `/streets/${c.slug}` : null,
  }));

  const nearestCross = (fraction: number): string | null => {
    if (crossStreets.length === 0) return null;
    let best = crossStreets[0];
    for (const c of crossStreets) {
      if (Math.abs(c.fraction - fraction) < Math.abs(best.fraction - fraction)) best = c;
    }
    return best.name;
  };

  const marks: AddressMark[] = town.addresses.map((a) => ({
    number: a.n,
    side: a.side,
    fraction: a.fraction,
    crossStreet: nearestCross(a.fraction),
    form: forms.get(a.n) ?? null,
    active: actives.get(a.n) ?? null,
  }));

  const numbers = marks.map((m) => m.number);
  const low = Math.min(...numbers);
  const high = Math.max(...numbers);

  return {
    count: marks.length,
    low,
    high,
    summary: buildSummary(input.streetName, marks.length, low, high, crossStreets),
    marks,
    crossStreets,
    activeCount: marks.filter((m) => m.active).length,
  };
}
