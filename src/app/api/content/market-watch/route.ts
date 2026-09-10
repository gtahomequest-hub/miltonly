// src/app/api/content/market-watch/route.ts
//
// The Market Watch weekly cron. Writes at most one edition per ISO week.
//
// ── THE SCHEDULE, AND WHY IT IS 08:00 AND NOT 06:00 ──────────────────────
//
// The target is Monday 08:00 America/Toronto. **Vercel cron schedules are UTC
// and carry no timezone**, and Toronto is UTC-4 in EDT and UTC-5 in EST, so no
// single UTC expression is 08:00 Toronto all year. A cron pinned to 12:00 UTC
// fires at 08:00 in summer and 07:00 in winter; one pinned to 13:00 UTC fires
// at 09:00 in summer and 08:00 in winter.
//
// So vercel.json registers BOTH, `0 12 * * 1` and `0 13 * * 1`, and this route
// carries the timezone logic: it proceeds only when the Toronto local hour is
// 8. Exactly one of the two firings satisfies that on any given Monday.
//
//   EDT (Mar-Nov):  12:00 UTC = 08:00 Toronto  -> RUNS
//                   13:00 UTC = 09:00 Toronto  -> skipped on the hour guard
//   EST (Nov-Mar):  12:00 UTC = 07:00 Toronto  -> skipped on the hour guard
//                   13:00 UTC = 08:00 Toronto  -> RUNS
//
// **BOTH UTC ENTRIES SIT AFTER THE 11:00 UTC SOLD SYNC, IN BOTH OFFSETS.**
// That is the whole reason the hour moved. `/api/sync/sold` runs `0 11 * * *`
// and `/api/jobs/compute-sold-stats` at `30 11 * * *`; the previous pair,
// 10:00 and 11:00 UTC, put the EDT firing an hour BEFORE the sync and the EST
// firing level with it, so an edition could be built from a DB2 that had not
// yet taken Monday's delivery. 12:00 and 13:00 UTC are both clear of it, and
// clear of the 12:00 UTC `compute-board` job only in the sense that neither
// reads its output. Any change to the sold sync hour must move these two.
//
// The changeover weekends need no special case: the guard reads the actual
// Toronto hour at request time, so whichever firing lands on 08:00 wins and the
// other is refused. And even if both somehow passed, the ISO-week idempotency
// below makes the second a no-op.
//
// ── IDEMPOTENCY, PER ISO WEEK ────────────────────────────────────────────
//
// `MarketEdition.weekOf` is the Monday of the covered week in YYYY-MM-DD form,
// and it is `@unique`. That IS the ISO week key. If a PUBLISHED row already
// exists for the target week the route returns `skipped` and writes nothing.
//
// This is a refusal, not an upsert. An edition is immutable once published, and
// DB2 keeps taking late-reported sales after the window closes, so a second run
// would silently rewrite figures a reader may already have seen.
//
// ── ENV SCOPE: PREVIEW NEVER WRITES ──────────────────────────────────────
//
// Two independent guards, because one is not enough:
//
//   1. Vercel only invokes crons on the production deployment, so a preview is
//      never scheduled. That is Vercel's behaviour, not this code's, and it
//      does not stop a person curling a preview URL with the secret.
//   2. This route refuses to WRITE unless `VERCEL_ENV` is "production" (or
//      absent, which means a local runner). On a preview it returns
//      `refused_env` and writes nothing.
//
// A dry run is allowed anywhere. It builds the edition and reports every figure
// with its basis, and touches no table.

import { NextRequest, NextResponse } from "next/server";
import { DateTime } from "luxon";
import { prisma } from "@/lib/prisma";
import { buildEdition } from "@/lib/marketWatch/edition";
import { generateEdition } from "@/lib/marketWatch/generate";
import { lastCompleteWeek, weekFromMonday } from "@/lib/marketWatch/windows";
import { K_ANON_PRICE, K_ANON_RANGE } from "@/lib/kAnon";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const ZONE = "America/Toronto";
const TARGET_HOUR = 8;

function authorised(request: NextRequest): boolean {
  const secret =
    request.headers.get("authorization")?.replace("Bearer ", "") ||
    request.nextUrl.searchParams.get("secret");
  return Boolean(process.env.CRON_SECRET) && secret === process.env.CRON_SECRET;
}

/** Absent VERCEL_ENV means a local run, which may write. "preview" and
 *  "development" may not. */
function mayWrite(): boolean {
  const env = process.env.VERCEL_ENV;
  return !env || env === "production";
}

/** Every figure's basis, for the dry run. States the gate that WOULD apply to
 *  each figure rather than only whether it happens to be null this week. */
function basisFor(key: string, value: number | string | null): string {
  if (key.startsWith("week.typical") || key === "week.typical") {
    return `weekly midpoint, published only at n >= ${K_ANON_PRICE} for the week's own sales`;
  }
  if (key.startsWith("week.band")) {
    return `weekly middle-half endpoint, published only at n >= ${K_ANON_RANGE}; a range leaks its own endpoints so it takes a higher floor than a midpoint`;
  }
  if (key === "week.dom" || key === "week.soldToAsk") {
    return `weekly rate aggregate, published only at n >= ${K_ANON_PRICE} for the week's own sales`;
  }
  if (key === "week.count" || key === "prevWeek.count") {
    return "count of completed sales in the week, DB2, upper-bounded at today; a count alone is non-sensitive so it carries no k gate";
  }
  if (key === "week.newListings") {
    return "count of DB1 listings whose listedAt falls in the week, permAdvertise and displayAddress only; Toronto instants, because listedAt is a real timestamp";
  }
  if (key.startsWith("ctx12.")) {
    return "trailing 12 months from getMiltonSoldOverall, the same helper /sold renders, k-gated there at 5 for a point and 10 for a band";
  }
  if (key.startsWith("form.") && key.endsWith(".count")) {
    return "count over a trailing 28-day window; a week is too small a sample to split four ways";
  }
  if (key.startsWith("form.") && key.endsWith(".typical")) {
    return `trailing 28-day midpoint per housing form, published only at n >= ${K_ANON_PRICE} for that form's own count`;
  }
  if (key.startsWith("nbhd.")) {
    return "weekly sale count for one neighbourhood; NO weekly neighbourhood price is published at any n, because a Milton neighbourhood sees one or two sales a week";
  }
  if (key.startsWith("street.")) {
    return "weekly sale count for one street that already has a published page; no price at street level at any n";
  }
  return value === null ? "suppressed" : "deterministic";
}

async function handle(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const p = request.nextUrl.searchParams;
  const dry = p.get("dry") === "1";
  const force = p.get("force") === "1";
  const weekParam = p.get("weekOf");

  const now = DateTime.now().setZone(ZONE);
  const window = weekParam ? weekFromMonday(weekParam) : lastCompleteWeek();
  if (!window) {
    return NextResponse.json({ error: "weekOf must be a Monday in YYYY-MM-DD form" }, { status: 400 });
  }

  const existing = await prisma.marketEdition.findUnique({
    where: { weekOf: window.weekOf },
    select: { weekOf: true, status: true, publishedAt: true },
  });

  const timezone = {
    torontoNow: now.toISO(),
    torontoHour: now.hour,
    offsetName: now.offsetNameShort, // "EDT" or "EST"
    targetHour: TARGET_HOUR,
    hourGuardPasses: now.hour === TARGET_HOUR,
  };

  // ── DRY RUN. Builds and reports. Writes nothing, anywhere. ──────────────
  if (dry) {
    const built = await buildEdition(window.weekOf);
    if (!built) {
      return NextResponse.json({ error: "no edition could be built for that week" }, { status: 400 });
    }
    const s = built.sections;
    return NextResponse.json({
      mode: "dry-run",
      wroteAnything: false,
      env: process.env.VERCEL_ENV ?? "local",
      mayWrite: mayWrite(),
      timezone,
      idempotency: {
        weekOf: window.weekOf,
        existingRow: existing ?? null,
        verdict: existing && existing.status === "published"
          ? "would SKIP: a published edition already exists for this ISO week"
          : "would WRITE: no published edition exists for this ISO week",
      },
      window: {
        weekOf: window.weekOf,
        label: window.label,
        db2DateBounds: {
          gte: window.dateStartUtc.toISOString(),
          lt: window.dateEndExclusiveUtc.toISOString(),
          note: "sold_date is a calendar date stamped at UTC midnight, so DB2 windows are UTC-midnight date bounds, not Toronto instants",
        },
        db1InstantBounds: {
          gte: window.startUtc.toISOString(),
          lte: window.endUtc.toISOString(),
          note: "listedAt is a real timestamp, so DB1 uses Toronto instants",
        },
        upperBound: "every DB2 query also carries sold_date <= NOW()",
      },
      summarySentence: built.summarySentence,
      metaTitle: built.metaTitle,
      wouldContain: {
        soldThisWeek: s.sales.count,
        soldPreviousWeek: s.previous.count,
        newListings: s.newListings,
        typicalPrice: s.sales.typicalPrice,
        band: [s.sales.bandLow, s.sales.bandHigh],
        avgDom: s.sales.avgDom,
        soldToAskPct: s.sales.soldToAskPct,
        formsWindow: s.forms.label,
        forms: s.forms.rows,
        neighbourhoodsWithASale: s.neighbourhoods.length,
        streetsWithAPublishedPage: s.streets.length,
        paragraph: "not generated in a dry run; it is optional, fail-closed and never blocks the edition",
      },
      figures: built.figures.figures.map((f) => ({
        key: f.key,
        value: f.value,
        label: f.label,
        source: f.source,
        kind: f.kind,
        suppressed: f.value === null,
        basis: basisFor(f.key, f.value),
      })),
      entities: built.figures.entities,
    });
  }

  // ── WRITE PATH ─────────────────────────────────────────────────────────

  if (!mayWrite()) {
    return NextResponse.json({
      skipped: true,
      reason: "refused_env",
      detail: `VERCEL_ENV is "${process.env.VERCEL_ENV}". Only production writes an edition. Add dry=1 to inspect.`,
      env: process.env.VERCEL_ENV,
    });
  }

  if (!force && !timezone.hourGuardPasses) {
    return NextResponse.json({
      skipped: true,
      reason: "wrong_hour",
      detail: `Toronto local hour is ${now.hour} (${now.offsetNameShort}); this route runs at ${TARGET_HOUR}. Two UTC crons are registered, 12:00 and 13:00, so that exactly one lands on 08:00 in both EST and EDT, and both sit after the 11:00 UTC sold sync.`,
      timezone,
    });
  }

  if (existing && existing.status === "published") {
    return NextResponse.json({
      skipped: true,
      reason: "already_published",
      detail: `A published edition already exists for the week of ${window.weekOf}. An edition is immutable once published, so this is a refusal rather than a regeneration.`,
      weekOf: window.weekOf,
      publishedAt: existing.publishedAt,
    });
  }

  const res = await generateEdition({ weekOf: window.weekOf, publish: true });
  if (!res) {
    return NextResponse.json({ error: "no edition could be built" }, { status: 500 });
  }

  return NextResponse.json({
    wrote: true,
    weekOf: res.weekOf,
    sold: res.built.sections.sales.count,
    typicalPrice: res.built.sections.sales.typicalPrice,
    paragraph: res.interpretation ? "written" : "not written",
    paragraphNote: res.note,
    violations: res.violations.map((v) => v.rule),
    costUsd: Number(res.costUsd.toFixed(4)),
    timezone,
  });
}

export async function GET(request: NextRequest) {
  return handle(request);
}
export async function POST(request: NextRequest) {
  return handle(request);
}
