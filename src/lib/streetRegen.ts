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
// decision AND, since MC-047, every "build" decision (a new page) in the queue untouched and says so
// in its response (src/lib/streetQueuePlan.ts decides which is which). New pages carry generated
// prose no check has read either, so the one switch holds all scheduled generation.
//
// WHAT IT DOES NOT GATE. The jobs that only flag, queue or count: vip-hubs (it flags isVipHub and,
// for a hot street with no page, creates a DRAFT row holding one template sentence, no model call),
// detect (queues new streets) and monitor/queue (resets stuck rows, counts). Nor the manual
// force-regenerate route or the local runners.
export function streetRegenEnabled(): boolean {
  return process.env.STREET_REGEN_ENABLED === "true";
}

export const STREET_REGEN_PAUSED_REASON = 'STREET_REGEN_ENABLED is not "true" (MC-049)';
