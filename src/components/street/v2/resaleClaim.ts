// src/components/street/v2/resaleClaim.ts
// THE ONE resale-claim gate. Both street shells import this — the full shell (sections.tsx) and the
// minimal shell (StreetMinimalPage.tsx). There is exactly one predicate and one set of wording; if
// you are about to write "No resales" anywhere else, call this instead.
//
// WHY IT EXISTS: the minimal shell used to hardcode <h3>No resales recorded yet</h3> unconditionally
// while the full shell gated the same claim on hasAnySale. 14 published streets — several with a
// sale that closed days earlier — told buyers no home had ever resold there.
//
// THE PREDICATE is data.hasAnySale, computed once in buildStreetEnrichment from the sibling union.
// It asks only "does the record contain a resale on this street", with NO date guard: a firm sale
// whose closing date is next week is a recorded resale even though its price cannot be published
// yet. (The <= NOW() guard still governs every PRICE on the page — that is a separate question.)
//
// ABSENCE phrasing is true only where the record is genuinely empty. Every other sub-k5 street has
// a record that simply cannot support a published price -> SUPPRESSION phrasing.

export interface ResaleClaimCopy {
  /** true when the page is asserting that no resale exists — the claim that must never be false */
  claimsAbsence: boolean;
  /** trust-anchor heading (minimal shell) */
  heading: string;
  /** trust-anchor body (minimal shell); pass the shell's own absence prose for the zero case */
  body: string;
  /** buyer-CTA body (both shells) */
  ctaBody: string;
  /** minimal shell's "why we're showing you the area instead" sentence. Was hardcoded future-tense
   *  ("…until a home on X trades"), which asserts absence in different words — the same false claim
   *  in a component the first pass never touched. */
  areaFallbackLine: string;
  /** seller-CTA body. A thin street cannot honestly promise depth ("grounded in every sale we have
   *  tracked") — on two sales that reads as boilerplate written for rich streets. Same population
   *  gate as the buyer copy. */
  sellerBody: (streetName: string) => string;
  /** eyebrow + H2 for the area-context block on identity-tier pages. The heading used to be the
   *  flat literal "New to the record", keyed on TIER — so it rendered on 113 pages of which 90 had
   *  sales on record. A heading is scanned alone and is what gets lifted into search snippets and
   *  AI summaries, so the sentence beneath it does not rescue it. Gated on hasAnySale like
   *  everything else here. */
  areaEyebrow: string;
  areaHeading: string;
}

export function resaleClaim(
  shortName: string,
  hasAnySale: boolean,
  /** the minimal shell's existing, street-specific absence prose (view.noData) */
  absenceBody?: string,
): ResaleClaimCopy {
  if (hasAnySale) {
    return {
      claimsAbsence: false,
      heading: 'Too few recent sales to publish a price',
      body: `Homes have changed hands on ${shortName}, but not often enough recently for us to publish a typical price — the record's there, it just can't support a number yet. We'd rather show you nothing than a figure the record can't stand behind.`,
      // verbatim the suppression copy the full shell has always used
      ctaBody: `Too few recent sales on ${shortName} to publish a typical price yet — the record's there, it just can't support a number. Get an email the moment the next home here lists or closes.`,
      areaFallbackLine: `With too few recent sales on ${shortName} to price it on its own, the area read below is the closest honest signal we can give you.`,
      sellerBody: (streetName) =>
        `Few recent sales on ${streetName} means less to compare against — which is exactly when pricing needs judgement rather than a formula. A conversation grounded in what the record does show, and in the ${shortName} homes we've tracked.`,
      areaEyebrow: 'Where this street sits',
      // homes HAVE sold here — the record is thin, not empty. Same register as the heading above.
      areaHeading: 'Too few recent sales to price it on its own',
    };
  }
  return {
    claimsAbsence: true,
    heading: 'No resales recorded yet',
    body: absenceBody ?? `No resales recorded on ${shortName} yet — a real street with quiet turnover, not a page without homes.`,
    // verbatim the absence copy the full shell has always used
    ctaBody: `No resales recorded on ${shortName} yet — a real street with quiet turnover, not a page without homes. Get an email the moment one is listed or sold.`,
    areaFallbackLine: `The area read below is the closest market signal we can offer honestly until a home on ${shortName} trades.`,
    sellerBody: (streetName) =>
      `No resale on record for ${streetName} yet, so there is no local comparable to lean on — pricing here is a judgement call, and worth a conversation before you list.`,
    areaEyebrow: 'Where this street sits',
    // true only here: the record really is empty
    areaHeading: 'New to the record',
  };
}
