// src/lib/streetRegen.ts: the switch for the scheduled rewrite of street prose (MC-049).
//
// WHAT IT GATES. Two cron routes rewrite an EXISTING street page's prose. /api/sync/regenerate
// (Sundays 12:00 UTC) queues every published page older than 30 days whose market-data hash moved,
// then fires /api/sync/generate; /api/sync/generate (hourly) drains the queue, and for a street that
// already has a page makeStreetDecision answers "regenerate" and generateStreetContent rewrites it.
// On Sunday 2026-09-27 that rewrote victoria-street (12:00:51Z), shortreed-crescent and
// baverstock-crescent (14:00-14:01Z, on retry) with text no compass or build-era check had read
// (MC-045), inside the 28 days MC-048's title re-read measures.
//
// OFF UNLESS STREET_REGEN_ENABLED IS EXACTLY "true". Nothing in the repo or the Vercel project sets
// it; turning it on is a decision, taken by setting it. While it is off, /api/sync/regenerate
// answers 200 {paused:true} and writes nothing, and /api/sync/generate leaves every "regenerate"
// decision in the queue untouched and says so in its response.
//
// WHAT IT DOES NOT GATE. New-page creation in /api/sync/generate (makeStreetDecision "build") is not
// a rewrite; DEC-NEW-PAGE-CAP still caps it at 20 a day. Nor the manual force-regenerate route, the
// local runners, or the jobs that only flag, queue or count (vip-hubs, detect, monitor/queue).
export function streetRegenEnabled(): boolean {
  return process.env.STREET_REGEN_ENABLED === "true";
}

export const STREET_REGEN_PAUSED_REASON = 'STREET_REGEN_ENABLED is not "true" (MC-049)';
