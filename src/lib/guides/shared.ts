// src/lib/guides/shared.ts
//
// What every guide builder needs and none should own: the registry row type, the built-guide
// shape, the shared CTAs, the "updated" stamp and the read-time rule. Split out of guides.ts
// on 2026-09-11 when the two source-grounded guides moved into their own files, so a builder
// file and the registry do not import each other in a cycle.

import { config } from "@/lib/config";
import type { GuideArticleData, GuideCategoryKey, GuideFaq, GuideSection } from "@/components/guides/types";
import type { GroundedFigures } from "@/lib/content/groundedFigures";

const CITY = config.CITY_NAME;
export const GUIDES_UPDATED = "September 2026";

export interface GuideDef {
  slug: string;
  title: string;
  dek: string;
  category: GuideCategoryKey;
  categoryLabel: string;
  /** The GSC query this page answers. Order of the registry array is the evidence order. */
  gscQuery: string;
  metaTitle: string;
  metaDescription: string;
}

export interface BuiltGuide {
  data: GuideArticleData;
  figures: GroundedFigures;
}

export const CTA_BUYER = {
  heading: `See what is for sale in ${CITY}`,
  body: `Every active listing on the board, with the street and neighbourhood pages behind each one.`,
  buttonLabel: "Browse listings",
  href: "/listings",
};
export const CTA_SELLER = {
  heading: "Find out what your home is worth",
  body: `A valuation built from ${CITY} sold data, not a national average.`,
  buttonLabel: "Get a valuation",
  href: "/sell#valuation",
};

/** Words on the page over 200 a minute, floor of two. Cited sentences and table cells count;
 *  they are read like anything else. */
export function readMinutes(sections: GuideSection[], faqs: GuideFaq[]): number {
  const wc = (s: string) => s.split(/\s+/).filter(Boolean).length;
  const words =
    sections.reduce(
      (n, s) =>
        n +
        wc(s.paragraphs.join(" ")) +
        (s.tip ? wc(s.tip) : 0) +
        (s.cited ?? []).reduce((m, c) => m + wc(c.text), 0) +
        (s.table ? s.table.rows.reduce((m, r) => m + wc(r.join(" ")), 0) : 0),
      0,
    ) + faqs.reduce((n, f) => n + wc(f.question) + wc(f.answer), 0);
  return Math.max(2, Math.round(words / 200));
}
