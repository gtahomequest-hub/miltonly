// src/components/listings/v2/format.ts
// Pure formatters + the TREB raw-string cleaners. Addresses, brokerages and
// neighbourhoods arrive ALL-CAPS / TREB-coded ("1035 - OM OLD MILTON"); the
// design owns the cleanup, mirroring the live grid's titleCase helpers.

export function fullPrice(n: number): string {
  return `$${n.toLocaleString('en-CA')}`;
}

/** 1_249_000 -> "$1.25M"; 949_900 -> "$950K"; 2_650 -> "$2,650" */
export function shortPrice(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`;
  if (n >= 100_000) return `$${Math.round(n / 1_000)}K`;
  return fullPrice(n);
}

const SMALL_WORDS = new Set(['of', 'at', 'the', 'in', 'and', 'on', 'for', 'by', 'to']);
const FIXUPS: Record<string, string> = {
  Remax: 'RE/MAX',
  'Re/Max': 'RE/MAX',
  Mls: 'MLS',
  Ltd: 'Ltd.',
  Inc: 'Inc.',
  Re: 'RE',
};

export function titleCase(s: string | null | undefined): string {
  if (!s) return '';
  const out = s
    .toLowerCase()
    .split(/(\s+|-|\/)/)
    .map((tok, i) => {
      if (!tok.trim() || tok === '/' || tok === '-') return tok;
      if (i > 0 && SMALL_WORDS.has(tok)) return tok;
      return tok.charAt(0).toUpperCase() + tok.slice(1);
    })
    .join('');
  return Object.entries(FIXUPS).reduce(
    (acc, [from, to]) => acc.replace(new RegExp(`\\b${from}\\b`, 'g'), to),
    out,
  );
}

/** "1035 - OM OLD MILTON" -> "Old Milton" */
export function cleanHood(h: string): string {
  return titleCase(h.replace(/^\d+\s*-\s*\w+\s+/, '').trim());
}

export function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export const TYPE_LABELS: Record<string, string> = {
  detached: 'Detached',
  semi: 'Semi',
  townhouse: 'Townhouse',
  condo: 'Condo',
};
