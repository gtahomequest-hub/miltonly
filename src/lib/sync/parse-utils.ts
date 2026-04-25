/**
 * Parse TREB's `LivingAreaRange` into an integer square-footage value
 * suitable for the `Listing.sqft Int?` column.
 *
 * Accepts either a range ("1500-2000") or a single value ("1500"); for
 * ranges, returns the rounded-down midpoint. Rejects junk values
 * outside [100, 50000] sqft.
 *
 * Single source of truth — used by /api/sync/detect, /lib/sync/treb-sync,
 * and the scripts/backfill-sqft.ts one-shot backfill.
 */
export function parseLivingAreaRange(range: string | null | undefined): number | null {
  if (!range || typeof range !== "string") return null;
  const trimmed = range.trim();
  if (!trimmed) return null;

  let value: number | null = null;

  const rangeMatch = trimmed.match(/(\d+)\s*[-–—]\s*(\d+)/);
  if (rangeMatch) {
    const low = parseInt(rangeMatch[1], 10);
    const high = parseInt(rangeMatch[2], 10);
    if (Number.isFinite(low) && Number.isFinite(high) && high >= low) {
      value = Math.floor((low + high) / 2);
    }
  } else {
    // Try "< X" notation (TREB uses this for tiny units, e.g. "< 700")
    const lessThanMatch = trimmed.match(/^<\s*(\d+)$/);
    if (lessThanMatch) {
      const ceiling = parseInt(lessThanMatch[1], 10);
      if (Number.isFinite(ceiling) && ceiling > 100) {
        // Use midpoint of [100, ceiling] — honest representation of the bounded range
        const midpoint = Math.floor((100 + ceiling) / 2);
        return midpoint >= 100 && midpoint <= 50000 ? midpoint : null;
      }
    }
    const single = parseInt(trimmed, 10);
    if (Number.isFinite(single) && single > 0) value = single;
  }

  if (value === null) return null;
  if (value < 100 || value > 50000) return null;
  return value;
}
