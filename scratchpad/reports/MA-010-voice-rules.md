# MA-010
AUDIT · D:\miltonly-audit · feat/audit

## MA-010: the two noisy rules narrowed, and what they were hiding

The code is `794ef5a` on `feat/audit`: `scripts/audit/nightly/checks.mjs`, the new standing test
`scripts/audit/nightly/test-voice-rules.mjs`, and one step in `.github/workflows/nightly-audit.yml`.
Evidence is in `scratchpad/ma010/`. Nothing was merged, the link-unpublished rule was not touched and
no rule was disabled. Production was read and never written.

## 1. The premise: 1,674, not ~1,800, and a third of them were real

| rule | open 2026-09-23 |
|---|---|
| em-dash | 1,368 |
| superlative | 306 |
| **the two together** | **1,674** (68.6% of 2,442) |
| the other six rules | 768 |

1,674 is 126 short of ~1,800 (7% under). That is close enough to go on, and I say so here as the brief
asked. **The bigger correction is that the 1,674 were not all noise.** I scored the old and the new
rules on the same bytes: every sitemap page (1,343), captured 2026-09-23. On those bytes:

- **About 1,125 were noise:** 794 em-dash findings (the A-Z "X—" and suppressed-value tiles) and 331
  superlative findings (ordinary "best").
- **576 were real:** 574 em-dash findings and 2 superlative claims.
- **One component hid most of the real ones.** 479 of the real em-dashes are a single sentence,
  `src/components/AgentContactSection.tsx:24`, which appears on every listing page. Each finding
  quoted the nav's "X—" first, so it looked like the same noise as the rest.

Full breakdown: `scratchpad/ma010/01-breakdown-2026-09-23.md`.

## 2. Em-dash: prose only

A dash now counts only when it punctuates running text, meaning there is content on each side of it.
The rule reads through the inline tags around the dash. These are **out of scope**:

- `nav` and `[role=navigation]` (the A-Z index, menu labels);
- breadcrumbs (`[class*=crumb]`, `[aria-label*=breadcrumb]`);
- `option` and ARIA control labels (`[role=option|combobox|listbox|menuitem|tab]`);
- `label`, `legend`, `th`;
- **value placeholders:** a lone "—", a unit or sign glued to the dash ("—/mo", "—%", "$—"), a dash in
  brackets, a dash opening its own chip or line;
- a dash separating a row of links.

**Kept in scope on purpose:**

- **Sentences inside a nav or a label.** Production's mega menu carries about forty sentences, and
  the home form's CASL consent sentence sits inside a `<label>`. A `<p>`, or an inline element of 8+
  words that writes the sentence itself, is kept.
- **Headings, cards, the `<title>` and the meta description.**

**Proof:**

- **An independent DOM implementation agrees.** I ran a DOM version of the same definition in
  Chrome, and it agrees with the rule on all 1,343 production pages (743 = 743 dashes).
- **Every counted dash is prose.** A red team read all 144 distinct contexts of the 743 by hand.
- **The fixtures pass:** 265 of 265 em-dash cases.
- **1,368 findings become 574.**

Selector list and reasons: `scratchpad/ma010/02-emdash-scope.md`.

## 3. Superlative: narrowed without going blind

**This is a compliance rule, so it fails closed.** The vocabulary is unchanged: the generator's own
`SUPERLATIVE_PHRASES`, and the test fails if the two lists drift. Every hit fires unless it sits in
one of six constructions that rank nothing:

- **proper:** a name, such as Best Road or Brian Best Park (read from `src/data`), a feed brokerage, or
  the Premier's office;
- **adverb:** "is best confirmed per listing";
- **fit:** "fits a buyer best";
- **source:** "the Ford market is your best guide to what you'd pay", the ~240-page street template;
- **question:** "Which Milton neighbourhood has the best schools?";
- **idiom:** "at best", "your best interest".

Each exemption is **void when the sentence names the registrant** (Aamir, we, our, RE/MAX, an agent
who is not a third party's). A construction the rule does not know fires, so a new benign idiom costs
one false positive and one fixture, never a missed claim.

**The proof the brief asked for: 10/10, and then 1,032/1,032.** The brief's own cases are in the test:

| the brief's case | result |
|---|---|
| "the best agent in Milton" | fires |
| "best value in Halton" | fires |
| "Best Rd", "Homes on Best Rd, Milton" | exempt, as a proper noun |
| "Best Road, Milton: homes, typical prices and recent sales" (the future street page) | exempt, as a proper noun |

The whole set:

| section | size | new rule | old rule |
|---|---|---|---|
| violations (must fire) | 333 | 333 | 252 |
| legitimate uses (must be exempt, for the named reason) | 339 | 339 | 107 silent |
| page cases | 88 | 88 | n/a |
| em-dash page cases | 254 | 254 | 150 |

**The old rule was blind as well as noisy.** It missed 81 of the violations, among them "The Best Agent
in Milton" and "Milton's Best Real Estate Team | Miltonly": its capital-letter test read any Title Case
claim as a proper noun.

**Four red-team rounds:**

- 2,433 attack candidates, each executed against the code;
- 999 mutants of `checks.mjs`;
- every claimed miss re-run by an independent skeptic before it counted.

Round 1 broke the first draft (its company-name and adverb rules were fail-open), and the rule was
redesigned. Round 4's realistic findings are fixed. Two of them matter most:

- **The future Best Road page:** its own aria-label ("Email for your Best Road valuation") would have
  fired every night.
- **Reader choices:** a choice left to the reader ("which streets suit your budget best") is now exempt
  even in a sentence that names Aamir.

413 executed kill fixtures from rounds 3 and 4 were re-run against the final rule and added. **The loop
did not run fully dry**, which a heuristic rule never will. The accepted limits are listed in
`scratchpad/ma010/03-superlative-rule.md`.

**New places the rule reads:**

- share cards (`og:`, `twitter:`);
- JSON-LD text the site writes, when it is not already on the page;
- image alt text and `aria-label`;
- the remarks of listings whose brokerage is RE/MAX Realty Specialists Inc. (item 2 below).

**Production:** 333 findings become 7.

**Nightly cost:** the sweep of all 1,343 pages took 59 s with the final rules, against 55 s with the
first draft, well inside the nightly's 285 s.

## 4. The true open count: 1,526

The full audit was re-run with the new rules: all 1,343 pages and all 396 off-sitemap links, with
Lighthouse and the 390 px sample, diffed against 2026-09-23. Output: `scratchpad/ma010/run/`.

| rule | 2026-09-23 nightly | full re-run |
|---|---|---|
| title-length | 488 | 488 |
| em-dash | 1,368 | **574** |
| link-unpublished | 47 | 170 (30 are S2 404s) |
| meta-length | 121 | 121 |
| font-under-12 | 104 | 112 |
| link-redirect | 5 | 50 |
| superlative | 306 | **7** |
| dead-anchor | 3 | 3 |
| sample-error | 0 | 1 (the 7 MB homepage timed out in local Chrome, a run-environment issue) |
| **open** | **2,442** | **1,526** (S2 30, S3 1,496) |

**Why it moved:**

- **The two rules account for 1,093 of the drop** (1,674 to 581).
- **The link rows grew for a different reason.** The nightly's link budget checks only the ~32
  most-linked targets. The re-run checked all 396 off-sitemap targets, which adds 168 findings,
  including every 404 below.
- **110 are carried over, not re-measured tonight:** 91 font findings (the sample reaches 40 pages a
  night, and 11 of these are stale) and 19 link targets.

**Most of the count is a few templates:**

- the bio sentence: 479;
- the listing title template: 478;
- the listing meta template: 64.

## 5. The top 10 the noise was hiding

Each was verified live on 2026-09-23 around 21:00 UTC, with its `file:line`. Full notes:
`scratchpad/ma010/04-buried-verification.json`.

1. **S1, compliance: the /about award captions** (`src/app/about/page.tsx:36-37, 43-44, 50-51`).
   - "Consistent top-tier production" sits beside the RE/MAX 100% Club Award, which is an annual
     threshold, not a ranking.
   - The sibling line "Highest career achievement recognition" labels the Hall of Fame, which is
     RE/MAX's entry-level career award, so the line is inaccurate. "Highest" is outside the rule's
     vocabulary.
   - No award gives a year or an issuer.
   - RECO Bulletin 5.1 asks for all three to be verifiable. Owner: Core.
2. **S2, compliance call: superlatives in own-brokerage listing remarks, on 4 live listings.**
   - The four lines:
     - W13798360: "One of the BEST DEALS in Milton!"
     - W13729522: "One Of Milton's Finest Mid-rise Condominiums"
     - W13802154: "unparalleled lifestyle"
     - W13744454: "One Of The Most Desirable Harrison Community"
   - All four are RE/MAX Realty Specialists Inc. listings, and the page says "Contact Aamir Yaqoob,
     RE/MAX Realty Specialists Inc., the listing brokerage".
   - The feed does not say which salesperson listed them.
   - The rule now reads these remarks. The old rule treated every remarks block as the seller's words.
   - **Aamir's decision:** whether own-brokerage remarks render verbatim.
3. **S2, compliance: an unsubstantiated "only" claim.**
   - Where it appears:
     - the home meta: "…Milton Ontario's only dedicated real estate platform";
     - the layout `OG_DESCRIPTION`: "the only real estate platform built exclusively for Milton
       Ontario", which reaches `twitter:description` on 537 pages;
     - `schema.ts:11`.
   - Sources: `config.ts:109`, `layout.tsx:15`, `schema.ts:11`.
   - "Only" is outside the vocabulary. The claim surfaced through the home page's meta-length finding.
   - Owner: Core.
4. **S2: street links from `/rentals` return 404.**
   - Measured:
     - `/rentals`: 29 of 47 card street links;
     - `/rent`: the same 29;
     - `?neighbourhood=timberlea`: 47 of 48;
     - 115 on the four views measured.
   - Cause: `RentalsClient.tsx:422-423` builds the slug from the address text, unit and all
     ("costigan-road-103", "yates-drive-1-bsmt").
   - Fix: select `streetSlug` in `rentals/page.tsx:29-36` and `rent/page.tsx:40-45`, and link the
     canonical published slug.
   - The nightly never checked these. Owner: Leads (Core as fallback).
5. **S2: the `/rentals` cards hide their specs.**
   - Beds, baths, parking and "/ month" are white on a white card, a contrast of 1.0:1. The cause is
     `aaff821` (2026-09-13), which moved `--t4` to a dark-surface value (`rentals.css:5, :272, :274`).
   - This surfaced inside the font-under-12 cluster. Owner: Leads.
6. **S2: `/listings` links a school page that 404s.**
   - `src/lib/listingsV2Data.ts:73` hardcodes `bishop-pf-reding-catholic-secondary-school`; the real
     slug is `bishop-pf-reding-catholic-ss` (`src/lib/schools.ts:60`).
   - It fires on every render. Owner: Core.
7. **S2/S3: the homepage's schema-only FAQ** (`src/lib/faqs.ts:10`).
   - "What are the best neighbourhoods in Milton Ontario?" is in the FAQPage JSON-LD but not on the
     page.
   - Its answer names "school catchments", catchment vocabulary that the catchment check never reads
     in JSON-LD.
   - It is new: this is the rule's first JSON-LD finding. Owner: Core.
8. **S3: the listing `<title>` template** (`src/app/listings/[mlsNumber]/page.tsx:115-123`, `:44`).
   - All 478 listing titles are longer than 65 characters, and the price comes last, so Google
     desktop cuts it on nearly every one.
   - 63 read "Milton Milton", 16 read "1051 - Walker", 11 read "0bd 0ba". Owner: Core.
9. **S3: raw feed slugs linked across the site.**
   - 53 internal hrefs pass through a 301 or 308: `/streets` 33, `/rentals` 16, 12 listing "Street
     Intelligence" cards, 10 "Similar streets" blocks.
   - The same cause puts misspelt duplicate cards on `/streets` (`src/app/streets/page.tsx:46-51, 116,
     160`). Owner: Core.
10. **S3: one sentence, 481 findings.** The agent bio's em-dash (`AgentContactSection.tsx:24`) makes
    up 31% of the open count. Owner: Home.
    - The same fix pass takes the 25 em-dashes in `<title>` and meta strings.
    - It also takes the condo cost notes (`condoData.ts:87`, `condo/sections.tsx:97, :189`).

**Also found, below the top ten:**

- `#leases` anchors with no target on the minimal street shell (`streets/[slug]/page.tsx:124-135`).
  3 pages today, and more as streets use that shell.
- Mosque titles read "ICNA Milton Milton" (`mosques/[slug]/page.tsx:36`).
- 20 school metas read "Milton, Milton Ontario".
- The `/compare/freehold-vs-condo` meta says "median".
- The stored prose on 12 of 14 hubs quotes generation-time figures beside newer tiles.
- `ListingDetailClient.tsx:438` drops ", Brokerage" from the brokerage name (a RECO descriptor
  question).
- `/book` is a 307 to `/about`, linked from 36 school pages. The audit's link check does not flag a
  307.
- The hub validators run no superlative check (`validateHubGeneration.ts:371-431`); Campbellville's
  "It is the best starting point" got through.
- `.pl-badge` uses #00ff80 on white (1.25:1) on 38 pages, and that colour is reserved for CTAs.

## Not done, and for Core

- **Merging costs a build.** A `.github/workflows/` change builds under the ignore rule, so take this
  in the next batch, not alone. The nightly runs the new test from `main` only after the merge.
- **The vocabulary is unchanged.** "Highest" and "only" (items 1 and 3), "#1", "top producer" and
  "leading" need a lockstep change to `SUPERLATIVE_PHRASES` and this rule. That is not done here.
- **The nightly's link budget left 29 live 404s unseen.** Checking more link targets is audit work,
  but it moves the link-unpublished counts that MC-042 used. It is held until Core says.
- **`sample-error` on `/`** came from the local run environment. The runner's history has none.

Report: scratchpad/ma010/MA-010-voice-rules.md
