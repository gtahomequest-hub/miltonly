# 067 · The edition cron moves to 08:00, and a published edition can be corrected once

**Worktree:** `D:\miltonly-content` · **Branch:** `feat/content`

Commit **`69b11e1`**, on `9132434`, a merge of `origin/main` at `73e94ea`.
Two rulings executed. One of the two is deliberately **not finished**: the
2026-08-31 regeneration is held on Core's battery, which is red.

---

## Merge

`git merge origin/main` brought `73e94ea` in cleanly, no conflicts.
`git merge-base --is-ancestor origin/main HEAD` passes, so this branch is a
strict descendant of main and the `commit-tree` clobber recorded in
`HANDOFF-content.md` cannot repeat from here.

---

## Ruling 1 · Monday 08:00 America/Toronto

### What was wrong with 06:00

Vercel cron expressions are UTC and carry no timezone, so a Toronto target
needs two entries, one per offset. At 06:00 those two were `0 10 * * 1` and
`0 11 * * 1`.

`/api/sync/sold` runs `0 11 * * *`, every day, and
`/api/jobs/compute-sold-stats` at `30 11 * * *`. So the old pair read a DB2
that had not yet taken Monday's delivery:

| | old UTC | Toronto | against the 11:00 UTC sold sync |
|---|---|---|---|
| EDT | 10:00 | 06:00 · RUNS | **one hour early** |
| EDT | 11:00 | 07:00 · skipped | |
| EST | 10:00 | 05:00 · skipped | |
| EST | 11:00 | 06:00 · RUNS | **level with it, order undefined** |

The firing that actually ran was the wrong side of the sync in **both**
offsets. That is the whole reason the hour moved; 08:00 is not a preference.

### What it is now

`vercel.json` carries `0 12 * * 1` and `0 13 * * 1`. `TARGET_HOUR` in
`src/app/api/content/market-watch/route.ts` is `8`.

| | new UTC | Toronto | against the 11:00 UTC sold sync |
|---|---|---|---|
| EDT | 12:00 | 08:00 · RUNS | one hour clear |
| EDT | 13:00 | 09:00 · skipped | |
| EST | 12:00 | 07:00 · skipped | |
| EST | 13:00 | 08:00 · RUNS | two hours clear |

Both entries clear the sync in both offsets, so the guard can pick either
without reading stale figures. The changeover weekends still need no special
case: the guard reads the actual Toronto hour at request time, and the
ISO-week idempotency below it makes a second firing a no-op regardless.

The comment block at the top of the route is rewritten to state the sold-sync
dependency explicitly, including the line that matters to whoever touches this
next: **any change to the sold sync hour must move these two entries.** The
`wrong_hour` refusal message names the two UTC times so a reader of the JSON
does not have to open `vercel.json` to check the pair.

### What was NOT changed

The other fourteen cron entries in `vercel.json` are Core's and are untouched.
The diff on that file is four lines, two schedules.

---

## Ruling 2 · one correction, then immutable again

### The gate moved into the library

`generateEdition` upserted unconditionally. The immutability rule lived only in
the cron route's `already_published` branch, which meant it held for exactly
one caller: the runner script wrote straight through it.

`generateEdition` now reads the existing row first and **throws** on a
published one unless a `correctionNote` is supplied. A draft is still freely
rewritable. A rule enforced in one caller is a rule that holds until someone
adds a second caller, and there already was one.

### The note is the override, and it is the page

There is no `--force`. The only way past the gate is the sentence the page
will carry, so the act of overriding is the act of telling the reader. It
renders in the masthead **above every figure**, because a reader who saw the
old numbers has to meet the correction before they meet the new ones.

Styled as a rule down the left rather than a tinted panel: the masthead is one
flat colour and a boxed callout is a thing to skim past. `.mw-correction`,
`.mw-correction-tag`, `.mw-correction-text`, all inside the `.market-watch`
scope. Mono uppercase tag, cream at 0.78 for the text. `#00ff80` is not used;
it is CTA only.

### Where it is stored, and why not a column

Inside `sectionsJson`, as an optional `correctionNote?: string` on
`EditionSections`.

- Nothing queries, filters or sorts on it. Only the renderer reads it.
- `_prisma_migrations` in this project is out of step with the live database
  (`HANDOFF-content.md`, notes for the next run), so a column here buys a
  raw-SQL `db execute` migration against two Neon projects that have already
  been confused for one another once.
- Every edition written before the field existed simply lacks the key, and
  `s.correctionNote ? ... : null` renders nothing. No backfill.

`buildEdition` never sets it. It is attached at the write, in
`generateEdition`, because only the person ordering the rewrite knows what was
wrong.

### A correction does not republish

`publishedAt` was being stamped `new Date()` on every publish, including an
update. A rewrite would have moved the edition's publication date forward and
claimed the corrected page was first published today.

`publishedAt` is now preserved on a rewrite. And `dateModified` in the Article
JSON-LD on **both** `/market-watch` and `/market-watch/[weekOf]` read
`publishedAt ?? updatedAt`, which meant that on any published edition it
returned `publishedAt` and `updatedAt` was unreachable. A correction would
have been invisible to a crawler. Both now read `updatedAt`. `datePublished`
is unchanged.

### The runner

`CORRECTION_NOTE` env var, or `--correction=<text>`; the env var wins and is
the one to use on Windows. Three refusals before anything is written:

1. a note without `--publish`, which would write a draft and leave the
   published edition uncorrected;
2. an em-dash in the note. It is prose on a content page, the voice rule
   applies, and the production battery counts em-dashes across the content
   pages. A hand-typed note is exactly where one gets in;
3. a note over 240 characters. It renders as one line.

The run report gains `STATUS ... REWRITTEN over a published edition` and a
`CORRECTION` line, so the log says what happened rather than that it worked.

---

## ADDENDUM, same day: the regeneration RAN

Core merged this branch as **`31a9ab0`** and reported the production battery
**PASS, 11 checks, 449 pages, 99 s, exit 0**, at the served SHA. The
precondition was met, so the held regeneration was run. Everything below the
addendum was written before that and is left as it stood.

### Core's `vercel.json` resolution is correct

`vercel.json` conflicted on merge: main already carried `/api/brief/send`
(`15 13 * * 1-5`) from `feat/leads` and both sides appended to the end of the
same `crons` array. Core kept all three entries. Verified by parse, 17 crons,
and both market-watch lines are present:

```
0 11 * * *     /api/sync/sold
30 11 * * *    /api/jobs/compute-sold-stats
15 13 * * 1-5  /api/brief/send
0 12 * * 1     /api/content/market-watch
0 13 * * 1     /api/content/market-watch
```

That reads the intent right, and dropping either market-watch line would have
lost the edition for half the year. `/api/brief/send` at 13:15 UTC sits 15
minutes after the EST firing; different paths, no interaction.

### What the sold-date backfill actually did to this edition

Measured before writing anything, by building the week against the corrected
DB2 and printing it beside the stored row. **Every headline figure moved.**

| | stored | corrected |
|---|---|---|
| homes sold | 40 | **62** |
| previous week | 43 | **76** |
| typical sold price | $920,000 | **$975,000** |
| middle half | $750,000 to $1,180,000 | **$775,000 to $1,135,000** |
| days on market | 76 | **85** |
| sold to ask | 97.5% | **97.3%** |
| 12-month sample | 1,531 | **1,728** |
| 12-month typical | $930,000 | $930,000, unchanged |
| detached, 28 days | 82 | **141** |
| townhouse, 28 days | 42 | **75** |
| neighbourhoods with a sale | 12 | **18** |
| streets with a published page | 32 | **45** |

New listings held at 56, which is the check that the diagnosis is right: that
figure comes from DB1's `Listing.listedAt`, which the backfill never touched.
Only the DB2 side moved.

The cause, in Core's words: `CloseDate` is the agreed completion date, not the
sale date. 255 rows carried a future `sold_date` and were re-dated to their
contract date. Because every DB2 window in this tier carries `sold_date <=
NOW()` (ruling 10), those rows were **excluded**, and sales that belonged in
this week had been dated forward out of it. The edition undercounted by 22.

### The run

```
CORRECTION_NOTE="Corrected 10 September 2026. Some sales carried their agreed
completion date rather than the date they sold, so this edition first published
40 sales where 62 had completed. Every figure below is rebuilt from the
corrected records."
WEEK_OF=2026-08-31 --publish --revalidate=https://miltonly.com
```

231 characters, under the 240 cap, no em-dash, both guards passed.

`scripts/purge-sold-caches.ts` was run **first**, per Core's order: 15 keys
deleted, which had repopulated under the 1 h TTL since Core's own purge. The
edition's 12-month context comes through `getMiltonSoldOverall`, which is one
of those cached keys, so generating before the purge would have baked a stale
1,531 into a page corrected for exactly that.

```
SOLD        62   (previous week 76)
TYPICAL     975000
STATUS      published, REWRITTEN over a published edition
PARAGRAPH   written - passed on attempt 1
COST        $0.0003
REVALIDATE  200  /market-watch/2026-08-31
REVALIDATE  200  /market-watch
REVALIDATE  200  /guides
```

The paragraph was regenerated rather than dropped. The stored one was wrong in
almost every clause: it read "Sales of 40 were down from 43" and put $920,000
*below* the 12-month figure, where the corrected week is *above* it. It passed
the validator on the first attempt against the corrected figures.

### Verified on production, not locally

`https://miltonly.com/market-watch/2026-08-31`, 200:

- the correction stamp renders, once, above every figure, with the note verbatim
- 62 homes sold, $975,000, 97.3%, 85 days
- **no occurrence of $920,000 or "40 homes sold" anywhere in the document**
- `datePublished` **`2026-09-10T08:21:38.061Z`**, the original, unmoved
- `dateModified` **`2026-09-10T18:01:25.631Z`**, the correction

That pair is the whole point of the `publishedAt` and `dateModified` changes,
and it is now observable on the live page rather than argued from the code.

`https://miltonly.com/market-watch`, 200: the index serves the corrected
edition as current, carries the same stamp, same figures.

Em-dashes on the edition page: still **4**, the same four site-wide chrome
occurrences catalogued below. The regenerated paragraph adds none; the
validator forbids them.

### CORRECTION to this report, later the same day: the migration-ledger claim

This report justified keeping `correctionNote` out of a column partly on the
grounds that "`_prisma_migrations` in this project is out of step with the live
database". **That was false**, and it is corrected here rather than edited out.

Measured directly against `DATABASE_URL`: **26 rows in `_prisma_migrations`, 0
unfinished, 0 rolled back.** The ledger is clean.

The earlier reading was taken against the wrong database. `prisma migrate
status` cannot run in this worktree, because `schema.prisma` declares
`directUrl = env("DIRECT_DATABASE_URL")` and that variable is absent from this
`.env.local`; the CLI fails `P1012` before opening a connection. The only way
to make it run here is to supply a value, and the nearest-looking one is
`NEON_DATABASE_URL_UNPOOLED`, **which is DB2**. Verified today: **DB2 has no
`_prisma_migrations` table at all**, under either `NEON_DATABASE_URL_UNPOOLED`
or `SOLD_DATABASE_URL`. Point Prisma at it and every migration reports
unapplied, correctly, about the wrong database.

The consequence was real. `20260910120000_market_edition` was applied with
`db execute` on that false premise, so the ledger never recorded it while both
tables existed with data in them. Core caught the drift, verified the live
schema against the migration column for column and index for index, and ran
`prisma migrate resolve --applied` rather than the migration, which would have
failed on `CREATE TABLE`. The row reads `applied_steps_count: 0`, the signature
of a resolve. Nothing broke only because Vercel runs `prisma generate && next
build`, not `migrate deploy`.

**The decision to keep the note in `sectionsJson` stands**, on the other ground
this report gave: nothing queries, filters or sorts on it and only the renderer
reads it. That reason never depended on the ledger. The withdrawn one is now
marked withdrawn in `HANDOFF-content.md`, along with the instruction it
produced, which was the actively harmful part.

### What was deliberately NOT done

- **`scripts/revalidate-figure-pages.ts`, the 487-path pass, was not re-run.**
  Core already ran it after the backfill and the battery passed at the served
  SHA. This write changed one row, and the runner revalidated the three paths
  that read it, all 200.
- **No street or hub regeneration.** Core reports 17 streets crossed k5 and 9
  crossed k10, so some can now publish a figure they were suppressing. Those
  numbers live in `StreetContent` prose, `StreetContent` is Core's, and this
  worktree does not write it. **Flagged for Core, not actioned.**

---

## The regeneration is NOT run *(as written before the addendum above)*

The ruling was: regenerate 2026-08-31 **only after Core reports the battery
green**. It is not green.

Root `HANDOFF.md`, rewritten today, and the two commits after it:

```
FAIL · 11 checks · 449 pages   (at e54d6be, after the redeploy)
  [hub-meta]    hero stat tiles parsed on every hub: 0, expected 22
  [hub-intents] hubs rendering no intent squares: 22, expected 0
```

Both are stale parsers left by `feat/homepage`'s `h-` to `hh-` markup rename,
not broken pages, and `fix/core-batch` is held at `2e8dfc0` waiting on them.
Diagnosed, not fixed. Until they are, the battery cannot report green and the
precondition is unmet.

Nothing about the mechanism is blocked by this. It is built, built green, and
sitting on the preview. **The single command, to be run once Core reports
green, from `D:\miltonly-content`:**

```powershell
$env:CORRECTION_NOTE = "This edition was regenerated on <date>. Its original figures were built from a sold-date bug, since fixed; the figures below are the corrected ones."
$env:WEEK_OF = "2026-08-31"
npx tsx --tsconfig tsconfig.test.json scripts/generate-market-edition.ts --publish --revalidate=https://miltonly.com
```

Not `NODE_OPTIONS=--conditions=react-server`. The runner documents why.

Two things to decide at that moment rather than now, because both depend on
what Core's fix actually changed:

- **the note's wording.** The placeholder above states the shape: what was
  wrong, that it is fixed, that the figures below are the corrected ones. It
  should name the fix in one clause once the fix has a name.
- **whether to pass `--skip-paragraph`.** The stored `interpretation` was
  written against the wrong figures, so it cannot stand. Regenerating without
  the flag writes a new one against the corrected figures, at roughly one cent
  and two DeepSeek attempts. Without a DeepSeek key on the machine, pass the
  flag and the edition publishes sections 1 to 6 with `interpretation` null,
  which is a normal outcome the page already handles.

`--revalidate` needs `REVALIDATION_SECRET` in `.env.local` or it logs
`skipped` and the page keeps serving the old figures from the cache. That has
cost this project 52 pages before.

---

## Gate

`pnpm build > build.log 2>&1`

```
EXIT=0
P2024 occurrences: 0
prebuild: 20/20 PASS, including test-content-validator, 55 assertions
Generating static pages (552/552)
```

Judged on the exit code. 552 pages, up from 548 at the last content build,
which is main's growth arriving through the merge, not this change.

Zero em-dashes added anywhere in the diff, checked on the `+` lines of the
diff itself rather than on the files, which carry pre-existing ones in
comments.

## Diff

```
scripts/generate-market-edition.ts             | 41 ++++-
src/app/api/content/market-watch/route.ts      | 37 ++--
src/app/market-watch/[weekOf]/page.tsx         |  5 +-
src/app/market-watch/page.tsx                  |  5 +-
src/components/marketwatch/MarketWatchPage.tsx |  9 +
src/components/marketwatch/market-watch.css    | 31 +++
src/lib/marketWatch/edition.ts                 | 18 +
src/lib/marketWatch/generate.ts                | 51 +++-
vercel.json                                    |  4 +-
```

No schema change. No migration. No `StreetContent`, `HubContent` or
`CondoContent` write. No header, footer or homepage file touched.

## Preview

**https://miltonly-hsq7pkfiz-gtahomequest-hubs-projects.vercel.app**

Ready, 2m, at `69b11e1`.

| | |
|---|---|
| `/market-watch` | 200 |
| `/market-watch/2026-08-31` | 200 |
| `/guides` | 200 |
| `mw-correction` in the markup | 0, as expected: no edition carries a note yet |
| the edition's figures | 40 homes sold, $920,000, 97.5%, unchanged |
| `datePublished` / `dateModified` | `2026-09-10T08:21:38.061Z` / `...065Z`, distinct, the 4 ms gap between the row's `publishedAt` and `updatedAt` at first write. The field is now reachable, which is the point |

**One observation, not a regression.** The rendered edition carries **four
em-dashes**, and production carries the same four at the same places. Two are
in `og:image:alt` ("Miltonly — Milton Ontario Real Estate platform") and
two in the footer agent bio ("invest — with a focus on first-time
buyers"). Both are site-wide chrome, neither is this tier's prose, and the diff
here adds none. Whoever owns the footer and the OG defaults owns these; noted
so the next reader of `HANDOFF-content.md`'s "zero em-dashes" line knows the
claim was about content prose, not about the whole document.

The correction stamp cannot be seen on the preview: no edition carries a note
until the regeneration runs. What the preview proves is that the page renders
unchanged without one, which is the case every edition but one will be in.
