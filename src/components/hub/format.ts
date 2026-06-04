// src/components/hub/format.ts

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
