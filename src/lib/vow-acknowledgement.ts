// Single source of truth for the VOW bona-fide-interest acknowledgement text.
//
// VOW Datafeed Agreement §3.2 "Consumer" requires an established lawful
// broker-consumer relationship under TRESA 2002. §6.3(k) requires a prominent
// notice. We satisfy both by storing (a) the literal text the user saw,
// (b) a timestamp, (c) their IP, (d) their user agent — so an audit can
// reconstruct which version of the text a given consumer agreed to.
//
// IMPORTANT: if this text is changed, the change is a new version. The
// stored `vowAcknowledgementText` lets us prove the exact version each user
// agreed to even after the text rotates. Do not rewrite the historical text
// on existing users.

export const VOW_ACKNOWLEDGEMENT_TEXT =
  "I confirm I have a bona fide interest in the purchase, sale, or lease of " +
  "residential real estate in the markets served by this website. I acknowledge " +
  "that this establishes a limited broker-consumer relationship with Aamir Yaqoob, " +
  "Salesperson, RE/MAX Realty Specialists Inc. (Membership #9541183), under the " +
  "Trust in Real Estate Services Act, 2002, for the sole purpose of accessing " +
  "MLS sold and leased data. I agree not to use this data for any commercial " +
  "purpose or redistribute it in any form.";
