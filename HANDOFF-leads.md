# Handoff — leads worktree

LEADS · D:\miltonly-leads · feat/leads

_Last rewritten 2026-09-10, after Phase 1 was built and proven on preview. NOT MERGED._

## READ THIS FIRST

**Phase 1 is built and proven on preview at `9b30343`. It is not merged and no merge was
requested.** Preview `miltonly-39gsrzys9`, battery **`PASS · 9 checks · 444 pages · 68s`** at the
full SHA `9b30343720227ebb5ff37475acee9be727a2f4e2`. Local build exit 0, zero `P2024`, **20/20
prebuild**, 545 static pages.

**`main` MOVED WHILE THIS WAS BUILDING.** It is at `e2d8476` (the homepage worktree merged
`d94e6b5`) and production serves it. This branch is based on `4911444`. **Merge `origin/main`
before Phase 2**, and re-run the battery after, because the merge is not trivially empty:
main's homepage work and this branch both touch `package.json`'s prebuild chain.

**TWO MIGRATIONS ARE ALREADY APPLIED TO THE PRODUCTION DATABASE.** `20260910100000_phase1_lead_layer`
and `20260910110000_savedsearch_env`. There is one database behind preview and production, so a
migration lands in production the moment it is applied, while production runs the old code. Every
statement is additive or a loosening — a new column with a default, a new index, a `NOT NULL`
dropped, a view — so the code main is serving cannot notice. **Nothing in a future migration may
drop, rename or tighten a column while this branch is unmerged.**

**`prisma migrate` REQUIRES A `DIRECT_DATABASE_URL` THAT DOES NOT EXIST, AND THE OBVIOUS GUESS
POINTS AT THE WRONG DATABASE.** `DIRECT_DATABASE_URL` is absent from `.env.local` and from Vercel.
Every `NEON_*` variable — including `NEON_DATABASE_URL_UNPOOLED` and
`NEON_POSTGRES_URL_NON_POOLING` — points at the **sold/analytics** project
(`ep-square-voice-anzyg95i`), not at DB1 (`ep-patient-paper-aebh7f93`). Exporting one of those and
running `migrate deploy` reports all 22 migrations as unapplied and would build the entire schema
in the sold database. The correct value is `DATABASE_URL` with `-pooler` removed:

```
export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.local | sed -E 's/^[^=]+=//; s/^"//; s/"$//')"
export DIRECT_DATABASE_URL="$(printf '%s' "$DATABASE_URL" | sed 's/-pooler//')"
npx prisma migrate status   # must say "Database schema is up to date!" BEFORE you deploy anything
```

**Run `migrate status` first, every time, and read the host it prints.**

## Step 0 — what `public.Lead` actually held

**14 rows.** Four are synthetic (`ads-rentals-lp`, the Phase-3 smoke tests). Two are certainly
real people: both `rental-detail-book`, 2026-07-03 and 2026-08-30, real names, Canadian mobiles,
and the second matches the "New lead — Taylor" notification in the mailbox. **The remaining eight
are `homepage-newsletter` and I am not willing to call them real.** All eight arrived between
2026-05-22 and 2026-05-26, all carry the placeholder name "Newsletter Subscriber", the domains are
scattered (`kimballne.org`, `outlook.com`, `hotmail.co.uk`, `icloud.com`) and one is
`s.t.o.u.t.f.i.f@gmail.com`, a dot-variant pattern typical of harvested addresses. Eight signups in
five days on a site that was getting about two Google clicks a week at the time is not a
plausible organic rate. So: **2 confirmed real, 8 unverifiable and probably bot, 4 synthetic**, and
the footer form that produced the eight had no honeypot until this branch. `scripts/read-leads.ts`
prints the census and states its heuristic.

## Where things stand

| | |
|---|---|
| branch | `feat/leads` at **`9b30343`**, **not merged** |
| `main` | **`e2d8476`** — moved under this branch; merge before Phase 2 |
| preview | **`miltonly-39gsrzys9`**, serving `9b30343` |
| battery on preview | **`PASS · 9 checks · 444 pages · 68s`** at the full SHA |
| local build | exit 0, zero `P2024`, **20/20 prebuild**, 545 static pages |
| `public.Lead` | **20 rows**: 15 production (14 original + 1 migrated from ads.leads), 9 preview from the proof |
| `ads.leads` | 1 row, **no longer written by anything**, kept as history |
| `SavedSearch` | **9 rows, all `env=preview`. Production watches: 0** |
| Phase 1 | built and proven on preview; step 4's env half stopped as instructed |

## What Phase 1 built

**One model.** `public.Lead` is canonical. The single `ads.leads` row was copied across as
`adsleads:ads-rentals-lp` — the prefix says where it came from, the rest preserves the campaign tag
that was its only attribution — landing as `cmtvaieml0000e7e8mg7trqkr` with its original
`createdAt`, so it keeps its place in every count by day. `createLead` is deleted;
`estimateLeadValue` stays. **`scripts/migrate-ads-leads.ts` is not in the repo**: `.gitignore:84`
carries `scripts/migrate-*.ts`, so one-off migration scripts are deliberately untracked here. The
move is done and idempotent, and the row id above is the record of it.

**One path.** `/api/leads/create` → `src/lib/lead/ingest.ts`. Response shape unchanged
(`{ok, lead_id}`) so no existing caller broke.

- **honeypot** answers **200**, not 400. A bot that learns which field betrayed it stops sending
  that field; one that believes it succeeded does not.
- **rate limit** per IP (5 / 10 min) and per email (3 / 1 h), Upstash where configured and the
  existing in-memory limiter where not. It **fails open**: a lead lost to an unreachable Redis is
  worse than a duplicate.
- **origin** must be a host we serve. Suffix spoofing (`miltonly.com.evil.example`) is refused.
- **every guard runs before the write**, and the prebuild test asserts that by source position.

**Seven surfaces on one client helper** — `StreetAlertCTA`, `CondoCTAs` (×2), `SoldValuationCTA`,
`ExitIntent`, `CornerWidget`, `PlaceAlertForm`, `DailyBriefSignup`. The helper carries the
honeypot, the page URL and the attribution payload.

**Every lead the site has ever produced shipped a value of 0 to Meta.** `estimateLeadValue`
understands `rent | buy | sell`; the surfaces sent `buyer`, `renter`, `seller`, `home-valuation`.
`normalizeIntent` maps fourteen spellings and the raw token is still stored on the row, so existing
analytics that group on `intent` are unaffected. The proof below shows CAD 200 and CAD 500 landing
where 0 used to.

**Alert surfaces leave a watch behind**, which is what makes the promise keepable. **A watch is
created only when there is a criterion**: one with no street, no area and no price band matches
every active listing in Milton, which is not what someone who left the field blank asked for. The
sender refuses such rows too, for any that predate the rule.

**`/api/alerts/match` had three independent reasons it had never sent anything**, and all three are
fixed: no cron entry (now `0 14 * * *`); POST only, while Vercel crons issue GET (now both); and a
`user.verified` gate that excluded every row a lead surface creates, because those rows carry an
email and no account.

**Leads per page** is `public.lead_daily_by_page`, a **view**, plus `scripts/leads-report.ts`
(`--json` for the Brain). A view because there is nothing to write that `Lead` does not already
hold, and a second copy is a second thing that can be wrong. `page` is the pathname only, host and
query stripped, so one page reached through an ad, a preview host and the apex aggregates into one
row. **It is a count, not a rate** — there is no page-view denominator in this codebase.

**Confirmation copy is chosen by source.** Someone who ticked a street-alert box was previously
told "I'll personally review your request and reply within the hour", a promise a different page
had made. The proof shows "You are watching Bronte Street South" and "Your question about 830
Megson Terrace is in" going to the right people.

**The environment tag, twice.** `Lead.env` came first, and it was **half a guard**: it excluded a
preview submission from the counts and left it in the sends, because `SavedSearch` had no
environment, the cron runs on production, and it read every enabled watch. Each of the six watches
the first proof created would have mailed a test address daily, from production, for as long as the
row lived. `9b30343` gives `SavedSearch` the same tag and makes the sender match watches to the
environment **it is itself running in** — no flag decides it. The host decides the tag, not the
variable: `.env.local` carries `VERCEL_ENV="production"`, so a local dev server would otherwise
write rows claiming to be production.

## The proof, one submission per surface on preview

Every one returned `200 {"ok":true,"lead_id":…,"env":"preview"}`. Confirmation and ops-alert ids
come from the route's own `diagnostics`, which is returned **only** for non-production rows.

| Source | Lead id | Confirmation id | Ops alert id | Value | Watch |
|---|---|---|---|---|---|
| `street-alert` | `cmtvaz4c00000me87z6fpnlvk` | `28678282-adab-487b-b1b5-9c0672868723` | `3e55fabd-6daa-4621-b5f3-3182e4ff02a8` | 200 | street |
| `street-exit-intent` | `cmtvaz4of0002me87dt8ywp0s` | `f4115b29-1865-4593-91c8-134858f58625` | `26b53b05-a91f-48fc-99ba-c7c8e3a34ad6` | 200 | street |
| `street-corner-widget` | `cmtvaz52q0004me87a2o4ygum` | `bca9541b-dafe-43f4-b71a-5299d9827c53` | `e2be28c6-b70b-41d1-99e1-002bd24f1318` | **500** | street |
| `condo-building-alert` | `cmtvaz5f90006me87bxag1flv` | `98b05474-86cc-43b1-b1f4-7c52addd1e65` | `eb7dfd5e-46f4-4117-a394-f8eaa57bca23` | 200 | hub |
| `condo-building-contact` | `cmtvaz5rx0008me87vjvp4z4g` | `f9e9c320-7af5-41ad-9b78-3790db481f07` | `26fdb931-a350-4e5e-91d3-8a80fcebfe3c` | 200 | hub |
| `sold-home-valuation` | `cmtvbfab00000pjwwr89bijw2` | `9d8855ee-d47d-4590-9399-ed108214aed0` | `81a5f9b0-7111-476e-b916-79a7ddbdefd8` | **500** | none, correctly |
| `mosque-alert` | `cmtvbfan00001pjwwlsz967vl` | `06a1f396-bfbb-4046-841c-4cc320b43f7e` | `4b11d411-7142-4d10-92fa-c112e911234d` | 200 | hub |
| `school-alert` | `cmtvbfazv0003pjwwgr66rn25` | `6696f2f4-945c-45de-88d5-08f02dda6d7f` | `13fa111a-c93e-472e-bc13-1cddda3c60d4` | 200 | hub |
| `daily-brief` | `cmtvbfbd10005pjwwslu51zad` | `eb3f806a-c9d1-4e68-b72f-4414769a0d97` | `6ef4d519-3e11-4753-b4c8-8b7d3dd3fdd8` | 200 | **brief** |

Ops alerts arrive titled `[preview] New lead — <source>` and carry `env` and the value. Street
slugs resolved correctly through `streetNameToSlug` (`bronte-street-south-milton`,
`pine-street-milton`).

**The guards, on the deployment, not in a unit test.** No `Origin` and no `Referer` → **403**,
which is exactly the curl that wrote a production row in Phase 0. Foreign origin → 403.
`miltonly.com.evil.example` → 403. Honeypot filled → **200 `{"ok":true}` with no lead id and no
row**. No contact → 400. The sixth submission from one IP inside ten minutes → **429**, against
real Upstash.

**One alert send, twice.** First at `4picofbpu`: 3 sent of 6 checked, recipients resolved from
`email` with no User, `lastAlertAt` and `lastMatchCount` written. Then at `39gsrzys9` after the env
fix: **`env: "preview"`, 1 sent of 8 checked**, "2 new listings matching New listings in Beaty"
delivered. `production` watches: **0**, so the cron's first real run mails nobody.

**Preview rows are excluded from the counts** while every one of them carries a page:
`leads-report.ts` prints `env=production: 4 of 15 rows carry a page` and
`env=preview: 5 of 5 rows carry a page`, and the table shows only the production row.

## What was NOT done, and why

**Step 4's environment half stopped, as instructed.** `KVCORE_LEAD_PARSE_EMAIL` has no value in
`.env.local` **or** in Vercel, so there was nothing to set it from. The parser email is wired into
the one path and fires on every lead; `kvcore.ts` documents that an empty variable is a silent
no-op, so it stays dormant until someone supplies the BoldTrail inbox. **Setting it is a decision
for Aamir**, and once set, every lead reaches the CRM with no further code change.

**Nine funnel surfaces still post to `/api/leads`**, the 1,201-line monolith:
`LeadCaptureForm`, `UnlockModal`, `HomeValuationCard`, `MarketPulseUnlockCard`, `AamirTrustCard`,
`ListingDetailClient`, `ListingExtras`, `ListingsCardsClient`, `RentalsClient`. They carry
thank-you redirects, CASL consent snapshots, the market-pulse stats packet and GA4 contracts, and
moving them is a bigger job than adding a guard. `normalizeIntent` means their intent tokens are
now scored correctly the moment they move; until then they keep the old route's own honeypot and
in-memory limiter. **Their leads do not get the source-specific confirmation or the env tag.**

**Three homepage forms were deliberately left alone** — `PreFooterCTA`, `PersonaRouter`,
`SoldOnMyStreet`. They are `src/components/sections/*` rendered by the homepage, which belongs to
`feat/homepage`. `PreFooterCTA` is the surface that produced the eight questionable newsletter
rows, so it is the one most worth a honeypot; that is a request to make of that worktree, not a
change to make here.

**`OffMarketForm` still posts to `/api/off-market-leads`.** It captures a phone and no email, so it
cannot receive a confirmation; folding it in means deciding what a phone-only lead is promised.

**The daily brief has no sender.** Step 6 asked for the source and the watch kind and said the cron
is later. `kind: "brief"` is explicitly excluded from `/api/alerts/match` — a digest of what changed
is a different query from a match notification — and the signup copy says the brief starts tomorrow
rather than promising something today. `DailyBriefSignup` is mounted on `/sell`, the one page this
worktree owns.

## Traps

- **`prisma migrate status` before every migration.** See the top of this file.
- **Preview writes to production data**, and preview deployments are where lead testing happens.
  Rows and watches are tagged now, so they are excluded from counts and sends, but they are real
  rows in the real table.
- **Vercel env vars bind at deploy time.** `CRON_SECRET` was added to Preview and the running
  preview kept answering 401 until it was redeployed. A `vercel redeploy` gives a **new URL**.
- **`LEAD_ALERTS_ON_PREVIEW=true` is set in Preview only.** It makes preview leads raise a
  prefixed ops alert so the path can be proven. It cannot make a row countable.
- **`CRON_SECRET` is now in Preview too**, added so the alert job could be triggered there. Vercel
  only schedules crons on production; this only widens manual triggering.
- **The `name-prose` prebuild guard reads string literals, not just page copy.** It failed a build
  on an em-dash inside a `notes:` template string.
- **The rate limit is real on preview.** Six submissions from one IP inside ten minutes will refuse
  the sixth, which makes a nine-surface proof a two-batch job.
- **`scripts/migrate-*.ts` is gitignored** (`.gitignore:84`). Do not expect a migration script you
  wrote to be committed; put the durable part in `prisma/migrations` and the record in a report.
- **545 static pages, not 546.** One fewer than Phase 0 reported. Published streets (445), hubs (22)
  and the battery's page set (444) are all unchanged, `/sell` is still statically rendered, and the
  delta is in a data-driven param set on a route this branch does not touch.

## Next

Phase 2 begins only on an explicit prompt. Before any of it: **merge `origin/main`** and re-run the
battery. The obvious candidates are the nine funnel surfaces, a lead dashboard for the MOD-58
columns that still have no UI, the daily-brief sender, and the street-grain valuation figure on
`/sell` from report 062's G10, which Phase 1 did not touch.
