// src/components/street/v2/format.ts
// Pure formatters. The DESIGN never decides suppression — the loader passes null
// where a value is k-anon suppressed. These only format already-publishable numbers.

/** 1_090_000 -> "1.09M" (no leading $) */
export function compactPrice(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${n}`;
}

/** 1_150_000 -> "$1,150,000" */
export function fullPrice(n: number): string {
  return `$${n.toLocaleString('en-CA')}`;
}

/** 1_150_000 -> "$1.15M" (compact, with sign) */
export function shortPrice(n: number): string {
  return `$${compactPrice(n)}`;
}

/** 0.984 -> "98%" */
export function pct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/** "$845K to $1.45M" band */
export function band(low: number, high: number): string {
  return `${shortPrice(low)} to ${shortPrice(high)}`;
}

/** magnitude-aware: sale prices compact ($1.21M), rents in full ($2,650) */
export function dollars(n: number): string {
  return n >= 100_000 ? shortPrice(n) : fullPrice(n);
}

/** clamp bar height to a 0..1 fraction of the series max (min 4% so a bar always shows) */
export function barFraction(value: number, max: number): number {
  if (max <= 0) return 0.04;
  return Math.max(0.04, value / max);
}
