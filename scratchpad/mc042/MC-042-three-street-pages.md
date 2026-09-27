# MC-042

CORE · D:\miltonly · main

**The three pages were generated, published and verified, and then I took them back to draft.** All three passed every VOW assertion (73 of 73) and the full production battery (`PASS · 24 checks · 722 pages · 482s`). The audit's own runner then showed the three findings gone. After that, a claim-by-claim fabrication review found **invented detail served on all three pages**. Your constraint was "a thin real page or no page, never invented detail", so I used the codebase's own unpublish convention (058: `draft`, `publishedAt` null, `needsReview` true, a `reviewNotes` line) and purged the pages. **Production is where it was before the task:** the placeholder renders, the three are off the sitemap (719 streets), and the three link-unpublished findings are open again. **The decision is yours:** republish the three as generated (one UPDATE plus a purge, written in the header of `scratchpad/mc042/unpublish.mjs`), or fix the pipeline's grounding first (item 7). Production serves `bfb6e74` (MC-041). This task changed no app code, so no preview and no build.

1. **Registry and geometry: all three are real, and nothing was synthesised.**
   - `src/data/miltonStreetRegistry.ts`: `:360` GOWLAND CRESCENT, `:283` ENNISCLARE DRIVE, `:458` JEMPSON PATH (Jempson Common at `:457` is a separate street).
   - **Gowland:** Town centreline OBJECTID 1025, 20 vertices, 700 m, 71 address points.
   - **Ennisclare:** OBJECTID 1713, 26 vertices, 1,280 m dead end, 29 address points.
   - **Jempson:** OBJECTID 236, 4 vertices, 80 m, 18 address points.
   - Each centroid is the street's own Town centreline (`townRoadFacts.ts:444/337/538`). All three have `ResidentialStreet` rows, so they pass both halves of the entity floor.
   - **The premise needed one correction.** None of the three was a 404. Each returned 200 with `index, follow`, a self-canonical and the "No written profile yet" placeholder, and was missing from the sitemap. That is exactly the nightly's S3 wording.
2. **Generation, through the standing street runners.**
   - The "47 regenerated descriptions" were MC-038's condos (`regen-condo-local.ts`). The street equivalents carry the same discipline: DeepSeek primaries forced, fallback off, a spend cap, a fresh log.
   - Gowland already had an April draft row, so it went through `regen-058-local.ts`. Ennisclare and Jempson went through `create-street-pages-local.ts`.
   - **The runners could not load `.env.local` as written.** Their `loadEnvLocal` regex fails on CRLF lines, so it parsed 2 of 83 assignments and would have thrown "DEEPSEEK_API_KEY unset". I ran them with `npx tsx --env-file=.env.local`. No code changed; this is an open defect.
   - Dry run first (`PHASE41_HALT=true`, throwaway logs): no refusal, no skip, nothing written.
   - **Cost $0.0310**:
     - Gowland, first run: $0.0121, failed closed after 5 market attempts (superlative, bad JSON twice, an ungrounded "89 days"); the page was left untouched.
     - Gowland, second run: $0.0058, passed.
     - Ennisclare: $0.0059, 959 words.
     - Jempson: $0.0072, 931 words.
   - That total excludes the fair-housing judge's own cost and uses the cache-miss rate.
   - Every write was followed by a purge of the page, `/streets` and the hub (timberlea, nassagaweya, harrison).
3. **Production assertions: 73 of 73 PASS while published** (`scratchpad/mc042/assert-prod.mjs`, log beside it).
   - **VOW sentences:** the bona fide notice and "deemed reliable but is not guaranteed accurate by PropTx" appear verbatim at both sites, the records island and the footer.
   - **24-month window:**
     - `VOW_DISPLAY_MONTHS` is 24 in the app and in the battery; the cutoff is 2024-09-23.
     - The logged-out sold table has no rows, and every machine date on the page is on or after the cutoff.
     - Gowland's "7 sales in the last ~2 years" equals DB2's 24-month count.
     - The out-of-window records (Gowland's 2024-08-01 lease, Jempson's 2024-08-23 sale) appear nowhere.
     - Signed in, via the battery's cached cookie: records are 2, 1 and 1, all inside the window, the oldest 2026-07-02.
   - **Withheld addresses:** none of these streets has a withheld row in DB1 or DB2, so the direct check is vacuous. The inverse check (no listing link on the page points at a withheld row) passed on 13 links per page.
   - **Cap:** 1 inventory card per page; 2, 1 and 1 signed-in records, all ≤ 100.
4. **Link-unpublished re-run against production.**
   - I ran the audit's own runner uncapped into `scratchpad/mc042/nightly-rerun/` (`--no-email --budget=2000`, 1,794 fetches, 221 s). **The three were gone**: each was on the sitemap, so the rule no longer discovers it.
   - **Of this morning's 47 findings:** the 3 were gone, **25 remain**, and 19 were already on the sitemap and are only carried forward by an audit defect (D1).
   - Uncapped, the rule finds **118 S3 and 30 S2** in total.
   - After the revert, the light reproduction shows the three open again and **119 total, the same as the pre-task baseline**.
5. **Battery.**
   - `PASS · 24 checks · 722 pages · 482s` at `bfb6e74` with the three published. This is also the first complete battery on MC-041's build; its own battery log stops partway.
   - `PASS · 24 checks · 719 pages · 830s` at `bfb6e74` after the revert (`scratchpad/mc003/battery-mc042-prod-bfb6e74-final.log`). The homepage street figure equals the published count, and 0 pre-build streets answer MISS.
6. **The review and the revert.**
   - **Method:** 9 reviewers (3 lenses per page) traced 918 claims to `inputJson`. Every raised finding went to 3 skeptics told to refute it. 156 raised, 41 refuted, 115 upheld; they deduplicate to 69, of which **32 were visible on the live pages** (16 fabrication, 12 minor, 4 voice). 35 sit only in stored text the renderer never serves.
   - **Gowland:** "a mature pocket of **west** Milton" (its centreline sits about 1.6 km **east** of downtown). "The grocery and retail cluster along the main commercial corridors" (no such input). The short name "Gowland" used in prose.
   - **Ennisclare:** "well **north** of the town's built-up grid" (it lies about 15 km **west** and 6 km north of downtown). "Framed by open land rather than subdivision streets" (29 lotted addresses on a dead end).
   - **Jempson:** its hero line and JSON-LD say "a mix of townhouse rows and detached homes", while its own FAQ says townhouse "is the only housing type recorded here".
   - **All three:** an FAQ answer asserting "established / built out" with no build-era input.
   - **Evidence:** exactly what was served is in `served-<slug>.txt`; the full review is in `fabrication-review.md` and `fabrication-findings.json`. The generated prose stays in `StreetGeneration`.
7. **Why the pipeline lets this through, a hypothesis for the corpus that I did not measure.**
   - The validators ground numbers, and the page's render-time `stripNumericParagraphs` then cuts every numeric sentence.
   - So the served profile is **mostly the qualitative sentences, which no validator checks**. Gowland served 9 of its 57 stored sentences, Ennisclare 15 of 51, Jempson 11 of 45.
   - The FAQ bank also asks "new construction or established?" of every street, and the input carries no build-era data to answer it with.
   - The 719 live pages come from the same pipeline, so they very likely carry the same kind of claim.
   - **The fix is one of:**
     - a validator for compass, position, build-era and housing-mix claims against the Town and input data;
     - withdrawing the questions and sections that invite those claims.
8. **Found and not touched.**
   - `/rentals` links to **29 malformed street slugs** with unit numbers baked in (for example `/streets/costigan-road-103`), and all 29 return **404**. Google really does follow those.
   - **D1 (for Audit):** a finding whose target joins the sitemap is never re-checked and carries forward on every run.
   - **Template copy, pre-existing and site-wide:**
     - "your **best** guide" in the area-context card;
     - "Mosques, churches, gurdwaras" over a list of mosques only;
     - "Breakdown by bed count below" with no breakdown when the rent is suppressed.
   - **Jempson's meta description, while published,** was cut to "…in Milton's." by `fitDescription`.
   - **The battery's `vow-display`:** its §1 ladder regex (`data-n=`) is out of date, and §2 never measures a street page's inventory.
   - `StreetQueue` still shows Ennisclare and Jempson as failed/3; I left them as they are.
9. **Untouched, as instructed:** the other 24 backlog streets, `scripts/audit/`, and the audit rule set.
10. **What this commit contains:** `scratchpad/mc042/`, `HANDOFF.md` and `QUEUE.md`. It is a docs-only push, so Vercel skips it.

Report: scratchpad/mc042/MC-042-three-street-pages.md
