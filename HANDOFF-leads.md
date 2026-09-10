# Handoff — leads worktree

LEADS · D:\miltonly-leads · feat/leads

_Last rewritten 2026-09-10, after Phase 1 merged to main and production was verified on it._

## READ THIS FIRST

**Phase 1 is MERGED and live.** Merged as **`3461e13`**, a two-parent merge
(`f6bbc92` + `5f5f782`) built with `commit-tree`. Production serves it on the apex and the battery
is **`PASS · 10 checks · 444 pages · 63s`** at the full SHA
`3461e1392b8197df4c7ded75cad8a9f13b4114b0`. The battery is 10 checks now, not 9 — the homepage
worktree added `scripts/verify/checks/homepage.mjs`.

**Two merges were needed, not one.** `origin/main` moved twice while this branch was building:
first the homepage tier (`e2d8476`), then the guides and Market Watch tier (`f6bbc92`). The second
merge conflicted on exactly one thing, `package.json`'s prebuild chain, and **the resolution was a
union, not "keep theirs"**: content had added `test-content-validator`, this branch had added
`test-lead-guards`, and 19 were common. Taking either side whole would have silently dropped a
gate. **21 prebuild tests run now.** Header, footer and the guides came across untouched.

**`prisma migrate deploy` IS BLOCKED FOR EVERYONE, AND IT IS NOT THIS BRANCH'S TO FIX.** The
database has `20260910120000_listing_price_history` in `_prisma_migrations`; main carries
`20260910120000_market_edition`, which the ledger has never heard of. **The `MarketEdition` table
EXISTS**, so this is a migration folder renamed after it was applied, not a missing table. Whoever
renamed it needs to reconcile the ledger (`prisma migrate resolve`). Until then `migrate deploy`
will try to apply `market_edition` onto a table that already exists and fail. This branch needs no
further migration, which is why the merge went ahead.

**`DIRECT_DATABASE_URL` is now set in Vercel Production and Preview**, pointing at
`ep-patient-paper-aebh7f93.c-2.us-east-2.aws.neon.tech` — DB1's unpooled host, which is
`DATABASE_URL` with `-pooler` removed. It had never existed anywhere, and **every `NEON_*` variable
points at the sold/analytics project instead**, so the obvious guess would run migrations against
the wrong database. Locally, derive it the same way:

```
export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.local | sed -E 's/^[^=]+=//; s/^"//; s/"$//')"
export DIRECT_DATABASE_URL="$(printf '%s' "$DATABASE_URL" | sed 's/-pooler//')"
npx prisma migrate status   # read the host it prints, every time, before deploying anything
```

**THE HOMEPAGE SHIPPED A SECOND DAILY-BRIEF FORM ON A DIFFERENT PATH.**
`src/components/home/DailyBrief.tsx` posts to **`/api/leads`** with source **`daily-brief`** — the
same source tag `DailyBriefSignup` on `/sell` uses, through the old monolith. Its comment says
"Leads owns the model (ruling, 2026-09-10)", so this was deliberate and left for this worktree. The
consequence today: **two code paths write the same source, and only one of them leaves a watch**.
A homepage brief signup gets no honeypot, no `env` tag, no source-specific confirmation and **no
`SavedSearch` of kind `brief`**, so the brief sender will not find those people. **This is the first
item of Phase 2.**

## Where things stand

| | |
|---|---|
| `main` | **`3461e13`** — two parents, `f6bbc92` (main) and `5f5f782` (feat/leads) |
| production | **`miltonly-3bxdbhb55`**, serving `3461e13`, confirmed on the apex |
| battery on production | **`PASS · 10 checks · 444 pages · 63s`** at the full SHA |
| battery on preview | **`PASS · 10 checks · 444 pages · 59s`**, `miltonly-822kndpq3` at `5f5f782` |
| local build | exit 0, zero `P2024`, **21/21 prebuild**, 547 static pages |
| `public.Lead` | **15 production rows**, 9 preview rows from the proof |
| `SavedSearch` | 9 rows, all `env=preview`. **Production watches: 0** |
| `ads.leads` | 1 row, not written by anything, kept as history |
| Phase 0, Phase 1 | **done**. Phase 2 not started |

## The production proof, and what it cost

One real-shaped submission through the `/sell` daily-brief form, at
`https://miltonly.com/sell`. The honeypot field renders on the live page (`company_website` is in
the served markup), which is how you can tell the form on production is the new one.

| | |
|---|---|
| response | `200 {"ok":true,"lead_id":"cmtvehhuo0000mmbtri67f37p","env":"production"}` |
| row | `source=daily-brief`, `intent=buy`, `env=production`, **`landingPage=/sell`**, `score=cold` |
| watch | `cmtvehhyl0001mmbt83wiqc8q`, `kind=brief`, `env=production` |
| confirmation | "Your Milton daily brief starts tomorrow", Gmail id **`1a08aeb735a5831c`**, 10:44:40Z |
| ops alert | "New lead — daily-brief", **no `[preview]` prefix**, `env: production`, CAD 200, Gmail id **`1a08aeb7425f8738`** |

**The Resend ids are deliberately not available for a production lead.** The route returns
`diagnostics` — which is where the confirmation and ops-alert ids come from — **only for
non-production rows**, so a real lead never carries email ids in an HTTP response. The Gmail message
ids above are the production-side evidence. If Resend ids are wanted for production leads, that is a
logging change, not a response change.

**Both the row and the watch were deleted.** Deleting the lead and leaving the watch would have made
a test address the only production brief subscriber, and the brief sender is a later step that would
have found it sitting there. `production Lead rows: 15`, `production watches: 0`.

## What Phase 1 shipped

One model: `public.Lead`, with the single `ads.leads` row copied across as
`adsleads:ads-rentals-lp` and `createLead` deleted. One path: `/api/leads/create` →
`src/lib/lead/ingest.ts`, with a honeypot that answers **200** rather than 400, per-IP (5/10 min)
and per-email (3/1 h) rate limits that **fail open**, and an origin check that refuses suffix
spoofing. Every guard runs before the write and the prebuild test asserts that by source position.
Nine surfaces on one client helper. `normalizeIntent` maps the fourteen spellings the surfaces send
onto the three tokens `estimateLeadValue` understands — **every lead this site ever produced had
been shipping a value of 0 to Meta**. Source-specific confirmation copy. A `SavedSearch` for every
alert surface, created only when there is a criterion to watch. `/api/alerts/match` fixed on all
three counts that had kept it silent (no cron entry, POST-only against GET crons, a verified-user
gate that excluded every lead-created row). `public.lead_daily_by_page` and
`scripts/leads-report.ts` for leads per page — a count, not a rate. And `Lead.env` plus
`SavedSearch.env`, because preview and production share one database and tagging the lead without
tagging the watch it creates is half a guard.

Full detail, including the nine-surface proof table with every confirmation and ops-alert id, is in
the git history of this file at `fbbb7d9`.

## Traps

- **`prisma migrate status` before every migration, and read the host.** See above.
- **Preview writes to production data.** Rows and watches are tagged, so they are excluded from
  counts and from sends, but they are real rows in the real table.
- **Vercel env vars bind at deploy time.** A newly added variable needs a redeploy, and
  `vercel redeploy` gives a new URL.
- **`LEAD_ALERTS_ON_PREVIEW=true`** (Preview only) makes preview leads raise a prefixed ops alert so
  the path can be proven. It cannot make a row countable.
- **`CRON_SECRET` is in Preview** so the alert job can be triggered there manually. Vercel only
  schedules crons on production.
- **The rate limit is real on preview**: six submissions from one IP inside ten minutes refuses the
  sixth, which makes a nine-surface proof a two-batch job.
- **`scripts/migrate-*.ts` is gitignored** (`.gitignore:84`).
- **Report numbers 062, 063 and 064 exist three times over** — leads, homepage and content each
  numbered independently. The filenames differ so nothing collided. Renaming committed reports would
  break the references that already point at them; pick 065+ next.
- **The `name-prose` prebuild guard reads string literals**, not just page copy. It failed a build
  on an em-dash inside a `notes:` template string.

## Phase 2, on the next prompt

1. **`src/components/home/DailyBrief.tsx`** — the second daily-brief path, described above. Same
   source tag, no watch, no env tag. Fix this first or the brief sender ships with a hole.
2. **The nine funnel surfaces still on `/api/leads`**: `LeadCaptureForm`, `UnlockModal`,
   `HomeValuationCard`, `MarketPulseUnlockCard`, `AamirTrustCard`, `ListingDetailClient`,
   `ListingExtras`, `ListingsCardsClient`, `RentalsClient`. They carry thank-you redirects, CASL
   consent snapshots, the market-pulse stats packet and GA4 contracts, which is why they were not
   moved in Phase 1.
3. **The three homepage forms** — `PreFooterCTA`, `PersonaRouter`, `SoldOnMyStreet`. Their
   submission is this worktree's now. `PreFooterCTA` is the surface that produced the eight
   questionable `homepage-newsletter` rows and it still has no honeypot.
4. **`OffMarketForm`** and `/api/off-market-leads`. It captures a phone and no email, so folding it
   in means deciding what a phone-only lead is promised.
5. **The daily-brief sender.** `kind: "brief"` is deliberately excluded from `/api/alerts/match` —
   a digest of what changed is a different query from a match notification — and the signup copy
   promises only that the brief starts tomorrow.

Still open from report 062 and untouched by Phase 1: **G10, the street-grain valuation figure on
`/sell`**, and the fact that the MOD-58 lead admin columns still have no UI.
