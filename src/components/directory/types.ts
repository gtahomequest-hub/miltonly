// src/components/directory/types.ts
// The shared contract for the Wave 2 directory/index family (/streets now;
// /neighbourhoods + /condos reuse next). Pages map their rows to DirectoryItem[]
// and hand them to <DirectoryGrid>; the grid owns search / A-Z / chip filtering
// and the forest card layout. Keep this presentation-only — no DB types here.

export interface DirectoryBadge {
  label: string;
  tone?: "new" | "vip";
}

export interface DirectoryMeta {
  label: string;
  tone?: "muted" | "active" | "accent";
}

export interface DirectoryItem {
  /** stable react key + filter identity */
  key: string;
  /** display title; also the A-Z bucket source (first char) and primary search field */
  name: string;
  /** destination — must resolve 200 (callers exclude non-resolving slugs) */
  href: string;
  /** extra text folded into the search match (e.g. neighbourhood) */
  searchExtra?: string;
  /** chip-filter bucket (e.g. neighbourhood); null = not chip-filterable */
  group?: string | null;
  /** small line under the title */
  subtitle?: string;
  /** big primary stat (pre-formatted, e.g. "$1.2M") */
  stat?: string;
  /** label under the primary stat */
  statLabel?: string;
  /** corner badges (NEW / VIP HUB …) */
  badges?: DirectoryBadge[];
  /** footer meta line items */
  meta?: DirectoryMeta[];
}

export interface DirectoryGridProps {
  items: DirectoryItem[];
  /** chip options (already sliced/ordered by the caller); omit to hide the chip row */
  groups?: string[];
  /** chip-row label, e.g. "Areas" */
  groupLabel?: string;
  /** "All …" reset chip label */
  groupAllLabel?: string;
  searchPlaceholder?: string;
  /** singular noun for the result count, e.g. "street" */
  itemNoun?: string;
  /** show the A-Z filter row (default true) */
  enableAZ?: boolean;
}
