# MC-047
CORE · D:\miltonly · main

**MC-047 is live. Production serves `467dc60` (`miltonly-9xwpg4454`).** The production battery is `PASS · 24 checks · 719 pages · 541s`. `core/mc047` was merged by SHA at `31827e9`. There was one preview, `miltonly-ooj4vkqti`.

## Commits, in order

- `dcd62ff` **Step 0:** `STREET_REGEN_ENABLED` now holds new pages too.
- `d532b1a` **CLAUDE.md:** the lane-push line.
- `40a47f7` **Branding and notices:**
  - the registrant strip in every header;
  - the footer lines;
  - the listing page's 8.24, 8.12 and 8.16 lines;
  - TREB-era wording removed;
  - guards.
- `5e57eca` **`/privacy`:** the bold PropTx sentence.
- `906996e` **`!data` head:** noindex, follow, with a test.
- `93ad3a8` **`listingsV2Data.ts:73`:** now `bishop-pf-reding-catholic-ss`.
- `ecd0979` **A6:** clearing a held reviewer emails their sign-in link.
- `2c773da` **A1, A2, A4, A5.**
- `31827e9` **Battery `nav` check:** it now measures the bar instead of assuming 66px.

## Findings and proofs on production

- **Item 10 and A1, the header.** "Aamir Yaqoob, Sales Representative" and "RE/MAX Realty Specialists Inc., Brokerage" appear in a strip above the bar, at 14px.
  - I measured it in a real browser: 41 page types at 360, 390, 800, 1024 and 1280 px, 205 views. There were 0 problems: the strip is present, 14px, not clipped, no sideways scroll, and no H1 under the nav.
  - The battery confirms it on 29 page types.
- **A1, the other items.**
  - Every footer leads with the Member.
  - `og:site_name` is "Miltonly · Aamir Yaqoob, Sales Representative".
  - The home title is "Milton Homes for Sale, Street by Street | Aamir Yaqoob".
  - These strings named Miltonly or a team as the party and now name Aamir: six condo CTA strings, the `/sold` valuation confirmation, the street page's "Ask the team", and three dead components.
- **Item 22.** The notice was already verbatim in `vowNotice.ts`. The paraphrases are gone:
  - the listing page's "Data provided by TREB…";
  - the footer's duplicate "deemed reliable" sentence.
- **Item 31.** The copyright line was not on Miltonly; it lived in homesly-vow. It is now in every footer, and the battery confirms this year's line on 29 types.
- **TREB-era wording.** It is gone from every string and JSX text under `src`: metas, source lines, badges, the home FAQ, and the hub and tenure labels. The battery finds 0 on 29 types.
- **8.24, 8.12 and 8.16 on `/listings/<mls>`.** Checked on production:
  - the 8.24 label names each added source;
  - the 8.12 line gives the phone and `hello@miltonly.com`;
  - the 8.16 line promises a correction within 48 hours.
  - ", Brokerage" is kept at the card line.
- **A2, `/terms`.**
  - It is public and titled "VOW Terms of Use".
  - The Member is the party.
  - It renders the stored clauses as version 6: clause (viii) now authorizes TRREB beside PropTx, and I also added TRREB to (ix).
  - **Every consumer owes a re-consent.** The battery's desk row re-consented through a real sign-in.
- **A4, square footage.** `Listing.sqft` is a midpoint computed from the MLS range.
  - Price per square foot is gone.
  - The midpoint sits under the 8.24 label. It is no longer in the listing's own fact line or meta, `floorSize`, the ad chips, the grid, condo or slider cards.
  - In the VOW facts, the price history is labelled as ours, and a time on market counted from the list date is starred.
- **A5.** `/privacy` opens in bold with the Appendix B(c)(ix) statement naming PropTx and TRREB. The sentence brief item 2 asked for is folded into it.
- **A6, the reviewer link.** I cleared a test held reviewer by clicking "Clear hold" on production `/admin/vow`.
  - The desk said the link was emailed, and the email arrived at gtahomequest+mc047reviewer@gmail.com.
  - Following the link landed on `/sold`, signed in as that reviewer. The token was consumed, and the row is deleted.
- **`CONTACT_EMAIL`** is set on Vercel Production.
  - A real sign-in on production returns `/api/auth/me` with `contact: hello@miltonly.com` and terms version 6.
  - The reviewer notice on `/terms` and `/signin` prints the address.
- **School link.** `/schools/bishop-pf-reding-catholic-ss` answers 200, and `/listings` no longer links the old slug.
- **The `!data` head.** The branch now returns noindex, follow, and a test holds it.
  - A no-data street still answers 404 through `notFound()`, and the served head is the not-found page's own noindex.
  - The branch's metadata is not what gets served, so the no-canonical path MC-050 feared was already non-indexable.
- **Freeze held.** Street heads (title, meta, canonical, og, twitter, H1) are byte-identical to production's before the deploy on the three streets checked.

## Anthropic API (report-only; the balance is -$0.50)

- **Two production paths reach Anthropic:** the hourly `/api/sync/generate` cron and the manual `/api/admin/force-regenerate`.
  - Both go through `callClaude` in `compliance.ts:494`, using `ANTHROPIC_API_KEY`.
  - The model is `claude-opus-4-7`, reached only through the `AI_PROVIDER_FALLBACK=opus` pass after DeepSeek fails 5 times.
- **On a 400:**
  - No retry.
  - `StreetGeneration` is marked failed and the queue row goes to failed with one more attempt.
  - The published content is untouched.
  - The cron returns 200; force-regenerate returns 500.
- **On main from `467dc60`,** the unset flag holds both build and regenerate, so the cron makes no Anthropic call.
- **Everything else is DeepSeek-only:** hubs, market-watch and geni.
- **A separate finding:** `/api/sync/generate` logs the first 10 characters of the key (`route.ts:28-29`).

## Open

- **MC-049's paused-rewrite checks,** after 2026-09-29 12:00 UTC and 2026-10-04 12:00 UTC.
- **The ads listing pages carry the notices and the strip, but not the 8.24 and 8.16 lines.**
- **The key-prefix log line.**

Report: scratchpad/reports/MC-047-reliability-notice.md
