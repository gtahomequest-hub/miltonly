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

// VERSION 2 (MP-002, 2026-09-17). Adds the sign-in sentence: the site never asks for a
// password, and this text is where the consumer is told what their credential is. The TRREB
// VOW Policy's words are "username and a password"; MP-001's reading is that the emailed
// one-time link or code is the consumer's private, expiring credential, the email address the
// username, and the 90-day session ceiling (src/lib/auth.ts) the policy's validity period.
// That reading stands pending the broker of record's ruling. If the ruling is "a password",
// a password is added to the same account and this sentence is version 3.
export const VOW_ACKNOWLEDGEMENT_TEXT =
  "I confirm I have a bona fide interest in the purchase, sale, or lease of " +
  "residential real estate in the markets served by this website. I acknowledge " +
  "that this establishes a limited broker-consumer relationship with Aamir Yaqoob, " +
  "Salesperson, RE/MAX Realty Specialists Inc. (Membership #9541183), under the " +
  "Trust in Real Estate Services Act, 2002, for the sole purpose of accessing " +
  "MLS sold and leased data. I agree not to use this data for any commercial " +
  "purpose or redistribute it in any form. My email address is my username and " +
  "the one-time code or link sent to it is my credential; each sign-in lasts at " +
  "most 90 days, after which I confirm my email again.";
