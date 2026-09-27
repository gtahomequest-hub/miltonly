# Handoff — leads worktree

LEADS · D:\miltonly-leads · feat/leads

_Last rewritten 2026-09-24, after ML-012 gave the rental cards' muted ramp a ground and made the card's street link the published page or nothing._

## READ THIS FIRST

**ML-012 AND ML-005 ARE ON THIS BRANCH, GATED, PREVIEWED, AWAITING CORE'S MERGE.** The proven
tree is **`4bc9343e613c9770291c68014937aba12f85d21c`**; above it sit only the docs commit (this
handoff, the queue mark, the report and the evidence) and a docs-only merge of `origin/main` at
`c636e20` (MC-045's report). No app file differs between `4bc9343` and the tip. One preview, `miltonly-ahq9hojts` at
`4bc9343`, battery **`PASS · 24 checks · 719 pages · 617s`**; local battery on `next start` at the same SHA
**`PASS · 24 checks · 719 pages · 593s`**; local gate exit 0 in 709 s, 841 of 841 pages. `origin/main` at
`be6c5bc` (MC-043) was merged in as `bcf9a18` before the work and `c636e20` (MC-045, docs) after
the preview, so the tip carries MA-010, MC-043 and MC-045. Core merges
`4bc9343` or the tip by SHA; both carry ML-005 (`064c5b6`), whose own preview never completed
under the 402 pause. ML-012 fixes a live production defect, so under DEC-BATCH-MERGE it merges
and deploys alone. Record in `scratchpad/ml012/ML-012-rentals-cards.md`.

**THE RENTAL CARDS' SPECS WERE WHITE ON WHITE SINCE 2026-09-13 (aaff821).** `--t4` is declared
on `.rentals-page` only; aaff821 moved it to white at 72%, right on the deep ground where 16 of
its 21 live reads sit and 1.0:1 on the white card (beds, baths, parking, "/ month", the
separator). `--t3` went the other way, to `#6b6f6a`, 2.4:1 on the navy for 11 reads. The token
had no ground. `rentals.css` now declares the deep-ground ramp at the root (`--t3` white at 60%)
and the two light islands, `.listings-sec` and `.sdrop`, redeclare it for a light ground
(`#6b6f6a`, `#6e726d`, `#6e726d`). **A rule picks a step; the ground picks the value. Never patch a
consumer with a literal.** Six literals in that file now read the ramp: `.q-of`, `.back-lnk`,
`.submit-note` (the CASL fine print under the wizard submit), `.ra-count`, `.ra-label`, the MLS
line. Measured on production before and the preview after: the four fields 1.0:1 to 4.89:1, the
Back link and the fine print 1.0:1 to 6.04:1 and 8.04:1, the rent band 2.56:1 and 3.97:1 to
5.72:1 and 7.53:1, the booking card and alert strip lines 2.39:1 to 5.43:1.

**THE CARD'S STREET LINK IS THE PUBLISHED PAGE OR NOTHING.** `RentalsClient` sliced a slug out
of the address text, unit included (`costigan-road-103`, `yates-drive-1-bsmt`): 114 links to
404 pages across `/rentals`, `/rent`, Timberlea and Harrison on 2026-09-24, and not one direct
200. `src/lib/rentalStreetPage.ts` (`withRentalStreetPages`) resolves the row's `streetSlug` the
way the middleware resolves an inbound URL (exact, the curated map, the identity rule) and links
it only when it is in `publishedStreetPageSlugs()`, the sitemap's set; the anchor text is the
page's own heading (the rural side-road name, then the published row's `streetName`, through
`resolveStreetName`), never the listing's `streetName`, which carries "520 A" and "E". No page,
no street entry; the neighbourhood link stays. A withheld listing is null before any lookup, and
`streetSlug` and `streetName` leave every row before serialisation. After: 0 links 404, 0
redirect, 172 answer 200, 13 cards render with no link (feed slugs with no page: `clarriage-court`,
`robert-street`, `nipissing-street`, `mctrach-crescent`, `ontario-street-s-street`,
`wise-crossing-n-a`, `mcdougall-cross-n-a`, `mccandles-court`, `mcdougall-crossing-n-a`). The
canonical rule rescues `nipissing-rd-road-milton`. The `/rentals` Upstash bundle key is `v4`.

**FOUND, MEASURED, NOT FIXED (a design decision, the owner's):** the accent override block at
the top of `rentals.css` (lines 19 to 27) loses every cascade contest to the later
equal-specificity rules that paint `var(--amber)`, which aaff821 remapped to `#017848`. Live: the
hero's "Milton" 2.56:1, the "Search →", "Show results", "Save this search →" and wizard primary
buttons 2.56:1 (navy on `#017848`), `.ra-eyebrow` and `.trust-why-ico` 2.56:1, `.ra-view`
2.35:1, `.mc-v em` 2.20:1, `.q-badge` 1.72:1, `.vtab.on` 2.95:1. Moving the block to the end
breaks `.lbtn-1h` and `.bc-btn`; each selector needs its ground decided. Also sub-AA: four
`#8a8f8a` literals at 4.32:1 on the navy, and `AgentContactSection`'s email line at 3.98:1 (Home's).

**ML-005 (2026-09-19) IS UNCHANGED BENEATH THIS.** The bot gate on the lead ingress: Gmail alias
collapse, daily windows, the user-agent guard; `scripts/test-lead-bot-gate.ts` runs 100 bot
submissions through the real path at prebuild (21 assertions, passed in this build). The 64
sale-detail bot rows were purged; `public.Lead` was 46 rows. Record in
`scratchpad/reports/ML-005-bot-gate.md`.

**ML-004 IS MERGED AND LIVE** (`7196623`, MC-028; production served it from 2026-09-18). CASL on
every recurring email, `consentText` on all 26 submissions. Record in
`scratchpad/reports/ML-004-casl-consent.md`.

## Where things stand

| | |
|---|---|
| branch | `feat/leads`, proven tree **`4bc9343`** (ML-012) above ML-005 `064c5b6` and the main merge `bcf9a18`, one docs commit on top; ML-004 and below merged as of `7196623` |
| last preview of this branch | **`miltonly-ahq9hojts`** at `4bc9343`, **`PASS · 24 checks · 719 pages · 617s`** |
| local gate at `4bc9343` | `pnpm build` on Node 22, exit 0, 709 s, 841 of 841, 0 `P2024`; local battery **`PASS · 24 checks · 719 pages · 593s`** |
| prebuild, lead layer | `[lead-guards]` · `[lead-forms] 222` · `[leads-digest]` · `[lead-bot-gate] 21` · `[vow-fields] 111` assertions |
| ML-012 evidence | `scratchpad/ml012/`: `measure.mjs` and its `measure-*.json` (before on production, after on local and preview), `names-check.mts` (134 linked cards, 0 anchor/heading mismatches), `db-sample.mjs`, `review-result.json`, the gate and battery logs |
| `public.Lead` | 46 rows after the ML-005 purge; the 30 preview proof rows remain |
| ingress routes | **one**: `/api/leads/create` |
| Phase 0, 1, 2, ML-001 to ML-004 | **all merged** |
| `BRIEF_UNSUBSCRIBE_SECRET` | **set** in both environments and bound |
| `LEADS_DIGEST_TO` | **unset everywhere**, deliberately. The digest falls back to `ALERT_EMAIL_TO` |

## The shape that shipped

```
a form  →  postLeadDetailed()  →  POST /api/leads/create  →  ingestLead()
           src/lib/postLeadClient.ts                          src/lib/lead/ingest.ts
                                                                ├─ guards.ts    honeypot, origin, user agent, rate limit (inbox key, daily windows)
                                                                │               every write and send behind IngestDeps; test-lead-bot-gate.ts counts them
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

the rentals surfaces (ML-012)
  /rentals, /rent  →  RENTAL_CARD_SELECT (+ streetSlug, streetName)  →  stripVowFields → redactAddress
                   →  withRentalStreetPages()  src/lib/rentalStreetPage.ts   the published page or null; the street columns leave the row
                   →  RentalsClient  Listing.streetPage { slug, name } | null   the only /streets/ href on the page
  rentals.css      the muted ramp --t3/--t4/--t5: deep values at .rentals-page, light values on .listings-sec and .sdrop
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

## The rulings ML-012 made

- **A token has a ground.** The muted ramp's value is chosen by the surface it renders on, not by
  the rule that reads it; a light island redeclares the ramp, a rule never carries a hex.
- **A card links a street page only when the page exists**, resolved server-side against the
  sitemap's set; the client builds no URL from text. The canonical rule is the middleware's own
  (map, then identity), gated on the published set both ways, so it never links into a 301 or a 404.
- **The anchor text is the page's heading**, through `resolveStreetName` over the page's own
  fallback chain. The listing's `streetName` is feed noise and names streets that do not exist.

## Traps

- **Claude Code reaps a background build when the desk runs low on memory** ("the system is
  running low on memory"; 4.8 GB free of 15.9 with five sessions open). The gate then has to run
  detached from the tool shell (MC-035), and **not as a PowerShell process**: there `bash` on PATH
  is not Git's, and the `vercel-ignore` prebuild answers 99 on all twelve cases (exit 1 in 43 s).
  The form that works: `Start-Process` on `C:\Program Files\Git\usr\bin\bash.exe` with
  `-l -c "export PATH=/usr/bin:/mingw64/bin:$PATH; sh scratchpad/ml012/gate-build.sh <label>"`.
  It writes `scratchpad/ml012/gate-<label>.txt` (`exit N seconds S`); poll for the file.
  `scratchpad/ml012/run-start22.sh <port> <sha> <log>` starts `next start` the same way.
- **A CLI preview from this worktree fails the `vercel-ignore` prebuild gate unless
  `scripts/vercel-ignore.sh` is LF in the working copy.** `.gitattributes` is `text=auto` and
  `core.autocrlf` is true, so a checkout writes the script CRLF, the CLI uploads it as it is, and
  bash on Vercel's builder answers neither BUILD nor SKIP (exit 1 in 80 s, "FAIL: 3 of 5
  assertions"). The first ML-012 deploy, `miltonly-5mvsnjf2g`, died that way. Strip the CRs
  before deploying (Node: split on `String.fromCharCode(13)`; the tool mangles `\r` in sed and
  in `$'\r'`), check `git diff --quiet scripts/vercel-ignore.sh`, then deploy. The durable fix is
  `*.sh text eol=lf` in `.gitattributes`, Core's file.
- **A PowerShell `>` redirect writes UTF-16.** A `build.log` written that way is unreadable by
  grep; the Bash runner writes UTF-8.
- **The `Set` spread fails the build (`TS2802`)**: `tsconfig` targets below es2015 for iteration.
  `Array.from(new Set(...))`. `tsc --noEmit` catches it in 43 s; run it before the gate.
- **`Listing.streetName` is not a street name.** It is `extractStreetName(address)` from the
  sync and carries the unit and direction tokens. Seven call sites still feed it to
  `resolveStreetName` as the fallback (`src/app/streets/page.tsx:117` among them); on a registry
  slug the resolver ignores it, on an off-registry slug it becomes the heading.
- **The honeypot field is `company_website`** (`src/lib/lead/honeypot.ts`). A smoke test that
  guesses the name posts a REAL lead: on 2026-09-19 one did, wrote a development row and sent
  a confirmation to a stranger's Gmail alias. Read the constant; never guess it.
- **A proof batch from one IP now hits the daily window at 13 and the burst at 6 in ten
  minutes.** Space the rows or run the path with `IngestDeps` and an in-memory store, as the
  bot gate does.
- **Local battery:** `pnpm build`, then `next start` with `VERCEL_GIT_COMMIT_SHA=<sha>` on a
  port, then `BASE=http://localhost:<port>` and `EXPECT_SHA=<sha>`. `next start` reads
  `.env.local`, so the reads hit the real databases; `/api/build` needs the env var or the
  battery aborts at the gate. Stop the listener afterwards (`netstat -ano`, `Stop-Process`).
- **A fresh preview's Data Cache holds the published street set for an hour, and only
  production's writes revalidate it.** `POST /api/revalidate?secret=…` with `{"path":"/streets"}`
  on the preview, then re-run. Production was never wrong.
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
- **Run the ancestor check after the LAST fetch, not the first.** `origin/main` moved twice
  during ML-003; the first push built without them.
- **The digest slot guard refuses everything but Monday 07:00 Toronto.** A manual trigger needs
  `force=true`; `dryRun=true` computes and returns without sending and needs no force.
- **`LEADS_DIGEST_TO` overrides the recipient wherever it is set.** Set on Preview for a proof
  and delete it after.
- **`git commit-tree` DOES NOT MERGE — it snapshots.** Re-check
  `git merge-base --is-ancestor origin/main HEAD` after the last fetch and **STOP if it fails**;
  merge main into the branch first, then build from that tree.
- **`sold_date` is a date wearing a timestamptz. Read it on `win.dateStartUtc` /
  `win.dateEndExclusiveUtc`, never on `win.start` / `win.end`.**
- **The prebuild rate-limit test runs against the real Upstash store on Vercel.** The key
  carries per-run entropy (`f9b7ea5`). Do not reintroduce an exact "5 per window" claim.
- **The rate limit is real on preview and a REFUSED call still spends a token.** Wait a clear
  ten minutes with **zero** requests between proof batches.
- **Preview writes to production data.** Rows and watches are tagged and excluded from every
  count and every send, but they are real rows in the real table.
- **`LEAD_ALERTS_ON_PREVIEW=true`** (Preview only) makes preview leads raise a prefixed ops
  alert. It cannot make a row countable.
- **`CRON_SECRET` is in Preview**, which is what lets the brief be triggered there by hand.
  Vercel only schedules crons on production.
- **Vercel env vars bind at deploy time.** A new variable needs a redeploy.
- **`prisma migrate deploy` and the migration ledger are Core's.** The lead layer needs no
  migration, and neither does ML-012.
- **`DIRECT_DATABASE_URL` is `DATABASE_URL` with `-pooler` removed.** Every `NEON_*` variable
  points at the sold/analytics project. Read the host `prisma migrate status` prints, every time.
- **`scripts/migrate-*.ts` is gitignored** (`.gitignore:84`), the place for a throwaway script
  that needs `@prisma/client`. Read-only evidence scripts live under the task's `scratchpad/`
  folder as `.mjs` or `.mts` (top-level await needs the ESM extension under tsx).
- **The `name-prose` prebuild guard reads string literals**, not just page copy.
- **Reports:** `scratchpad/<task>/<TASK-ID>-<slug>.md` when the prompt names the folder (MC-043,
  ML-012), else `scratchpad/reports/<TASK-ID>-<slug>.md`; first line `# <TASK-ID>`, second the
  worktree prefix, tracked in git.

## What is open

1. **The accent override block in `rentals.css`** (lines 19 to 27) never wins a cascade
   contest; the hero's "Milton", the search and "Show results" buttons and the wizard's primary
   button render at 2.56:1. A design decision: turning them signal green changes a dozen
   elements. Measured in `scratchpad/ml012/measure-before-prod.json` (the `sweep` array).
2. **Four `#8a8f8a` literals at 4.32:1 on the navy** in the same file (`.new-this-week`,
   `.trust-row`, `.wiz-sub`, `.ra-subtitle`); sub-AA for 11 to 12 px text, visible.
3. **`.gitattributes` wants `*.sh text eol=lf`** next to its `*.sql` rule, so no Windows
   worktree ships a CRLF `scripts/vercel-ignore.sh` to Vercel again. Core's file, one line.
4. **Feed slugs the identity rule does not collapse** (`wise-crossing-n-a`,
   `mcdougall-cross-n-a`, `mcdougall-crossing-n-a`, `ontario-street-s-street`) leave a card with
   no link although a page exists for the street. The canonical map is the /streets pipeline's;
   an entry there would link them without touching this tier.
5. **`lead_daily_by_page` buckets by UTC day.** One-line fix, `AT TIME ZONE 'America/Toronto'`
   in a `CREATE OR REPLACE VIEW` migration; Core's ledger.
6. **The Sunday brief `PreFooterCTA` promises has no sender.** Either its copy becomes the daily
   brief and its source becomes `daily-brief` (homepage worktree owns the copy), or a weekly
   sender gets built.
7. **The brief cron is live on production.** Production brief watches are **0**, so each run
   sends nothing. The first real subscriber makes it real.
8. **Eight questionable `homepage-newsletter` rows** predate that surface having a honeypot.
9. **Nine preview watches** remain, tagged, so no cron reads them.
10. **`/api/seo/digest` (Core, behind `ORGANIC_LOOP_ENABLED`) sends with no footer and no
   unsubscribe.** `emailFooter` and a `digest`-kind watch through `digestWatchFor` would give it
   both in a few lines; it is Core's file.
11. **The rentals alert strip promises "SMS alert before it appears on any other site"** and
    the cron sends email, daily, about listings already on the site. This tier's copy.
12. **The portal door does not pass a User-Agent to its guards.** `checkUserAgent` exists; wiring
    it into `requestSignIn` is two lines in the portal tier.
13. Still open from report 062: **G10, the street-grain valuation figure on `/sell`**, and the
    MOD-58 lead admin columns with no UI.
