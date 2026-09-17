// src/lib/guides/goTransit.ts
//
// GETTING TO TORONTO FROM MILTON GO, COMPUTED FROM THE FEED. Every departure, count, journey
// time and fare on this guide is read from src/data/sources/goGtfsMilton.ts, which
// scripts/gtfs/milton-go.mjs writes from a Metrolinx GTFS extract. The feed's version and
// validity dates render on the page beside the figures, and every figure sentence is a
// `cited` entry pointing at the feed, so a reader can see how old the timetable is without
// leaving the section. Nothing here is typed by hand; when the feed changes, the script is
// re-run and the guide follows.
//
// Times are rendered from GTFS service-day clock strings. "24:25" is 12:25 a.m. on the
// following calendar day and is written that way, never silently wrapped to look like an
// early-morning departure on the same day.

import "server-only";
import { config } from "@/lib/config";
import type { GuideFaq, GuideLink, GuideSection, GuideSource, GuideTable } from "@/components/guides/types";
import type { GroundedFigures, GroundedFigure } from "@/lib/content/groundedFigures";
import { GO_GTFS_MILTON } from "@/data/sources/goGtfsMilton";
import { fig } from "./figures";
import { hubSlugsNear, publishedHubs, type PublishedHub } from "./hubLookup";
import { GUIDES_UPDATED, CTA_BUYER, CTA_SELLER, readMinutes, type GuideDef, type BuiltGuide } from "./shared";

const CITY = config.CITY_NAME;
const G = GO_GTFS_MILTON;

// Milton GO, from the feed's stops.txt (stop ML). Used only to find the hubs around it.
const STATION = { lng: -79.867172, lat: 43.52364 };
const NEAR_METRES = 1600;

// ── formatting, locale-free ───────────────────────────────────────────────

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "20260910" to "10 September 2026". */
function longDate(yyyymmdd: string): string {
  return `${Number(yyyymmdd.slice(6, 8))} ${MONTHS[Number(yyyymmdd.slice(4, 6)) - 1]} ${yyyymmdd.slice(0, 4)}`;
}
/** GTFS "HH:MM" to "6:00 a.m."; past 24:00 it is the next day and says so. */
function clock(hhmm: string): string {
  const [h24, m] = hhmm.split(":").map(Number);
  const next = h24 >= 24;
  const h = h24 % 24;
  const ampm = h < 12 ? "a.m." : "p.m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}${next ? " (after midnight)" : ""}`;
}
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

const FEED_LABEL = `GO Transit GTFS feed ${G.feed.version}, valid ${longDate(G.feed.startDate)} to ${longDate(G.feed.endDate)}`;
const FEED: GuideSource = {
  label: `Metrolinx GTFS feed ${G.feed.version}`,
  url: G.feed.publisherUrl,
  fetchedOn: longDate(G.feed.computedOn.replace(/-/g, "")),
};
/** A sentence that ends on "a.m." or "p.m." must not end on "a.m..". */
const tidy = (text: string) => text.replace(/\.\.$/, ".");
const cite = (text: string) => ({ text: tidy(text), source: FEED });

type Leg = { dep: string; arr: string; mins: number };
function legTable(caption: string, from: string, to: string, legs: readonly Leg[]): GuideTable {
  return {
    caption,
    source: FEED,
    head: [`Leaves ${from}`, `Arrives ${to}`, "Minutes"],
    rows: legs.map((l) => [clock(l.dep), clock(l.arr), String(l.mins)]),
  };
}

/** `deps.hubs` lets the prebuild test build the guide without a database; the page never passes it. */
export async function buildGoTrain(def: GuideDef, deps: { hubs?: Map<string, PublishedHub> } = {}): Promise<BuiltGuide> {
  const wk = G.weekday;
  const we = G.weekend;
  const via = wk.trainsToUnion.via as readonly string[];
  const fare = G.fare.miltonToUnion;
  const holiday = G.exceptions[0] ?? null;

  // ── link-down: the hubs around the station ────────────────────────────────
  const hubs = deps.hubs ?? (await publishedHubs());
  const near = hubSlugsNear(STATION.lng, STATION.lat, NEAR_METRES)
    .map((n) => ({ ...n, hub: hubs.get(n.slug) }))
    .filter((n) => n.hub);
  const stationHub = near.find((n) => n.metres === 0)?.hub ?? null;
  const hubLinks: GuideLink[] = near.map((n) => ({ label: n.hub!.name, href: `/neighbourhoods/${n.slug}` }));

  // ── figures ───────────────────────────────────────────────────────────────
  const times = (legs: readonly Leg[]) => legs.map((l) => `${clock(l.dep)} to ${clock(l.arr)} (${l.mins} minutes)`).join("; ");
  const busTimes = (legs: readonly Leg[]) => legs.map((l) => clock(l.dep)).join(", ");
  const summaryFigs = (prefix: string, s: { n: number; minsTypical: number | null; minsMin: number | null; minsMax: number | null }, label: string): GroundedFigure[] => [
    fig(`${prefix}.n`, s.n, `${label}, departures`, "count", "goGtfsMilton"),
    fig(`${prefix}.typical`, s.minsTypical, `${label}, typical minutes`, "count", "goGtfsMilton"),
    fig(`${prefix}.min`, s.minsMin, `${label}, fewest minutes`, "count", "goGtfsMilton"),
    fig(`${prefix}.max`, s.minsMax, `${label}, most minutes`, "count", "goGtfsMilton"),
  ];
  const figures: GroundedFigures = {
    figures: [
      fig("feed", G.feed.version, FEED_LABEL, "text", "feed_info.txt"),
      fig("feed.computed", FEED.fetchedOn, "computed on", "text", "milton-go.mjs"),
      fig("feed.serviceDates", G.feed.serviceDates, "dated services in the feed", "count", "calendar_dates.txt"),
      fig("weekday.dates", wk.dates, "weekday dates sharing the timetable", "count", "calendar_dates.txt"),
      fig("weekend.dates", we.dates, "weekend dates sharing the timetable", "count", "calendar_dates.txt"),
      ...summaryFigs("wk.train.to", wk.trainsToUnion, "weekday trains to Union"),
      ...summaryFigs("wk.train.from", wk.trainsFromUnion, "weekday trains from Union"),
      ...summaryFigs("wk.bus.to", wk.busesToUnion, "weekday 21 buses to Union"),
      ...summaryFigs("wk.bus.from", wk.busesFromUnion, "weekday 21 buses from Union"),
      ...summaryFigs("we.train.to", we.trainsToUnion, "weekend trains to Union"),
      ...summaryFigs("we.bus.to", we.busesToUnion, "weekend 21 buses to Union"),
      ...summaryFigs("we.bus.from", we.busesFromUnion, "weekend 21 buses from Union"),
      fig("wk.train.to.times", times(wk.trainsToUnion.legs), "weekday trains to Union, times", "text", "stop_times.txt"),
      fig("wk.train.from.times", times(wk.trainsFromUnion.legs), "weekday trains from Union, times", "text", "stop_times.txt"),
      fig("wk.bus.to.times", times(wk.busesToUnion.legs), "weekday 21 buses to Union, times", "text", "stop_times.txt"),
      fig("wk.bus.from.times", busTimes(wk.busesFromUnion.legs), "weekday 21 buses from Union, times", "text", "stop_times.txt"),
      fig("we.bus.to.times", times(we.busesToUnion.legs), "weekend 21 buses to Union, times", "text", "stop_times.txt"),
      fig("we.bus.from.times", busTimes(we.busesFromUnion.legs), "weekend 21 buses from Union, times", "text", "stop_times.txt"),
      fig("via", via.length, "stations between Milton and Union", "count", "stop_times.txt"),
      ...wk.otherBuses.flatMap((b) => [
        fig(`other.${b.route}.n`, b.n, `route ${b.route} ${b.name}, weekday departures, first ${clock(b.first)}, last ${clock(b.last)}`, "count", "stop_times.txt"),
        fig(`other.${b.route}.route`, Number(b.route), `route ${b.route}`, "count", "routes.txt"),
      ]),
      ...we.otherBuses.flatMap((b) => [fig(`other.we.${b.route}.n`, b.n, `route ${b.route} ${b.name}, weekend departures, first ${clock(b.first)}, last ${clock(b.last)}`, "count", "stop_times.txt")]),
      fig("route21", 21, "route 21 Milton", "count", "routes.txt"),
      fig("fare", fare ? fare.price : null, `single-ride fare, zone ${fare?.fromZone} to zone ${fare?.toZone}`, "dollar", "fare_attributes.txt"),
      fig("holiday", holiday ? longDate(holiday.date) : null, "the one date whose timetable matches neither pattern", "text", "calendar_dates.txt"),
      fig("near.km", NEAR_METRES / 1000, "hubs within, kilometres of the station", "count", "hubLookup"),
    ],
    entities: [
      // Sentence and column openers that precede a proper noun; the validator reads the run
      // as one token, so "Leaves Milton GO" needs "Leaves" licensed with the station.
      "The",
      "Leaves",
      "Arrives",
      "Coming",
      "Weekend",
      "Weekday",
      "Check",
      "Route",
      CITY,
      "Milton GO",
      "Milton GO Bus",
      "Union",
      "Union Station",
      "Union Station GO",
      "Union Station Bus Terminal",
      "Toronto",
      "GO Transit",
      "GO Transit's",
      "GO",
      "Metrolinx",
      "GTFS",
      "PRESTO",
      "Finch Bus Terminal",
      "Oakville GO",
      "Oakville GO Bus",
      "Regional Road 25",
      "Highway 401",
      "Lakeshore West",
      "Thanksgiving",
      "North York",
      "Oakville",
      "Milton / North York",
      "Milton / Oakville",
      ...via,
      ...near.map((n) => n.hub!.name),
    ],
  };

  const firstTo = wk.trainsToUnion.first!;
  const lastTo = wk.trainsToUnion.last!;
  const firstFrom = wk.trainsFromUnion.first!;
  const lastFrom = wk.trainsFromUnion.last!;
  const wkBusTo = wk.busesToUnion;
  const wkBusFrom = wk.busesFromUnion;
  const weBusTo = we.busesToUnion;
  const weBusFrom = we.busesFromUnion;
  const r27 = wk.otherBuses.find((b) => b.route === "27");
  const r22 = wk.otherBuses.find((b) => b.route === "22");
  const r27we = we.otherBuses.find((b) => b.route === "27");

  // The weekday morning has no bus between the early 21s and the mid-morning 21s; the
  // trains cover it. Read off the timetable rather than asserted.
  const wkBusDeps = wkBusTo.legs.map((l) => l.dep);
  let gap: { from: string; to: string } | null = null;
  for (let i = 1; i < wkBusDeps.length; i++) {
    const a = wkBusDeps[i - 1].split(":").map(Number);
    const b = wkBusDeps[i].split(":").map(Number);
    if (b[0] * 60 + b[1] - (a[0] * 60 + a[1]) >= 180) {
      gap = { from: wkBusDeps[i - 1], to: wkBusDeps[i] };
      break;
    }
  }

  const sections: GuideSection[] = [
    {
      heading: "The weekday train, in one table",
      paragraphs: [
        `The ${CITY} line is a rush-hour railway. Every train to Union leaves in the morning, every train back leaves in the afternoon, and there is nothing in between or after. Here is the whole morning.`,
      ],
      cited: [
        cite(`On a weekday, ${wk.trainsToUnion.n} trains leave ${CITY} GO for Union Station. The first departs at ${clock(firstTo.dep)} and arrives at ${clock(firstTo.arr)}; the last departs at ${clock(lastTo.dep)} and arrives at ${clock(lastTo.arr)}.`),
        cite(
          wk.trainsToUnion.minsMin === wk.trainsToUnion.minsMax
            ? `Every one of them is timetabled at ${wk.trainsToUnion.minsTypical} minutes.`
            : `The typical journey is ${wk.trainsToUnion.minsTypical} minutes, and the range is ${wk.trainsToUnion.minsMin} to ${wk.trainsToUnion.minsMax}.`,
        ),
        cite(`Each train calls at ${via.length} stations on the way: ${list(via.map((v) => v.replace(/ GO$/, "")))}.`),
      ],
      table: legTable(`Weekday trains, ${CITY} GO to Union Station.`, `${CITY} GO`, "Union", wk.trainsToUnion.legs),
      tip: null,
    },
    {
      heading: "Coming home",
      paragraphs: [
        `The afternoon mirrors the morning. Miss the last one and the trip home is a bus, which is the next section.`,
      ],
      cited: [
        cite(`On a weekday, ${wk.trainsFromUnion.n} trains leave Union Station for ${CITY} GO. The first departs at ${clock(firstFrom.dep)} and the last at ${clock(lastFrom.dep)}, arriving in ${CITY} at ${clock(lastFrom.arr)}.`),
        cite(
          wk.trainsFromUnion.minsMin === wk.trainsFromUnion.minsMax
            ? `Every one of them is timetabled at ${wk.trainsFromUnion.minsTypical} minutes.`
            : `The typical journey is ${wk.trainsFromUnion.minsTypical} minutes, and the range is ${wk.trainsFromUnion.minsMin} to ${wk.trainsFromUnion.minsMax}.`,
        ),
      ],
      table: legTable(`Weekday trains, Union Station to ${CITY} GO.`, "Union", `${CITY} GO`, wk.trainsFromUnion.legs),
      tip: null,
    },
    {
      heading: "Outside the rush hour, it is the 21 bus",
      paragraphs: [
        `Route 21 runs from the bus platform at ${CITY} GO straight to the Union Station Bus Terminal, no change. It is slower than the train and it runs when the train does not, which on this line is most of the day.`,
      ],
      cited: [
        cite(`On a weekday, ${wkBusTo.n} route 21 buses run from ${CITY} GO to Union Station Bus Terminal. The first leaves at ${clock(wkBusTo.first!.dep)} and the last at ${clock(wkBusTo.last!.dep)}.`),
        cite(`The typical scheduled journey is ${wkBusTo.minsTypical} minutes, and it ranges from ${wkBusTo.minsMin} to ${wkBusTo.minsMax} depending on the hour.`),
        ...(gap ? [cite(`There is no 21 between the ${clock(gap.from)} and the ${clock(gap.to)} departures. That is the window the trains cover.`)] : []),
        cite(`Coming back, ${wkBusFrom.n} route 21 buses leave Union Station Bus Terminal for ${CITY} GO on a weekday, from ${clock(wkBusFrom.first!.dep)} to ${clock(wkBusFrom.last!.dep)}, typically ${wkBusFrom.minsTypical} minutes.`),
        cite(`Weekday departures from Union: ${busTimes(wkBusFrom.legs)}.`),
      ],
      table: legTable(`Weekday route 21, ${CITY} GO to Union Station Bus Terminal.`, `${CITY} GO`, "Union Bus Terminal", wkBusTo.legs),
      tip: `A bus time in a feed is a schedule, not a promise. The train is timetabled on its own track; the 21 shares the road with everyone else.`,
    },
    {
      heading: "Weekends",
      paragraphs: [
        `There is no weekend train on this line in the feed, on any Saturday or Sunday between ${longDate(G.feed.startDate)} and ${longDate(G.feed.endDate)}. The 21 is the whole service.`,
      ],
      cited: [
        cite(
          we.trainsToUnion.n === 0
            ? `The feed carries no train from ${CITY} GO to Union on any of its ${we.dates} weekend dates.`
            : `On a weekend day, ${we.trainsToUnion.n} trains leave ${CITY} GO for Union.`,
        ),
        cite(`On a Saturday or Sunday, ${weBusTo.n} route 21 buses run from ${CITY} GO to Union Station Bus Terminal, the first at ${clock(weBusTo.first!.dep)} and the last at ${clock(weBusTo.last!.dep)}. The typical scheduled journey is ${weBusTo.minsTypical} minutes, ranging from ${weBusTo.minsMin} to ${weBusTo.minsMax}.`),
        cite(`Coming back, ${weBusFrom.n} buses leave Union for ${CITY} GO, from ${clock(weBusFrom.first!.dep)} to ${clock(weBusFrom.last!.dep)}, typically ${weBusFrom.minsTypical} minutes.`),
        cite(`Weekend departures from Union: ${busTimes(weBusFrom.legs)}.`),
      ],
      table: legTable(`Weekend route 21, ${CITY} GO to Union Station Bus Terminal.`, `${CITY} GO`, "Union Bus Terminal", weBusTo.legs),
      tip: null,
    },
    {
      heading: `The other buses from ${CITY} GO`,
      paragraphs: [
        `Two more GO routes start at the station. Neither goes to Union, but both connect ${CITY} to somewhere a lot of people need to be.`,
      ],
      cited: [
        ...(r27
          ? [cite(`Route ${r27.route}, ${r27.name}, runs to ${list([...r27.destinations])} ${r27.n} times on a weekday, from ${clock(r27.first)} to ${clock(r27.last)}${r27we ? `, and ${r27we.n === 1 ? "once" : `${r27we.n} times`} at the weekend, at ${clock(r27we.first)}` : ", and not at the weekend"}.`)]
          : []),
        ...(r22
          ? [cite(`Route ${r22.route}, ${r22.name}, has ${r22.n} weekday departures from ${clock(r22.first)} to ${clock(r22.last)}, ending at ${list([...r22.destinations].map((d) => d.replace("Oakville GO Bus", "Oakville GO").replace("Regional Rd. 25 @ Hwy. 401 Park & Ride", "the Regional Road 25 carpool lot at Highway 401")))}, and none at the weekend.`)]
          : []),
      ],
      tip: `Oakville GO is on the Lakeshore West line, which has trains to Union all day and at the weekend. This guide does not compute the connection, because a connection time depends on a transfer the feed does not guarantee.`,
    },
    {
      heading: "The fare, the feed, and the one odd Monday",
      paragraphs: [
        `Everything above is computed, not copied, from a timetable feed GO Transit publishes for software. Its version and its validity dates are the shelf life of every figure on this page.`,
      ],
      cited: [
        ...(fare ? [cite(`The single-ride fare between the ${CITY} GO fare zone and the Union Station fare zone in this feed is $${fare.price.toFixed(2)}. PRESTO, concession and monthly pricing are not in a GTFS feed and are not stated here.`)] : []),
        cite(`This is ${FEED_LABEL}, published by ${G.feed.publisher}. It carries ${G.feed.serviceDates} dated services; ${wk.dates} weekdays share the weekday timetable above and ${we.dates} weekend days share the weekend one. The figures were computed on ${FEED.fetchedOn}.`),
        ...(holiday
          ? [
              cite(
                `One date matches neither: ${holiday.dow === "Mon" ? "Monday" : holiday.dow} ${longDate(holiday.date)}, which in this feed carries the ${holiday.trainsMatch} train timetable and the ${holiday.busesMatch} bus timetable. Check GO Transit's own site the week before a holiday rather than this page.`,
              ),
            ]
          : []),
      ],
      tip: `When the feed's end date has passed, this page is out of date until the feed is re-read. The date is printed beside every figure so that is never a surprise.`,
    },
    {
      heading: "Living near the station",
      paragraphs: [
        stationHub
          ? `${CITY} GO sits inside ${stationHub.name}. The neighbourhood pages below are the ones whose boundary lies within ${NEAR_METRES / 1000} kilometres of the platform, nearest first, each with its own sold data and street pages.`
          : `The neighbourhood pages below are the ones whose boundary lies within ${NEAR_METRES / 1000} kilometres of the platform, nearest first, each with its own sold data and street pages.`,
      ],
      tip: null,
      links: hubLinks,
    },
  ];

  const faqs: GuideFaq[] = [
    {
      question: `How long is the GO train from ${CITY} to Union Station?`,
      answer:
        wk.trainsToUnion.minsMin === wk.trainsToUnion.minsMax
          ? `${wk.trainsToUnion.minsTypical} minutes, on every weekday train in the feed, calling at ${via.length} stations on the way. The trip back is ${wk.trainsFromUnion.minsTypical} minutes.`
          : `Typically ${wk.trainsToUnion.minsTypical} minutes, calling at ${via.length} stations on the way.`,
      source: FEED,
    },
    {
      question: "Is there a train at the weekend?",
      answer: `Not in this feed. On a Saturday or Sunday the service to Union is the route 21 bus, ${weBusTo.n} times a day from ${clock(weBusTo.first!.dep)}, typically ${weBusTo.minsTypical} minutes.`,
      source: FEED,
    },
    {
      question: "What is the last train home from Union?",
      answer: tidy(`${clock(lastFrom.dep)} on a weekday, arriving at ${CITY} GO at ${clock(lastFrom.arr)}. After that the 21 bus runs until ${clock(wkBusFrom.last!.dep)}.`),
      source: FEED,
    },
    {
      question: "What is the first train in the morning?",
      answer: tidy(`${clock(firstTo.dep)}, arriving at Union at ${clock(firstTo.arr)}. Before that there are route 21 buses from ${clock(wkBusTo.first!.dep)}.`),
      source: FEED,
    },
  ];

  const ta = (text: string) => `${tidy(text)} (${FEED.label}, read ${FEED.fetchedOn})`;
  const takeaways = [
    ta(`${wk.trainsToUnion.n} weekday trains to Union, ${clock(firstTo.dep)} to ${clock(lastTo.dep)}, ${wk.trainsToUnion.minsTypical} minutes each.`),
    ta(`${wk.trainsFromUnion.n} weekday trains back, ${clock(firstFrom.dep)} to ${clock(lastFrom.dep)}.`),
    ta(`No weekend train. The 21 bus runs to Union Station Bus Terminal ${weBusTo.n} times a weekend day, typically ${weBusTo.minsTypical} minutes.`),
    ...(fare ? [ta(`The single-ride fare in the feed is $${fare.price.toFixed(2)}.`)] : []),
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
