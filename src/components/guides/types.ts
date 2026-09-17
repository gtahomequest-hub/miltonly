// src/components/guides/types.ts
// THE SEAM. Data window implements getGuidesIndexData(): Promise<GuidesIndexData>
// and getGuideArticle(slug): Promise<GuideArticleData | null>.
// Guides are editorial — content lives in the data layer, layout stays dumb.

export type GuideCategoryKey = 'buying' | 'selling' | 'renting' | 'living';

/** card-level summary, used on the index, in related rails, and as the featured pick */
export interface GuideTeaser {
  slug: string;
  title: string;
  dek: string;
  category: GuideCategoryKey;
  categoryLabel: string;
  readMinutes: number;
  updated: string; // "May 2026"
}

export interface GuideCategoryGroup {
  key: GuideCategoryKey;
  label: string;
  blurb: string; // eyebrow line above the label
  guides: GuideTeaser[];
}

export interface GuideCta {
  heading: string;
  body: string;
  buttonLabel: string;
  href: string;
}

export interface GuideStat {
  n: string;
  l: string;
}

export interface GuidesIndexData {
  heading: string;
  sub: string;
  stats: GuideStat[];
  featured: GuideTeaser | null;
  categories: GuideCategoryGroup[];
  ctaBuyer: GuideCta;
  ctaSeller: GuideCta;
}

/** a link out of a body section: the guides tier's link-down surface */
export interface GuideLink {
  label: string;
  href: string;
}

/**
 * Where a sentence came from, rendered beside it. Added 2026-09-11 for the two
 * source-grounded guides (parking, GO): a rule the Town publishes or a figure a
 * transit feed carries is only as good as its provenance, so the URL and the
 * date it was read render on the page, next to the sentence, not in a footnote.
 */
export interface GuideSource {
  label: string; // "Town of Milton, Parking regulations"
  url: string;
  fetchedOn: string; // "11 September 2026", rendered as written, never locale-formatted
}

/** a sentence that carries its own citation */
export interface GuideCited {
  text: string;
  source: GuideSource;
}

/** a small data table under a section; every cell is plain text */
export interface GuideTable {
  caption: string;
  head: string[];
  rows: string[][];
  source?: GuideSource;
}

/** one body section of an article; tip renders as a callout when present */
export interface GuideSection {
  heading: string;
  paragraphs: string[];
  tip: string | null;
  /** Cited sentences, rendered as a ledger after the paragraphs. Optional and additive. */
  cited?: GuideCited[];
  /** A data table, rendered after the cited ledger. Optional and additive. */
  table?: GuideTable;
  /**
   * Optional link row rendered under the paragraphs. Added 2026-09-10 because
   * `paragraphs: string[]` is plain text and cannot carry an anchor, which
   * left a guide unable to link down to the hub, street, listing or school
   * page its own figures were drawn from. Optional and additive: the preview
   * fixtures omit it and render exactly as before.
   */
  links?: GuideLink[];
}

export interface GuideFaq {
  question: string;
  answer: string;
  /** Optional citation rendered under the answer; the FAQ schema carries question and answer only. */
  source?: GuideSource;
}

export interface GuideArticleData {
  slug: string;
  title: string;
  dek: string;
  category: { key: GuideCategoryKey; label: string };
  readMinutes: number;
  updated: string;
  takeaways: string[]; // "The short version" card; empty -> hidden
  sections: GuideSection[];
  faqs: GuideFaq[];
  related: GuideTeaser[];
  ctaBuyer: GuideCta;
  ctaSeller: GuideCta;
}