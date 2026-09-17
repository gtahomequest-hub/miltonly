#!/usr/bin/env node
// MILTON GO <-> UNION, COMPUTED FROM THE GO TRANSIT GTFS FEED.
//
//   GTFS_DIR=D:/dashcam/work/gtfs/go node scripts/gtfs/milton-go.mjs
//
// Reads a Metrolinx GTFS extract and writes src/data/sources/goGtfsMilton.ts, the only
// source the /guides/milton-go-train-to-toronto guide reads. Nothing in the guide is typed
// by hand: every departure, journey time and count below is a row of stop_times.txt, and
// the feed's own version and validity dates ride with the figures so a reader can see how
// old they are. Re-run when the feed changes; the guide re-renders from the new file.
//
// What "weekday" and "weekend" mean here. This feed has no calendar.txt; every service is a
// single dated row in calendar_dates.txt, so a timetable is a set of dates. A date's pattern
// is the ordered list of its Milton departures. "Weekday" is the pattern most Monday-to-Friday
// dates share, "weekend" the pattern most Saturday and Sunday dates share, and any date that
// matches neither is listed under `exceptions` with what it actually carries, rather than
// being folded into an average.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

const DIR = (process.env.GTFS_DIR || "D:/dashcam/work/gtfs/go").replace(/\/?$/, "/");
const OUT = path.resolve("src/data/sources/goGtfsMilton.ts");
const COMPUTED_ON = new Date().toISOString().slice(0, 10);

const MILTON_RAIL = "ML";
const MILTON_BUS = "00194";
const UNION_RAIL = "UN";
const UNION_BUS = "02300";

const read = (f) => fs.readFileSync(DIR + f, "utf8").replace(/^\uFEFF/, "");
const rows = (f) => {
  const [h, ...rs] = read(f).split(/\r?\n/).filter(Boolean).map((l) => l.split(","));
  return rs.map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
};

const feed = rows("feed_info.txt")[0];
const routes = new Map(rows("routes.txt").map((r) => [r.route_id, r]));
const stops = new Map(rows("stops.txt").map((r) => [r.stop_id, r]));
const serviceDate = new Map(rows("calendar_dates.txt").filter((r) => r.exception_type === "1").map((r) => [r.service_id, r.date]));
const trips = new Map(rows("trips.txt").map((r) => [r.trip_id, r]));

// The feed's own fare between the two stations' zones: fare_rules maps an origin zone and a
// destination zone to a fare_id, fare_attributes carries its price. This is the single-ride
// fare the feed publishes and nothing more; concession and PRESTO pricing are not in a GTFS.
const fareBetween = (fromStop, toStop) => {
  const from = stops.get(fromStop)?.zone_id;
  const to = stops.get(toStop)?.zone_id;
  if (!from || !to) return null;
  const rule = rows("fare_rules.txt").find((r) => r.origin_id === from && r.destination_id === to);
  const attr = rule && rows("fare_attributes.txt").find((a) => a.fare_id === rule.fare_id);
  return attr ? { fareId: attr.fare_id, price: Number(attr.price), currency: attr.currency_type, fromZone: from, toZone: to } : null;
};

// stop_times.txt is ~120 MB; stream it and keep only trips that touch Milton.
const stopTimes = new Map();
const touchesMilton = new Set();
{
  const rl = readline.createInterface({ input: fs.createReadStream(DIR + "stop_times.txt") });
  let idx = null;
  for await (const line of rl) {
    const r = line.split(",");
    if (!idx) {
      idx = Object.fromEntries(r.map((k, i) => [k.replace(/^\uFEFF/, ""), i]));
      continue;
    }
    const trip = r[idx.trip_id];
    let list = stopTimes.get(trip);
    if (!list) stopTimes.set(trip, (list = []));
    list.push({ stop: r[idx.stop_id], seq: Number(r[idx.stop_sequence]), arr: r[idx.arrival_time], dep: r[idx.departure_time] });
    if (r[idx.stop_id] === MILTON_RAIL || r[idx.stop_id] === MILTON_BUS) touchesMilton.add(trip);
  }
}

const toMin = (t) => {
  const [h, m, s] = t.split(":").map(Number);
  return h * 60 + m + s / 60;
};
const hhmm = (t) => t.slice(0, 5);
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dowOf = (d) => DOW[new Date(`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T12:00:00Z`).getUTCDay()];

// ── per-date legs ─────────────────────────────────────────────────────────
const byDate = new Map();
const dateRec = (date) => {
  let d = byDate.get(date);
  if (!d) byDate.set(date, (d = { date, dow: dowOf(date), trainTo: [], trainFrom: [], busTo: [], busFrom: [], otherBus: [] }));
  return d;
};

for (const tripId of touchesMilton) {
  const t = trips.get(tripId);
  const date = serviceDate.get(t.service_id);
  if (!date) continue;
  const route = routes.get(t.route_id);
  const sts = stopTimes.get(tripId).sort((a, b) => a.seq - b.seq);
  const d = dateRec(date);
  if (route.route_type === "2") {
    const iM = sts.findIndex((s) => s.stop === MILTON_RAIL);
    const iU = sts.findIndex((s) => s.stop === UNION_RAIL);
    if (iM < 0 || iU < 0) continue;
    if (iM < iU) {
      d.trainTo.push({
        dep: hhmm(sts[iM].dep),
        arr: hhmm(sts[iU].arr),
        mins: Math.round(toMin(sts[iU].arr) - toMin(sts[iM].dep)),
        via: sts.slice(iM + 1, iU).map((s) => stops.get(s.stop)?.stop_name ?? s.stop),
      });
    } else {
      d.trainFrom.push({
        dep: hhmm(sts[iU].dep),
        arr: hhmm(sts[iM].arr),
        mins: Math.round(toMin(sts[iM].arr) - toMin(sts[iU].dep)),
        via: sts.slice(iU + 1, iM).map((s) => stops.get(s.stop)?.stop_name ?? s.stop),
      });
    }
  } else {
    const iM = sts.findIndex((s) => s.stop === MILTON_BUS);
    if (iM < 0) continue;
    const iU = sts.findIndex((s) => s.stop === UNION_BUS || s.stop === UNION_RAIL);
    const rec = { route: route.route_short_name, name: route.route_long_name, headsign: t.trip_headsign };
    if (iU > iM) {
      d.busTo.push({ ...rec, dep: hhmm(sts[iM].dep), arr: hhmm(sts[iU].arr), mins: Math.round(toMin(sts[iU].arr) - toMin(sts[iM].dep)) });
    } else if (iU >= 0 && iU < iM) {
      d.busFrom.push({ ...rec, dep: hhmm(sts[iU].dep), arr: hhmm(sts[iM].arr), mins: Math.round(toMin(sts[iM].arr) - toMin(sts[iU].dep)) });
    } else if (iM < sts.length - 1) {
      // a departure from Milton GO that does not reach Union
      d.otherBus.push({ ...rec, dep: hhmm(sts[iM].dep), last: stops.get(sts[sts.length - 1].stop)?.stop_name ?? sts[sts.length - 1].stop });
    }
  }
}

const byDep = (a, b) => toMin(a.dep + ":00") - toMin(b.dep + ":00");
const dates = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
for (const d of dates) for (const k of ["trainTo", "trainFrom", "busTo", "busFrom", "otherBus"]) d[k].sort(byDep);

// ── patterns ──────────────────────────────────────────────────────────────
const key = (d) => ["trainTo", "trainFrom", "busTo", "busFrom", "otherBus"].map((k) => d[k].map((x) => `${x.route ?? "T"}${x.dep}`).join("|")).join("#");
const modal = (set) => {
  const counts = new Map();
  for (const d of set) counts.set(key(d), (counts.get(key(d)) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
};
const weekdays = dates.filter((d) => !["Sat", "Sun"].includes(d.dow));
const weekends = dates.filter((d) => ["Sat", "Sun"].includes(d.dow));
const weekdayKey = modal(weekdays);
const weekendKey = modal(weekends);
const weekday = weekdays.find((d) => key(d) === weekdayKey);
const weekend = weekends.find((d) => key(d) === weekendKey);
const sig = (legs) => legs.map((x) => x.dep).join("|");
const exceptions = dates
  .filter((d) => key(d) !== (["Sat", "Sun"].includes(d.dow) ? weekendKey : weekdayKey))
  .map((d) => ({
    date: d.date,
    dow: d.dow,
    trainsMatch: sig(d.trainTo) === sig(weekday.trainTo) ? "weekday" : sig(d.trainTo) === sig(weekend.trainTo) ? "weekend" : "other",
    busesMatch: sig(d.busTo) === sig(weekday.busTo) ? "weekday" : sig(d.busTo) === sig(weekend.busTo) ? "weekend" : "other",
    trainsToUnion: d.trainTo.length,
    busesToUnion: d.busTo.length,
  }));

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  if (!s.length) return null;
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const summary = (legs) => ({
  n: legs.length,
  first: legs[0] ? { dep: legs[0].dep, arr: legs[0].arr } : null,
  last: legs.length ? { dep: legs[legs.length - 1].dep, arr: legs[legs.length - 1].arr } : null,
  minsTypical: legs.length ? Math.round(median(legs.map((l) => l.mins))) : null,
  minsMin: legs.length ? Math.min(...legs.map((l) => l.mins)) : null,
  minsMax: legs.length ? Math.max(...legs.map((l) => l.mins)) : null,
});
const otherSummary = (legs) => {
  const m = new Map();
  for (const l of legs) {
    let r = m.get(l.route);
    if (!r) m.set(l.route, (r = { route: l.route, name: l.name, n: 0, first: l.dep, last: l.dep, destinations: new Set() }));
    r.n++;
    if (toMin(l.dep + ":00") < toMin(r.first + ":00")) r.first = l.dep;
    if (toMin(l.dep + ":00") > toMin(r.last + ":00")) r.last = l.dep;
    r.destinations.add(l.last);
  }
  return [...m.values()].map((r) => ({ ...r, destinations: [...r.destinations].sort() }));
};
const strip = (legs) => legs.map(({ via, ...rest }) => rest);

const dayBlock = (d, dateSet) => ({
  dates: dateSet.filter((x) => key(x) === key(d)).length,
  trainsToUnion: { ...summary(d.trainTo), via: d.trainTo[0]?.via ?? [], legs: strip(d.trainTo) },
  trainsFromUnion: { ...summary(d.trainFrom), legs: strip(d.trainFrom) },
  busesToUnion: { ...summary(d.busTo), legs: d.busTo },
  busesFromUnion: { ...summary(d.busFrom), legs: d.busFrom },
  otherBuses: otherSummary(d.otherBus),
});

const out = {
  feed: {
    publisher: feed.feed_publisher_name,
    publisherUrl: feed.feed_publisher_url,
    version: feed.feed_version,
    startDate: feed.feed_start_date,
    endDate: feed.feed_end_date,
    computedOn: COMPUTED_ON,
    serviceDates: dates.length,
    firstServiceDate: dates[0]?.date ?? null,
    lastServiceDate: dates[dates.length - 1]?.date ?? null,
  },
  stops: {
    miltonRail: stops.get(MILTON_RAIL)?.stop_name,
    miltonBus: stops.get(MILTON_BUS)?.stop_name,
    unionRail: stops.get(UNION_RAIL)?.stop_name,
    unionBus: stops.get(UNION_BUS)?.stop_name,
  },
  fare: { miltonToUnion: fareBetween(MILTON_RAIL, UNION_RAIL), unionToMilton: fareBetween(UNION_RAIL, MILTON_RAIL) },
  weekday: dayBlock(weekday, weekdays),
  weekend: dayBlock(weekend, weekends),
  exceptions,
};

const header = `// src/data/sources/goGtfsMilton.ts
// GENERATED, do not hand-edit. Re-run: GTFS_DIR=<feed dir> node scripts/gtfs/milton-go.mjs
//
// Source : ${feed.feed_publisher_name} GTFS feed, version ${feed.feed_version}
//          valid ${feed.feed_start_date} to ${feed.feed_end_date}, ${dates.length} dated services
// Computed : ${COMPUTED_ON}
// Stops    : ${MILTON_RAIL} (${stops.get(MILTON_RAIL)?.stop_name}), ${MILTON_BUS} (${stops.get(MILTON_BUS)?.stop_name}),
//            ${UNION_RAIL} (${stops.get(UNION_RAIL)?.stop_name}), ${UNION_BUS} (${stops.get(UNION_BUS)?.stop_name})
//
// Times are GTFS service-day times: "24:25" is 12:25 a.m. on the following calendar day.
// A "weekday" is the pattern most Monday-to-Friday dates in the feed share, a "weekend" the
// pattern most Saturday and Sunday dates share; \`exceptions\` lists every date that matches
// neither, with what it carries instead.

`;
fs.writeFileSync(OUT, header + `export const GO_GTFS_MILTON = ${JSON.stringify(out, null, 2)} as const;\n`);
console.log(`wrote ${OUT}: feed ${feed.feed_version}, ${dates.length} dates, weekday trains to Union ${out.weekday.trainsToUnion.n}, weekend ${out.weekend.trainsToUnion.n}, exceptions ${exceptions.length}`);
