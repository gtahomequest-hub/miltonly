# MA-003
AUDIT · D:\miltonly-audit · feat/audit

## MA-003: the nightly checks tightened, rerun against production

Four rules changed in `scripts/audit/nightly/checks.mjs`; nothing on a page was edited.

1. **Catchment words need context.** Every pattern fires only within twelve words of school,
   board, zone or catchment context, on either side of the match. The match itself supplies
   context when it names one ("school zone", "feeder school"), so the `/schools/*` titles still
   fire; "Zoned for residential dwellings" in a listing no longer does. The bare nouns
   "catchment" and "boundary" (S2) are never a finding in a sentence about the Town polygon or a
   distance: "Schools whose position falls inside the Town of Milton's boundary", "Schools inside
   the boundary", "measured boundary centre to boundary centre", "within 1.6 kilometres".
2. **The hub disclaimer is exempt.** Any match inside the sentence "a catchment is the school
   board's fact, and we do not publish one" is skipped.
3. **Remarks blocks.** An element with a `data-remarks` attribute is the listing agent's words. It
   leaves the body before the catchment, superlative and TREB checks (and the em-dash check, since
   what is left is our copy). It must carry the visible label "Listing agent's remarks" inside it
   or as the line just before it; otherwise the block is an S2 `remarks-unlabelled` finding.
   Production has no such block yet, so a listing page without one gets a single S3
   `remarks-unmarked` finding and its body keeps the third-party exemption it had (no em-dash or
   superlative check, catchment only in school context). Once Core ships the attribute, the rest of
   the listing page is our own copy and is checked in full.
4. **TREB strings on our own copy stay S2.** The listing fact strip's "Bungalow-Raised",
   "Sidesplit 3", "Backsplit 4" remain findings; the seller's "W/O" and "Sq Ft" do not.

**Rerun, 2026-09-13, second run of the date, no email** (the nightly sends one a night; this was a
rule change, not a night). The rotation swept the 452 pages not swept by the morning run, so the
state now covers 1,013 of 1,113 sitemap URLs. `scratchpad/audit/nightly/2026-09-13.md` and
`state.json` are this run and are what Core merges.

**Counts.** Open findings 3,572: **S1 32 · S2 16 · S3 3,524**. The morning baseline over 507 pages
was S1 32 · S2 38 · S3 1,955; the S3 rise is the wider sweep (1,016 findings on the 452 pages
first swept tonight, 107 of them `remarks-unmarked`), not a rule change.

| code | before | after | why |
|---|---|---|---|
| `catchment` S1 | 32 | 32 | the `/schools/*` title "Prices, Listings & School Zone Data" (29), `/schools` text and description, `/listings` "School zones" |
| `catchment` S2 | 28 | 2 | 26 fixed: the disclaimer and "Schools inside the boundary" on 13 hubs. Left: the schools guide's "The boundary data behind those decisions" (within twelve words of "boards") and one carried listing, cleared on its next sweep |
| `treb-string` S2 | 9 | 13 | four listings first swept tonight print "Bungalow-Raised" or "Backsplit" in the fact strip; none removed |
| `superlative` S3 | 29 | 58 | the wider sweep; no exemption applies until a `data-remarks` block exists |
| `remarks-unmarked` S3 | 0 | 107 | one per listing page swept tonight; disappears when MC-020 ships the attribute |
| `h1-multiple` S2 | 1 | 1 | `/rentals` |

The rest of S3: `em-dash` 1,722, `meta-length` 687, `title-length` 494, `dead-anchor` 378,
`font-under-12` 43, `link-unpublished` 31, `link-redirect` 4. Nothing 4xx or 5xx, no host leak,
no canonical mismatch, no JSON-LD parse failure, no overflow at 390. One Lighthouse move:
`bussel-crescent-milton` perf 74 to 63.

**A slow host tonight.** Production answered GET p50 3.2 s, p95 9.9 s (183 REVALIDATED, 267 MISS),
against 2.1 s this morning. The sweep yielded to the clock at 204 s with 55 pages unswept and the
sample stopped at 29 of 40; the run finished in 265 s of 285 with 543 fetches. The guards did what
they are for; on a slow night the cost is coverage, named in Run notes, not a failed run.

**For Core (MC-020).** Merge the `feat/audit` head, not `4a1e349`: MA-003 sits on top. `D:\miltonly`
main holds an unpushed local merge `8326b2a` of `4a1e349` from the interrupted MC-019, `pnpm build`
exit 0; merging the new head on top of it is fine, or reset it. Label the remarks block with
`data-remarks` and the visible text "Listing agent's remarks" so the 107 `remarks-unmarked`
findings turn into a clean check. Add the two Actions secrets and run the workflow once by hand.

Report: scratchpad/reports/MA-003-checks-tightened.md
