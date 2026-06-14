// src/components/places/types.ts
// Shared prop contracts for the /mosques + /schools twin templates. Presentation
// only — the routes keep their own data/queries/JSON-LD and map into these.

import type { ReactNode } from "react";

export type BadgeTone = "blue" | "amber" | "green";

export interface PlaceBadge {
  label: string;
  tone?: BadgeTone;
}

/** One directory-grid card (a mosque or a school). */
export interface PlaceCard {
  slug: string;
  href: string;
  name: string;
  badge?: PlaceBadge; // board / type pill
  metaParts?: string[]; // "JK-8", "Timberlea", grades, etc.
  fraser?: string | null; // schools only — "8.2"
  note?: string | null;
  footer?: string; // "12 homes for sale nearby" / "View nearby listings"
  footerActive?: boolean;
  /** generic filter dimensions, e.g. { board:"public", level:"elementary", type:"masjid" } */
  filters?: Record<string, string>;
  /** lowercased text the search box matches (name + neighbourhood) */
  searchText: string;
}

/** A client-side filter chip group (board, level, type). */
export interface PlaceFilterGroup {
  key: string; // matches PlaceCard.filters key
  allLabel: string; // "All boards"
  options: { value: string; label: string }[];
}

export interface PlaceStat {
  value: string;
  label: string;
}

export interface PlaceFaq {
  question: string;
  answer: string;
}

export interface PlaceLink {
  name: string;
  href: string;
  price?: string;
  sub?: string;
}

/** Index template props. */
export interface PlaceDirectoryProps {
  breadcrumbLabel: string; // "Mosques"
  eyebrow: string;
  title: string;
  titleEm: string; // italic green segment
  subtitle: string;
  stats: PlaceStat[];
  items: PlaceCard[];
  filterGroups?: PlaceFilterGroup[];
  searchPlaceholder: string;
  itemNoun: string; // "mosque" / "school"
  prose: { heading: string; paragraphs: string[] };
  hoodLinks?: { heading: string; links: PlaceLink[] };
  faqs: PlaceFaq[];
  alert: { heading: string; body: string; form: ReactNode };
}

/** Detail template props. */
export interface PlaceDetailProps {
  breadcrumb: { label: string; href?: string }[];
  badge: PlaceBadge;
  heroEyebrow: string; // "Timberlea · Milton"
  title: string; // "Homes Near …"
  metaLine: string;
  highlight?: string | null; // Fraser pill
  serviceChips?: string[]; // mosque services
  stats: PlaceStat[];
  byType?: { type: string; count: number; avgPrice: string }[];
  listingsHeading: string;
  listings: ReactNode; // PlaceListings island
  streetsHeading: string;
  streets: PlaceLink[];
  siblingsHeading: string;
  siblings: { name: string; href: string; badge?: PlaceBadge; sub: string }[];
  faqs: PlaceFaq[];
  cta: { heading: string; body: string };
}
