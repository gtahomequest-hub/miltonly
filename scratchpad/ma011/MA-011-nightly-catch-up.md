# MA-011
AUDIT · D:\miltonly-audit · feat/audit

## MA-011: the nightly and the morning report catch up

**Merge `3c8add8` (feat/audit's last code commit) by SHA, in the next batch.** Main is merged in twice:
at `ac96e39` (`bf31f57`, which brought MC-045's CRLF loader) and at `e0bfc40` (`9488b44`, which brought
MC-049). The MA-011 commits sit on top, and the docs commit (this report, the handoff, the queue mark)
follows `3c8add8`. Nothing under `src/`, `prisma/` or `public/` changed. Everything is under
`scripts/audit/` except one step in `.github/workflows/nightly-audit.yml`. Files under `scripts/` build,
so the merge spends one production build.

- **Production:** read, never written.
- **Street pages:** no street title, meta, H1 or body changed.
- **Rules:** none disabled; link-unpublished and em-dash untouched.

Three calls you made mid-task, now in the code:

- **reliability-notice is deferred.** MC-047's report is not in the repo, on any branch or in any worktree.
- **The superlative lockstep is audit side only.** Added verbatim, the validator would hard-reject the
  stored prose of 543 of 722 published streets ("only" alone: 789 sections, such as "with only a handful
  of recorded transactions"), and `\b#1\b` can never match. `SUPERLATIVE_PHRASES` keeps the generator's
  eleven. The drift test holds the mirror exact and the audit list as the mirror plus the five
  (`scratchpad/ma011/lockstep-blast.txt`).
- **"only" closing the phrase it restricts is a free idiom.** Under the literal rule the CASL footer
  line ("Miltonly emails only, from Aamir Yaqoob (RE/MAX Realty Specialists Inc., Brokerage)") was
  1,356 findings, one per page.

## 1. Nightly checks

| check | what it asserts | production 2026-09-28 | on failure |
|---|---|---|---|
| banned-sentences | MC-045's 58 WRONG compass sentences are absent from their 56 pages, and MC-048's positive control is present on each | 0 of 58 found; controls 55 of 55 | S1, and the night fails (exit 5); a missing control is S2 |
| street-head | on every swept street page: the title is the MC-048 rung the ladder picks (and its name is the H1), 65 or fewer; the meta is one of the two shapes, 155 or fewer; no $, typical, median, sales count, en or em dash; og and twitter equal them | 719 of 719 pass on the day's capture (rungs 642/75/2, metas 717/2, as MC-048 reported); 197 of 197 on the final local run | S2 |
| www-twin | 20 date-seeded www paths answer 308 to the same apex path | 20 of 20 | S2, and the night fails (exit 5) |
| reliability-notice | deferred | | |

**Street-head covers the sitemap in four nights, not one.** It checks the street pages the sweep fetches.
All 719 every night would take 719 fetches against the 600-page budget, so each street page is checked
every 4 nights, in rotation.

**www-twin is enforced.** MC-049 is live: production is `9a563fd` (`miltonly-m25idhaan`, from
`npx vercel ls --prod`). So, per the brief, `3c8add8` sets `guards.json` `wwwTwinEnforced` to true, and
from tonight a miss fails the night. The night could not have told MC-049 had landed from www's
behaviour, because www already answered 308 before MC-049, so the switch is how it knows. Setting it to
false returns the check to S4, report-only.

**verify-strip.mjs is adopted.**

- The matcher moves to `nightly/strip.mjs`, and the CLI keeps its behaviour. On production, Core's
  original and the adopted CLI print identical output.
- The 58 sentences and 55 controls are frozen in `nightly/banned-sentences.json`, with the hashes of
  Core's two source files. The guard test re-derives the JSON and fails if Core's files change
  (`verify-strip.mjs --freeze` refreezes).
- **One gap closed:** Core's matcher stripped every tag before matching, so a sentence inside a meta
  tag's `content` was never seen, although its comment says it reads the meta tags. The adopted
  matcher reads meta contents too, which can only find more.

**Guard pages.** The 56 stripped pages are swept every night: 54 pinned, and 2 already in the fixed set.
MC-049 also paused the scheduled street-prose rewrite, which is what could bring a stripped sentence back.

## 2. Link budget

- **Links get their own budget:** 900 fetches, checked oldest check first, 16 at a time, cut at 80% of
  the clock. On the final local run all 350 off-sitemap targets were checked (386 fetches), with the
  links phase done 45 s into the run, so the cadence is **every night**. If the budget or clock cuts a
  night short, the rest rotate and the report states in how many nights every target is checked.
- **D1 is fixed.** A carried link finding resolves when its target joins the sitemap, or when every page
  that linked it was swept without linking it. The first night resolved **19**, the 19 MC-042 counted.

**Counts, for MC-042's comparison:**

| | 2026-09-23 nightly | 2026-09-28 nightly (runner, before MA-011) | 2026-09-28 MA-011 final run |
|---|---|---|---|
| targets checked | 32 most-linked of 399 | 32 of 353 | 350 of 350 |
| link-unpublished | 47 (19 of them D1-carried) | 50 (38 carried) | 121: 120 render but are unlisted (S3), 1 is a 404 (S2) |
| link-redirect | 5 | 6 | 34 |
| of which in the 32 most-linked | all | all | 18 (16 unpublished, 2 redirect) |

The 18 is the like-for-like figure against MC-042's numbers.

**Where the new rows come from:**

- 118 of the 120 unlisted-but-rendering street pages are linked from the `/streets` index.
- The one S2 is `/listings` linking `/schools/bishop-pf-reding-catholic-secondary-school`, MA-010's item 6,
  still live.
- The 29 `/rentals` 404s are gone (ML-012).

## 3. Superlative: only, highest, #1, top producer, leading

**The rule, audit side:**

- **"#1" and "top producer" fail closed.** They are exempt only as:
  - a number: a unit, lot, office or street address, a series, "the #1 bus";
  - a list label: "Offer #1", "Mistake #1", "#1: Get pre-approved", void when the sentence names us;
  - part of a company's name: "RE/MAX #1 Realty Inc.", "#1 Movers Ltd.".
- **"only", "leading" and "highest" fire in the claim sense only.**
  - The quantity and ordinary sense is exempt ("ordinary"). The exemption is void when the sentence
    names the registrant.
  - An unanchored ranking of a service, a person or an outlet is the site's own and fires, as do
    "leading the Milton market", ratings and comparisons among agents or sites.
  - A ranking is ordinary when it is anchored to:
    - another domain (transit, schools, EQAO, Walk Score, heritage, insurance, builders);
    - a named third party (TRREB, Zoocasa, the Town, Mattamy);
    - a third party's subject, apposition or possessor;
    - a colon or copula answer ("the only pricing guide is the neighbourhood figure");
    - a data head.
  - A ranking of anything else is ordinary. Unknown heads do not fail closed.
  - Customers ("Every listing gets"), site products ("The Street Report is") and pronouns are never
    third parties.
  - "only" needs a mark of uniqueness ("the only", "Milton's only", "only one", "only here"). Without
    one it is the restriction sense ("only licensed agents can").
- **The registrant guard now reads the words in front of each role word.**
  - "An insurance agent", "a Tarion representative", "the developer's sales agent" and "listing
    brokerages" are third parties, as MA-010's own definition says.
  - "Pros and cons", "World War I" and "the US" no longer name us.

**The fixtures:** `test-voice-rules.mjs` is at 2,566 assertions, from 1,032. That is 982 violations,
1,210 legitimate uses, 95 page cases, 265 em-dash cases and the drift test. The additions:

- the brief's cases for each word;
- stored street prose (the lockstep sentences);
- production lines;
- every red-team break an independent skeptic confirmed that the rule now gets right.

**Three red-team rounds.** Attackers executed each candidate against the rule, and an independent
skeptic confirmed each break.

| round | against | executed | confirmed breaks (missed claims, false positives) | now right |
|---|---|---|---|---|
| 1 | the first claim-sense rule | 1,576 | 285 (101, 184) | 284 of 285 |
| 2 | the reworked rule, aimed at its new machinery | 1,392 | 473 (245, 228) | 472 of 473 |
| 3 | the anchored rule, fresh attacks | 1,572 | 713 (277, 436) | 702 of 713 |

**Round 2 is where the design changed.** Classifying nouns leaked both ways. Anchoring to a third party's
domain did not: before any round-2 case was fixed, the anchored rule got 454 of the 473 right.

**Round 3 removed one default.** An unknown head failed closed, and that default was 263 of the round's
confirmed false positives ("With so few sales, the only pricing guide is the neighbourhood figure").
Round 3 also changed three narrower things:

- the domain anchors are scoped to the ranked phrase;
- copula answers count only in the main clause;
- "#1" takes open-vocabulary labels and company names.

Its cases the rule now gets right are fixtures: 268 violations and 433 legitimate uses.

**Production, same bytes (1,356 pages captured 2026-09-28), final rule: 4 findings before, 8 after.**

- **The 4 before:** own-brokerage listing remarks (MA-010 item 2, still waiting on your decision):
  - W13798360 "BEST DEALS";
  - W13729522 "Finest";
  - W13802154 "unparalleled";
  - W13744454 "Most Desirable".
- **The 4 new**, all "only" in its restriction sense, in a sentence naming us (by your rule):
  - `/listings`: "No spam · Aamir Yaqoob only emails matches".
  - `/condos/830-megson-terrace-milton`, `/condos/480-gordon-krantz-avenue-milton` and
    `/condos/610-farmstead-drive-milton`: "we only ever show whole-building proportions".
- **The five words on production:**
  - "only": 10,528 hits (6,085 closing idioms, 4,443 ordinary).
  - "leading": 26 are Century 21 Leading Edge Realty Inc. (proper), and 1 is ordinary ("at the leading
    edge of that story").
  - "highest": 28, all ordinary: "Highest sold" data labels, the lowest-to-highest range text, and
    rankings of a school and a place.
  - There are no "#1" or "top producer" hits.

**D1 is fixed** (section 2).

**One more fix on the way.** MA-010's own-brokerage test read the whole page. On every listing page, the
featured card ("Listed by RE/MAX Realty Specialists Inc., Brokerage", when the card is one of our
listings) therefore made every listing ours. That is the 61 remarks findings of 2026-09-26.

- The test now reads the listing's own "MLS® <number> · <brokerage>" line. That line matches exactly
  the 23 own-office listings today.
- The final local run fixed 46 of those findings.
- 13 are still carried, marked not re-swept, and clear as the rotation reaches them.

## 4. Morning report

**Web Analytics reads the Vercel Query API** (`/v1/query/web-analytics/visits/count` and `/aggregate`,
`since`/`until`, whole UTC days) with `VERCEL_API_TOKEN`.

**The local run (`--no-email`, 2026-09-28): exit 0, 41 s, 51 calls.**

- **Last 7 days** (2026-09-21 to 09-27): **109 visitors, 347 pageviews**. By day: 0, 15, 13, 28, 22, 16, 15.
- **Top 5 pages:** / 21 · /neighbourhoods/timberlea 10 · /streets/main-street-milton 10 ·
  /streets/sauve-street-milton 9 · /streets/woodward-avenue-milton 9.
- **Referrers:** direct 54, google.com 50, bing.com 5, chatgpt.com 1. chatgpt.com is the one AI
  referrer. bing.com is not counted as AI: the API groups by hostname, so Bing chat cannot be told from
  Bing search.
- **Cost per visit** divides by visitors now.

**GSC credentials:** it reads `GSC_SERVICE_ACCOUNT_KEY` or `GSC_SERVICE_ACCOUNT_JSON`, whichever is set,
or the key-file path.

**From ML-013:**

- **Production leads only.** Every lead, funnel and cost-per-lead figure reads `env = 'production'`, and
  the report names what it leaves out ("left out this month: 30 preview").
  - Month to date: 5 production leads.
  - 3 of the 5 were written today between 19:46 and 20:15 UTC: two rental bookings on
    /listings/W13832868 and one condo contact. They look like another session's form tests. Nothing
    was deleted.
- **The Money section shows the upcoming invoice first.**
  - The invoice, cycle to date: $186.24. That is every billed line with the Pro plan, after the included
    credit (`vercel usage` `totals.billedCost`), projected to $200.45.
  - Beside it, the spend-management figure the $300 cap counts: $185.28.
  - Cost per lead, invoice first: $42.15, or $41.96 on the spend-management figure, over 5 production
    leads in the cycle.
  - No REST endpoint gives an upcoming invoice (four tried, all 404). I could not check this figure
    against the dashboard.

## 5. Index coverage, once, report-only

**Method.** `scripts/audit/index-coverage.mjs` ran the URL Inspection API over the 719 sitemap street pages.
It took 1,250 s with 0 errors and used 721 of the 2,000 daily quota. Output:
`scratchpad/ma011/index-coverage.csv`, `.jsonl`, `-summary.json`.

| verdict | all 719 | the 484 with no impression (MC-048's baseline, 28 days to 09-26) |
|---|---|---|
| indexed | 241 | 9 |
| discovered, not indexed | 309 | 308 |
| crawled, not indexed | 6 | 4 |
| other | 163 | 163 |

**"Other" breaks down as:**

- 154 "URL is unknown to Google" (no sitemap or referrer in Google's record);
- 8 "duplicate without user-selected canonical";
- 1 redirect error.

The 484 zero-impression pages are almost all **never crawled**: 308 discovered and 154 unknown. Only 9
are indexed.

**For Core, S1: Google chose `https://www.747live.bet/`, a gambling site, as the canonical of 8 street
pages:** 14-side-road, bell-street, cedric-terrace, connaught-terrace, lobelia-crescent,
lower-base-line, rowe-terrace, whetham-heights.

- Crawled 2026-07-24 to 09-18, with no user-declared canonical at that crawl.
- Not investigated further here; this part is report-only.

**Also:**

- `bronte-street-milton` has a redirect error (last crawl 2026-06-13).
- 294 of the 455 referring URLs Google holds are the www twin.
- One referring URL is a `vercel.app` preview host.

## Proof

- **Tests:**
  - `node scripts/audit/nightly/test-voice-rules.mjs`: PASS, 2,566 assertions.
  - `node scripts/audit/nightly/test-nightly-checks.mjs`: PASS, 60 assertions (street-head,
    stripped sentences and controls, D1 and the link queue, the www verdict). The workflow runs it after
    the voice fixtures.
- **The full nightly, locally,** with the final rule against production `9a563fd`: `--no-email`,
  diffed against 2026-09-28's runner state, default budgets. Report: `scratchpad/ma011/run/2026-09-28.md`.
  - **Exit 0 in 136 s of the 285 s budget.** Phases ended at: sweep 30 s, links 45 s, sample 73 s,
    Lighthouse 136 s.
  - **Fetches:** 580 of 600 page fetches (507 swept), 386 of 900 link fetches, 20 www fetches.
  - **Guards:** banned 0 of 58, controls 55 of 55, street head 0 findings on 197 street pages, www 20 of
    20 (enforced).
  - **Open findings: 1,538.** S1 0, S2 1 (the school-slug 404), S3 1,537.
  - **New 136:** 118 link findings from the full link budget, 13 font-under-12 and the 4 "only".
  - **Fixed 66:** 46 page-wide remarks findings, 19 by D1 and 1 redirect.
  - **One of 12 Lighthouse runs failed locally.** `/` returned no scores. The failure is isolated and
    local: run alone twice it scored perf 87 and 89, SEO 100, and this morning's runner scored it 83.
- **The morning report, once:** exit 0 with the real numbers above
  (`scratchpad/ma011/morning/2026-09-28.md`), no email.

## Also found

- **Expect the em-dash count to fall over four nights, not one (MH-010).** Streets and listings rotate
  every four nights, and an unswept page carries its findings forward.
- **The `/streets` index links 118 street pages that render but are not on the sitemap.**
- **13 red-team cases the rule still gets wrong,** none of them on production today:
  - **Missed claims (9):**
    - "The highest sales volume of any office in Halton Region."
    - "Industry-leading exposure through HouseSigma, Zoocasa and realtor.ca."
    - "Milton's leading real estate sponsor of minor hockey."
    - "The only Mattamy resale specialist site for Milton."
    - "The only local real estate office with five-star reviews from Google, Facebook and HomeStars."
    - "Neighbours on every street have made this office the only one they recommend."
    - "The only bungalow on a 60 ft lot, and under $1M, in Coates."
    - "Why settle for anything less than #1."
    - "Presented by Halton Top Producer Group Inc."
  - **False positives (4):**
    - "Each property has only one listing office on the MLS system."
    - "The only group that meets on the street is the neighbourhood watch."
    - "Top Producer Realty Brokerage handled the sale."
    - "Top-Producing Homes Realty Ltd."

## For Core

- **Merge `3c8add8` by SHA in the next batch.** It spends one build.
- **When MC-047's report lands,** the reliability-notice check is the one part-1 item left.
- **The 747live.bet canonical** on 8 street pages, and the `/streets` index linking unlisted pages.

Report: scratchpad/reports/MA-011-nightly-catch-up.md
