# Handoff — content worktree

CONTENT · D:\miltonly-content · feat/content

_Last rewritten 2026-09-10, after the guides tier and Market Watch merged to
main and production was confirmed on the merge SHA._

## READ THIS FIRST

**This worktree owns the guides and everyday-life tier, and the Market Watch
weekly edition.** Its own tables, its own routes, generation through
`src/lib/ai/compliance.ts` under the cheap-first rule. **It never writes
`StreetContent`, `HubContent` or `CondoContent` rows, never touches the header,
footer or homepage.** Read the root `HANDOFF.md` for those tiers; it is the
authority on everything outside this scope.

**MERGED AND LIVE.** Approved by Aamir on preview `miltonly-clft5u5jn` after
reading all six guides.

| | |
|---|---|
| merged to `main` as | **`f6bbc92f2093b6fe7a3aafa27fc6f88bbd4b3a7b`**, two parents |
| production | **`miltonly-kqtcnrve4`**, Ready, serving the merge SHA, confirmed on the apex |
| battery on production | **`PASS · 10 checks · 444 pages · 67s`**, exit 0, at the full SHA |
| local gate, merged tree | exit 0, zero `P2024`, **20/20 prebuild**, 548 static pages |
| first edition | `/market-watch/2026-08-31`, published, real data |

The battery is 10 checks now, not 9: Home's merge added the homepage check in
the same window.

Gate A is `scratchpad/reports/062-content-gate-a.md`, its volume addendum `063`,
and the build record **`064-content-build.md`**. Read 064 before touching any of
this.

## What is live

```
/guides
/guides/what-milton-neighbourhoods-cost                 milton real estate market
/guides/how-to-read-a-milton-sold-price                 sold prices milton
/guides/is-it-a-good-time-to-sell-in-milton             is it a good time to sell
/guides/milton-condo-fees-parking-and-lockers           condos in milton
/guides/what-it-costs-to-buy-your-first-home-in-milton  first-time buyer
/guides/milton-schools-what-the-data-shows              schools
/market-watch
/market-watch/2026-08-31
```

All nine return **200 on `https://miltonly.com`** and all nine are in the
**live sitemap**, checked on the apex after the merge. Order is the brief's GSC
evidence order. `parking` is held: the Town bylaw is not in this repo and a
model would invent it.

Verified on production, not just locally: 24 condo listings state a fee,
`2.25% as at 8 September 2026` renders, the edition shows 40 sales, $920,000 and
97.5%, and across all seven content pages there are **zero em-dashes and zero
raw TREB strings**.

## What a next session must not undo

**`validateStreetGeneration.ts` is Core's and this tier does not edit it.** The
four required rules were checked for extraction and **none extracts unchanged**:
each takes `input: StreetGeneratorInput` and reads `.aggregates` / `.nearby` /
`.primaryBuilder`, and `SUPERLATIVE_PHRASES` is module-private.
`src/lib/content/validateContentProse.ts` reimplements five rules against
`GroundedFigures`. `scripts/test-content-validator.ts` is the 20th prebuild
test, 55 assertions, both directions on every rule, proven red on a weakened
validator.

**A SUPPRESSED FIGURE REMOVES PROSE, IT DOES NOT DAMAGE IT.** `sentence()`
returns null when its figure is null and `para()` discards nulls. Never render a
dash, a zero or a sentence with a hole where a k-suppressed figure would be.

**A WEEK HAS TWO BASES AND THEY ARE NOT INTERCHANGEABLE.**
`sold.sold_records.sold_date` is a `timestamp with time zone` whose every value
is **exactly UTC midnight** — a calendar date wearing a timestamp type, measured
across all 3,961 Milton For Sale rows. A Toronto-midnight window drops the whole
Monday: the week of 2026-08-31 read **18** where the day-by-day count is **40**.
DB1's `Listing.listedAt` is the opposite, a real timestamp, where Toronto
instants are correct. `WeekWindow` carries `dateStartUtc` /
`dateEndExclusiveUtc` for DB2 and `startUtc` / `endUtc` for DB1. **Use the one
that matches the column.**

**EVERY DB2 WINDOW CARRIES `sold_date <= NOW()`** (ruling 10). Any query added
later must too.

**GUIDES ARE DYNAMIC ON PURPOSE.** No `generateStaticParams` on
`/guides/[slug]`. Their figures are read live, and the first build prerendered
them, which would have frozen every number at build time.

**THE PARAGRAPH NEVER BLOCKS A PAGE.** Validator violation, provider error,
missing key: `interpretation` stays null, the attempt is recorded on
`MarketEditionGeneration` with its violations, sections 1 to 6 publish
regardless. Two attempts, DeepSeek only, no Claude escalation — the Anthropic
account has no credit and a weekly cron that can escalate is one that can fail
on a balance.

**AN EDITION IS IMMUTABLE ONCE PUBLISHED.** Both routes render the stored row
and recompute nothing. Late-reported sales land in a later edition.

**`src/lib/content/neighbourhoodName.ts` is the only source of a neighbourhood
name in this tier.** `Listing.neighbourhood` and `sold_records.neighbourhood`
hold the raw TREB string ("1032 - FO Ford"). An unmapped string returns **null**
and the caller drops the clause. It never falls back to the raw string.

**`src/data/policyRate.ts` is the only rate.** 2.25%, observed 2026-09-08, BoC
Valet series V39079. **Render the date every time.** Re-pull the URL in the file
and update both fields together, never one without the other. A policy rate is
not a mortgage rate and the guide says so.

## Deviations, stated and still standing

**The schools guide ships board, level and grades. It does NOT ship address or
distance.** Ruling 6 asked for address and distance and neither exists:
`src/lib/schools.ts` has no street address, the school page's own
`PostalAddress` JSON-LD carries locality, region and country only, and the
lat/lng some rows hold is a neighbourhood centroid approximate to about 300 m by
that file's own comment. The guide says plainly that it holds neither rather
than approximating either. **If address and distance are wanted, they have to be
sourced first.**

**"Open this weekend" is not in v1.** Open houses are read live and expire; an
edition is immutable. A stored weekend is a lie by the following Tuesday and a
live block inside an archived edition breaks the immutability the table exists
for. The live block belongs on the index page as its own piece of work.

**No cron is wired.** Monday 06:00 is proposed, not scheduled. Nothing publishes
a second edition until someone runs the runner or wires the cron.

## Open items

1. **Only one edition exists.** `/market-watch` will keep serving the week of
   2026-08-31 until the next run. Either wire the Monday 06:00 cron or run the
   runner weekly by hand, and decide which before a reader notices the date.
2. **Up-links from hubs and streets to the current edition are Core's**
   (ruling 7). This worktree does not make those writes. Without them the
   archive sits instead of compounding.
3. **192 For Sale rows and 53 For Lease rows in `sold.sold_records` carry a
   future `sold_date`**, the furthest 2027-01-29 against a database `NOW()` of
   2026-09-10. A Core data bug, logged not fixed. An unbounded 28-day
   neighbourhood count returns 327 where the bounded one returns 135.
4. **`Listing.maintenanceFee` (Int) is dead** on all 73 active Milton condo
   listings while `maintenanceFeeAmt` (Float) is populated on all 73. Two
   columns for one fact, one empty. It already cost one wrong page, which
   published "No Milton condo currently for sale states a monthly maintenance
   fee" while 73 did.
5. **`SUPERLATIVE_PHRASES` is module-private** in `validateStreetGeneration.ts`,
   so this tier keeps a second copy that has to be kept in step by hand.
   Exporting it removes the duplication. Core's call, Core's file.
6. **The invented-entity rule has one asserted blind spot**: a one-word invented
   place opening a sentence is not caught. Closing it needs a dictionary. The
   test asserts the gap so it cannot change silently.
7. **The guides index builds all six articles to get their read times.** Six
   builds against cached aggregates per index request. Fine at six; revisit
   before the tier grows.

## Notes for the next run

- `scripts/generate-market-edition.ts` is the edition runner. `--publish`,
  `--skip-paragraph`, `--revalidate=<url>`, `WEEK_OF=YYYY-MM-DD` (a Monday).
  Run it as `npx tsx --tsconfig tsconfig.test.json` — **not** with
  `NODE_OPTIONS=--conditions=react-server`, the same trap the condo runner
  documents. It refuses to start if any provider knob names a Claude model.
- **`DIRECT_DATABASE_URL` is not in `.env.local`, and
  `NEON_DATABASE_URL_UNPOOLED` is DB2, a different Neon project from
  `DATABASE_URL`.** Substituting one for the other creates tables in the sold
  database. It happened during this build; the two empty tables were dropped
  from DB2 and created in DB1, verified both ways.
- **The `_prisma_migrations` table is out of sync with the live database** —
  every historical migration reports unapplied. `prisma migrate deploy` would
  try to replay all of them. Apply Content migrations with
  `npx prisma db execute --url "$DATABASE_URL" --file <migration.sql>`, the
  raw-SQL-on-Neon pattern this project already uses.
- `npx prisma db execute` prints nothing for a `SELECT`. It cannot be used to
  inspect. Use a short `.mjs` against `@neondatabase/serverless` from the
  project root, and delete it after.
- **Read the served host, not the local render.** Two of the four defects in
  report 064 were invisible locally: the dead fee column and a
  locale-dependent date that rendered "September 8, 2026" on Vercel and
  "8 September 2026" here.
- The battery is **10 checks** as of Home's merge. Take the full 40-character
  SHA; a short SHA aborts the gate before any content check.

## Next expected task

**None. Do not self-start.** The obvious candidates are the Monday cron (open
item 1), the live open-house block on the index, and whichever of the two held
guides the real GSC rows justify.
