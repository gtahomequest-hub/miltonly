# Handoff — content worktree

CONTENT · D:\miltonly-content · feat/content

_Last rewritten 2026-09-10, after the guides tier and Market Watch were built
against the ten Gate A rulings._

## READ THIS FIRST

**This worktree owns the guides and everyday-life tier, and the Market Watch
weekly edition.** Its own tables, its own routes, generation through
`src/lib/ai/compliance.ts` under the cheap-first rule. **It never writes
`StreetContent`, `HubContent` or `CondoContent` rows, never touches the header,
footer or homepage.** Read the root `HANDOFF.md` for those tiers; it is the
authority on everything outside this scope.

**BUILT AND AWAITING PREVIEW REVIEW. NOT MERGED.**

| | |
|---|---|
| branch | `feat/content` at **`62ab3a5f789e1468a9d02572b14a0231cdd60b20`** |
| preview | **`https://miltonly-clft5u5jn-gtahomequest-hubs-projects.vercel.app`** |
| battery on preview | **`PASS · 9 checks · 444 pages · 64s`**, exit 0, at the full SHA |
| local gate | exit 0, zero `P2024`, **20/20 prebuild**, 554 static pages |
| first edition | `/market-watch/2026-08-31`, published, real data |

Gate A is `scratchpad/reports/062-content-gate-a.md`, its volume addendum is
`063`, and what was built is **`064-content-build.md`**. Read 064 first now.

## The nine URLs

```
/guides
/guides/what-milton-neighbourhoods-cost                      milton real estate market
/guides/how-to-read-a-milton-sold-price                      sold prices milton
/guides/is-it-a-good-time-to-sell-in-milton                  is it a good time to sell
/guides/milton-condo-fees-parking-and-lockers                condos in milton
/guides/what-it-costs-to-buy-your-first-home-in-milton        first-time buyer
/guides/milton-schools-what-the-data-shows                   schools
/market-watch
/market-watch/2026-08-31
```

All nine return 200 and all nine are in `sitemap.xml`, verified on the served
host. `parking` is held: the Town bylaw is not in this repo and a model would
invent it.

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
that matches the column.** The edition now reads 40 and 43, matching report 063.

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

## Deviations, stated

**The schools guide ships board, level and grades. It does NOT ship address or
distance.** Ruling 6 asked for address and distance and neither exists:
`src/lib/schools.ts` has no street address, the school page's own
`PostalAddress` JSON-LD carries locality, region and country only, and the
lat/lng some rows hold is a neighbourhood centroid approximate to about 300 m by
that file's own comment. The guide says plainly that it holds neither rather
than approximating either. **If address and distance are required, they have to
be sourced first.**

**"Open this weekend" is not in v1.** Open houses are read live and expire; an
edition is immutable. A stored weekend is a lie by the following Tuesday and a
live block inside an archived edition breaks the immutability the table exists
for. The live block belongs on the index page as its own piece of work.

**No cron is wired.** Monday 06:00 is proposed, not scheduled. Wiring it before
the first edition is reviewed would publish unreviewed editions weekly.

## Requests to Core

1. **Up-links from hubs and streets to the current edition** (ruling 7). This
   worktree does not make those writes. Without them the archive sits instead of
   compounding.
2. **192 For Sale rows and 53 For Lease rows in `sold.sold_records` carry a
   future `sold_date`**, the furthest 2027-01-29 against a database `NOW()` of
   2026-09-10. A Core data bug, logged not fixed. An unbounded 28-day
   neighbourhood count returns 327 where the bounded one returns 135.
3. **`Listing.maintenanceFee` (Int) is dead** on all 73 active Milton condo
   listings while `maintenanceFeeAmt` (Float) is populated on all 73. Two
   columns for one fact, one empty, is a trap. It already cost one wrong page.
4. **`SUPERLATIVE_PHRASES` is module-private** in `validateStreetGeneration.ts`,
   so this tier keeps a second copy. Exporting it removes the duplication.
   Core's call, Core's file.

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
- **Read the served preview, not the local render.** Two of the four defects in
  report 064 were invisible locally: the dead fee column and the locale-dependent
  date, which rendered "September 8, 2026" on the host and "8 September 2026"
  locally.

## Next expected task

**Preview review of `miltonly-clft5u5jn`.** After approval: the cron, the live
open-house block on the index, and whichever of the two held guides the GSC rows
justify. **Do not self-start any of them, and do not merge.**
