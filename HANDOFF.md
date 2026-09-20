CORE · D:\miltonly · main

# Handoff

_Last rewritten 2026-09-20 (MC-034 on `fix/cost-2 @ 6ba561e`, previewed and NOT merged): the street render's Listing rows narrow, memoised and Data-Cached under the `listings` tag with a write stamp; the ignore rule skips docs-only pushes from the last successful deployment; the integration Neon project is inspectionly.ca's and stays; suspend timeouts already 300 s. Preview `miltonly-jm3fj4ug7` battery `PASS · 21 checks · 646 pages · 802s`. `main` is `5bd57e1`, production serves `2510466`. Record `scratchpad/reports/MC-034-cost-fixes.md`._

## READ THIS FIRST

**`fix/cost-2 @ 6ba561e` IS PREVIEWED AND WAITS FOR THE MERGE (MC-034).** Three commits above
`5bd57e1`: `f1291a4` the work, `a4c6eb4` the review's two fixes, `6ba561e` the rule under
Vercel's 256-character `ignoreCommand` limit. Preview `miltonly-jm3fj4ug7` serves it; full
battery there `PASS · 21 checks · 646 pages · 802s`; local gate exit 0, 168/168, `neon-egress`
63. **What it does.** (1) `src/lib/street-data.ts`: `STREET_LISTING_SELECT` (fifteen columns, no
photos, no description, no VOW-only column; the card's image is `photos[1]` of the active rows in
one raw query), `getStreetPageData` under `perRequest` (React.cache, now exported from
`hubSets.ts`) and the rows through `dataCached` keyed `["street-listings:v1",
<count>:<max updatedAt>, ...siblingSlugs]`, revalidate 3600, tag `listings`
(`LISTING_ROWS_TAG` in `revalidateSurfaces.ts`, dropped by `revalidateListingSurfaces` after
every write by the three listing syncs, accepted by `/api/revalidate`). The stamp is in the key
because `unstable_cache` serves a tag-dropped entry stale while it refreshes; a write changes the
key. Measured on `main-street-milton`: production 4 full-row pulls a render (688 rows, 75 columns,
about 3.4 MB); the preview 2 narrow pulls (344 rows, 15 columns) plus 2 stamp rows and 2 photo
reads, and the next request within the hour 1 stamp row and no pull. The 4 pulls are the HTML and
RSC passes of one regeneration; `cache()` alone halves them, the Data Cache zeroes the rest. A
clean production window (21:34 to 21:44Z Sunday, nothing else on DB1): 16,118 calls, 95,159 rows,
the full-row pull 26 calls, 233 rows; **the after-window is measured on production after the
merge with `scratchpad/mc003/pgstat-window.mjs 600 mc034-after`, same hour.** (2)
`vercel.json`: `if [ "$VERCEL_GIT_COMMIT_REF" != main ]; then exit 0; fi; B=${VERCEL_GIT_PREVIOUS_SHA:-HEAD^}; git cat-file -e $B^{commit} || exit 1; git diff --quiet $B HEAD -- docs/phase-4.1 || exit 1; git diff --quiet $B HEAD -- . ':!scratchpad' ':!docs' ':!*.md'`,
proven on the real pushes (a merge under a docs commit builds; docs only and the nightly audit
skip; a missing base builds); `docs/phase-4.1/` always builds because the generators read those
prompt files at runtime; CLAUDE.md says the same. **After the merge, the first docs-only push
to `main` is the proof: `npx vercel ls --prod` shows it CANCELED in a few seconds.** (3) Item 2
was not done, correctly: the "unused" Neon project `lingering-sea-07597558` is inspectionly.ca's
production database (MC-016 and MC-033 were wrong to call it idle; its $15.66 a month is
inspectionly's line on the shared Vercel invoice); `suspend_timeout_seconds` 0 is Launch's 300 s
default on every endpoint and Launch allows nothing between that and never; 0 hours saved.
(4) Previews per worktree in the last 7 days and the one-preview-per-task rule are in the report;
skips cost $0. **Battery note:** with the Data Cache on the rows, a local `next start` battery
must drop the `db2`, `db3` and `listings` tags first (`purge-preview.mjs` pattern) or the on-disk
cache serves yesterday's rows. **Review notes left for a later task:** the street card prints
`address` regardless of `displayAddress` (pre-existing); `latitude`/`longitude` are 0/0 on every
row and `townLat`/`townLng` are the coordinates the rows carry; the generation twin in
`src/lib/ai/buildGeneratorInput.ts:168` still pulls full rows (cron-time, not per render); the
3,700 to 5,100 narrow rows the other street queries read per render are the next egress lever.
Record: `scratchpad/reports/MC-034-cost-fixes.md`; evidence in `scratchpad/mc034/` (untracked).

**MAIN IS `2510466` AND PRODUCTION SERVES `2510466`, ML-005 THE BOT GATE LIVE, ON NODE 22.**
`feat/leads @ 064c5b6` merged by SHA as `2510466` on `e5c7ca7`: the door's guard set on
`/api/leads/create` (honeypot, origin, a user-agent guard refusing a missing or quoted
`User-Agent` with 200 and nothing written or sent, the rate limit keyed on the collapsed inbox
with a daily window), every write and send behind `IngestDeps`, prebuild `test-lead-bot-gate.ts`
(100 bot submissions through the real path, 0 rows, 0 emails). Three resolutions in the merge
commit: `package.json` unions the prebuild line; `test-lead-forms.ts` excludes neither
`ListingsCardsClient` (gone since MC-029) nor `ListingDetailClient` (a real form with the
honeypot now); `ListingDetailClient.tsx` keeps MC-029's imports and takes ML-005's honeypot.
Gate exit 0, 168/168, `P2024` 0. Proven on production (`scratchpad/mc003/mc032-proof.mjs
bot|normal|delete`): a quoted UA answers `200 {"ok":true}` and writes no row, no activity, no
Resend send; a Chrome UA writes the row (`env production`), records two `email_sent` rows, and
Resend reports both the confirmation and the ops alert delivered; the row was then deleted.
Battery `PASS · 21 checks · 646 pages · 871s`. Record: `scratchpad/reports/MC-032-lead-bot-gate.md`.

**MC-033, THE COST CHECK (NO CODE), IN ONE PARAGRAPH.** Vercel's real billing period is the 3rd
07:00Z to the 3rd; team on-demand billed **$156.76 at day 17 against $41.37 for all of last
cycle**, Build CPU Minutes 87% of it ($154.20 usage; miltonly $81.86 for about 780 billed minutes
against $22.15 for 211; homesly $61.76). Infra fell from $12.91 a day to $4.15 a day after the
branch rule (`65e9c90`, 09-14), still 2.5x last cycle's daily rate: the residual is deploy count
(3.1 production a day, 9 of the last 25 docs-only; worktree CLI previews about $30 a cycle) at
$0.105 a Turbo minute, about $0.32 a production build. The 37 ignore-rule skips this cycle cost
nothing measurable. Projected cycle end: **about $210 on demand, about $260 invoiced**; the $200
budget is crossed about 09-30. **Neon egress is free on Launch (500 GB a project included) but
DB1 is 71.6 GB month-to-date against the 16 GB ceiling, projected 106 GB**, 3.29 GB a day since
MC-016 against 3.90 before (16% down, not the cut). Half of it is one statement: the unselected
full-row `Listing` `findMany` on every street render, twice a render (`generateMetadata` and the
page, no memo), about 4.9 KB a row on the wire (photos and description in TOAST), about 1.5 GB
a day; 80% of renders are standing traffic at `revalidate = 3600`, batteries a quarter. Neon's
bill is compute: 323 CU-h month-to-date across three computes awake 19 to 22.6 h a day (DB1 124,
DB2 103, **the integration project nothing reads 96**), about $34 now, about $53 at month end.
One battery in `pg_stat_statements` (MC-031's): DB1 +231,834 calls, +431,444 rows; DB2 +123,451,
+111,658; the window carried a local battery from another worktree and Neon's own monitoring;
the production run alone is about 0.08 to 0.14 GB. Evidence in `scratchpad/mc033/` (untracked).
Record: `scratchpad/reports/MC-033-cost-check.md`. The three levers it points at, none taken:
select columns on the street render's `Listing` pull (or memo it per request), suspend or delete
the integration Neon project, and fewer docs-only production builds (a docs path in the ignore
rule would need the CLAUDE.md sentence changed).

**MAIN IS `1a5a24d` AND PRODUCTION SERVES `1a5a24d`, MP-002b THE PASSWORD LIVE, ON NODE 22.**
`feat/portal @ 98d2cd7` merged by SHA as `c1caac8` on `e087209` (the 2026-09-20 nightly audit):
TRREB R-805(c), a username and a password per consumer. The email is the username; the card
asks for a password (12+, bcrypt cost 12) with the acknowledgement; `POST /api/auth/login` is the
returning sign-in with its own limiter and one 401 message for wrong, unknown and unset;
`src/lib/vow-access.ts` `canSeeVowRecords` (verified, acknowledged, password set) is the one rule
and the prebuild `test-portal-door.ts` reads ten files for the call. **Merge resolution, in the
merge commit:** MC-029's `/api/listings/[mlsNumber]/vow`, `/listings` and `/api/auth/saved-listings`
predate the rule and gated on a bare `vowAcknowledgedAt`; they now call `canSeeVowRecords`, so a
session that came in by link and closed the card sees no VOW field on the listing page or the
grid either. Full gate on Node 22 exit 0, 168/168, `P2024` 0, portal-door 126, vow-fields 67;
`prisma migrate status` 31, up to date (`20260918120000_portal_password` was applied from the
portal worktree). **The battery's signed-in half now uses the password** (`1a5a24d`): with
`VERIFY_PORTAL_PASSWORD` in `.env.local` (never the repo; the desk row's passphrase, set through
the live card on 2026-09-20) `vow-fields` POSTs `/api/auth/login`, no email and no signup limit
spent; without it, the code door as before. Proofs on production, iPhone UA at 390
(`scratchpad/mc003/mc031-proof.mjs card|login|row|reset-pw|delete-mc028`): an acknowledged row
with no password gets the password-only card inline on the street ("Choose a password to
finish", two password inputs, no name field) and 12 rows 1.6 s after saving; a returning sign-in
from a fresh browser with email and password lands on `/streets/farmstead-drive-milton#sold-records`
with 12 rows in 3.4 s. Purged tags and hubs, full production battery `PASS · 21 checks · 646
pages · 878s`. `User` holds one row (the `+mc028` test row deleted). **The neon HTTP driver reads
`timestamp` columns +4 h** (parsed as local); read them with `to_char` or trust Prisma. Record:
`scratchpad/reports/MC-031-portal-password.md`, with the four URLs and the one-line TRREB
sentence. The MC-030 and MC-029 paragraphs below stand.

**MAIN IS `c83fffb` AND PRODUCTION SERVES `c83fffb`, MC-029 LIVE, ON NODE 22.** Production
answered 200 again on 2026-09-19 evening (Vercel's pause lifted after about seven hours of 402),
`main` was pushed (`e606d8b..c83fffb`: the merge `5994cc7` of `fix/vow-compliance @ de199c2`
plus two docs commits), deployment `miltonly-82uy36xiw` built to Ready in 2m and `/api/build`
answers `c83fffb5c642143f08befa75c89d8790fef5a79c`. **The battery expects the served head, not
the merge SHA:** Vercel builds the pushed commit, so `EXPECT_SHA` is `c83fffb…` even though the
code is `5994cc7`'s. The `db2`/`db3` tags and the 22 hubs were purged through `/api/revalidate`
(a session-scratch `purge-prod.mjs` modelled on `scratchpad/mc003/purge.mjs`: tags first, then
every `/neighbourhoods/<slug>` in the sitemap), then the full battery ran: `FAIL · 21 checks ·
644 pages · 910s` (`scratchpad/mc003/battery-mc030-prod-c83fffb.log`) with seven failing lines
that are all one street, `dinsmore-drive-milton`, published by the creation cron at 02:01Z one
minute after the crawl read a 644-page sitemap (645 `StreetContent` rows by the end, 1259 of
1260 sitemap URLs read, Beaty's ladder 68 vs 67, the home and menu page counts 645 vs 644).
That is the creation-cron hour named below, isolated and pre-existing in kind; purged again
(tags, hubs, `/`, `/streets`) and rerun `--only=homepage,hub-page,hub-meta,catchment`: `PASS · 4
checks · 645 pages · 596s` (`-rerun.log`). The other 17 checks passed in the full run;
`vow-fields` 15 of 15 on production: 16 of 16 anonymous surfaces carry no VOW-only field, the
gated route answers no facts anonymously and the facts to the acknowledged session, the grid
cards and the listing page island render them for that session, 474 listing URLs checked against
DB1 with 0 off market or lacking `permAdvertise`, 5 of 5 surfaces measured with 0 brokerage
elements differing from their price. An independent curl of `/listings/W13800708` (MISS) carries
zero of the seven keys; its only "days on market" and "price history" text is the sign-in line
and the market edition's aggregate. **Do not start a battery at :00 local**: the creation cron
runs at :01Z every hour and a page published mid-crawl fails four checks by one street.
Record: `scratchpad/reports/MC-030-vow-to-production.md`. The MC-029 paragraphs below stand.

**HOW MC-029 REACHED MAIN (2026-09-19, UNDER THE PAUSE).** Vercel was paused for about seven
hours from the evening of 2026-09-18 (every deployment answered 402). On that basis the merge
was prepared and not pushed: `git merge --no-ff de199c2` (the branch head; code head `6c23bdc`)
landed as `5994cc7` on `e606d8b`. Gated locally: `pnpm build` on Node 22 exit 0, 168/168; then
`next start` on port 3100 (`scratchpad/mc003/run-start22.sh <port> <sha> <log>` sets
`VERCEL_GIT_COMMIT_SHA` so `/api/build` answers the SHA the battery expects) and the full battery
with `BASE=http://localhost:3100`: `FAIL · 21 checks · 626 pages · 749s` with four `hub-page`
drifts and nothing else, then `PASS · 2 checks` on `hub-page,hub-meta` after purging the db2/db3
tags, the 22 hubs and the street through `/api/revalidate` (the window-edge lie: gordon-krantz
has a sale dated 2025-09-18, and Harrison's stock share moved with the feed; no MC-029 file
touches a hub figure). `vow-fields` 15 of 15 locally. Before the pause, preview `czlzy3wc7`
served `6c23bdc` and the full battery passed there (`PASS · 21 checks · 609 pages · 769s`).
Record: `scratchpad/reports/MC-029-vow-compliance.md`, which carries the URL list for the TRREB
reply and reconciles the audit's checklist (`MA-006-vow-fields-addendum.md` on `feat/audit`,
every file:line) against the branch. The sitemap grew from 609 to 626 street pages overnight
and stands at 645 (the creation cron).

**WHAT MC-029 IS, IN ONE PARAGRAPH.** `src/lib/listings/vow.ts` names the seven VOW-only
columns (`daysOnMarket`, `listedAt`, `priorPrice`, `priceChangedAt`, `lastPriceChangeAt`,
`soldPrice`, `soldDate`), the public predicate (`permAdvertise` AND on the market: sale by
`status='active'`, lease by `leaseStatus='active'`, as `PUBLIC_SALE_WHERE`, `PUBLIC_LEASE_WHERE`,
`PUBLIC_LISTING_WHERE`, `isPublicListing`) and `stripVowFields`, which every page runs on a
Prisma row before `JSON.parse(JSON.stringify(...))` hands it to a client component (it also drops
`status` and `leaseStatus`, redundant on a public row). The listing page (ISR) never carries a
VOW column; `/api/listings/[mls]/vow` (force-dynamic, `getSession` + `vowAcknowledgedAt`) answers
them to an acknowledged session and `ListingVowFacts` renders them, with the sign-in line as the
server default and MP-002's card for a signed-in, unacknowledged person. `/listings` is
force-dynamic, reads the session on the server and passes `{ vow }` to `getListingsV2Data`, whose
`CARD_SELECT` names no VOW column; the VOW columns join the select only then and land under
`card.vow`. `/listings?status=sold` redirects to `/sold`; a sold, expired or leased listing page
answers the display-flag shell ("This listing is not available for display", noindex, the same
words for every reason). `/rentals`, `/rent`, `/rentals/ads`, the ad landing pages and the condo
page use the public predicates (they selected leased units before). The Buy menu's "Price
changes" panel keeps the count and shows the newest four homes, not the changed ones. The
listing brokerage renders through one component, `src/components/listings/ListingBrokerage.tsx`,
placed INSIDE the `[data-price]` element on every card and the detail page so it inherits the
price's face, size, weight and colour (TRREB item 27), and beside the price in the alert email.
Deleted: `/listings-v2-preview` and its mock fixtures (a public route rendering fabricated sold
cards), `ListingsCardsClient.tsx`, `ListingsGrid.tsx`, `street/ActiveInventory.tsx` (dead).

**THE BATTERY SIGNS IN THROUGH THE DOOR, AND THE DOOR HAS LIMITS.** `JWT_SECRET` is a sensitive
Vercel secret: `vercel env pull` writes `[SENSITIVE]`, so a minted token was never an option and
`.env.local` carries no `JWT_SECRET`. `vow-fields` POSTs `/api/auth/signup` for the most recently
acknowledged verified user in DB1 (`gtahomequest@gmail.com`), reads `verifyCode` off the row,
POSTs `/api/auth/verify`, keeps the cookie in the OS temp dir per host and checks it against
`/api/auth/me` before reuse. One real sign-in email reaches that inbox per fresh sign-in. The
limiter is shared by every lead form: three requests an hour per address, five per IP in ten
minutes; a 429 fails the check by name (it did once tonight, running production straight after
the preview). The Upstash keys are shared between preview and production.

**AGGREGATES LEFT AS THEY WERE, ON PURPOSE.** A street's typical days on market (k5, DB3), the
hub's and the homepage's days on market, the market edition's "after 88 days on market", the
menu's "N price changes in the last week" and "N listed in the last 24 hours", `/rentals` "N new
this week" (now counted on the server), `/api/street-stats` (k-floored DB1 averages, no caller),
`/api/listings/count`. The `/api/content/v1/*` routes still return `listedAt` per listing to the
bearer-token content engine; they are not public. The daily brief names streets with a closing,
never a listing.

**LEFT ON PRODUCTION BY THE PROOFS.** The desk's user `cmu66lk3y0000lhuz6ye554f3` has a fresh
`verifyCode` cleared by the verify, and three sign-in emails in its inbox (preview, production,
localhost). Nothing else. A `next start` battery signs in against localhost like any other host.

**BEFORE MC-029: MAIN WAS `7196623` AND PRODUCTION SERVES `895962b`** (MC-028's docs commit;
`e606d8b` is the nightly audit on top), `PASS · 20 checks · 609 pages · 713s`, ON NODE 22. The
MC-028 paragraphs below stand.

**MAIN IS `7196623` AND PRODUCTION SERVES `7196623`, `PASS · 20 checks · 609 pages · 713s`, ON
NODE 22.** MC-028 merged four commits by SHA, in order, each followed by the full local gate
(`pnpm build` on Node 22, exit code 0, 171 then 170 prerenders): `fix/favicon @ 9144b35` as
`ea81883` (the Miltonly icon set, the manifest on the site tokens, `logo.png`), `feat/street-v3 @
2553f2e` as `e078e91` (Street Page v3, MH-005: the hero capture field, the ladder with a house-number
box, the gate in the served HTML, 44px targets, the 12px floor), `feat/portal @ 86d5f9f` as
`706ce07` (Portal slice 1, MP-002: magic link and code, a guarded signup, the VOW card inline on
the street page, a 90-day ceiling; `prisma migrate status` clean at 30 migrations, the
`portal_door` migration already applied) and `feat/leads @ 7eeeb79` as `7196623` (ML-004: one
CASL footer on every recurring email, sender, brokerage, mailing address, why, and a signed
one-click unsubscribe with `List-Unsubscribe` headers; `consentText` on every surface; the alert
copy says "listed for sale" because `/api/alerts/match` reads new listings only). Confirmed on
production: `/favicon.ico` is byte-identical to `src/app/favicon.ico` (3,660 bytes, three sizes);
`/streets/main-street-milton` serves `<form class="s-capture" id="capture">` and the ladder's "Find
a house number" box (`5 to 6895`, 381 addresses); a sign-in requested from that street came back
with `redirect: /streets/main-street-milton#sold-records` on both the emailed link (`r=`) and the
code path, and the session then answered `needsAcknowledgement: true` on `sold-records`, which
is the inline VOW card; one forced brief send to `gtahomequest+mc028@gmail.com` (Resend
`01a0b291-c9e2-7233-8992-1bcebee4897c`) carried the footer, and its unsubscribe link disabled the
watch (a dry run then found 0 subscribers). Lighthouse mobile on main-street: **perf 90, SEO 100,
a11y 100, best-practices 79**, LCP 3.6 s, CLS 0, TBT 34 ms (MH-006 measured the street page at
perf 71, a11y 91, LCP 6.4 s, TBT 112 ms; the 79 is the Meta pixel's third-party `fr` cookie, older
than this batch). Record: `scratchpad/reports/MC-028-four-merges.md`.

**THREE MERGE RESOLUTIONS, ALL IN THE MERGE COMMITS.** `package.json` unions the prebuild line
(`test-hub-truth` then `test-portal-door`). `SoldRecordsIsland.tsx` keeps MH-005's gate-from-the-
first-byte (`gated = !canSee && !needsAck`) under MP-002's ack card. `AddressLadder.tsx` takes
Leads' "listed for sale", and `StreetCapture.tsx`, which Street v3 added after ML-004 branched,
was brought under ML-004's consent rule in the merge itself: `VALUATION_FINE_PRINT` or
`ALERT_FINE_PRINT` rendered under the field and sent as `consentText` (without it
`test-lead-forms.ts` fails the build by file). Home and Leads should pull `main` before their next
commit on those files.

**LEFT ON PRODUCTION BY THE PROOFS.** A verified, unacknowledged `User` row for
`gtahomequest+mc028@gmail.com` (the door proof) and a `daily-brief` lead for the same address whose
brief watch `cmu6ej7ua0002xa8boopmia3i` is disabled by the unsubscribe. Both are the desk's own
address; leave them or delete them, nothing reads them.

**BEFORE MC-028, MAIN WAS `56cf3ea` AND PRODUCTION SERVED IT, `PASS · 20 checks · 608 pages · 794s`, ON
NODE 22.** `56cf3ea` merges `fix/hub-truth @ b7183b4` (MC-027, app code `f415ae4`) on top of
`5ac650b`, the nightly audit's own commit for 2026-09-17, which is the proof the gate fix
works (MC-023): GitHub delivered the run late again and the first delivery of the Toronto day
ran. Local build exit 0, 171/171 (the 22 hubs prerender). After the merge: the `db2` and `db3`
tags and the 22 hub paths were purged and `/api/jobs/warm-hubs` walked the 22 in 67 s, so
production serves the regenerated prose (Timberlea reads "95 sales here in 12 months" under
its tile); `scripts/queue-mean-typical-streets.ts --write` queued **39** street pages whose
stored prose states the old mean typical, for the hourly cron; **Maple Avenue is Dempsey's**
(its centreline centroid sits in the Dempsey polygon, 73 % of its length too, and 26 of 35
sold records agree), applied to the registry and purged on both hubs and the street; the hub
checks rerun clean on production (`--only=hub-page,hub-meta`, 2 checks, 608 pages). Record:
`scratchpad/reports/MC-027-hub-truth.md` (the build) and `MC-027-merge.md` (the merge).

**WHAT MC-027 IS, IN ONE PARAGRAPH.** A hub's generation is drifted when
`calcHubDataHash(live input)` (typical to $10,000, sale count, days on market, active count)
differs from `HubGeneration.inputHash`; the page emits FAQPage only when current;
`/api/sync/regenerate-hubs` (12:45 UTC, three a run, DeepSeek only) regenerates the rest, and
all 22 were regenerated on 2026-09-17 for $0.109. The 22 hubs prerender at build and
`/api/jobs/warm-hubs` re-warms them after every sold and analytics job (11:12, 11:42, 12:12,
12:55 UTC): first-visitor TTFB p50 0.24 s prerendered against 2.9 to 5.6 s purged.
DEC-TYPICAL-MEDIAN: every typical is `PERCENTILE_CONT(0.5)`, K-gated, on the street page, the
AI inputs, the hub, the ladder (`medianOf` over pooled price arrays), the sibling cards, /sold
(no average tile, the hub named in the H1, 22 chips, the sign-in returns to the view) and the
battery's record; the "Typical is not average" guide keeps a real mean named as one. Bronte
Meadows is an urban hub. The street page's up-link is the registry row only
(`scripts/hub-membership-reconcile.ts` lists disagreements: three long roads with one or two
records each way remain listed, unchanged). Prebuild `scripts/test-hub-truth.ts`, 44 assertions.

**WATCH THE 39 QUEUED STREETS.** They regenerate on the hourly `/api/sync/generate` cron
(regenerations are uncapped); each lands with prose grounded on the median. If one fails closed
it sits in `StreetGenerationReview`, the same as any other. `scripts/queue-mean-typical-streets.ts`
without `--write` lists what still states a mean.

**THE OPEN LIST.** Search Console: submit `sitemap-index.xml` (human). The Vercel project's
Node setting still reads 20.x and is overridden by `engines` 22.x; set it to 22.x when
convenient. `15-side-road-side-road-milton` is a published page with no registry row.
`louis-st-laurent-avenue` and `lower-base-line-west` are published clips with no page. The
shared `AgentContactSection` prints amber on the listing page. `/sold` still carries 17
em-dashes outside the lines MC-027 touched. The first `npx vercel deploy` after a pause answers
"Not authorized" and the retry works; three times now.

**THE NIGHTLY AUDIT** runs on the first GitHub delivery of each Toronto day at or after 03:00
(four crons, 07 to 10 UTC; MC-023) and commits `audit(nightly): <date>` to main without a
human; `ignoreCommand` keeps that commit out of Vercel. **Pull before you branch or push.**
Secrets `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are repository Actions secrets. `gh` is not
installed; the Actions API answers with the machine's stored Git credential. **Vercel and
Windows gotchas:** `vercel ls` reports a preview `● Ready` a minute before the URL stops serving
a "Deployment is building" page; match rows on `vercel.app`, never a line number; find a
deployment by `/api/build` commit, never by position; every worktree previews with `npx vercel
deploy --yes`. A battery under the Bash tool dies at the 10-minute cap: run
`nohup sh scratchpad/mc003/run-battery.sh <sha> <base> <log> &` and poll the log for `^EXIT`.
A local `next start` holds Prisma's engine DLL and `prisma generate` then fails `EPERM`; stop it
with `Stop-Process` from PowerShell. The machine is shared. **The Bash tool collapses a doubled
backslash in a heredoc**: put a patch that carries backslashes in a file and run the file.
**`pnpm build` on Node 22 goes through Node 22's own corepack** (`"$N/node.exe"
"$N/node_modules/corepack/dist/pnpm.js" build`, `N=C:/Users/amazo/AppData/Local/nvm/v22.23.2`);
the `pnpm` shim on PATH runs the nvm4w Node 20. **A script that imports a module using
`React.cache`** runs under `tsx --require ./scripts/_server-only-shim.cjs`, which stands in for
it; never `--conditions=react-server`. **The battery lies for an hour at a window edge and after
a creation-cron hour** (00:01Z and every :01): read a FAIL against production first, purge the
`db2`/`db3` tags and the hub paths, rerun.


**THREE THINGS MC-017 HAD TO LEARN, ALL IN THE CODE COMMENTS.** (1) **Next 14 caches a dynamic
route only when `generateStaticParams` exists.** The first preview served every hub, condo, guide
and listing page MISS, `private, no-store`, exactly as before, with `revalidate` set and no
dynamic API in sight; an empty `generateStaticParams() { return []; }` on each page is what
turns the route ISR, and nothing prerenders. (2) **The Upstash client fetches `no-store`, and
under a static render that is a bailout Next records before the client throws**: `cached()` in
`src/lib/cache.ts` caught the error and the page lived, but the route's revalidate was already 0.
`cached()` now skips Redis when `staticGenerationAsyncStorage` says the render is static (the
store `unstable_noStore` reads); the route cache is the cache there, Redis keeps the dynamic
routes and the route handlers. That also removed the 60 `DYNAMIC_SERVER_USAGE` lines every build
printed. (3) **A page's effective revalidate is the smaller of its own and any fetch's**: the
Neon reads carry an hour (`src/lib/db.ts`, MC-010), so a page that reads DB2 or DB3 serves
`s-maxage=3600` and one that does not (a condo page, a 404) serves 86400. The hour stays: it is
what bounds the 12-month window's trailing edge (the battery lies for an hour, not a day).

**THE WRITE PATHS DROP WHAT THEY CHANGE.** `src/lib/revalidateSurfaces.ts`: the three listing syncs
(`/api/sync`, `/api/sync/detect`, `/api/sync/expire`) purge `/listings/[mlsNumber]`,
`/condos/[slug]`, `/neighbourhoods/[slug]` and the two indexes after a run that wrote rows; the
two hub generators and the condo generator purge their page and index after the upsert; the
three analytics jobs (`compute-sold-stats`, `compute-board`, `compute-geni`) drop the `db3` tag,
pulled forward from MC-015. The sold sync already dropped `db2`. `scripts/test-build-cost.ts`
(42 assertions) holds all of it in the prebuild.

**WHICH FIFTY STREETS.** `src/lib/streetPrerender.ts`: Search Console impressions (SeoOpportunity
holds 26 street pages, zero clicks), then active listings, then the slug. It only decides which
pages are warm at deploy; the other 459 render on first visit under the page's own hour and
serve from the cache after (checked: `aird-court-milton` MISS then HIT on the preview).

**CLAUDE.md REPORTING (MC-021).** A task ends with `scratchpad/reports/<TASK-ID>-<slug>.md` and a
reply whose last line is `Report: <path>`; nothing opens the editor.

**NEON EGRESS (MC-016, recon only, `scratchpad/reports/MC-016-neon-egress-recon.md`).** Neon's
per-day consumption endpoint is Scale-plan only (403); the month-to-date counters say DB1 46.4 GB,
DB2/DB3 1.8 GB, and they lag by hours, so the "101 GiB yesterday" console figure could not be
reconciled from the API. Measured instead with `pg_stat_statements`, **now enabled on DB1 and
DB2** (statistics only; `DROP EXTENSION pg_stat_statements` removes it): one full battery costs
≈ 0.15 GB, its own loaders 0.29 MB; the rows leave through the renders it triggers. The four
heavy readers, in order: `/streets` (`force-dynamic`, in-memory `distinct` pulls every Milton
listing, 3,414 rows a render, 57 renders in the window), `publishedStreetPageSlugs()` and the
`ResidentialStreet` floor (490 + 963 rows on nearly every render, 18 call sites), `/rentals`
(66,712 rows scanned a render, uncached), and the `Neighbourhood`/`HubContent` sets fetched 2,600
times a window. Proposals and a 16 GB/month ceiling are in the report. **No code was changed.**

**MC-015 IS ON PRODUCTION; see the top of this file.** Open: Search Console,
`louis-st-laurent-avenue` / `lower-base-line-west`.

**WHAT LANDED WITH CORE BATCH 3.** The board never the family; the judge cannot refuse on a
finding it labels not a violation; hub titles and descriptions have no em-dash and the LIVE
title serves (the stored one carried the old dash); `/rentals?neighbourhood=<hub>`; the overflow
page 301s and left the sitemap; parking and GO up-links from the guides' own hub rules, held by
the battery against the guides' down-links; `sources-fresh`, which will fire on 2026-11-28
(GTFS) and 2026-12-11 (parking pages) by design: refetch, then rebuild.

**WHAT LANDED WITH HUBS V2 (MH-004).** Glance claims derived or dropped; the ladder is every
published street at the street page's own k-gated typical (Timberlea: 22 rows = 22 published);
schools inside the Town polygon; the `hub-page` check.

**THE BATTERY LIES FOR AN HOUR AT A WINDOW EDGE, AND IT LIED ON PRODUCTION TONIGHT.** At 00:00Z
the 12-month window's trailing edge passed nine rows and `chretien-street` fell from five
sales to four while its page held the k5 figures; the homepage's neighbourhood typicals were
served from an entry a pre-tag build had computed from an untagged Data Cache reply. Production
and the rulings preview failed the same assertions at the same minute on code that had passed
an hour earlier, and the tagged Data Cache serves one stale reply past its expiry
(stale-while-revalidate), so "wait an hour" is not enough either. Read a FAIL after a window
edge or a sold-sync write against production first; if production fails the same lines, it is
the caches. `scratchpad/mc003/purge-street.ts <slug> <base…>` clears one street on both
caches and the path; after that the rulings preview passed 14/14.

**THE SOLD SYNC NOW PURGES BOTH CACHES ON MAIN.** Upstash (exact keys, per-street and
per-neighbourhood prefixes for what it wrote, a settle pass) and the `db2` Data Cache tag,
dropped by the sold route after a writing run. `/api/revalidate` takes `{ tag: "db2" | "db3" }`.
**The three analytics jobs drop `db3`** since MC-017 (`src/lib/revalidateSurfaces.ts`).

**THE JUDGE, NOW READABLE ON EVERY ROW (`StreetGeneration.judgeVerdict`).** Two things its
verdicts show for a ruling: "For Catholic families …" is how the model names the Catholic
board's schools and the judge reads it as `religion` (three round-1 refusals tonight, all
passed on round 2); and on `barclay-circle` it refused with a finding it labelled "amenity
fact, not a violation". `barclay-circle` and `gordon-krantz-avenue` are the two crossed
streets still on the suppressed sample.

**THE SEVEN CLIPS ARE LIVE, THE MANIFEST IS 173 ROWS / 49 PUBLISHED**, `bronte-street-south`
retired. Re-keyed clips live under `streets/<slug>/<YYYYMMDD>/`.

**THE CREATION PROGRAMME IS RUNNING.** 19 pages created 2026-09-11, the cap held; the 00:00Z
pass opened a new budget (481 pages on the sitemap by 00:20Z). 215 pending.

**THE FIGURES MOVE DAILY, SO DO NOT PIN THEM.** The battery asserts each against its own source.

**Every cost figure in every handoff before 2026-09-05 is wrong by 3x on the Opus portion.**

## Where things stand

| | |
|---|---|
| `main` | **`7196623`** (MC-028: the favicon set, Street Page v3, Portal slice 1, ML-004, on top of MC-027), production serves it |
| battery on production | **`PASS · 20 checks · 609 pages · 713s`** at `7196623`, 2026-09-18 |
| `prisma migrate status` | **clean**, 30 migrations (`20260917120000_portal_door` was already applied when merged) |
| waiting on merge | nothing |
| Node runtime | **`22.x` on production** (`engines`); the Vercel project setting still reads 20.x, overridden |
| creation programme | **running**, cap 20 per UTC day, DeepSeek first |
| `AI_PROVIDER_MARKET` | **deepseek** (Production, Preview); fallback opus, no credit |
| Neon | DB1 46.4 GB month-to-date, ≈ 0.15 GB per battery run; `pg_stat_statements` on DB1 and DB2 |
| nightly audit | **live**, 03:00 Toronto, run `34769017742` by hand 2026-09-13, first email `f97ac935…` |
| open tasks | watch the 39 queued streets land; Search Console for `sitemap-index.xml`; the Vercel Node setting; Portal slices MP-003 and MP-004 wait on a prompt |

## What happened 2026-09-10 (final) — three merges

Record in `scratchpad/reports/068-three-merges.md`.

**1. `5448b96`, the approved rent tile and hub anchors.** Cherry-picked as `1cf5342`, because a
merge reported "Already up to date". Battery `PASS · 11 checks · 449 pages · 109s`. `/rentals`
1,116 and the homepage agrees; `on-market` 457.

**2. `0a2499b`, feat/content.** Merged as `31a9ab0` after a `vercel.json` conflict resolved to
keep all three crons. Battery `PASS · 11 checks · 449 pages · 99s`. Content ran the held
2026-08-31 regeneration and reported back: every headline figure moved with the backfill, and new
listings held at 56 because they come from DB1's `listedAt`, which the backfill never touched.
That is the clean confirmation of the `CloseDate` diagnosis.

**3. `fix/core-batch`, head `dce1b70`.** `origin/main` merged in, four conflicts resolved, the TTL
added as its own commit rather than buried in the merge, two lead guards repointed. Preview
`miltonly-j6va7trjl` green, then merged as `8db80da`. Battery
`PASS · 11 checks · 449 pages · 97s`.

**Then the ledger.** Two wrong rows in `_prisma_migrations`, both fixed, status clean.

| `5448b96` | **cherry-picked** as `1cf5342` (a merge was a no-op) |
| `feat/content` `0a2499b` | **merged** as `31a9ab0`; Content notified, correction is live |
| `fix/core-batch` `dce1b70` | **merged** as `8db80da`; preview `miltonly-j6va7trjl` was green |
| `feat/homepage` | **unmerged**, intact, awaiting Home's hub work |
| crons | **17**, both market-watch entries kept |
| prebuild | **23 tests** |
| future-dated DB2 rows | **0** of 8,578 |
| creation programme | **paused**, 5 built, 249 rows `ineligible`, cap live at 20/day |
| published street pages | **450** |
| QUEUE | 1, 2, 3, 4 done; **7 DONE and merged**; 5, 6 not started |


## What happened 2026-09-10 (latest) — the revert, the sweep, and feat/leads

Record in `scratchpad/reports/067-revert-and-leads.md`.

**The sweep.** Redis purged first, then 487 figure-publishing paths revalidated in batches, all
200. Battery afterwards: every figure check green, drift zero. That answered the question the
sweep was for — the remaining red was never about figures.

**The revert.** `git log main --oneline -15` showed `c98f40e wip(hub)` sitting between the
approved `5448b96` and the merge commit. Reverted the merge whole. Battery went from
`FAIL · 11 checks` to `PASS · 10 checks` on that one commit.

**feat/leads.** Merged by SHA at `26381f9`. Build exit 0, zero `P2024`, 549 static pages.
Production Ready, `543ef99 served == expected`, battery `PASS · 10 checks · 449 pages · 70s`.

**The export.** `SUPERLATIVE_PHRASES` made public, one line, `114420a`.

## What happened 2026-09-10 (later) — the rulings

Four rulings executed. Record in `scratchpad/reports/066-rulings-and-merges.md`.

**1. The backfill.** `scripts/backfill-sold-date-not-future.ts`, dry-run by default, repairs
through `resolveSoldDate`. 255 rows, 0 undatable, re-run 0. It never invents a date and never
deletes a row it cannot date. Two new purge scripts followed it, in the order that matters.

**2. The 50-page run.** Halted at 23 by its own guard. 5 published. The blocker is a
prompt/validator disagreement over `differentPriorities` on thin-data inputs, not the runner.

**3. The cap.** Built, hourly-drain-aware, reported in the response.

**4. The merges.** `feat/homepage` in at `cec6906`. `fix/core-batch` held back on a red battery.

## What happened 2026-09-09 — QUEUE item 4, condo names

**The surfaces wired**, all from `condoName`: H1, title, meta description, breadcrumb,
JSON-LD `name` and `address`, OpenGraph and Twitter on **both** condo routes, the `/condos`
index, `/api/autocomplete`, `heroIndex` and the hub's condo list. Also
`buildCondoBuildingInput`, so the next generation writes the resolved name instead of
re-introducing what the backfill just removed — without that, this item undoes itself.

**A real `association_name` still wins the heading.** `condoName` governs the ADDRESS, which
is what those buildings fall back to, and it always computes the address form as well,
because JSON-LD `address` must be an address even when the heading is a name.

**`regional-road-25-milton` joined `OFF_REGISTRY_STREETS`** (ruling 1). It was the one
building in 65 that resolved to no name at all.

**Why the direction is not in `townAddressPoints.ts`.** That key is `${number}|${base}||${type}`
and has no direction slot. Widening a 1.4 MB ingest-only table with a row-count assertion five
things depend on, to carry a field 4% of its rows have, is the wrong trade. Re-run
`scripts/town/gen-address-directions.ts` if the Town layer is re-pulled; it fetches its own
filtered slice and refuses to write a partial table.

## What happened 2026-09-08 — QUEUE item 3, address anchors

`/streets/<slug>#<houseNumber>` on every published street the Town has address points
for. Read report 059 before touching any of it; the summary below is the shape, not the
detail.

**The sourcing is a build-time projection, not a render-time import.**
`src/data/townAddressPoints.ts` declares itself ingest-only and is 1.4 MB.
`scripts/town/gen-street-addresses.ts` consumes it and emits
`src/data/streetAddresses.ts` — 901 identities, 40,826 addresses, 3,048 placed cross
streets, 432 KB, and **no coordinate per house**. It parses the ingest module's packed
literal as text and asserts the row count against the constant that module exports, so a
re-pull that changes the table fails the generator instead of drifting. **Re-run the
generator whenever `townAddressPoints.ts` is re-pulled.**

**Position is walked per side, in house-number order.** A merged walk accumulates the
road width on every step, because consecutive numbers alternate across the roadway; on a
short street that inflates the total by more than the street is long. Walking by number
rather than projecting onto a straight axis is also what makes crescents, courts and
circles come out right.

**A cross-street tick is a nearest-pair estimate within 150 m**, not a surveyed
intersection. It links only where `StreetAdjacency` already holds the pair, because
every `connectedSlug` there is a published street; everything else is a label.

**What the section may carry stops at building form and live status.** Never, at any k:
a sold price, a sold date, an owner, a historical listing, or a per-address coordinate.
A single address is a population of one. The summary sentence is generated from the data
and never written by a model. The `ItemList` is `PostalAddress` and nothing else, with
no `offers` and no `price`.

**`scripts/test-address-anchors.ts` is the 18th prebuild test, 52 assertions.** It
renders the section and reads the ids back out of the markup rather than asserting that
a file imports something — the pattern open item 9 still wants applied to the name
guard, and it now counts mark tags against mark count so a wrapper cannot creep back in.
It runs under `tsconfig.jsx-test.json`, which exists only to set
`"jsx": "react-jsx"`; the app's tsconfig says `preserve` and under `tsx` that fails in a
component written for the automatic runtime.

**`scripts/verify/address-anchors.mjs`** is the deployed-host check. It strips React's
`<!-- -->` text separator before matching heading text, which is the one difference
between the served page and the local render the prebuild guard reads.

**`scripts/create-street-page.ts` is new.** `regen-058-local.ts` is a *re*generation
runner and skips any slug with no `StreetContent` row, which is exactly the case for a
street that has never been generated. The new script copies its provider discipline
verbatim and adds the entity floor as a refusal.

**Page weight, after the diet.** An address is ONE tag whose detail lives in a single
`data-d` attribute that CSS draws on interaction. `savoline-boulevard-milton`
(387 addresses) went 745 KB to **421 KB** raw and 42.1 KB to **37.2 KB** compressed.

**The 250 KB raw target is WITHDRAWN and the full `ItemList` stays. Decided 2026-09-09.**
The arithmetic is in report 059: the App Router inlines the RSC flight payload, so
everything is served twice, and the `ItemList` alone costs 184 KB against a 152 KB budget
— over budget before a single address element is drawn. Fitting 250 KB would have meant
cutting the list to about 40 of 387 addresses. After the 2026-09-09 changes savoline is
**437 KB raw and 38 KB compressed**, up 4% on the words and the CTA block. Compressed is
what a browser and a crawler actually pay.

**What landed 2026-09-09.** 34 px reserved at both ends of the spine so no end label is
clipped. Cross-street names moved to the right edge of their rule, in mono, truncated with
an ellipsis and carrying the full name in `title`, linked where the street has a published
page — and the summary sentence now links the same names on the same rule, which is what
`summaryNodes` is for. Position reads in words (`midway`, `near the Charles Street end`)
with the fraction kept on the end of `data-d` for the guard. The footer is the exact
sentence asked for, held verbatim by the guard and the deployed verifier. Two CTAs in the
page's own final-CTA card, no new colour: `/sell?street=<name>#valuation` and
`#street-alert`. **`DOT_GAP` went 7 to 14 px and is now the hit area of a quiet mark**, so
no two targets can overlap; measured on savoline, 387 marks, 331 labels suppressed,
minimum same-side gap exactly 14 px on both sides, zero below. Guard at 52 assertions.

**There is no VIP signup route in this codebase.** "Watch <Street>" points at
`#street-alert`, the live street alert already on the page. `/exclusive` is a listings page
with no form and `#vip` is a homepage strip of links. A distinct VIP list would be a new
surface and a new decision. Re-checked 2026-09-09 against the brief, which asked for a VIP
signup by name: **this is still the deviation, and it is deliberate.** The alert posts
`source: "street-alert"` with `property_address: <street name>`, so the street travels the
way a prefill would carry it. The owner CTA does prefill for real — `/sell?street=<name>`,
read by `HomeValuationCard` as the initial address value.

**Cross-street links verified against the published set, not just against the code.** On
pine-street the section draws 8 ticks; the 4 published ones link, the 4 that are not
(`maiden-lane`, `fulton-street`, `prince-street`, `bruce-street`) carry no link and are
absent from the sitemap, all 8 carry `title`, and the summary sentence links the same 4.

**`HomeValuationCard` now reads `?street=`** as the initial value of its address field. The
component is shared with `/sell`, the sold pages and `/value`, and the change is inert
without the parameter.

## Open items

1. **The Anthropic account has no credit, and it is the only path for three pages.**
   `bell-school-line-milton` was the new one this task tried. It passes
   `makeStreetDecision` and `getStreetStats`; the stale `NoCentroidError` on its queue
   row is cleared by the Town-centreline step in `resolveCentroid`. What fails is the
   eval half, on the jasper pattern exactly: `invalid_json_shape` plus
   `zero_price_faq_question` on all 5 attempts. Two active listings near $4M and zero
   sold in the window, so the zero-price rules fire correctly and DeepSeek will not hold
   them. $0.042 spent, nothing written, fail-closed. `jasper-street-milton` and
   `wood-close-milton` are the other two, and `wood-close` is a different fault: its
   `getStreetStats()` returns `No stats available` in one second, before a prompt exists.
2. **No two published pages share an address ladder. An earlier note here said they did
   and it was wrong.** That claim reasoned from the identity model rather than the data.
   Measured 2026-09-08 by `scripts/recon-directional-siblings.ts`: across 490
   `StreetContent` rows, exactly **one** identity key carries more than one row, and it is
   not directional — `jarrett-cross-milton` (unpublished, resolves through the fallback
   chain) and `jarrett-crossing-milton` (published, resolves through the registry) both sit
   on `jarrett||crossing`. **Groups where more than one row is published: 0.** The registry
   carries exactly two compass-word streets, `kennedy-circle-east-milton` and
   `kennedy-circle-west-milton`; neither has a page, they collide with each other on
   `kennedy-circle||` and NOT with the published `kennedy-circle-milton` (`kennedy||circle`),
   and `kennedy-circle||` has no Town address points at all. There is no Bronte North/South
   pair in the registry or in `StreetContent`. The exposure is future and it is a publish
   decision, not a render bug.
3. **Pre-2026-09-05 `costUsd` rows overstate Opus-assisted generations by 3x.** Not
   rewritable from what is stored. Treat historical cost claims as upper bounds.
4. **The DOM rule cannot read the neighbourhood's DOM.** `findUngroundedNumerics`
   compares a `days` token only against `input.aggregates.daysOnMarket`, never
   `neighbourhoodComparable.daysOnMarket`. 86 regenerated pages cite the neighbourhood
   figure correctly and would fire if the rule were widened. Fix the field before
   widening the scope.
5. **Grounding is still enforced on zero and thin only, dollars only.** Counts,
   percentages, days and quarter labels remain market-scoped on every tier.
6. **The two generation paths digest `inputHash` at different widths** (64 vs 12 chars),
   so `backfill-descriptions.ts`'s idempotency check can never match a row the cron
   wrote. The bulk path has been silently regenerating cron-written rows.
7. **`claude-haiku-4-5-20251001` carries a date suffix**; the current id is
   `claude-haiku-4-5`. Hygiene, not a fault. Production's `AI_PROVIDER_MARKET="haiku"`
   means the market half runs on it.
8. **Seven live clips carry `blur_verified: false`** (`chretien-street`,
   `clifford-point`, `frost-court`, `heaven-crescent`, `mulroney-heights`, `shade-lane`,
   `tasker-court`). Decision: verify or pull.
9. **Two orphaned clips** under slugs that are not real streets. GPS has been taken as
   far as it goes; someone has to watch the footage.
10. **`makeStreetDecision`'s minimum-data gate** — QUEUE item 7. Measured: 831 slugs
    carry DB2 records, 419 are skipped as low-data, 103 of those already have a page and
    316 have none. The brief's figure of 46 does not reproduce.
11. **The name guard's blind spot**: it asserts a file *imports* the resolver, not that
    every consumer uses the resolved value. `test-input-snapshot.ts` and now
    `test-address-anchors.ts` are the pattern for fixing it.
12. `burnhamthorpe-road-milton` and `louis-st-laurent-avenue-milton` are entity-real with
    no data behind them.
13. `heroSearch.ts` resolves 5 slugs to physically different streets; needs an ambiguity
    guard.
14. **CLOSED.** Condo H1s, titles, meta and stored name columns all render the full name, and
    52 of 55 prose bodies were regenerated clean. The 3 that remain are a fail-closed validator
    failure (`830-megson-terrace`) and two zero-data refusals (`158-mill-street`,
    `174-bronte-street`), not naming faults. `830-megson-terrace` is queued in
    `StreetGenerationReview` under `condo:830-megson-terrace-milton` if anyone wants it.
15. Stored `HubContent.metaDescription` drifts from live on 21 of 22 hubs.
16. Rent pill disagrees with the market card on `melville-bonus-crescent-milton` and
    `mcdougall-crossing-milton`.
17. `video.miltonly.com` still unattached. `r2.dev` is rate-limited and not intended for
    production traffic at volume.
18. Two draft rows carry a clip: `diefenbaker-street-milton`, `murlock-heights-milton`.
19. **11 slugs have R2 clips uploaded and no `StreetContent` row.** Generation candidates,
    blocked by open item 1 wherever DeepSeek cannot clear them.
20. **CLOSED.** The 255 future-dated DB2 rows are repaired; a re-run reports 0.
24. **`feat/homepage` still needs Home to finish the hub work.** `5448b96` is back on main by
    cherry-pick and its check passes against the `h-` markup. When the `hh-` rebuild returns, the
    two checks must land WITH it: `hub-intents.mjs`'s selector, `hub-meta.mjs`'s `heroStats()`,
    and `hub-meta`'s sub-k `silent` model rewritten around the degrade-to-a-count tile (moffat
    prints `3` / "sales in 12 months" where a k-clearing hub prints `$955K` / "typical sale
    price"). That last one is a k-anonymity change and needs its own review.
29. **CLOSED by revert (historical).** The two hub checks failed against markup from an unapproved WIP
    commit (`c98f40e`), not against a stale contract. `git revert -m 1 cec6906` restored green.
    When Home re-merges `feat/homepage`, `hub-intents.mjs` and `hub-meta`'s `heroStats()` must
    land WITH the `hh-` markup, and `hub-meta`'s sub-k `silent` model has to be rewritten around
    the degrade-to-a-count tile (moffat prints `3` / "sales in 12 months" where a k-clearing hub
    prints `$955K` / "typical sale price"). That rewrite is a k-anonymity change and needs its
    own review.
25. **CLOSED.** `buildMiltonWideContext` now carries a 5-minute TTL (`259a365`). Previously: and nothing in the serving path resets it.
    Three homepage figures go stale daily and are corrected only by a deploy.
26. **The creation programme is paused at 22%.** `differentPriorities` is offered by the prompt
    on inputs the validator refuses it on. 226 of 249 candidates unattempted.
27. **CLOSED. `fix/core-batch` is merged** as `8db80da`. Previously: Main has moved twice under it (a
    revert and a merge). Nothing is wrong with the branch; its baseline is simply stale.
28. **17 streets cleared k5 and 9 cleared k10** in the backfill and still publish the suppressed
    figure, because the numbers are in stored prose. A regeneration is the only way through.
28. **The DB1 branch of `makeStreetDecision` has no entity floor**, and `/api/sync/generate` has
    none at all. Only `scripts/create-street-page.ts` enforces publish floor = entity floor.

## Notes for the next run

- **A reverted merge's commits are still ancestors, so re-merging them is a silent no-op.**
  `git merge --no-ff 5448b96` printed "Already up to date" and did nothing. Cherry-pick reapplies
  them. Read the merge output before believing a merge happened.
- **The Prisma CLI reads `.env`, NOT `.env.local`.** This worktree has a gitignored `.env`
  carrying `DATABASE_URL` and `DIRECT_DATABASE_URL`, which is the only reason `migrate status`
  runs here. A worktree without one fails **P1012** before it opens a connection, because
  `schema.prisma` declares `directUrl = env("DIRECT_DATABASE_URL")`. Content's worktree hit
  exactly that and was pushed toward improvising a value.
- **`DIRECT_DATABASE_URL` is `DATABASE_URL` with `-pooler` removed from the host.** Same Neon
  endpoint, unpooled. It does not need to be fetched from Vercel and no credential needs to be
  passed around to reconstruct it. **Do not substitute `NEON_DATABASE_URL_UNPOOLED`** — that is
  DB2, it has no `_prisma_migrations` table at all, and Prisma will confidently report every
  migration unapplied about the wrong database. That is the same DB1/DB2 substitution that once
  created two empty tables in the sold database.

  **The danger is the shape of the wrongness, not the wrongness.** That misreading does not
  produce an error or an obviously silly answer. It produces a specific, plausible, actionable
  finding — "the ledger is out of sync, do not run migrate deploy" — which reads as diligence and
  survives review intact. The only question that catches it is *which host answered*. On
  2026-09-10 it did not get asked, so the finding was written into `HANDOFF-content.md` as an
  instruction, and that instruction then licensed a whole tier to route around the ledger with
  `prisma db execute` for weeks. **A wrong reading that is merely wrong gets corrected; one that
  is useful-looking gets institutionalised.** Ask which database answered before writing down
  anything a `_prisma_migrations` query told you. (Content's framing, taken verbatim in
  substance; theirs is the sequence, not just the misreading.)
- **Never route around the ledger with `prisma db execute`.** It runs the SQL and writes no row,
  so the migration is invisible to `migrate status` and the next `migrate deploy` tries to replay
  it against tables that already exist. `HANDOFF-content.md` recommended exactly this, on a false
  premise; withdrawn by Content at `6608b59`. Audited afterwards with
  `scripts/diag-migration-ledger-audit.ts`: 26 rows, 26 directories, 0 in progress, 0 drift,
  0 never-applied, and only **2** rows with zero applied steps — `0_init`, which is the expected
  baseline, and `20260910120000_market_edition`. **`savedsearch_env` and `phase1_lead_layer` were
  genuinely run.** Content's worry that other migrations went the same way does not materialise.
- **`prisma migrate status` is worth running after any merge that carries migrations.** Two rows
  were wrong on 2026-09-10 and neither broke a build, because Vercel runs `prisma generate`, not
  `migrate deploy`. `scripts/fix-migration-ledger.ts` clears a zero-step rolled-back row safely.
- **`git merge --no-ff <branch>` resolves the branch at the moment you type it.** If you were
  given a SHA, merge the SHA. `cec6906` shipped an unapproved 1,532-line hub rebuild because the
  tip had moved past the commit that was approved, and nothing in the merge output says so.
  `git log --oneline <approved-sha>..<branch>` before merging tells you in one line.
- `scripts/revalidate-figure-pages.ts` sweeps all 487 figure-publishing paths in batches.
- **Purge order after any DB2 write: Redis, then pages, then prose.**
  `scripts/purge-sold-caches.ts` then `scripts/purge-after-sold-backfill.ts`. Purging pages first
  just re-renders the stale numbers, which is exactly what happened on 2026-09-10.
- **`&&` short-circuits, and an `echo` after it does not.** A chain whose `python` step failed
  still printed "migration written" and the migration directory was never created. Verify the
  artifact, not the message.
- **Read the schema before adding to it.** `StreetContent.createdAt` was already there, twice
  over, and the ALTER failed with 42701.
- `scripts/create-street-pages-local.ts` CREATES pages; `regen-058-local.ts` REgenerates and
  silently skips any slug with no row. Pick by whether the row exists.
- **The battery takes the full 40-character SHA.** A short SHA fails the gate on a string
  compare and aborts before any content check. `EXPECT_SHA` overrides local HEAD, which
  is what you want when running it from a branch against a preview.
- `scripts/verify/address-anchors.mjs` takes `BASE` and checks four streets. Run it on
  any host that should be serving the ladder. The four anchor URLs it proves:
  `/streets/pine-street-milton#262`, `/streets/mae-court-milton#71`,
  `/streets/mcphail-way-milton#3165`, `/streets/bell-school-line-milton#7295`.
  The last has **no `StreetContent` row** and renders its ladder anyway — the address
  section reads the Town projection and does not depend on a generated row.
- `scripts/measure-address-380.ts` re-measures the 380px hit areas corpus-wide. Pure, no
  DB, no network at render time. Run it under `tsconfig.jsx-test.json` after any change to
  `DOT_GAP`, `END_PAD`, `LABEL_GAP` or `.s-m.s-q`. It reads
  `scratchpad/audit/060-slugs.txt`, which is the published set from the sitemap.
- **`tsconfig.json` type-checks `**/*.ts`**, excluding `node_modules`, `scripts/**`,
  `scratchpad/**` and `tmp-*`. `scratchpad/**` was added in `a6229a7` after a throwaway
  script there failed a Vercel build (`19883b7`, `TS2802`). **Runnable `.ts` still goes in
  `scripts/`** — the exclusion closes a deploy hazard, it does not make `scratchpad/` a
  second home for code. Anything outside those four exclusions compiles under the app's
  tsconfig, not the test one.
- **A local build started before a file is written does not cover that file.** The gate on
  `19883b7` was green and the deploy still failed, because the script was created while the
  build was running. Write first, then build.
- `scripts/regen-condo-local.ts` is the CONDO bulk runner. `REGEN_ORDER` is required, there is
  no default. It forces DeepSeek primaries, refuses to start if any primary knob names a Claude
  model, and sets `CONDO_ENABLED=true` for its own process only. Run it as
  `npx tsx --tsconfig tsconfig.test.json` — **not** with `NODE_OPTIONS=--conditions=react-server`,
  which makes React's shared-subset entry throw "not yet supported outside of experimental
  channels" before anything runs.
- `scripts/recon-condo-names.ts` reports condo naming state across all 65 buildings, including
  which resolve, which report a disagreement, and which carry a Town direction. Read only.
- `scripts/backfill-condo-names.ts` is **dry run by default**; `--write` to touch anything. It
  reports 10 before/after samples and proves its own idempotency after a write.
- `scripts/town/gen-address-directions.ts` regenerates `src/data/addressDirections.ts` from the
  Town layer. Re-run it whenever the Town address layer is re-pulled.
- `scripts/recon-address-anchors.ts` reports per-street ladder shape and corpus coverage.
- `scripts/create-street-page.ts` creates a page that does not exist; `regen-058-local.ts`
  regenerates one that does. Neither can run a Claude primary pass.
- `scripts/audit-corpus-grounding.ts` rebuilds inputs and reports false positives on
  comparator figures. Prefer `inputJson` on any row that has one.
- Whether the fallback fires at all is stochastic — the same page escalated on one run
  and passed on DeepSeek at attempt 2 on the next. A single-page A/B proves less than it
  looks.

## Next expected task

Whatever Aamir names. Open: the 39 queued streets; Portal slices MP-003 (the account) and MP-004 (the loop back) on
a prompt; the Node 24 runtime move before 2026-10-01; `barclay-circle` and `gordon-krantz-avenue` on a later pass.
