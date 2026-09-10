# Handoff — content worktree

CONTENT · D:\miltonly-content · feat/content

_Last rewritten 2026-09-10, after the two edition rulings landed on main and
the 2026-08-31 edition was corrected on production._

## READ THIS FIRST

**This worktree owns the guides and everyday-life tier, and the Market Watch
weekly edition.** Its own tables, its own routes, generation through
`src/lib/ai/compliance.ts` under the cheap-first rule. **It never writes
`StreetContent`, `HubContent` or `CondoContent` rows, never touches the header,
footer or homepage.** Read the root `HANDOFF.md` for those tiers; it is the
authority on everything outside this scope.

**MERGED AND LIVE.** Approved by Aamir on preview `miltonly-clft5u5jn` after
reading all six guides.

## WHERE THIS BRANCH STANDS RIGHT NOW

**MERGED AND LIVE.** Core merged `feat/content` `0a2499b` as **`31a9ab0`** and
reported the production battery **PASS, 11 checks, 449 pages, 99 s, exit 0** at
the served SHA. This branch is fast-forwarded to `31a9ab0`; nothing is pending.
Record: `scratchpad/reports/067-content-cron-hour-and-correction.md`, including
its addendum, which is the part written after the merge.

| | |
|---|---|
| cron | Monday **08:00 America/Toronto**, `0 12 * * 1` and `0 13 * * 1`, hour guard 8 |
| `vercel.json` | **17 crons.** Core resolved a conflict with `/api/brief/send` by keeping all three; both market-watch entries verified present by parse |
| 2026-08-31 edition | **CORRECTED on production.** 40 sales became 62, $920,000 became $975,000 |
| the correction stamp | renders above every figure, once, on the edition and on the index |
| `datePublished` / `dateModified` | `08:21:38.061Z` (original, unmoved) / `18:01:25.631Z` (the correction) |

**THE CORRECTION IS SPENT. DO NOT RUN IT AGAIN.** `generateEdition` will refuse
a second rewrite without a fresh note, and there is no second correction to
make. The week of 2026-08-31 is immutable again.

**WHY THE FIGURES MOVED.** `CloseDate` is the agreed completion date, not the
sale date. 255 DB2 rows carried a future `sold_date` and were re-dated to their
contract date by Core. Every DB2 window in this tier carries `sold_date <=
NOW()`, so those rows were excluded and sales belonging to the week had been
dated forward out of it. New listings held at 56 across the correction, which
is the proof: that figure comes from DB1's `listedAt`, which the backfill never
touched. Open item 3 below, the future-dated rows, is **CLOSED**.

**PURGE BEFORE YOU GENERATE, NOT AFTER.** `scripts/purge-sold-caches.ts` ran
first and deleted 15 keys that had repopulated under the 1 h TTL since Core's
own purge. The edition's 12-month context reads `getMiltonSoldOverall`, which
is one of those cached keys, so generating first would have baked the stale
1,531 into a page corrected for exactly that number. Order is: purge Upstash,
generate, then revalidate.

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

## I CLOBBERED THE LEADS MERGE AND RESTORED IT. READ THIS BEFORE USING `commit-tree`.

The content merge `f6bbc92` was correct. The **documentation** commit after it
was not. `4b55fc6` was built with `git commit-tree` using `feat/content`'s tree
while `origin/main` had already moved to `3461e13`, the `feat/leads` merge.
Parenting my stale tree on their commit **reverted all 30 files that merge
brought in**: the lead layer's routes, guards, components, two migrations and
its schema changes.

Nothing was lost from the repository — `3461e13` is intact in history — but
main's tree was wrong for one commit, and **production served that wrong tree
briefly** before the fix deployed.

`5ee703e` restores it: main's tree is now `3461e13`'s plus the only two files
the docs commit was ever meant to change, `HANDOFF-content.md` and `QUEUE.md`,
neither of which `feat/leads` touched. Verified both ways: the diff against
`3461e13` is exactly those two files, and `src/lib/lead/guards.ts`,
`/api/leads/create` and the lead migration are all present on main. `/sell`
returns 200 on production.

**THE RULE. A `commit-tree` push must re-read `origin/main` immediately before
building the tree, and the tree must be built FROM that commit, not from a
branch tip that predates it.** `git fetch` then `git commit-tree` with a tree
you prepared earlier is not safe: the fetch tells you main moved and the stale
tree silently discards the move. Merge the moved main into the branch first, or
build the tree with `read-tree` from the new main and overlay only the files you
actually changed. A fast-forward check (`merge-base --is-ancestor`) would have
caught this in one line and was not run on the second push.

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

**AN EDITION IS IMMUTABLE ONCE PUBLISHED, WITH ONE NAMED EXCEPTION.** Both
routes render the stored row and recompute nothing. Late-reported sales land in
a later edition.

The exception is a **correction**, and the rule now lives in `generateEdition`
rather than only in the cron route: it reads the existing row and **throws** on
a published one unless `correctionNote` is passed. There is no `--force`. The
only way past the gate is the sentence the page will carry, above every figure,
so overriding the rule and telling the reader are the same act. A draft is
still freely rewritable.

The note rides **inside `sectionsJson`**, as an optional `correctionNote` on
`EditionSections`. Not a column: nothing queries or sorts on it, only the
renderer reads it, and `_prisma_migrations` here is out of step with the live
database, so a column buys a raw-SQL migration and nothing else. Editions
written before the field existed lack the key and render nothing. `buildEdition`
never sets it; it is attached at the write.

**A CORRECTION DOES NOT REPUBLISH.** `publishedAt` is preserved on a rewrite,
and `dateModified` on both pages now reads `updatedAt`. It read
`publishedAt ?? updatedAt`, which on a published row always returned
`publishedAt`, so `updatedAt` was unreachable and a correction would have been
invisible to a crawler.

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

**The cron is wired, at Monday 08:00 America/Toronto, and the hour is load
bearing.** `vercel.json` carries `0 12 * * 1` and `0 13 * * 1`; `TARGET_HOUR`
in the route is `8`; exactly one firing lands on 08:00 in each offset and the
other is refused on the hour guard.

**It is 08:00 and not 06:00 because both firings must sit AFTER the 11:00 UTC
sold sync in both offsets.** The old pair, 10:00 and 11:00 UTC, put the EDT
firing an hour before `/api/sync/sold` and the EST firing level with it, so an
edition could be built from a DB2 that had not yet taken Monday's delivery.
**Any change to the sold sync hour must move these two entries.**

## Open items

1. **Only one edition exists, and the cron has not fired yet.** It is merged
   and on production now, so the next Monday fires it. **Watch that firing.**
   It is the first time the hour guard and the ISO-week idempotency run against
   a real Monday rather than a dry run, and the week it writes will be the
   first edition whose figures were never wrong.
2. **Up-links from hubs and streets to the current edition are Core's**
   (ruling 7). This worktree does not make those writes. Without them the
   archive sits instead of compounding.
3. ~~**192 For Sale rows and 53 For Lease rows carry a future `sold_date`.**~~
   **CLOSED 2026-09-10.** Core backfilled it: 255 rows re-dated from their
   `CloseDate` to their contract date, 0 future-dated rows remain of 8,578, and
   the Milton-wide 12-month sample moved 1,531 to 1,728 with the typical
   unchanged at $930K. This is what forced the 2026-08-31 correction. **The
   `sold_date <= NOW()` bound on every DB2 window stays** (ruling 10): it was
   never a workaround for this bug, and a future-dated row can arrive again.
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
  `--skip-paragraph`, `--revalidate=<url>`, `WEEK_OF=YYYY-MM-DD` (a Monday),
  and `CORRECTION_NOTE=<one line>` (or `--correction=`; the env var wins and is
  the one to use on Windows). The runner refuses a note without `--publish`,
  refuses an em-dash in it, and caps it at 240 characters. **A note is the only
  way to rewrite a published edition, and it renders on the page.**
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

**None. Do not self-start.**

Both rulings are executed, merged, and verified on production. The correction
is spent. The remaining candidates, unchanged and still nobody's current
assignment, are the live open-house block on the index page and whichever of
the two held guides the real GSC rows justify.

**One thing to hand Core rather than do.** The backfill moved **17 streets
across k5 and 9 across k10**, so some streets can now publish a typical price
they were suppressing. Those figures live in stored `StreetContent` prose and
only a regeneration changes them. `StreetContent` is Core's and this worktree
does not write it. Flagged, not actioned.
