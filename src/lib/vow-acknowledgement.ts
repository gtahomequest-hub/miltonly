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

export const VOW_TERMS_VERSION = 4;

export interface VowClause {
  /** Appendix B(c) roman numeral, or "signin" for the house sentence. */
  key: "i" | "ii" | "iii" | "iv" | "v" | "vi" | "vii" | "viii" | "ix" | "signin";
  text: string;
  /** Rendered in bold on the card: Appendix B(c)(ix) says the consumer is to be "boldly" informed. */
  bold?: boolean;
}

export const VOW_TERMS_CLAUSES: readonly VowClause[] = [
  {
    key: "i",
    text:
      "I am entering into a lawful broker-consumer relationship with Aamir Yaqoob, Salesperson, " +
      "RE/MAX Realty Specialists Inc., Brokerage (TRREB membership #9541183), under the Trust in Real " +
      "Estate Services Act, 2002, for the purpose of accessing MLS® listing, sold and leased " +
      "information on this website (the VOW).",
  },
  {
    key: "ii",
    text: "All MLS® data I obtain through this VOW is for my personal, non-commercial use only.",
  },
  {
    key: "iii",
    text: "I have a bona fide interest in the purchase, sale or lease of real estate of the type offered through this VOW.",
  },
  {
    key: "iv",
    text:
      "I will not copy, redistribute, retransmit or otherwise use any of the data or information provided, " +
      "except in connection with my consideration of the purchase, sale or lease of an individual property.",
  },
  {
    key: "v",
    text:
      "I acknowledge that PropTx Innovations Inc. (PropTx) owns, and holds the copyright in, the MLS® " +
      "database, the data, the MLS® System and the Listing Information.",
  },
  {
    key: "vi",
    text:
      "I will not display, post, disseminate, distribute, publish, broadcast, transfer, sell or sublicense " +
      "any of the information, and I will not screen scrape, database scrape or data mine this VOW or its information.",
  },
  {
    key: "vii",
    text:
      "My agreement here, by a mouse click or a tap, is sufficient to acknowledge these terms. These terms " +
      "impose no financial obligation on me and do not create a representation agreement between me and the brokerage.",
  },
  {
    key: "viii",
    text:
      "I expressly authorize PropTx and other PropTx Members to access this VOW to verify compliance with the " +
      "MLS® rules and policies and to monitor the display of Members' listings.",
  },
  {
    key: "ix",
    bold: true,
    text:
      "I have read the privacy policy at miltonly.com/privacy and I consent to the collection, use and " +
      "disclosure of my personal information as it describes, including that my name, email address, username, " +
      "password record and my activity on this VOW may be shared with PropTx for auditing and/or legal purposes.",
  },
  {
    key: "signin",
    text:
      "My username is my email address and my password is mine alone; I will not share them. My password " +
      "expires 90 days after I set it and I renew or reconfirm it then. A sign-in ends after 60 minutes " +
      "without activity, and in any case 90 days after it began.",
  },
];

/** The literal text stored on the row and in VowConsent: the clauses, numbered, one per line. */
export const VOW_ACKNOWLEDGEMENT_TEXT = VOW_TERMS_CLAUSES.map((c, i) => `${i + 1}. ${c.text}`).join("\n");
