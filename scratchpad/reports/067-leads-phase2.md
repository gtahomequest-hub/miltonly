# 067 — Leads Phase 2: one ingress for every form, and the daily brief

**Worktree:** `D:\miltonly-leads` · **Branch:** `feat/leads`

_2026-09-10. Pushed for the preview gate at **`f9b7ea5`**, which sits on the merge `00caa57` of
`origin/main` (`73e94ea`) into the Phase 2 commits `e46ae49`, `39bcfe1` and `0a1d08b`. Not merged
to main; Core merges._

## What was asked, and what it turned into

The prompt listed sixteen surfaces across four items. The sweep found **twenty-one submission
points across nineteen files**, and two ingress routes the prompt did not name:

| | prompt | found |
|---|---|---|
| the second daily-brief writer | 1 | 1 |
| "the nine funnel surfaces on `/api/leads`" | 9 | **13** submission points in 11 files |
| the three homepage forms | 3 | 3 |
| `OffMarketForm` | 1 | 1 |
| not in the prompt | — | **`/api/exclusive-inquiry` + `InquiryForm`**, a fourth ingress |
| not in the prompt | — | `MortgageCalculator`, `ResultsClient` (listings v2) |

`/api/leads` (1,201 lines, four branches), `/api/off-market-leads` (73 lines) and
`/api/exclusive-inquiry` (96 lines) are **deleted**. Every form in `src/` reaches
`/api/leads/create` through `src/lib/postLeadClient.ts`, and `scripts/test-lead-forms.ts` walks
the tree at prebuild so the next new form cannot open a fifth path.

## The defects the migration found

Each of these was a real, live defect, not a tidiness item. They are the reason this took the
shape it did.

**1. `LeadCaptureForm` wrote TWO `Lead` rows per submission.** Its `PH3-DUALWRITE` block posted
the same visitor to `/api/leads/create` a second time. That was harmless while that route wrote
`ads.leads` — and became a duplicate the moment Phase 1 repointed it at `public.Lead`. Since
Phase 1 shipped, every submission through the paid-traffic hero form on `/sales/ads` and
`/rentals/ads` produced **two rows, two confirmation emails, two desk alerts and two CAPI events
with different `event_id`s** for one person filling in one form. The Pixel/CAPI `event_id`
pairing the dual write actually existed for survives; the second row does not.

**2. The ingest path dropped all six last-touch attribution fields and `firstVisitAt`.** The
client helper has always sent `utm_*_last`, `gclid_last` and `firstVisitAt`;
`src/lib/lead/ingest.ts` wrote none of them. Every lead Phase 1's path produced credited the
first ad click and lost the click that actually converted. Nine surfaces' worth.

**3. Phase 1 dropped the Twilio SMS to Aamir.** All four monolith branches sent it — a second
channel added in May after a Vercel-to-Resend outage swallowed leads. Phase 1's path sent the
desk an email and nothing else. Migrating the paid surfaces onto it without the SMS would have
removed that redundancy exactly where it was bought. It is back, on the same environment rule
the ops alert follows: a preview submission does not ring a real phone.

**4. `budgetToInt` read `"$2K–$2.5K"` as null.** So a rental-quiz lead stored **no budget** while
the realtor notification carried the token intact. The monolith kept four copies of every
form-to-column mapping and they had drifted. `src/lib/lead/fields.ts` is one set:
`normalizePhone`, `bedroomToInt`, `budgetToBand`, `propertyTypeFor`, `sanitizeText`,
`mlsNumberFor`. 24 assertions on it in the prebuild gate.

**5. The generic branch scored on a different scale from the other three.** 30 points for a
phone and 0 without one, where the paid branches used 25/50/75 — so a homepage lead and an ads
lead with identical contact details sorted differently in the same admin list.
`src/lib/lead/score.ts` states one rule and **reproduces every score the three paid branches
produced**: hot for a seller or a pre-approved buyer inside three months, warm on a phone, cold
on an email alone. Asserted case by case.

**6. Eight surfaces rendered a confirmation over a refused submission.** `RentalsClient`'s
`submitLead` returned `true` for a 429 and a 500 — only a thrown network error reached its
`catch` — so all five of its call sites showed their toast regardless. Same shape in
`ListingsCardsClient`, `ResultsClient` and `PreFooterCTA`, the last of which also checked only
`res.ok` against a route that answered **200 with `{success:true}` for a honeypot hit**, so a
bot got the same green tick a person did.

**7. `RentalsClient`'s "alert me when new matches list" sent a name and no contact field at
all.** The row it wrote was unreachable by every channel the site has. The quiz two screens
earlier had captured an email and a phone; those are now carried forward in state, and the price
band the quiz set becomes the watch's criterion.

**8. `OffMarketForm` and `InquiryForm` wrote `email: ""` rather than null**, with no honeypot, no
rate limit and no origin check, and `InquiryForm` sent the visitor **nothing at all** — a person
who typed their email into the off-market listing form got no acknowledgement of any kind.

**9. Five surfaces each kept their own copy of "read the six UTM params off the URL"**, each
seeing only the URL the visitor happened to land on last.
`src/components/AttributionCapture.tsx` has been in the root layout the whole time, persisting
first-touch and last-touch for the session. All five copies are gone.

## The rulings this required

**A phone-only lead is promised a call, and nothing by email.** `OffMarketForm` is the only
surface on the site that captures no address. Stated on the card, repeated in the confirmation
panel, and honoured by three deliberate absences: no confirmation email (no address to send
one to), no watch (a `SavedSearch` is an email channel and cannot reach a phone), and the desk
alert plus the Twilio message to Aamir as the actual delivery.

**`homepage-newsletter` leaves no watch, and its promise is still unkept.** `PreFooterCTA` says
"Aamir's Milton Market Brief — Sundays at 8am". The brief cron is Monday to Friday, so mapping
this source onto a `brief` watch would have mailed those subscribers five times a week having
promised them once. It is source-tagged, guarded and honeypotted, and it leaves no watch. **The
Sunday brief has no sender. That is an open promise, recorded rather than papered over.**

**The two rentals "alert me" surfaces make price-band watches.** `alert` and `new-match-alert`
promise "your current filters saved", and the band is the only criterion they capture. That is
the first use of the `price-band` kind, which `createWatchForLead` has supported since Phase 1
and nothing produced.

**A `brief` watch is keyed on the address alone.** Every other kind keys on its criteria. A
subscriber who signs up from two pages must get one brief, not two, so the street is stored (it
personalises the edition) and excluded from the idempotency lookup. The sender groups by email
as a second guard.

## The daily brief

`/api/brief/send`, cron `15 13 * * 1-5` — 9:15am ET, after `/api/sync/sold` (11:00 UTC) and
`compute-sold-stats` (11:30 UTC), so "yesterday" is not half-filled.

**The bar: read in under a minute, learn one true thing about your own street.** So it is three
or four number sentences and one named-street line. Nothing else. The real preview edition, in
full:

```
Milton yesterday · 2026-09-09

- 19 homes came to market, asking a typical $1,040,000.
- 1 home sold. Too few to publish a typical price.
- 6 listings changed price.

On Zuest Crescent: a home sold. <link to the street page>

Every figure is the same one Miltonly publishes: <link>
Unsubscribe: <signed link>
```

**The second line is the whole discipline in one sentence.** One sale is below `K_ANON_PRICE`,
so the count is published and the price is not, and the clause says which. Milton sells roughly
five to fifteen homes on a weekday, so that is a common edition, not a broken one.

**"Changed price", never "dropped".** `Listing.lastPriceChangeAt` records THAT a price changed
and never what it changed from, so a reduction cannot be told from an increase
(DEC-PRICE-CHANGE-NOT-DROP). The prebuild gate fails on the word "dropped" appearing in
`compose.ts`.

**Monday's edition covers the weekend.** Sending Monday to Friday and reporting a literal
"yesterday" would mean Saturday's activity was reported to nobody, ever: Sunday's edition does
not exist and Monday's would cover Sunday. The window reaches back two local days on a Monday
and the label says "over the weekend". The window is computed as UTC instants bounding whole
`America/Toronto` calendar days, so the SQL stays a range scan and the two clock-change days do
not shift the boundary by an hour. Asserted at the 2026-11-02 fall-back boundary.

**The personal line, in preference order:** an event on the street the signup named; then an
event in its neighbourhood; then the most notable event in Milton, named to its street and
preferring one with a published page. The third is the honest floor for a subscriber who only
ever gave an email address: still one named street and one real event, simply not theirs.

**It will not send:** twice to one address; on a day nothing changed (the signup promised "only
what changed"); the same edition twice (`lastAlertAt` is stamped and a stamped watch is
skipped); a commercial email it cannot sign an unsubscribe link for; or across environments.

**Unsubscribe is one click and signed.** HMAC-SHA256 of the watch id under
`BRIEF_UNSUBSCRIBE_SECRET` or `CRON_SECRET`, constant-time compared, `List-Unsubscribe` and
`List-Unsubscribe-Post: One-Click` headers set. A bare watch id in a URL would let anyone who
guesses one turn off somebody else's brief and a sequential scan turn off all of them. No
secret means no send: an unsigned link is not a weaker unsubscribe, it is none, and a commercial
email with a broken unsubscribe is the thing CASL prohibits.

## The gate

| | |
|---|---|
| local build | **exit 0**, zero `P2024`, **22/22 prebuild**, 549 static pages |
| prebuild, lead layer | `[lead-guards] PASS — 171 assertions` · `[lead-forms] PASS — 105 assertions` |
| battery on preview at `39bcfe1` | **`PASS · 10 checks · 449 pages · 67s`** |
| battery on preview at `f9b7ea5` | **`FAIL · 11 checks · 449 pages · 123s`** — see below |
| `origin/main` merged in | `73e94ea`, clean (twice; the second gained only `HANDOFF.md`) |

### The battery failure is pre-existing on main and is not the lead layer

The final preview fails **two assertions, both from the hub tier that landed on `main` between
the two merges**, and the battery is 11 checks now rather than 10 because that tier added
`scripts/verify/checks/hub-intents.mjs`:

```
[hub-meta]    hero stat tiles parsed on every hub: 0,  expected 22
[hub-intents] hubs rendering no intent squares:   22,  expected 0
```

**Production fails the identical two.** Run against `https://miltonly.com` with
`EXPECT_SHA=73e94ea…`, which is what main serves:
`FAIL · 11 checks · 449 pages · 94s`, same two assertions, same numbers. Main's own
`HANDOFF.md` records it as "the battery is down to two stale parsers". **Isolated,
pre-existing, and nothing in this branch touches a hub page, a hub parser or the stat tiles.**
Stated explicitly per the stop-on-failure rule, and the run continued.

### The lead layer re-confirmed on the final SHA

The two merges after the surface proof brought hub and homepage source changes, so one
end-to-end submission was run again against `miltonly-psc39y5bl` at `f9b7ea5`:

```
200  {"ok":true,"lead_id":"cmtvj5xtm0000bp8n9lgv0yrj","env":"preview",
      "diagnostics":{"confirmationEmailId":"0e6b5a87…","opsAlertId":"7651f84e…",
                     "watch":{"created":true,"id":"cmtvj5xxr…","kind":"brief"},"value":200}}
```

The brief then found that subscriber and composed its edition (`subscribers=1`, subject
`Milton brief: 1 sold, 19 new`, named street `Zuest Crescent`). **The watch was deleted. Brief
watches: 0.**

`scripts/test-lead-forms.ts` walks every file under `src/`, strips comments, and reads every
string literal handed to `fetch(`, every form `action=`, and any axios/XHR-shaped POST. A lead
ingress named anywhere but `src/lib/postLeadClient.ts` fails the build, the three retired routes
must be absent from disk, and each of the 24 known surfaces must import the helper, be
source-tagged, and send only `buy`/`sell`/`rent`. The vocabulary check reads **inside the
submission payload** by brace matching, because several surfaces pass a different `intent` to
gtag on purpose — the GA4 param is an analytics token and the row carries the economic bucket, and
a file-wide grep would have forced one of the two to be renamed to satisfy a test.

## Proof on preview

Preview `miltonly-1lw66pqlc` at `39bcfe1`, aliased `miltonly-git-feat-leads`. Rows tagged
`env=preview`, excluded from every count and every send.

### The daily brief

| | |
|---|---|
| dry run | 2 subscribers, subject `Milton brief: 1 sold, 19 new`, named street `Zuest Crescent` |
| figures | listed 19 / typical ask `$1,040,000`; sold 1 / typical **`null`** (below k5); changed 6 |
| send 1, street subscriber | Resend `a9fd6b36-3db6-4d85-b167-f2a9fbb2607f`, Gmail **`1a08b28224921c22`**, line "On Pine Street: a home came to market." |
| send 2, sold-street subscriber | Resend `639e5fee-234f-41f6-a937-1c6452f11db6`, Gmail **`1a08b3193141894c`**, line "On Zuest Crescent: a home sold." |
| second trigger, same edition | `sent=0 skipped=1 — "already sent this edition"` |
| unsubscribe, forged token | **400**, "That link did not work" |
| unsubscribe, signed token | **200**, "You are unsubscribed"; `alertEnabled` went `true → false` |
| subject prefix | `[preview] Milton brief: …` — preview editions say so |

**Reading the first send is what found the last two defects**, not a test. Its plain-text half
wrote `Milton yesterday — 2026-09-09` (an em-dash), and every link in it, the unsubscribe
included, pointed at `miltonly.com` — which *works*, because both deployments share one database
and one signing secret, and which means a preview test of the unsubscribe was exercising
production. Both fixed in `39bcfe1` and re-proven in send 2, whose links all point at the
preview host.

### The surfaces

One submission per migrated surface, with the exact payload the surface now sends. The per-IP
limit is 5 in 10 minutes, so this ran in spaced batches; the `429`s below are the limiter
working and are part of the proof.

| # | surface | source | intent → value | lead_id | watch | confirm / ops |
|---|---|---|---|---|---|---|
| 1 | `DailyBrief` (homepage) | `daily-brief` | buy → 200 | `cmtvgsx5b0000dp8f0j217cxp` | **brief `cmtvgsx9n…`** | `4c3c37f2…` / `6456d60d…` |
| 2 | `PreFooterCTA` | `homepage-newsletter` | buy → 200 | `cmtvgsxgp0002dp8fq5y4piux` | none, by ruling | `4bc855bf…` / `3206b12d…` |
| 3 | `PersonaRouter` (move-up) | `homepage-persona-move-up` | **sell → 500** | `cmtvgsxn30003dp8fyn0ym65j` | no email captured | — / `65033e0e…` |
| 4 | `SoldOnMyStreet` | `homepage-sold-on-my-street` | **sell → 500** | `cmtvgsxt50004dp8f3dqe938t` | not an alert surface | `b7db8801…` / `c1b09b9a…` |
| 5 | `MortgageCalculator` | `homepage-mortgage-calculator` | buy → 200 | `cmtvgsxz00005dp8f4k421spq` | not an alert surface | `59aaed77…` / `cc5299ab…` |
| 6 | `OffMarketForm` | `homepage-exclusive` | buy → 200 | `cmtvgwgwf0006dp8flx8jmvwh` | no email captured | — / `e2764505…` |
| 7 | `LeadCaptureForm` sales | `sales-rentals-featured-top` | buy → 200 | `cmtvgwh3o0007dp8f2e5glykf` | not an alert surface | `925aab99…` / `d77ad9e7…` |
| 8 | `LeadCaptureForm` rental | `ads-rentals-lp` | **rent → 50** | `cmtvh792d0000zh99zqtu7h2j` | not an alert surface | `86c78605…` / `12406b78…` |
| 9 | `UnlockModal` | `ads-rentals-lp-modal` | **rent → 50** | `cmtvh79ar0001zh99mwh4lc7o` | not an alert surface | `0572f6bb…` / `d6b0000b…` |
| 10 | `HomeValuationCard` | `sales-ads-home-valuation` | **sell → 500** | `cmtvh79qe0002zh99xzodqkc5` | not an alert surface | `b700c9ad…` / `848442fa…` |
| 11 | `MarketPulseUnlockCard` | `sales-ads-market-pulse-unlock` | buy → 200 | `cmtvh79z40003zh997hvgfz24` | not an alert surface | `6a66f5f6…` / `e218f211…` |
| 12 | `AamirTrustCard` | `sales-ads-trust-card-message` | buy → 200 | `cmtvhlnz60000uyyyk435xipq` | not an alert surface | `d3896f19…` / `30f6d29c…` |
| 13 | `ListingsCardsClient` / `ResultsClient` | `listing-card-book` | buy → 200 | `cmtvhlo7k0001uyyyerz9k4jl` | no email captured | — / `9d9fdbd5…` |
| 14 | `ListingDetailClient` | `sale-detail` | buy → 200 | `cmtvif3m1000010xn1mdk8k6t` | not an alert surface | `707921b9…` / `6fab98df…` |
| 15 | `ListingExtras` AudienceCTA | `seller-listing-page` | **sell → 500** | `cmtvif3tu000110xnhojpss4z` | not an alert surface | `a2a02daf…` / `4943cf62…` |
| 16 | `ListingExtras` RentalBooking | `rental-detail-book` | **rent → 50** | `cmtvif419000210xn2bmqxc2h` | not an alert surface | `99052938…` / `54af4cf7…` |
| 17 | `RentalsClient` alert strip | `alert` | **rent → 50** | `cmtvhzv6s0000fouxn18wtto3` | **price-band `cmtvhzvar…`** | `3f71e51b…` / `2acd4d7f…` |
| 18 | `RentalsClient` quiz | `rental-quiz` | **rent → 50** | `cmtvhzvi90002fouxrk4ldqws` | not an alert surface | `d0761788…` / `efd0a7f2…` |
| 19 | `InquiryForm` (off-market) | `exclusive-listing` | buy → 200 | `cmtvhzvoy0003fouxwin4756v` | not an alert surface | `a399a864…` / `ede6a2fe…` |
| 20 | **honeypot** | `daily-brief` + `company_website` | — | **`200`, no row** | — | none fired |

**Every value is non-zero.** Before Phase 1 all fourteen intent spellings these surfaces sent
scored 0 to Meta; the bolded ones are the tokens that used to. `sell` is 500, `buy` 200,
`rent` 50.

**Two watches were created and seventeen deliberately were not.** The brief watch (row 1) is
what the sender reads. The price-band watch (row 17) is the first the codebase has ever
produced. The rest say why in the response: `no email captured` for the two phone-only
surfaces, `not an alert surface` for the fourteen that promise a reply rather than recurring
email, and row 2 by the ruling above.

**The honeypot answered 200 with no `lead_id`, no watch and no emails** — a bot believes it
succeeded and learns nothing.

**Eleven `429`s were collected along the way**, in three separate runs, because the per-IP limit
is 5 in 10 minutes and a refused call still spends a token. The limiter is live on preview.

## What is left open

- **The Sunday brief `PreFooterCTA` promises has no sender.** Either its copy changes to the
  daily brief and its source becomes `daily-brief`, or a weekly sender is built. Its copy is the
  homepage worktree's.
- **`homepage-newsletter` has eight questionable pre-existing rows** from before it had a
  honeypot. Untouched here; they are still in the table.
- **Preview watches and preview proof rows are still in the shared database.** `Lead` by env:
  production 15, preview 20 plus this run's rows. Tagged, so excluded from counts and sends.
- **`prisma migrate deploy` is still blocked for everyone** —
  `20260910120000_market_edition` is in the repo and not in `_prisma_migrations`, while the
  table exists. Not this branch's to fix, and this branch needs no migration.
- **G10, the street-grain valuation figure on `/sell`**, and the MOD-58 lead admin columns with
  no UI. Both still open from report 062.
