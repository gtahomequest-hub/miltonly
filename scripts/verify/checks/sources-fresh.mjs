// EVERY STORED SOURCE UNDER src/data/sources IS INSIDE ITS WINDOW.
//
// The parking guide is built from seven milton.ca pages fetched on one day and stored as text;
// the GO guide is computed from one GTFS feed with a stated validity. Neither page has any way
// to know that its ground has moved: the Town rewrites a parking page, Metrolinx publishes the
// winter timetable, and the guide goes on stating the old thing with a read date beside it. So
// each source declares a window and this check fails the battery when any window has closed:
//
//   · GTFS: today must be on or before the feed's endDate (2026-11-27 for feed 20260910145058)
//   · Town pages: fetched no more than PARKING_MAX_AGE_DAYS ago (90)
//
// It reads the source files themselves (a JSON literal and a dated constant), never the guide
// that renders them, so a guide that quietly stopped showing its dates could not hide a stale
// source. wholeCorpusOnly: it reads the working tree, not a page. FAILING IS THE POINT: when
// this fires, refetch (`node scripts/gtfs/milton-go.mjs`, the curl pass in MCT-001) and rebuild.
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '../lib/env.mjs';

export const PARKING_MAX_AGE_DAYS = 90;

/** Pure, exported for the prebuild case: the findings for a given "today". */
export function sourceWindows(today, files = {}) {
  const gtfsSrc = files.gtfs ?? fs.readFileSync(path.join(REPO_ROOT, 'src/data/sources/goGtfsMilton.ts'), 'utf8');
  const parkingSrc = files.parking ?? fs.readFileSync(path.join(REPO_ROOT, 'src/data/sources/miltonParking.ts'), 'utf8');
  const rows = [];

  const end = gtfsSrc.match(/"endDate":\s*"(\d{8})"/);
  const start = gtfsSrc.match(/"startDate":\s*"(\d{8})"/);
  const version = gtfsSrc.match(/"version":\s*"(\d+)"/);
  if (!end || !start) throw new Error('goGtfsMilton.ts: could not read the feed window; fix the parser, not the data');
  const iso = (d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  const endIso = iso(end[1]), startIso = iso(start[1]);
  rows.push({
    source: `GTFS feed ${version ? version[1] : '?'}`,
    window: `${startIso} to ${endIso}`,
    ok: today >= startIso && today <= endIso,
    why: today > endIso ? `feed ended ${endIso}; today is ${today}` : today < startIso ? `feed starts ${startIso}` : '',
  });

  const fetched = parkingSrc.match(/PARKING_FETCHED_ON_ISO\s*=\s*"(\d{4}-\d{2}-\d{2})"/);
  if (!fetched) throw new Error('miltonParking.ts: could not read PARKING_FETCHED_ON_ISO; fix the parser, not the data');
  const ageDays = Math.floor((Date.UTC(...today.split('-').map(Number).map((n, i) => (i === 1 ? n - 1 : n))) - Date.UTC(...fetched[1].split('-').map(Number).map((n, i) => (i === 1 ? n - 1 : n)))) / 86_400_000);
  const pages = (parkingSrc.match(/file:\s*"milton-parking\/[^"]+"/g) || []).length;
  rows.push({
    source: `Town of Milton parking pages (${pages}), fetched ${fetched[1]}`,
    window: `${PARKING_MAX_AGE_DAYS} days`,
    ok: ageDays <= PARKING_MAX_AGE_DAYS && ageDays >= 0,
    why: ageDays > PARKING_MAX_AGE_DAYS ? `${ageDays} days old` : ageDays < 0 ? 'fetched in the future' : '',
  });
  return rows;
}

export default {
  id: 'sources-fresh',
  title: 'Every stored source under src/data/sources is inside its validity or fetch-age window',
  wholeCorpusOnly: true,

  finish() {
    const today = new Date().toISOString().slice(0, 10);
    const rows = sourceWindows(today);
    const stale = rows.filter((r) => !r.ok);
    return {
      coverage: [
        ['today', today],
        ...rows.map((r) => [r.source, `${r.window} ${r.ok ? 'OK' : 'STALE: ' + r.why}`]),
      ],
      assertions: [
        ['sources read', rows.length, 2],
        ['sources past their window', stale.length, 0],
      ],
      examples: stale.map((r) => `${r.source}: ${r.why}`),
    };
  },
};
