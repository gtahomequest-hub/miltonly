// src/data/sources/miltonParking.ts
//
// THE TOWN OF MILTON'S PARKING PAGES, AS READ ON 2026-09-11. The verbatim text of each page
// sits beside this file in ./milton-parking/<id>.txt with its URL, the fetch date and the
// SHA-256 of the HTML it was extracted from. This module is the typed index of those files
// and the list of facts the parking guide is allowed to state. A fact not in this list is not
// on the page, and nothing here is inferred: every value is a number or a phrase that appears
// in the fetched text, and every fact names the file it came from.
//
// Re-fetch: curl each URL, re-run the extraction recorded in the .txt header, diff, then
// update PARKING_FETCHED_ON and PARKING_FETCHED_ON_ISO together. Never one without the other.

import type { GuideSource } from "@/components/guides/types";

export const PARKING_FETCHED_ON_ISO = "2026-09-11";
/** Rendered as written. Not locale-formatted: report 064 caught a date that rendered two ways. */
export const PARKING_FETCHED_ON = "11 September 2026";

export type ParkingSourceId =
  | "parking"
  | "regulations"
  | "exceptions"
  | "winter"
  | "fifteenHour"
  | "tickets"
  | "lpr";

export interface ParkingSourcePage {
  id: ParkingSourceId;
  /** Short label, rendered beside every sentence drawn from the page. */
  label: string;
  url: string;
  /** Relative to this directory. */
  file: string;
}

export const PARKING_SOURCES: Record<ParkingSourceId, ParkingSourcePage> = {
  parking: {
    id: "parking",
    label: "Town of Milton, Parking",
    url: "https://www.milton.ca/en/living-in-milton/parking.aspx",
    file: "milton-parking/parking.txt",
  },
  regulations: {
    id: "regulations",
    label: "Town of Milton, Parking regulations",
    url: "https://www.milton.ca/en/living-in-milton/parking-regulations.aspx",
    file: "milton-parking/parking-regulations.txt",
  },
  exceptions: {
    id: "exceptions",
    label: "Town of Milton, Parking exceptions and permits",
    url: "https://www.milton.ca/en/living-in-milton/parking-exceptions.aspx",
    file: "milton-parking/parking-exceptions.txt",
  },
  winter: {
    id: "winter",
    label: "Town of Milton, Winter parking",
    url: "https://www.milton.ca/en/living-in-milton/winter-parking.aspx",
    file: "milton-parking/winter-parking.txt",
  },
  fifteenHour: {
    id: "fifteenHour",
    label: "Town of Milton, Permanent 15-hour parking",
    url: "https://www.milton.ca/en/living-in-milton/permanent-extended-15-hour-parking.aspx",
    file: "milton-parking/permanent-extended-15-hour-parking.txt",
  },
  tickets: {
    id: "tickets",
    label: "Town of Milton, Parking tickets and penalty notices",
    url: "https://www.milton.ca/en/town-hall/parking-tickets-and-penalty-notices.aspx",
    file: "milton-parking/parking-tickets-and-penalty-notices.txt",
  },
  lpr: {
    id: "lpr",
    label: "Town of Milton, Licence plate recognition",
    url: "https://www.milton.ca/en/living-in-milton/licence-plate-recognition-lpr.aspx",
    file: "milton-parking/licence-plate-recognition-lpr.txt",
  },
};

export function parkingSource(id: ParkingSourceId): GuideSource {
  const s = PARKING_SOURCES[id];
  return { label: s.label, url: s.url, fetchedOn: PARKING_FETCHED_ON };
}

/** Links the Town's pages point at. Rendered as link-outs, never restated as rules. */
export const PARKING_PORTALS = {
  payOrCheckTicket: "https://portal.gtechna.com/userportal/milton/ticketSearch1.xhtml",
  shortTermException: "https://exceptions.milton.ca/userportal/visitorpass/",
  extendedException: "https://forms.milton.ca/ePay/Permits/Extended-On-Street-Parking-Application",
  largeVehicleException: "https://forms.milton.ca/ePay/Permits/Special-Parking-Exceptions",
  overnightParkPermit: "https://milton.gtechna.net/permit-portal/",
  fifteenHourRequest: "https://forms.milton.ca/ContactUs/Engineering",
  clerksOffice: "https://forms.milton.ca/ContactUs/Town-Clerks-Office",
} as const;

/**
 * Every number the guide may state, with the page it appears on. The content validator
 * checks the rendered prose against exactly this list, so a figure that is not here cannot
 * reach the page, and a figure that is here can be traced to a line of the fetched text.
 */
export interface ParkingFact {
  key: string;
  value: number;
  kind: "count" | "dollar" | "percent";
  label: string;
  source: ParkingSourceId;
}

export const PARKING_FACTS: readonly ParkingFact[] = [
  { key: "limit.hours", value: 5, kind: "count", label: "maximum street parking, hours", source: "regulations" },
  { key: "overnight.from", value: 2, kind: "count", label: "no street parking from, a.m.", source: "regulations" },
  { key: "overnight.to", value: 6, kind: "count", label: "no street parking until, a.m.", source: "regulations" },
  { key: "boulevard.intersectionMetres", value: 50, kind: "count", label: "no boulevard parking within, metres of an intersection", source: "regulations" },
  { key: "boulevard.curbMetres", value: 3, kind: "count", label: "and within, metres of the curb line", source: "regulations" },
  { key: "hydrant.metres", value: 3, kind: "count", label: "no parking within, metres of a fire hydrant", source: "regulations" },
  { key: "driveway.metres", value: 1, kind: "count", label: "no parking within, metre of a driveway", source: "regulations" },
  { key: "bylaw.parking", value: 105, kind: "count", label: "Parking By-law No. 105-2019", source: "regulations" },
  { key: "bylaw.parkingYear", value: 2019, kind: "count", label: "Parking By-law No. 105-2019", source: "regulations" },
  { key: "exceptions.perPlate", value: 25, kind: "count", label: "short-term exceptions per licence plate per year", source: "exceptions" },
  { key: "exceptions.windowFromDay", value: 15, kind: "count", label: "extended and large-vehicle exceptions accepted from April 15", source: "exceptions" },
  { key: "exceptions.windowToDay", value: 14, kind: "count", label: "to Nov. 14", source: "exceptions" },
  { key: "exceptions.leadDays", value: 5, kind: "count", label: "apply five business days before the start date", source: "exceptions" },
  { key: "large.lengthMetres", value: 6.7, kind: "count", label: "large vehicle, longer than, metres", source: "exceptions" },
  { key: "large.heightMetres", value: 2.6, kind: "count", label: "large vehicle, taller than, metres", source: "exceptions" },
  { key: "pilot.monthly", value: 60, kind: "dollar", label: "overnight park permit, per month", source: "exceptions" },
  { key: "pilot.spaces", value: 400, kind: "count", label: "overnight park permit spaces across four wards", source: "exceptions" },
  { key: "pilot.wards", value: 4, kind: "count", label: "wards", source: "exceptions" },
  { key: "pilot.reviewYear", value: 2027, kind: "count", label: "pilot review presented to Council in 2027", source: "exceptions" },
  { key: "pilot.parks", value: 15, kind: "count", label: "participating parks listed", source: "exceptions" },
  { key: "ticket.contactHours", value: 24, kind: "count", label: "contact the Town within, hours if ticketed after obtaining an exception", source: "exceptions" },
  { key: "winter.lotHours", value: 48, kind: "count", label: "winter alternative lots, parking allowed for a period of, hours", source: "winter" },
  { key: "winter.lots", value: 12, kind: "count", label: "winter alternative lots listed", source: "winter" },
  { key: "bylaw.roadFouling", value: 115, kind: "count", label: "Road Fouling By-law No. 115-2005", source: "winter" },
  { key: "bylaw.roadFoulingYear", value: 2005, kind: "count", label: "Road Fouling By-law No. 115-2005", source: "winter" },
  { key: "fifteen.hours", value: 15, kind: "count", label: "permanent extended parking, up to, hours, one side of a residential street", source: "fifteenHour" },
  { key: "fifteen.monthsMin", value: 2, kind: "count", label: "process takes between 2-3 months", source: "fifteenHour" },
  { key: "fifteen.monthsMax", value: 3, kind: "count", label: "process takes between 2-3 months", source: "fifteenHour" },
  { key: "fifteen.supportPct", value: 51, kind: "percent", label: "homeowner support required, per cent", source: "fifteenHour" },
  { key: "fifteen.surveys", value: 13, kind: "count", label: "completed parking survey results listed", source: "fifteenHour" },
  { key: "fifteen.surveysSuccessful", value: 2, kind: "count", label: "of which successful", source: "fifteenHour" },
  { key: "hall.number", value: 150, kind: "count", label: "Town Hall, 150 Mary St., Monday to Friday, 8:30 a.m. to 4:30 p.m.", source: "tickets" },
  { key: "ticket.onlineFee", value: 2.45, kind: "dollar", label: "online payment convenience fee", source: "tickets" },
  { key: "ticket.responseDays", value: 30, kind: "count", label: "pay or dispute within, days of issue", source: "tickets" },
  { key: "ticket.disclosureDays", value: 10, kind: "count", label: "request for disclosure at least, business days before a screening or hearing", source: "tickets" },
  { key: "ticket.hearingContactDays", value: 5, kind: "count", label: "a representative will contact you within five business days", source: "tickets" },
  { key: "fee.mtoSearch", value: 12, kind: "dollar", label: "after 30 days, MTO search fee", source: "tickets" },
  { key: "fee.late", value: 36, kind: "dollar", label: "after 60 days, late payment fee", source: "tickets" },
  { key: "fee.lateDays", value: 60, kind: "count", label: "after 60 days", source: "tickets" },
  { key: "fee.plateDenial", value: 31, kind: "dollar", label: "after 75 days, plate denial registration", source: "tickets" },
  { key: "fee.plateDenialDays", value: 75, kind: "count", label: "after 75 days", source: "tickets" },
  { key: "fee.screeningNoShow", value: 60, kind: "dollar", label: "screening no-show fee", source: "tickets" },
  { key: "fee.hearingNoShow", value: 118, kind: "dollar", label: "hearing no-show fee, and adjournment fee", source: "tickets" },
  { key: "fee.registeredMail", value: 23, kind: "dollar", label: "registered mail service fee", source: "tickets" },
  { key: "fee.regularMail", value: 10, kind: "dollar", label: "regular mail service fee, and the LPR standard-mail fee", source: "tickets" },
  { key: "fee.corporateSearch", value: 153, kind: "dollar", label: "corporate search fee", source: "tickets" },
  { key: "fee.parcelSearch", value: 143, kind: "dollar", label: "parcel search fee", source: "tickets" },
  { key: "aps.launchYear", value: 2022, kind: "count", label: "APS launched Feb. 1, 2022", source: "tickets" },
  { key: "aps.launchDay", value: 1, kind: "count", label: "APS launched Feb. 1, 2022", source: "tickets" },
  { key: "hall.phone", value: 905, kind: "count", label: "905-878-7252 ext. 2530", source: "tickets" },
  { key: "hall.phone2", value: 878, kind: "count", label: "905-878-7252 ext. 2530", source: "tickets" },
  { key: "hall.phone3", value: 7252, kind: "count", label: "905-878-7252 ext. 2530", source: "tickets" },
  { key: "hall.ext", value: 2530, kind: "count", label: "905-878-7252 ext. 2530", source: "tickets" },
];

/**
 * The parks in the Town's one-year overnight parking pilot, by ward, as the exceptions page
 * lists them. `townPark` is the matching row of src/data/townPlaces.ts (the Town's own parks
 * layer) so the guide can link the park to the neighbourhood page it sits in; the two datasets
 * spell some names differently ("Clark" against "Clarke", "Lions Park" against "Lions Sports
 * Park") and the pairing is made here, once, where it can be read.
 */
export interface PilotPark {
  ward: 1 | 2 | 3 | 4;
  /** As the Town's exceptions page prints it. */
  name: string;
  /** Prefix of the matching TOWN_PARKS name; null when the parks layer has no such row. */
  townPark: string | null;
  /** Also listed as a winter alternative lot on the winter parking page. */
  winterLot: boolean;
}

export const PILOT_PARKS: readonly PilotPark[] = [
  { ward: 1, name: "Brian Best Park (North and South)", townPark: "Brian Best Park", winterLot: true },
  { ward: 1, name: "Bronte Meadows Park", townPark: "Bronte Meadows Park", winterLot: true },
  { ward: 1, name: "Scott Neighbourhood Park (East Lot)", townPark: "Scott Neighbourhood Park - East", winterLot: true },
  { ward: 1, name: "Sherwood District Park", townPark: "Sherwood District Park", winterLot: true },
  { ward: 2, name: "Clark Neighbourhood Park (North and South)", townPark: "Clarke Neighbourhood Park", winterLot: true },
  { ward: 2, name: "Laurier Park", townPark: "Laurier Park", winterLot: true },
  { ward: 2, name: "Lions Park (East Lot)", townPark: "Lions Sports Park", winterLot: true },
  { ward: 3, name: "Beaty Neighbourhood Park (South Lot)", townPark: "Beaty Neighbourhood Park - South", winterLot: true },
  { ward: 3, name: "Coates Neighbourhood Park (North and South)", townPark: "Coates Neighbourhood Park North", winterLot: true },
  { ward: 3, name: "Cobban Neighbourhood Park", townPark: "Cobban Neighbourhood Park", winterLot: false },
  { ward: 4, name: "Ford Neighbourhood Park", townPark: "Ford Neighbourhood Park", winterLot: true },
  { ward: 4, name: "Milton Community Park", townPark: "Milton Community Park", winterLot: false },
  { ward: 4, name: "Optimist Neighbourhood Park", townPark: "Optimist Park", winterLot: true },
  { ward: 4, name: "Sunny Mount Park", townPark: "Sunny Mount Park", winterLot: false },
  { ward: 4, name: "Willmott Neighbourhood Park", townPark: "Willmott Neighbourhood Park", winterLot: true },
];

/** The completed parking survey table, row for row, from the permanent 15-hour page. */
export interface ParkingSurveyRow {
  location: string;
  date: string;
  request: string;
  supportPct: number;
  result: "Successful" | "Unsuccessful";
}

export const PARKING_SURVEYS: readonly ParkingSurveyRow[] = [
  { location: "Bennett Boulevard, Lee's Gate to Cooper Avenue", date: "Oct. 25, 2021", request: "15-hour parking anytime", supportPct: 13, result: "Unsuccessful" },
  { location: "Lemieux Court", date: "Aug. 25, 2021", request: "15-hour parking anytime", supportPct: 4, result: "Unsuccessful" },
  { location: "651 Farmstead Drive", date: "June 28, 2021", request: "15-hour parking anytime", supportPct: 40, result: "Unsuccessful" },
  { location: "John Street", date: "March 15, 2021", request: "South side, no parking anytime", supportPct: 18, result: "Unsuccessful" },
  { location: "Izumi Gate", date: "Feb. 1, 2021", request: "15-hour parking anytime", supportPct: 3, result: "Unsuccessful" },
  { location: "Tasker Court", date: "Dec. 14, 2020", request: "15-hour parking anytime", supportPct: 67, result: "Successful" },
  { location: "Anne Boulevard, Meadowbrook Drive and Vanier Drive", date: "Nov. 9, 2022", request: "Parking prohibition", supportPct: 20, result: "Unsuccessful" },
  { location: "Meadowbrook Drive", date: "Nov. 9, 2022", request: "Parking prohibition", supportPct: 18, result: "Unsuccessful" },
  { location: "Robert Street", date: "Dec. 6, 2022", request: "Parking prohibition", supportPct: 4, result: "Unsuccessful" },
  { location: "Ashbrook Court", date: "Dec. 6, 2022", request: "Parking prohibition", supportPct: 43, result: "Unsuccessful" },
  { location: "Bessborough Drive, house 540 to 566", date: "Sept. 8, 2023", request: "Reversal parking regulation", supportPct: 75, result: "Successful" },
  { location: "Mowat Lane", date: "Oct. 13, 2023", request: "15 hour parking anytime", supportPct: 22, result: "Unsuccessful" },
  { location: "Severn Drive", date: "Dec. 6, 2023", request: "15 hour parking anytime", supportPct: 43, result: "Unsuccessful" },
];
