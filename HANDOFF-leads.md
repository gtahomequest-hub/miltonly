# Handoff — leads worktree

LEADS · D:\miltonly-leads · feat/leads

_Last rewritten 2026-09-17, after ML-004 put CASL on every recurring email and consent text on every surface._

## READ THIS FIRST

**ML-004, ML-003 AND ML-002 ARE ON THIS BRANCH, AWAITING CORE'S MERGE.** Proven tree
**`7eeeb79a17f848ee23e8819a60743ab6568116fc`**, with `origin/main` `5ac650b` merged in clean
as `8b0a17a`; the head is one docs commit above it. Merge the head. Record in `scratchpad/reports/ML-004-casl-consent.md`.

**EVERY RECURRING EMAIL NOW CARRIES ONE FOOTER AND ONE UNSUBSCRIBE.** The brief, the deal
alerts (`sendDealAlertEmail`) and the weekly leads digest all render `src/lib/email/footer.ts`:
sender, brokerage, `config.brokerage.mailingAddress`, why the reader is receiving it, and a
signed one-click link, in both bodies, plus `List-Unsubscribe` and `List-Unsubscribe-Post`
headers from `listUnsubscribeHeaders`. `src/lib/brief/unsubscribe.ts` moved to
`src/lib/email/unsubscribe.ts` and signs ANY watch id; `/api/unsubscribe` is the route every
new link points at, `/api/brief/unsubscribe` still answers for links already in inboxes, and
both mount `src/lib/email/unsubscribeHandler.ts`, which names what stops by kind. A sender
that cannot sign refuses before its loop (`canSignUnsubscribe`). A deal alert that did not go
out no longer stamps the watch. **Proven on preview `miltonly-md810529s`:** one brief, one
deal alert and one digest received; one-click POST, GET, the legacy path and a forged token
each answered as designed; after the unsubscribes both senders found nothing to send.

**THE DIGEST'S RECIPIENT IS NOW A WATCH.** `src/lib/digest/recipient.ts` finds or creates a
`SavedSearch` of kind `digest` per (address, environment) on every send, so the desk's
unsubscribe has a row to disable; a disabled row makes the route return
`skipped: "recipient unsubscribed from the digest"`. `/api/alerts/match` excludes `brief` and
`digest` by name. A dry run creates nothing.

**THE MAILING ADDRESS IS THE ONE THE SITE ALREADY PUBLISHES**, `178 Lemieux Ct, Milton, ON
L9E 1E9`, the LocalBusiness address on `/rentals/ads`. If CASL should carry the brokerage
office instead, change `config.brokerage.mailingAddress` once. Nothing was invented.

**ALL 26 LEAD SUBMISSIONS SEND `consentText`, AND THE PREBUILD HOLDS THEM TO IT.**
`src/lib/lead/finePrint.ts` holds the four shared disclosures (`ALERT_`, `REPLY_`,
`VALUATION_`, `SMS_EMAIL_FINE_PRINT`); `DailyBrief`, `HomeValuationCard` and
`MarketPulseUnlockCard` keep their own `CONSENT_TEXT`. The rule is: a surface renders a named
constant in JSX and sends the same constant, so the row records the words the visitor saw.
`scripts/test-lead-forms.ts` fails a submission with no `consentText`, a string literal, an
opaque payload (`postLead(data)`) or a constant the file never renders. **Nothing was
backfilled**; rows before the deploy that carries this have whatever they had.

**THE STREET ALERT CARD SAYS "LISTED FOR SALE".** `/api/alerts/match` reads new active listings
only; nothing sends a sold alert. The card body (`street-data.ts`), its done copy, the address
ladder's watch card, both `resaleClaim` CTA bodies, the mock data and the confirmation line in
`notify.ts` all say listed now. The condo card and its confirmation line took the same one-line
fix. When a sold alert exists, put the promise back in those seven places.

## Where things stand

| | |
|---|---|
| branch | `feat/leads`, ML-004 on ML-003 on ML-002, `origin/main` `5ac650b` merged. Proven tree **`7eeeb79`**, head one docs commit above |
| Phase 2 merge on main | **`543ef99`** (merges `26381f9`) |
| last preview of this branch | `miltonly-3obrz4ffz` at `7eeeb79` (battery); the sends were from `miltonly-md810529s` at `1721347` |
| battery there | `--only=claims,nav,footer,homepage` **PASS** after the preview's surface cache was purged (see Traps) |
| prebuild, lead layer | `[lead-guards] 209` · `[lead-forms] 221` · `[leads-digest] 232` assertions |
| `public.Lead` | 25 production rows (10 `sale-detail` on 2026-09-11 alone, on four listings; open item 7), 30 preview |
| `SavedSearch` | the three ML-004 preview rows were deleted; the preview `digest` row is recreated on the next preview send |
| ingress routes | **one**: `/api/leads/create` |
| Phase 0, 1, 2 | **all merged** |
| `BRIEF_UNSUBSCRIBE_SECRET` | **set** in both environments and bound (the ML-004 preview signed with it); the name stays, the module is generic |
| `LEADS_DIGEST_TO` | **unset everywhere**, deliberately. The digest falls back to `ALERT_EMAIL_TO` |

## The shape that shipped

```
a form  →  postLeadDetailed()  →  POST /api/leads/create  →  ingestLead()
           src/lib/postLeadClient.ts                          src/lib/lead/ingest.ts
                                                                ├─ guards.ts    honeypot, origin, rate limit
                                                                ├─ fields.ts    every form→column mapping
                                                                ├─ score.ts     the one scoring rule
                                                                ├─ intent.ts    the value vocabulary
                                                                ├─ notify.ts    confirmation + ops alert
                                                                ├─ sms.ts       Twilio, countable env only
                                                                └─ savedSearch.ts  street | hub | price-band | brief

a brief watch  →  /api/brief/send (cron 15 13 * * 1-5)  →  src/lib/brief/
                                                             ├─ window.ts     the local-day period
                                                             └─ compose.ts    the reads and the copy
a listing/street/hub/band watch  →  /api/alerts/match (cron 0 14 * * *)  →  sendDealAlertEmail (src/lib/email-user.ts)

every recurring email  →  src/lib/email/
                          ├─ footer.ts             sender, brokerage, mailing address, why, the link (ML-004)
                          ├─ unsubscribe.ts        HMAC over the watch id, any kind, fails closed
                          └─ unsubscribeHandler.ts one click, GET or POST, names what stops
                  /api/unsubscribe  ← every new link;  /api/brief/unsubscribe  ← links already in inboxes
a form's fine print  →  src/lib/lead/finePrint.ts  ← rendered AND sent as consentText, held by test-lead-forms.ts

the desk  ←  /api/digest/leads (cron 0 11 * * 1 and 0 12 * * 1, runs at Toronto hour 7)  →  src/lib/digest/
                                                                                          ├─ window.ts     7 and 28 local days ending Sunday, both bases
                                                                                          ├─ compose.ts    the reads and the copy
                                                                                          └─ recipient.ts  the desk's digest watch, the row its unsubscribe disables
             every send attempt in ingest  →  LeadActivity email_sent | email_failed  (notify.ts recordDeliveries)
             src/lib/lead/sources.ts  the mounted surfaces, held to src/ by scripts/test-leads-digest.ts
```

`scripts/test-lead-forms.ts` walks `src/` at prebuild and fails the build on a lead ingress
named anywhere but `/api/leads/create`. Full Phase 2 record, with the four live defects the
migration found and fixed, in `scratchpad/reports/067-leads-phase2.md`.

## The rulings Phase 2 made

- **A phone-only lead is promised a call and nothing by email.** `OffMarketForm` captures no
  address, so: no confirmation, no watch, and the desk alert plus the SMS to Aamir ARE the
  delivery. Stated on the card.
- **`homepage-newsletter` leaves no watch.** `PreFooterCTA` promises a brief "Sundays at 8am"
  and the sender is Monday to Friday. Mapping it to a `brief` watch would mail five times a
  week. **See the open item below.**
- **`alert` and `new-match-alert` make `price-band` watches.** The band is the only criterion
  those surfaces capture.
- **A `brief` watch keys on the address alone**, not on its street, so a subscriber who signs up
  from two pages gets one brief. The street is still stored, because it personalises the edition.
- **Monday's brief covers the weekend.** Sending Mon–Fri and reporting a literal "yesterday"
  would mean Saturday was reported to nobody, ever.
- **"Changed price", never "dropped"** (DEC-PRICE-CHANGE-NOT-DROP). `lastPriceChangeAt` cannot
  tell a cut from a rise, and the prebuild gate fails on the word. **One sale is below
  `K_ANON_PRICE`**, so the count is published, the price is not, and the clause says which. **An
  edition with nothing in it is not sent.**

## Traps

- **A fresh preview's Data Cache holds the published street set for an hour, and only
  production's writes revalidate it.** The homepage check failed `proof-street-pages` 589 vs
  606 on `miltonly-3obrz4ffz` minutes after deploy. `POST /api/revalidate?secret=…` with
  `{"path":"/streets"}` on the preview, then re-run. Production was never wrong.
- **A CLI preview reports `/api/build` as "unknown" unless the SHA is passed:**
  `npx vercel deploy --yes -e VERCEL_GIT_COMMIT_SHA=<head>`. Without it the battery aborts at
  the deployment gate.
- **`git add -A` picks up `vercel-deploy*.log`.** Delete the logs before staging.
- **The unsubscribe token is HMAC(watch id) and nothing else**, so a link works on either route
  and a link minted before ML-004 still verifies. Changing the HMAC input invalidates every link
  in every inbox; do not.
- **Preview proof watches go in by script, not by form:** a form submission spends a rate-limit
  token, writes a Lead row and fires the desk alert. `prisma.savedSearch.create` with
  `env: "preview"` and a `+tag` address does not. Delete them after.

- **`origin/main` moved twice during ML-003** (sold-sync purge, menu v2). The first push built at
  `ee846bf` without them; the ancestor check caught it, main was merged, the tree rebuilt and
  re-pushed. **Run the ancestor check after the LAST fetch, not the first.**
- **The digest slot guard refuses everything but Monday 07:00 Toronto.** A manual trigger needs
  `force=true`; `dryRun=true` computes and returns without sending and needs no force. The
  Preview `CRON_SECRET` is the value in `.env.local`; a bearer header against the preview URL works.
- **`LEADS_DIGEST_TO` overrides the recipient wherever it is set.** Set on Preview for the proof
  and deleted after. The running `miltonly-bsn6qltes` deployment still has it bound; a new
  preview deploy does not.
- **`scripts/migrate-digest-dry.ts`** (gitignored) composes the digest locally for any instant:
  `npx tsx --tsconfig tsconfig.test.json scripts/migrate-digest-dry.ts 2026-09-14T11:00:00Z`.
- **`git commit-tree` DOES NOT MERGE — it snapshots.** Re-check
  `git merge-base --is-ancestor origin/main HEAD` after the last fetch and **STOP if it fails**;
  merge main into the branch first, then build from that tree.
- **`sold_date` is a date wearing a timestamptz. Read it on `win.dateStartUtc` /
  `win.dateEndExclusiveUtc`, never on `win.start` / `win.end`.** The instants are for DB1's real
  timestamps only. The prebuild reads the sold query off the source and fails on the instants.
- **The prebuild rate-limit test runs against the real Upstash store on Vercel.** The Upstash
  variables ARE set on a Vercel build. The key now carries per-run entropy (`f9b7ea5`) and the
  assertion states what holds of both stores. Do not reintroduce an exact "5 per window" claim.
- **The rate limit is real on preview and a REFUSED call still spends a token.** 5 per IP per 10
  minutes, sliding. Wait a clear ten minutes with **zero** requests between proof batches.
- **Preview writes to production data.** Rows and watches are tagged and excluded from every
  count and every send, but they are real rows in the real table.
- **`LEAD_ALERTS_ON_PREVIEW=true`** (Preview only) makes preview leads raise a prefixed ops
  alert. It cannot make a row countable.
- **`CRON_SECRET` is in Preview**, which is what lets the brief be triggered there by hand.
  Vercel only schedules crons on production.
- **Vercel env vars bind at deploy time.** A new variable needs a redeploy, and `vercel redeploy`
  gives a new URL. This is why `BRIEF_UNSUBSCRIBE_SECRET` is set but not yet live.
- **`prisma migrate deploy` and the migration ledger are Core's**, per main's `HANDOFF.md` and
  the migrations audit on main (`bb32044`, `217e9ef`). **The lead layer needs no migration.**
- **`DIRECT_DATABASE_URL` is `DATABASE_URL` with `-pooler` removed.** Every `NEON_*` variable
  points at the sold/analytics project. Run `npx prisma migrate status` and read the host it
  prints, every time.
- **`scripts/migrate-*.ts` is gitignored** (`.gitignore:84`) — the place for a throwaway script
  that needs `@prisma/client`.
- **The `name-prose` prebuild guard reads string literals**, not just page copy.
- **Reports are now `scratchpad/reports/<TASK-ID>-<slug>.md`**, first line `# <TASK-ID>`,
  tracked in git. Leads tasks are `ML-`. The numbered series (062–068) is closed.

## What is open

1. **`lead_daily_by_page` buckets by UTC day.** One-line fix, `AT TIME ZONE 'America/Toronto'`
   in a `CREATE OR REPLACE VIEW` migration; Core's ledger. Until then the digest states the
   basis and the route's cross-check shows the gap, which was 0 on 2026-09-11.
2. **The first production digest is Monday 2026-09-14 at 07:00 EDT (11:00 UTC)** if the merge
   deploys before then. Its delivery counts will be partial: the log begins at the deploy.
3. **The Sunday brief `PreFooterCTA` promises has no sender.** Either its copy becomes the daily
   brief and its source becomes `daily-brief` (homepage worktree owns the copy), or a weekly
   sender gets built. Today those subscribers get a confirmation and nothing after it.
4. **`BRIEF_UNSUBSCRIBE_SECRET` is bound** on preview (ML-004 signed with it) and binds on
   production with the next deploy there. Nothing to build.
5. **The brief cron is live on production** since the Phase 2 merge deployed. Production brief
   watches are **0**, so each run sends nothing. The first real subscriber makes it real.
6. **Eight questionable `homepage-newsletter` rows** predate that surface having a honeypot.
   Still in the table, untouched.
7. **Ten `sale-detail` leads on 2026-09-11**, on four listings, in a table that held 15 rows the
   day before. Not examined; see item 11.
8. **Nine preview watches** remain, matching Phase 1's posture. Tagged, so no cron reads them.
9. **`/api/seo/digest` (Core, behind `ORGANIC_LOOP_ENABLED`) sends with no footer and no
   unsubscribe.** `emailFooter` and a `digest`-kind watch through `digestWatchFor` would give it
   both in a few lines; it is Core's file.
10. **The rentals alert strip promises "SMS alert before it appears on any other site"** and
    the cron sends email, daily, about listings already on the site. Rentals tier's copy.
11. **64 `sale-detail` leads in 7 days across 30 listings, 1 to 5 per page**, in the ML-004
    proof digest. Item 7 is now a pattern, not a day. Read the rows before they are read as demand.
12. **Production's homepage check fails `proof-sales-12mo` 1,723 vs 1,712** at `10de234`,
    on production, with no lead code involved. Main's.
13. Still open from report 062: **G10, the street-grain valuation figure on `/sell`**, and the
   MOD-58 lead admin columns with no UI.
