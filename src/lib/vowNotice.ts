// The two consumer notices every VOW surface carries (PropTx VOW Best Practices item 22;
// MLS Rules 8.25). The first is PropTx's recommended wording, verbatim, no Oxford comma: the
// battery matches the string exactly. The second is the reliability statement the same item
// requires ("the data is deemed reliable but is not guaranteed accurate by PropTx"). Rendered
// together from here on every surface that shows listing data, so no copy can drift.
export const VOW_BONA_FIDE_NOTICE =
  "The information provided herein must only be used by consumers that have a bona fide interest in the purchase, sale or lease of real estate and may not be used for any commercial purpose or any other purpose.";

export const VOW_RELIABILITY_NOTICE =
  "The information is deemed reliable but is not guaranteed accurate by PropTx.";

/** Both sentences, one string, for a surface that renders plain text (an email, a plain p). */
export const VOW_NOTICES = `${VOW_BONA_FIDE_NOTICE} ${VOW_RELIABILITY_NOTICE}`;
