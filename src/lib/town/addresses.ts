// src/lib/town/addresses.ts
// The one accessor for the Town address projection. Everything that reads streetAddresses.ts
// goes through here, the way roadFacts.ts fronts townRoadFacts.ts.
//
// ABSENCE IS NEVER EVIDENCE — the same rule that governs the rest of this layer, enforced at its
// entry point. A street the Town's address layer does not carry returns null, and null means the
// caller renders exactly what it rendered before. It may not withhold a page or mark a street
// unreal: the Roads layer is from 2022, the Address Points layer from 2023, and the Town's own
// street-name registry from 2026-05-21, so the names are newer than the geometry.
import {
  townAddressesForKey,
  type TownStreetAddress,
  type TownStreetAddresses,
  type TownStreetCross,
} from "@/data/streetAddresses";
import { identityFromSlug } from "./identity";

export type { TownStreetAddress, TownStreetAddresses, TownStreetCross };
export {
  STREET_ADDRESS_COUNT,
  STREET_ADDRESS_STREETS,
  STREET_ADDRESS_SOURCE_PULLED,
} from "@/data/streetAddresses";

/** Civic addresses and placed cross streets for one of our street slugs, or null. */
export function townAddressesForSlug(slug: string | null | undefined): TownStreetAddresses | null {
  if (!slug) return null;
  return townAddressesForKey(identityFromSlug(slug).key);
}
