export function formatPrice(price: number): string {
  if (price >= 1000000) {
    const m = price / 1000000;
    return "$" + (m % 1 === 0 ? m.toFixed(0) : m.toFixed(2)) + "M";
  }
  if (price >= 1000) {
    return "$" + Math.round(price / 1000) + "K";
  }
  return "$" + price.toLocaleString();
}

export function formatPriceFull(price: number): string {
  return "$" + price.toLocaleString();
}

/**
 * Round a price for customer-facing prose (<title>, meta description, hero copy).
 * Schema.org and DB values stay precise; only visible prose gets rounded.
 *
 *   Under $500K       → nearest $10K
 *   $500K to $999,999 → nearest $25K
 *   $1M to $1,999,999 → nearest $50K
 *   $2M and above     → nearest $100K
 */
export function roundPriceForProse(price: number): number {
  if (!Number.isFinite(price) || price <= 0) return 0;
  let step: number;
  if (price < 500_000) step = 10_000;
  else if (price < 1_000_000) step = 25_000;
  else if (price < 2_000_000) step = 50_000;
  else step = 100_000;
  return Math.round(price / step) * step;
}

/** The rent counterpart to roundPriceForProse.
 *
 *  roundPriceForProse is a HOUSE-price rounder — its smallest step is $10,000, so a $2,460 rent
 *  rounds to $0. The market card had been working around that by suppressing any rent that
 *  rounded to zero, which is every rent, which is why 139 pages showed a rent in the hero pill
 *  and a dash in the market card for the same metric. Rents round to $25. */
export function roundRentForProse(rent: number): number {
  if (!Number.isFinite(rent) || rent <= 0) return 0;
  return Math.round(rent / 25) * 25;
}

export function daysAgo(date: Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

/**
 * Strip TREB internal neighbourhood codes from raw Listing.neighbourhood strings.
 * Input like "1032 - FO Ford" → "Ford". Handles leading numeric+dash+code prefix
 * ("1032 - FO "), trailing abbreviation suffix (" - FO"), all-caps, and
 * comma-separated multi-neighbourhood strings. Idempotent — clean input returns
 * unchanged.
 */
export function cleanNeighbourhoodName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .split(/\s*,\s*/)
    .map(cleanOneNeighbourhood)
    .filter(Boolean)
    .join(", ");
}

function cleanOneNeighbourhood(s: string): string {
  if (!s) return "";
  // Strip leading: digits + dash, with an OPTIONAL 1-4 letter area code ("1032 - FO " or "1051 - ").
  // The code group used to be mandatory, so "1051 - Walker" fell straight through — "Walker" is six
  // letters, so `[A-Za-z]{1,4}\s+` could never match it. That raw string then rendered live in the
  // hero eyebrow, the Street-facts card and the meta description. Making the group optional handles
  // both shapes; a genuine name is unaffected because it does not open with digits and a dash.
  let cleaned = s.replace(/^\s*\d+\s*-\s*(?:[A-Za-z]{1,4}\s+)?/i, "");
  // Strip trailing: " - XX" abbreviation
  cleaned = cleaned.replace(/\s*-\s*[A-Za-z]{1,4}\s*$/i, "");
  // If all-caps or mixed, normalize to title case.
  const trimmed = cleaned.trim();
  if (trimmed.length === 0) return "";
  return trimmed.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
