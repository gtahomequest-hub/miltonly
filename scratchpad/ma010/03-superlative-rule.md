# MA-010 step 3: the superlative rule, narrowed with care
AUDIT · D:\miltonly-audit · feat/audit

Code: `scripts/audit/nightly/checks.mjs`, the block `// MA-010. The superlative check`
(`superlativeExemption`, `properExempt`, `superlativeHits`), plus the readers in `pageFindings`.
Standing test: `scripts/audit/nightly/test-voice-rules.mjs`, run by the nightly workflow before it
fetches anything (`.github/workflows/nightly-audit.yml`, step "Voice rule fixtures").

## The design: fail closed

The vocabulary is unchanged: the eleven `SUPERLATIVE_PHRASES` of the street generator's validator, and
the test fails if the two lists drift. Every hit fires unless it sits in one of six constructions
that rank nothing. A construction the rule does not know **fires**. A new benign idiom therefore costs
one false positive and one fixture, never a missed claim.

| exemption | what it covers | never covers |
|---|---|---|
| proper | registered streets, parks and schools from `src/data` (Best Road, Best Rd, Brian Best Park), feed intersections ("Ferguson/Best"), slugs, companies ending in Inc./Ltd., feed brokerage attributions ("Listed by World Class Realty Point"), the Premier's office | "The Best Road in Milton", "Best Road for families", Title Case claims ("The Best Agent in Milton"), company-shaped claims ("Best Realty Team In Milton") |
| adverb | "best" + a verb of finding out: "is best confirmed per listing", "a building best understood through its lease record", "Best confirmed per listing" as a note | evaluative participles: "best placed", "best located", "best known", "best reviewed by residents" |
| fit | "fits a buyer best", "works best from here", "Best suits", "is best suited to" | "the home best suited to", "working hard for the best results", "Of all the listings, this one works best" |
| source | a data subject named as the place to look: "the Ford market is your best guide to what you'd pay" (street template, ~240 pages), "typically sell around $610K, the best guide to its value" (condo template) | the site's own products ("this street report", "the market watch", "these figures"), "Aamir's listings", "the best evidence of local expertise" |
| question | a choice the reader makes: "Which Milton neighbourhood has the best schools?", "Is a condo or a freehold best for a first-time buyer?" | "Why…", "What makes…", "the best value…", a question whose answer names the registrant, a site product or a pick ("This one: four beds") |
| idiom | "at best", "to the best of my knowledge", "your best interest", "best and final", "no single best", "the best of both worlds"; guarded: "it is best to confirm", "your best bet is to", "the best way to confirm", "a best estimate", "the top tier of the price range", "nothing comes close to the 2022 peak" | "the best interest rate", "at best value", "the best estimate in Milton", "the top tier of the market for finishes", "nothing comes close to that track record" |

The guard: adverb, fit, source, question and the guarded idioms are void when the sentence (or a
question's answer) names the registrant: Aamir, Yaqoob, Miltonly, RE/MAX, Realty Specialists, I, we,
our (not "Our Lady"), us, me, my, he, his, or a realtor, broker, brokerage, agent, specialist, expert,
advisor, representative, negotiator, producer, team or "someone who knows your street" that is not a
third party's ("the listing agent", "the buyer's agent", "the leasing team", "a mortgage broker").

## Where the rule now reads

The body (with tags as spaces, so "SpecialistBest-Reviewed" splits), the title and the meta, as
before; and, new: `og:` and `twitter:` titles, descriptions, image alt and site name; JSON-LD text
the site writes (descriptions, slogans, awards, job titles, headlines, review text, FAQ questions and
answers) when it is not already on the page; image alt text; `aria-label`; and **the remarks of a
listing whose brokerage is RE/MAX Realty Specialists Inc.**, which the page presents as the
registrant's brokerage's listing. Other listings' remarks stay the seller's words (MA-003).

## The proof the task asked for

**The fixture set scores 1,032 of 1,032** (`node scripts/audit/nightly/test-voice-rules.mjs`):

| section | cases | pass |
|---|---|---|
| violations (must fire) | 333: agent, brokerage, site, property; 2 from the brief, 142 red-team breaks, 161 mutant killers | 333/333 |
| legitimate uses (must be exempt, for the named reason) | 339: proper 105, idiom 77, adverb 68, question 46, source 24, fit 19 | 339/339 |
| whole pages (where the rule reads) | 88 | 88/88 |
| em-dash pages | 254 + 11 page-level checks | 265/265 |

The brief's own cases are in it: "the best agent in Milton" and "Best value in Halton" fire; "Best Rd",
"Homes on Best Rd, Milton" and "Best Road, Milton: homes, typical prices and recent sales" (the street
page the rule must not trip on its own name) are exempt as proper nouns.

**The old rule on the same fixtures:** 252 of 333 violations fire (81 real claims missed, among them
"The Best Agent in Milton" and "Milton's Best Real Estate Team | Miltonly", which its capital-letter
test passed as proper nouns), and only 107 of 339 legitimate uses stay silent.

**Production, same bytes:** 333 superlative findings become 7. The 331 that disappear are the street
template (≈240 pages) and condo, street and hub FAQ answers in the six exempt shapes. The final rule
exempts 208 distinct production contexts (adverb 166, proper 24, source 7, fit 5, idiom 4, question
2); in round 1, three reviewers read all 206 contexts the first draft exempted, of the same shapes,
and found no hidden claim.

## How it was tested: four red-team rounds

| round | attack candidates executed | mutants of checks.mjs | what it changed |
|---|---|---|---|
| 1 | 430 | 66 (29 killed) | the first draft's company-name rule and adverb wildcard were fail-open; redesigned |
| 2 | 538 | 244 (103 killed) | participles narrowed, guards widened, JSON-LD and share cards read |
| 3 | 359 | 262 (99 killed) | sentence bounds at "Inc."/"St.", role nouns, data idioms, condo template |
| 4 | 1,106 | 427 (189 killed) | the Best Road page's own aria-label, own-brokerage remarks, reader choices |
| total | 2,433 | 999 | every kill fixture the red team executed was re-run against the final rule; 413 more were added |

Each missed violation was re-executed by an independent skeptic before it counted. The loop did not
run fully dry, and a heuristic rule never will: round 4 still found edge phrasings, mostly low
realism. Its realistic findings are fixed and pinned; the remainder is listed below.

## Known limits (tested, accepted, fail-closed where possible)

- Fires on (false positives by design, one fixture each when they appear): "a Best Buy", "Milton's
  best-known landmark", "most desirable to buyers varies", "The figures we publish … are best read
  as directional" (the "we" guard), generic hiring advice naming a third party's role in a CTA.
- Not read: inline `<svg>` text, `<input>` values and placeholders, `title` tooltips, the keywords
  meta (ignored by search engines), a claim split across two sibling blocks.
- The vocabulary is the generator's eleven words. Live claims outside it, found by this task and
  reported, not fixed: "Highest career achievement recognition" (/about), "Milton Ontario's only
  dedicated real estate platform" (home meta, OG default on 537 pages, JSON-LD). Widening the list is
  a lockstep change to `SUPERLATIVE_PHRASES` and this rule.
