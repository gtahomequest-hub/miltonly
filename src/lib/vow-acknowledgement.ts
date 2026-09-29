// Single source of truth for the VOW terms of use the consumer agrees to.
//
// VOW Datafeed Agreement 3.2 "Consumer" requires an established lawful broker-consumer
// relationship under TRESA 2002; 6.3(k) requires a prominent notice. The PropTx VOW Best
// Practices, Appendix B(c), list nine clauses a Terms of Use must contain (MP-006). We satisfy
// all of it by storing (a) the literal text the user saw, (b) a timestamp, (c) their IP, (d)
// their user agent, and (e) the version number, so an audit can reconstruct which version of
// the text a given consumer agreed to.
//
// IMPORTANT: if this text is changed, bump VOW_TERMS_VERSION. A row whose stored version is
// lower than the current one owes a fresh agreement before any record is served
// (src/lib/vow-access.ts), and every agreement is appended to VowConsent, so the historical
// text on existing rows is never rewritten.
//
// VERSION 1 (Phase 2.5): the bona fide interest, the relationship, no commercial use.
// VERSION 2 (MP-002, 2026-09-17): the passwordless sign-in sentence.
// VERSION 3 (MP-002b, 2026-09-18): username and password, under R-805(c).
// VERSION 4 (MP-006, 2026-09-21): the nine Appendix B(c) clauses, each its own numbered
// paragraph, the privacy clause in bold on the card, and the sign-in sentence carrying the
// 90-day password and the 60-minute inactivity limit (R-8.06, R-8.13).
// VERSION 5 (MP-007, 2026-09-27): the nine clauses read word-for-word against Appendix B(c) in
// the PropTx PDF and corrected where they departed — clause (iv) says "Listing Information",
// clause (v) adds "the validity of PropTx's proprietary rights", clause (vi) adds "directly or
// indirectly" and "to another individual or entity", clause (viii) adds "or their duly
// authorized representatives". Clauses (iv) and (vi) carry the two Rule 8.09(d) and (e) "for
// greater certainty" AI sentences (no use of the data to train or feed AI, no automated
// extraction). Two clauses are added: Rule 8.09(g), the ownership of TRREB and PropTx, and the
// account-sharing prohibition (VOW Best Practices item 39). The clause-by-clause diff from v4
// is in scratchpad/reports/MP-007-proptx-standard.md.
// VERSION 6 (MC-047, 2026-09-29): TRREB's audit of homesly.ca (same registrant, same auditor)
// asked that clause (viii) authorize the Association as well as PropTx (Rule 8.11): it now names
// the Toronto Regional Real Estate Board (TRREB). Clause (ix) names TRREB beside PropTx too, so
// the consent says what /privacy says. Nothing else changed.

export const VOW_TERMS_VERSION = 6;

export interface VowClause {
  /** Appendix B(c) roman numeral, "own-g" for Rule 8.09(g), "share" for the account-sharing
   *  prohibition, or "signin" for the house sentence. */
  key: "i" | "ii" | "iii" | "iv" | "v" | "vi" | "vii" | "viii" | "ix" | "own-g" | "share" | "signin";
  text: string;
  /** Rendered in bold on the card: Appendix B(c)(ix) says the consumer is to be "boldly" informed. */
  bold?: boolean;
}

export const VOW_TERMS_CLAUSES: readonly VowClause[] = [
  {
    // Appendix B(c)(i): a lawful broker-consumer relationship with the Member.
    key: "i",
    text:
      "I am entering into a lawful broker-consumer relationship with Aamir Yaqoob, Sales " +
      "Representative, RE/MAX Realty Specialists Inc., Brokerage (TRREB membership #9541183), " +
      "under the Trust in Real Estate Services Act, 2002, for the purpose of accessing MLS® " +
      "listing, sold and leased information on this website (the VOW).",
  },
  {
    // Appendix B(c)(ii): all MLS® data is for the consumer's personal, non-commercial use.
    key: "ii",
    text: "All MLS® data I obtain through this VOW is for my personal, non-commercial use only.",
  },
  {
    // Appendix B(c)(iii): a bona fide interest.
    key: "iii",
    text: "I have a bona fide interest in the purchase, sale or lease of real estate of the type offered through this VOW.",
  },
  {
    // Appendix B(c)(iv), corrected to say "Listing Information" (v4 said "information"), with
    // the Rule 8.09(d) "for greater certainty" AI sentence.
    key: "iv",
    text:
      "I will not copy, redistribute, retransmit or otherwise use any of the data or Listing " +
      "Information provided, except in connection with my consideration of the purchase, sale " +
      "or lease of an individual property. For greater certainty, I am prohibited from using " +
      "any AI system or technology, or any other technology that has the effect of, or is " +
      "intended to, collect, store, reorganize, analyze, summarize or manipulate any Listing " +
      "Information or any related data.",
  },
  {
    // Appendix B(c)(v), corrected to add "the validity of PropTx's proprietary rights" (v4
    // omitted it) and to say "MLS® data" rather than "the data".
    key: "v",
    text:
      "I acknowledge PropTx Innovations Inc.'s (PropTx) ownership of, and the validity of " +
      "PropTx's proprietary rights and copyright in, the MLS® database, the MLS® data, PropTx's " +
      "MLS® System and the Listing Information.",
  },
  {
    // Appendix B(c)(vi), corrected to add "directly or indirectly" and "to another individual
    // or entity" (v4 omitted both), with the Rule 8.09(e) "for greater certainty" AI sentence.
    key: "vi",
    text:
      "I will not, directly or indirectly, display, post, disseminate, distribute, publish, " +
      "broadcast, transfer, sell or sublicense any Listing Information to another individual or " +
      "entity. The prohibited uses expressly include \"scraping\" (including \"screen scraping\" " +
      "and \"database scraping\"), \"data mining\" or any other activity intended to collect, " +
      "store, re-organize, summarize or manipulate any Listing Information or any related data. " +
      "For greater certainty, I am prohibited from directly or indirectly providing any Listing " +
      "Information to any AI system or technology.",
  },
  {
    // Appendix B(c)(vii): a mouse click is sufficient; no financial obligation; no
    // representation agreement.
    key: "vii",
    text:
      "My agreement here, by a mouse click or a tap, is sufficient to acknowledge these terms. These terms " +
      "impose no financial obligation on me and do not create a representation agreement between me and the brokerage.",
  },
  {
    // Appendix B(c)(viii), corrected to add "or their duly authorized representatives" (v4
    // omitted it), and TRREB, the Association, beside PropTx (v6, Rule 8.11).
    key: "viii",
    text:
      "I expressly authorize PropTx, the Toronto Regional Real Estate Board (TRREB), and other PropTx Members or their duly authorized " +
      "representatives, to access this VOW for the purposes of verifying compliance with the " +
      "MLS® Rules and Policies (including the VOW Rules) and monitoring the display of Members' listings.",
  },
  {
    // Appendix B(c)(ix): the privacy policy, boldly informing of and obtaining consent to the
    // collection, use and disclosure, including sharing with PropTx (and TRREB, v6).
    key: "ix",
    bold: true,
    text:
      "I have read the privacy policy at miltonly.com/privacy and I consent to the collection, use and " +
      "disclosure of my personal information as it describes, including that my name, email address, username, " +
      "password record and my activity on this VOW may be shared with PropTx and the Toronto Regional Real Estate Board " +
      "(TRREB) for auditing and/or legal purposes.",
  },
  {
    // Rule 8.09(g): the Association's ownership, naming TRREB and PropTx (beyond Appendix
    // B(c)(v), which names PropTx alone). Homesly carries the same clause; see D:\homesly
    // src/lib/auth/texts.ts OWNERSHIP_8_09_G.
    key: "own-g",
    text:
      "I acknowledge the ownership of, and the validity of the proprietary rights and copyright " +
      "in, the MLS® Database, the MLS® System, the Listing Information and any related " +
      "information of the Toronto Regional Real Estate Board (TRREB), the association of which " +
      "the brokerage is a member, and of PropTx Innovations Inc.",
  },
  {
    // The account-sharing prohibition (VOW Best Practices item 39; R-8.05(c) one credential per
    // consumer). A consumer must not lend the account or the credential to anyone.
    key: "share",
    text:
      "I will not share my username or password, let anyone else use my account, or create more " +
      "than one account, and I will not allow any other person or entity to gain access to or " +
      "use the contents of this VOW through my credentials.",
  },
  {
    // The house sentence (ours, not the Appendix's): the credential lifetime and the session
    // limits (R-8.06, R-8.13).
    key: "signin",
    text:
      "My username is my email address and my password is mine alone; I will not share them. My password " +
      "expires 90 days after I set it and I renew or reconfirm it then. A sign-in ends after 60 minutes " +
      "without activity, and in any case 90 days after it began.",
  },
];

/** The literal text stored on the row and in VowConsent: the clauses, numbered, one per line. */
export const VOW_ACKNOWLEDGEMENT_TEXT = VOW_TERMS_CLAUSES.map((c, i) => `${i + 1}. ${c.text}`).join("\n");
