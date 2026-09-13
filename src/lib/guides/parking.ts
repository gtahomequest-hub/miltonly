// src/lib/guides/parking.ts
//
// PARKING IN MILTON, FROM THE TOWN'S OWN PAGES AND NOTHING ELSE. Every rule sentence on this
// guide is a `cited` entry that carries the Town page it was read from and the date it was
// read, rendered beside the sentence. The paragraphs that are not cited state no rule: they
// say what the section is for, or what the Town's page does not say. The numbers the guide may
// use are PARKING_FACTS in src/data/sources/miltonParking.ts, which is the list the content
// validator checks the rendered prose against (scripts/test-content-guides.ts).
//
// "No inference beyond the text" (MCT-001). Where the Town's page is silent, this guide is
// silent too, and says so where a reader would expect an answer: there is no visitor permit,
// no list of streets with posted exceptions, and no fine amount on any fetched page.

import "server-only";
import { config } from "@/lib/config";
import type { GuideFaq, GuideLink, GuideSection, GuideSource } from "@/components/guides/types";
import type { GroundedFigures } from "@/lib/content/groundedFigures";
import { TOWN_PARKS } from "@/data/townPlaces";
import {
  PARKING_FACTS,
  PARKING_FETCHED_ON,
  PARKING_PORTALS,
  PARKING_SOURCES,
  PARKING_SURVEYS,
  PILOT_PARKS,
  parkingSource,
  type ParkingSourceId,
} from "@/data/sources/miltonParking";
import { fig } from "./figures";
import { hubSlugAt, publishedHubs, type PublishedHub } from "./hubLookup";
import { GUIDES_UPDATED, CTA_BUYER, CTA_SELLER, readMinutes, type GuideDef, type BuiltGuide } from "./shared";

const CITY = config.CITY_NAME;

const cite = (id: ParkingSourceId, text: string) => ({ text, source: parkingSource(id) });
const src = (id: ParkingSourceId): GuideSource => parkingSource(id);

/** Every proper noun the prose names. The validator flags any capitalised run not here.
 *  Each phrase is added whole and word by word with trailing punctuation stripped, because
 *  "Mary St." reaches the validator as the run "Mary St" and "Nov. 14" as "Nov". */
const ENTITY_PHRASES = [
  // Sentence openers that precede a proper noun ("The Town", "From April"). The validator
  // reads a capitalised run as one token, so the opener has to be licensed with the noun.
  "The",
  "What",
  "On",
  "From",
  "Through",
  CITY,
  "Town of Milton",
  "Town",
  "Town's",
  "Milton's",
  "Town Hall",
  "Mary St.",
  "Mary Street",
  "Council",
  "Engineering",
  "Development Services",
  "Ministry of Transportation",
  "Administrative Penalties System",
  "Provincial Offences Court",
  "Parking By-law No. 105-2019",
  "Road Fouling By-law No. 115-2005",
  "By-law",
  "By",
  "Ward",
  "No Parking Anytime",
  "Licence Plate Recognition",
  "Canada Post",
  "Ontario Vehicle Permit",
  "Chrome",
  "April",
  "Nov.",
  "Feb.",
  "Oct.",
  "Aug.",
  "Sept.",
  "Dec.",
  "Lot",
  "North",
  "South",
  "East",
  "West",
  ...PILOT_PARKS.map((p) => p.name),
  ...PARKING_SURVEYS.map((r) => r.location),
];
const ENTITIES = Array.from(
  new Set(ENTITY_PHRASES.flatMap((e) => [e, ...e.split(/\s+/).map((w) => w.replace(/[.,;:()]+$/, "").replace(/^[(]/, ""))])),
);

/** `deps.hubs` lets the prebuild test build the guide without a database; the page never passes it. */
export async function buildParking(def: GuideDef, deps: { hubs?: Map<string, PublishedHub> } = {}): Promise<BuiltGuide> {
  // ── figures: the fact list, plus the survey rows as quotable text ─────────
  const figures: GroundedFigures = {
    figures: [
      ...PARKING_FACTS.map((f) => fig(f.key, f.value, f.label, f.kind, PARKING_SOURCES[f.source].file)),
      ...PARKING_SURVEYS.map((r, i) =>
        fig(`survey.${i}`, `${r.location}, ${r.date}, ${r.request}, ${r.supportPct}%, ${r.result}`, "completed parking survey row", "text", PARKING_SOURCES.fifteenHour.file),
      ),
      ...PARKING_SURVEYS.map((r, i) => fig(`survey.${i}.pct`, r.supportPct, `${r.location}, homeowner support`, "percent", PARKING_SOURCES.fifteenHour.file)),
      fig("fetched", PARKING_FETCHED_ON, "date the Town's pages were read", "text", "curl"),
    ],
    entities: ENTITIES,
  };

  // ── link-down: each pilot park to the hub it sits in ──────────────────────
  const hubs = deps.hubs ?? (await publishedHubs());
  const parkHubs = new Map<string, GuideLink>();
  for (const p of PILOT_PARKS) {
    if (!p.townPark) continue;
    const row = TOWN_PARKS.find((t) => t.name.startsWith(p.townPark as string));
    if (!row) continue;
    const slug = hubSlugAt(row.lng, row.lat);
    const hub = slug ? hubs.get(slug) : undefined;
    if (hub && !parkHubs.has(hub.slug)) parkHubs.set(hub.slug, { label: hub.name, href: `/neighbourhoods/${hub.slug}` });
  }

  const wardList = (ward: 1 | 2 | 3 | 4) =>
    PILOT_PARKS.filter((p) => p.ward === ward)
      .map((p) => p.name)
      .join("; ");
  const winterLots = PILOT_PARKS.filter((p) => p.winterLot);
  const successful = PARKING_SURVEYS.filter((r) => r.result === "Successful");

  const sections: GuideSection[] = [
    {
      heading: "The two rules that cover most nights",
      paragraphs: [
        `Most parking questions in ${CITY} come down to two rules, and both are on the Town's regulations page. Everything else on this guide is a refinement of one or the other.`,
      ],
      cited: [
        cite("regulations", "There is a maximum five-hour street parking limit in Milton."),
        cite("fifteenHour", "You cannot park on the street between 2 and 6 a.m., unless otherwise posted."),
        cite("regulations", "There is no parking on streets during snowstorms and snow removal operations."),
      ],
      tip: `The Town's page does not list which streets carry a posted exception to the 2 to 6 a.m. rule. The sign on your street is the only source for that, and this guide does not guess at it.`,
      links: [{ label: "All the Town's parking pages, in one place", href: PARKING_SOURCES.parking.url }],
    },
    {
      heading: "Where you cannot park at all",
      paragraphs: [
        `Beyond the time limits, the regulations page lists the places a vehicle may never stand. Each of these is a sentence from that page, in the Town's order.`,
      ],
      cited: [
        cite("regulations", "No parking in any area where a No Parking Anytime sign is displayed."),
        cite("regulations", "No parking on a grass boulevard."),
        cite("regulations", "No parking on a boulevard within 50 metres of an intersection and within 3 metres of the curb line."),
        cite("regulations", "No parking within 3 metres of a fire hydrant."),
        cite("regulations", "No parking within 1 metre of a driveway."),
        cite("regulations", "No parking facing the wrong direction on the road."),
        cite("regulations", "No parking on or overhanging a sidewalk."),
        cite("regulations", "No parking in a manner that obstructs traffic, road repair or snow removal."),
        cite("regulations", "No parking on any highway for the purpose of displaying the vehicle for sale."),
        cite("regulations", "No parking in a space designated for persons with disabilities without displaying a valid disabled person's permit."),
        cite("regulations", "Parking is not permitted on grass boulevards, front or side yards, according to Parking By-law No. 105-2019."),
        cite("regulations", "A vehicle can park on the paved section of the driveway, facing the direction of traffic."),
        cite("regulations", "Vehicles parked on the landscaped section of the lawn, side yard or hanging over sidewalks or curbs may be ticketed."),
      ],
      tip: null,
    },
    {
      heading: "Winter: a storm suspends everything",
      paragraphs: [
        `The winter rule is not a schedule. It is triggered by the weather, and when it triggers it overrides every permit and exception on this page.`,
      ],
      cited: [
        cite("winter", "A winter storm happens when the weather makes snow clearing and parking difficult; usually heavy snowfall, freezing temperatures, or strong winds that cause drifting snow."),
        cite("winter", "When a winter storm occurs, street parking exception permits are suspended, and no cars can be parked on Milton roads."),
        cite("winter", "Vehicles left on the road during suspension may be ticketed or towed at the owner's expense."),
        cite("exceptions", "Parking exceptions obtained online are null and void during snow clearing operations. Your vehicle is never permitted to obstruct snow removal."),
        cite("winter", "Please do not shovel snow onto the road or sidewalk from your property. Placing snow on the roadway is a violation of Milton's Road Fouling By-law No. 115-2005."),
        cite("winter", "The Town maintains designated parking lots during winter for residents who normally rely on street parking permits. These lots are available when permits are suspended for snow removal."),
        cite("winter", "Parking in those lots is allowed for a 48-hour period."),
        cite("winter", `The ${winterLots.length} winter lots are the park lots listed under the overnight permit pilot below, less Cobban Neighbourhood Park, Milton Community Park and Sunny Mount Park, which the winter page does not list.`),
      ],
      tip: `The Town posts suspension notices on its social accounts, which the winter page links to. This site does not mirror them; when it snows, the Town's own channel is the one to read.`,
    },
    {
      heading: "Permits: parking longer than five hours, or overnight",
      paragraphs: [
        `There is no general visitor or resident permit in ${CITY}. The Town offers an exception instead, counted per licence plate, and a separate monthly permit for a lot in a park.`,
      ],
      cited: [
        cite("exceptions", "You can request a short-term parking exception to park on the street for more than five hours, or between 2 and 6 a.m."),
        cite("exceptions", "Each licence plate is allowed up to 25 exceptions per year."),
        cite("exceptions", "From April 15 to Nov. 14, you can request extended parking exceptions beyond the regular 25 per vehicle."),
        cite("exceptions", "To qualify for an extended exception you must use or book all 25 regular exceptions for all vehicles registered to your home, park at least one vehicle in your garage, and apply five business days before the start date."),
        cite("exceptions", "You can request a special parking exception for large vehicles that are longer than 6.7 metres or taller than 2.6 metres. Requests are accepted from April 15 to Nov. 14 and can be combined with your 25 regular exceptions."),
        cite("exceptions", "Parking exceptions will not be granted for commercial vehicles over 6.7 metres long or 2.6 metres high, school buses or commercial coaches, derelict or unlicensed vehicles, vehicles with expired stickers, or immobile trailers."),
        cite("exceptions", "The Town of Milton launched a one-year pilot program offering overnight parking permits in designated lots at municipal parks. There are 400 parking spaces available across all four wards."),
        cite("exceptions", "Permits cost $60 per month, are available on a first-come, first-served basis, and allow overnight parking for the full month in the lot of a designated park. To qualify, you must not have any outstanding parking violations."),
        cite("exceptions", "A full review of the program will be presented to Council in 2027. The pilot program will continue until then."),
        cite("exceptions", `Ward 1: ${wardList(1)}.`),
        cite("exceptions", `Ward 2: ${wardList(2)}.`),
        cite("exceptions", `Ward 3: ${wardList(3)}.`),
        cite("exceptions", `Ward 4: ${wardList(4)}.`),
        cite("exceptions", "Park only in areas marked by signs. Follow all parking rules."),
        cite("exceptions", "If you receive a parking ticket after obtaining a street parking exception, contact the Town within 24 hours. Failure to contact the Town within 24 hours may result in your ticket not being reviewed."),
      ],
      tip: `Book the exception before the night, not after. The neighbourhood links below go to the page for each pilot park's area.`,
      links: [
        { label: "Book a short-term exception", href: PARKING_PORTALS.shortTermException },
        { label: "Apply for an extended exception", href: PARKING_PORTALS.extendedException },
        { label: "Apply for a large-vehicle exception", href: PARKING_PORTALS.largeVehicleException },
        { label: "Apply for a monthly park permit", href: PARKING_PORTALS.overnightParkPermit },
        ...Array.from(parkHubs.values()),
      ],
    },
    {
      heading: "Permanent 15-hour parking on your street",
      paragraphs: [
        `A street can be re-signed for longer parking, but it is a petition, not an application, and the Town's own results table shows how it usually ends.`,
      ],
      cited: [
        cite("fifteenHour", "Residents in Milton may apply to get extended parking for up to 15 hours on one side of a residential street."),
        cite("fifteenHour", "Permanent 15-hour parking can only be requested by the homeowner. Non-homeowners must ask homeowners to submit a request."),
        cite("fifteenHour", "The process to look at permanent 15-hour parking takes anywhere between 2 and 3 months."),
        cite("fifteenHour", "The request goes to Engineering by email and should include the reason for requesting parking on your street. Once received, the Town conducts a site inspection to see if the street can support permanent 15-hour parking."),
        cite("fifteenHour", "You must gather signatures from 51 per cent of the homeowners on your street. If 51 per cent or more support it on the official questionnaire, the Town asks Council for an amendment to the parking by-law on your street, and new signs are installed."),
        cite("fifteenHour", "Permanent 15-hour parking will not take effect until all appropriate signs have been installed."),
        cite("fifteenHour", "Permanent 15-hour parking on one side of your street will result in no parking on the other side of the street at all times."),
        cite("fifteenHour", `The Town lists ${PARKING_SURVEYS.length} completed parking surveys, of which ${successful.length} were successful: ${successful.map((r) => r.location).join(", and ")}.`),
      ],
      table: {
        caption: "Completed parking survey results, as the Town lists them.",
        source: src("fifteenHour"),
        head: ["Date", "Location", "Requested", "Support", "Result"],
        rows: PARKING_SURVEYS.map((r) => [r.date, r.location, r.request, `${r.supportPct}%`, r.result]),
      },
      tip: null,
      links: [{ label: "Ask Engineering about your street", href: PARKING_PORTALS.fifteenHourRequest }],
    },
    {
      heading: "Tickets: where to check, how to pay, and the clock",
      paragraphs: [
        `Tickets in ${CITY} run through the Town's penalty portal rather than the courts. The portal is also where to look up whether a plate has a ticket against it, which matters now that some tickets arrive by post rather than under a wiper.`,
      ],
      cited: [
        cite("tickets", "On Feb. 1, 2022, the Town launched the Administrative Penalties System process, which moves disputes from the Provincial Offences Court to the Town's own screening and hearing officers."),
        cite("tickets", "You can pay online, with a $2.45 convenience fee, or in person at Town Hall at 150 Mary St., where acceptable payment methods are cash or debit."),
        cite("tickets", "You must either pay or choose to dispute the penalty notice within 30 days from the date that it was issued to avoid late payment or other administrative fees."),
        cite("tickets", "A screening officer looks at a dispute first and can lower the penalty amount, give more time to pay, or cancel the penalty. If you disagree with the screening decision you can ask for a hearing, and a hearing can only be requested once you have gone through screening."),
        cite("tickets", "A request for disclosure must be received by the Town at least 10 business days prior to a scheduled screening or hearing appointment."),
        cite("tickets", "If you do not respond by the due date, either by paying or by scheduling an initial screening review, you automatically waive your right to a review and the penalty is deemed upheld."),
        cite("tickets", "After 30 days, a $12 Ministry of Transportation search fee applies. After 60 days, a $36 late payment fee. After 75 days, a $31 fee for plate denial registration."),
        cite("tickets", "A $60 fee applies for failing to appear at a scheduled screening, and $118 for failing to appear at a scheduled hearing or for an adjournment requested during a hearing review."),
        cite("tickets", "If the penalty and fees remain unpaid, a notice of default is sent to the Ministry of Transportation, which results in your Ontario Vehicle Permit renewal being denied."),
        cite("lpr", "The Town is introducing Licence Plate Recognition software: cameras mounted on by-law enforcement vehicles capture images of vehicles in violation, and a ticket is issued and mailed to the registered owner with an image of the vehicle and plate."),
        cite("lpr", "In addition to the ticket fine, a $10 standard mail service fee applies to a mailed ticket. Enforcement will prioritise school and community safety zones, and overnight on-street parking compliance."),
        cite("tickets", "Questions about a parking ticket or penalty notice go to the Town by email or on 905-878-7252 ext. 2530."),
      ],
      tip: `None of the Town's fetched pages states the fine for a specific offence, so no fine amount appears on this guide. The portal shows the amount on the ticket itself.`,
      links: [
        { label: "Look up, pay or dispute a ticket", href: PARKING_PORTALS.payOrCheckTicket },
        { label: "Email the Town about a ticket", href: PARKING_PORTALS.clerksOffice },
      ],
    },
    {
      heading: "Sources",
      paragraphs: [
        `Every rule above was read from one of these seven Town of Milton pages on ${PARKING_FETCHED_ON}. The text of each page as read that day is stored with this site, so a later change on milton.ca can be seen as a change. If a sentence here and the Town's page disagree, the Town's page is current and this guide is behind.`,
      ],
      tip: null,
      links: (Object.keys(PARKING_SOURCES) as ParkingSourceId[]).map((id) => ({ label: PARKING_SOURCES[id].label, href: PARKING_SOURCES[id].url })),
    },
  ];

  const faqs: GuideFaq[] = [
    {
      question: `Can I park on the street overnight in ${CITY}?`,
      answer: `Not between 2 and 6 a.m. unless a sign on the street says otherwise, and not for longer than five hours at any time. A short-term exception booked through the Town covers a night, and each licence plate gets up to 25 of them a year.`,
      source: src("exceptions"),
    },
    {
      question: "Is there a visitor parking permit?",
      answer: `The Town's pages describe no visitor permit. A visitor's plate can be booked for a short-term exception the same way a resident's can, from the same 25-per-plate allowance.`,
      source: src("exceptions"),
    },
    {
      question: "What happens to my exception when it snows?",
      answer: `It is suspended. During a winter storm no cars can be parked on Milton roads, exceptions obtained online are null and void, and a vehicle left on the road may be ticketed or towed at the owner's expense. The Town keeps park lots open for 48 hours for people who normally rely on a permit.`,
      source: src("winter"),
    },
    {
      question: "How do I check whether I have a parking ticket?",
      answer: `The Town's penalty portal is where to look, and it is the same place you pay or dispute one. Search by the ticket or plate. You have 30 days from the date of issue to pay or dispute before fees start.`,
      source: src("tickets"),
    },
  ];

  // Takeaways are plain strings in the seam, so the citation rides inside the sentence.
  const ta = (text: string, id: ParkingSourceId) => `${text} (${PARKING_SOURCES[id].url.replace(/^https?:\/\//, "")}, read ${PARKING_FETCHED_ON})`;
  const takeaways = [
    ta(`Five hours is the limit on any ${CITY} street, and nothing between 2 and 6 a.m. unless posted.`, "regulations"),
    ta(`A plate gets 25 short-term exceptions a year; a monthly permit for a park lot is $60.`, "exceptions"),
    ta(`A winter storm suspends every exception and clears every road.`, "winter"),
    ta(`A ticket must be paid or disputed within 30 days, on the Town's portal.`, "tickets"),
  ];

  return {
    data: {
      slug: def.slug,
      title: def.title,
      dek: def.dek,
      category: { key: def.category, label: def.categoryLabel },
      readMinutes: readMinutes(sections, faqs),
      updated: GUIDES_UPDATED,
      takeaways,
      sections,
      faqs,
      related: [],
      ctaBuyer: CTA_BUYER,
      ctaSeller: CTA_SELLER,
    },
    figures,
  };
}
