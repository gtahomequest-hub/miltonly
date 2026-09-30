/**
 * @file Who the VOW is branded to, and the listing-page notices that name them (MC-047).
 * @module lib/compliance/registrant
 *
 * **Item 10, as TRREB reads it.** PropTx VOW Best Practices item 10 says a VOW "must be branded
 * only to that Member". TRREB's auditor wrote to Aamir on 2026-09-28 (the finding on
 * homesly.ca) that a VOW "must be branded to you, not just your Real Estate company". So the
 * header of every page type carries the registrant's name with the title RECO registers, and
 * the brokerage with its registered descriptor ", Brokerage". Both strings come from the config,
 * so the header, the footer's full line and the listing notices cannot disagree.
 *
 * **8.24, 8.12 and 8.16** (PropTx MLS® Rules, Article 8) are the three sentences a listing page
 * adds beside the MLS® content: what on the page is ours and where it came from, how to reach the
 * Member about the property, and how a listing brokerage reports an error in what we added.
 *
 * Import-free apart from the config, so client components (the nav, the ads pages) and the
 * prebuild guard read the same strings.
 */
import { config } from "@/lib/config";

/** "Aamir Yaqoob, Sales Representative". */
export const REGISTRANT_NAME_LINE = `${config.realtor.name}, ${config.realtor.title}`;

/** "RE/MAX Realty Specialists Inc., Brokerage": the registered name, descriptor included. */
export const REGISTRANT_BROKERAGE_LINE = config.brokerage.name;

/** og:site_name on every page (MC-047, A1): the site's name, then the Member it is branded to. */
export const OG_SITE_NAME = `${config.SITE_NAME} · ${REGISTRANT_NAME_LINE}`;

/** The homepage <title> (MC-047, A1): it names the Member. */
export const HOME_TITLE = `Milton Homes for Sale, Street by Street | ${config.realtor.name}`;

/** The footer's full line: the registrant, the brokerage, the phone. */
export const REGISTRANT_FULL_LINE = `${REGISTRANT_NAME_LINE} · ${REGISTRANT_BROKERAGE_LINE} · ${config.realtor.phone}`;

/**
 * MLS® Rule 8.24: listing content is shown as the MLS® System provides it, and anything added
 * is identified with its source. Sits above the first block a listing page adds.
 */
export const AUGMENTATION_LABEL =
  "From here down, added by Miltonly and not part of the MLS® listing. Nearby places and distances: Town of Milton open data (Open Government Licence – Milton). Commute times, the mortgage figures and the living area (the midpoint of the listing's range): Miltonly's figures.";

/**
 * MLS® Rule 8.12: a prominent way to reach the Member about any property displayed.
 * @param email the published contact address, or null when CONTACT_EMAIL is unset
 */
export function contactLine(email: string | null): string {
  return `Questions about this property: ${REGISTRANT_NAME_LINE}, ${REGISTRANT_BROKERAGE_LINE}, at ${config.realtor.phone}${email ? ` or ${email}` : ""}.`;
}

/**
 * MLS® Rule 8.16: the listing brokerage's way to report inaccurate added information, and the
 * 48 hours in which it is corrected.
 * @param email the published contact address, or null when CONTACT_EMAIL is unset
 */
export function reportInaccuracyLine(email: string | null): string {
  const how = email ? `write to ${email}` : `call ${config.realtor.phone}`;
  return `Listing brokerage: to report inaccurate information Miltonly has added to this listing, ${how}. It is corrected within 48 hours.`;
}
